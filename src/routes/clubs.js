const { Router } = require("express");
const createLimiter = require("../middleware/createLimiter");
const requireUser = require("../middleware/requireUser");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { ServerError, HTTPcodes, sendRouteError } = require("../util");
const clubs = require("../database/clubs");
const friends = require("../database/friends");
const { emitToUser } = require("../realtime");

const clubsRoutes = Router();

const MAX_NAME = 40;

const limiter = createLimiter({ limit: 30, message: "Easy there, dealer. Try again in a minute." });
clubsRoutes.use(...requireUser, limiter);

const notFound = () => new ServerError("ClubNotFound", "We couldn’t find that club", HTTPcodes.notFound);

// Loads the club and the caller's role: "owner", "member", "invited", "requested", or "visitor" (public clubs only)
async function loadClub(req) {
    const club = await clubs.getClub(req.params.id);
    if (!club) throw notFound();
    let role = null;
    if (club.owner_id === req.user.id) {
        role = "owner";
    } else {
        const membership = await clubs.getMembership(club.id, req.user.id);
        if (membership) role = { accepted: "member", pending: "invited", requested: "requested" }[membership.status];
        else if (club.is_public) role = "visitor";
    }
    if (!role) throw notFound();
    return { club, role };
}

function requireOwner(role) {
    if (role !== "owner") {
        throw new ServerError("Forbidden", "Only the club owner can do that", HTTPcodes.forbidden);
    }
}

const shapeUser = row => ({ username: row.username, avatarUrl: row.avatar_url || null });

const shapeClub = row => ({ id: row.id, name: row.name, owner: row.owner, isOwner: row.is_owner, memberCount: row.member_count });

clubsRoutes.get("/", async (req, res) => {
    try {
        const rows = await clubs.listForUser(req.user.id);
        return res.status(200).json({
            clubs: rows.filter(r => r.status === "accepted").map(shapeClub),
            invites: rows.filter(r => r.status === "pending").map(shapeClub),
            requested: rows.filter(r => r.status === "requested").map(shapeClub),
            requestsToReview: rows.reduce((sum, r) => sum + r.request_count, 0)
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Only public clubs are ever searchable
clubsRoutes.get("/search", async (req, res) => {
    try {
        const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
        if (q.length < 2 || q.length > MAX_NAME) {
            throw new ServerError("InvalidQuery", "Type at least 2 characters to search", HTTPcodes.badRequest);
        }
        const rows = await clubs.searchPublic(q);
        return res.status(200).json({ clubs: rows.map(shapeClub) });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

clubsRoutes.post("/", requireVerifiedEmail, async (req, res) => {
    try {
        const name = typeof req.body?.name === "string" ? req.body.name.trim().replace(/\s+/g, " ") : "";
        if (!name || name.length > MAX_NAME) {
            throw new ServerError("InvalidName", `Club names need 1 to ${MAX_NAME} characters`, HTTPcodes.badRequest);
        }
        if (await clubs.countOwnedClubs(req.user.id) >= clubs.MAX_OWNED_CLUBS) {
            throw new ServerError("TooManyClubs", `You can own up to ${clubs.MAX_OWNED_CLUBS} clubs`, HTTPcodes.conflict);
        }
        const club = await clubs.createClub(req.user.id, name);
        return res.status(201).json({ club: { id: club.id, name: club.name } });
    } catch (error) {
        if (error?.code === "23505") {
            return res.status(HTTPcodes.conflict).json({ error: "NameTaken", message: "Another club already has that name" });
        }
        return sendRouteError(res, error);
    }
});

clubsRoutes.get("/:id", async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        const body = {
            id: club.id,
            name: club.name,
            isPublic: club.is_public,
            owner: shapeUser({ username: club.owner, avatar_url: club.owner_avatar_url }),
            role
        };
        if (role === "owner" || role === "member") {
            const rows = await clubs.listMembers(club.id);
            body.members = rows.filter(r => r.status === "accepted").map(shapeUser);
            if (role === "owner") {
                body.invited = rows.filter(r => r.status === "pending").map(shapeUser);
                body.requests = rows.filter(r => r.status === "requested").map(shapeUser);
            }
        }
        return res.status(200).json({ club: body });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Owner-only: make the club public or private
clubsRoutes.patch("/:id", async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        requireOwner(role);
        if (typeof req.body?.isPublic !== "boolean") {
            throw new ServerError("InvalidRequest", "isPublic must be true or false", HTTPcodes.badRequest);
        }
        await clubs.setPublic(club.id, req.body.isPublic);
        if (!req.body.isPublic) emitToUser(club.owner_id, "clubs");
        return res.status(200).json({ isPublic: req.body.isPublic });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Owner-only: hand the club to an existing member
clubsRoutes.post("/:id/owner", requireVerifiedEmail, async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        requireOwner(role);
        const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
        const target = username && await friends.findUserByUsername(username);
        if (!target || target.id === req.user.id) {
            throw new ServerError("InvalidRequest", "Pick another member to take over", HTTPcodes.badRequest);
        }
        if (await clubs.countOwnedClubs(target.id) >= clubs.MAX_OWNED_CLUBS) {
            throw new ServerError("TooManyClubs", "That player already owns as many clubs as allowed", HTTPcodes.conflict);
        }
        if (!await clubs.transferOwnership(club.id, req.user.id, target.id)) {
            throw new ServerError("NotAMember", "Only a member of the club can become its owner", HTTPcodes.badRequest);
        }
        emitToUser(target.id, "clubs");
        return res.status(200).json({ owner: target.username });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Ask to join a public club
clubsRoutes.post("/:id/requests", requireVerifiedEmail, async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        if (role !== "visitor") {
            throw new ServerError("InvalidRequest", "You’re already connected to this club", HTTPcodes.conflict);
        }
        if (await clubs.countMembers(club.id) >= clubs.MAX_MEMBERS) {
            throw new ServerError("ClubFull", "This club is full", HTTPcodes.conflict);
        }
        await clubs.requestToJoin(club.id, req.user.id);
        emitToUser(club.owner_id, "clubs");
        return res.status(201).json({ role: "requested" });
    } catch (error) {
        if (error?.code === "23505") {
            return res.status(HTTPcodes.conflict).json({ error: "AlreadyRequested", message: "You’re already connected to this club" });
        }
        return sendRouteError(res, error);
    }
});

// Owner-only: approve someone's request
clubsRoutes.put("/:id/requests/:username", requireVerifiedEmail, async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        requireOwner(role);
        const target = await friends.findUserByUsername(req.params.username);
        if (await clubs.countMembers(club.id) >= clubs.MAX_MEMBERS) {
            throw new ServerError("ClubFull", "This club is full", HTTPcodes.conflict);
        }
        if (!target || !await clubs.setStatus(club.id, target.id, "requested", "accepted")) {
            throw new ServerError("NoRequest", "There’s no request from that player", HTTPcodes.notFound);
        }
        emitToUser(target.id, "clubs");
        return res.status(200).json({ approved: target.username });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Owner-only: invite any player, friend or not. They join once they accept
clubsRoutes.post("/:id/members", requireVerifiedEmail, async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        requireOwner(role);
        const username = typeof req.body?.username === "string" ? req.body.username.trim() : "";
        const target = username && await friends.findUserByUsername(username);
        if (!target) throw new ServerError("UserNotFound", "We couldn’t find a player with that name", HTTPcodes.notFound);
        if (target.id === req.user.id) {
            throw new ServerError("InvalidRequest", "You already run this club", HTTPcodes.badRequest);
        }
        if (await clubs.countMembers(club.id) >= clubs.MAX_MEMBERS) {
            throw new ServerError("ClubFull", "This club is full", HTTPcodes.conflict);
        }
        // Inviting someone who already asked to join simply lets them in
        if (await clubs.setStatus(club.id, target.id, "requested", "accepted")) {
            emitToUser(target.id, "clubs");
            return res.status(200).json({ invited: target.username, joined: true });
        }
        await clubs.invite(club.id, target.id);
        emitToUser(target.id, "clubs");
        return res.status(201).json({ invited: target.username });
    } catch (error) {
        if (error?.code === "23505") {
            return res.status(HTTPcodes.conflict).json({ error: "AlreadyInvited", message: "That player is already invited or in the club" });
        }
        return sendRouteError(res, error);
    }
});

// Accept your own invitation
clubsRoutes.put("/:id/membership", requireVerifiedEmail, async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        if (role !== "invited" || !await clubs.setStatus(club.id, req.user.id, "pending", "accepted")) {
            throw new ServerError("NoInvite", "There’s no invitation to accept", HTTPcodes.notFound);
        }
        emitToUser(club.owner_id, "clubs");
        return res.status(200).json({ role: "member" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Owner removes a member, cancels an invite or declines a request; anyone else may only remove themselves (leave, decline or withdraw)
clubsRoutes.delete("/:id/members/:username", async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        const target = await friends.findUserByUsername(req.params.username);
        if (!target || target.id === club.owner_id) {
            throw new ServerError("InvalidRequest", "The owner can’t be removed. Delete the club instead", HTTPcodes.badRequest);
        }
        if (role !== "owner" && target.id !== req.user.id) {
            throw new ServerError("Forbidden", "Only the club owner can remove other players", HTTPcodes.forbidden);
        }
        if (!await clubs.removeMember(club.id, target.id)) {
            throw new ServerError("NotFound", "That player isn’t in this club", HTTPcodes.notFound);
        }
        emitToUser(target.id, "clubs");
        emitToUser(club.owner_id, "clubs");
        return res.status(200).json({ removed: target.username });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

clubsRoutes.delete("/:id", async (req, res) => {
    try {
        const { club, role } = await loadClub(req);
        requireOwner(role);
        const rows = await clubs.listMembers(club.id);
        await clubs.deleteClub(club.id);
        rows.forEach(row => emitToUser(row.id, "clubs"));
        return res.status(200).json({ deleted: true });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

module.exports = clubsRoutes;
