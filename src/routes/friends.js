const { Router } = require("express");
const createLimiter = require("../middleware/createLimiter");
const requireUser = require("../middleware/requireUser");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { ServerError, HTTPcodes, sendRouteError } = require("../util");
const friends = require("../database/friends");
const { emitToUser } = require("../realtime");

const friendsRoutes = Router();

const limiter = createLimiter({ limit: 30, message: "Easy there, dealer. Try again in a minute." });
friendsRoutes.use(...requireUser, limiter);

// Tells both sides to refresh their friends list and any open chat
function notifyFriendsChanged(userId, otherId) {
    emitToUser(userId, "friends");
    emitToUser(otherId, "friends");
}

async function resolveTarget(req) {
    const target = await friends.findUserByUsername(req.params.username);
    if (!target) throw new ServerError("UserNotFound", "We couldn’t find a player with that name", HTTPcodes.notFound);
    if (target.id === req.user.id) {
        throw new ServerError("InvalidRequest", "You can’t befriend yourself, though we admire the confidence", HTTPcodes.badRequest);
    }
    return target;
}

friendsRoutes.get("/", async (req, res) => {
    try {
        const rows = await friends.listFriendships(req.user.id);
        const shape = row => ({ username: row.username, avatarUrl: row.avatar_url || null });
        return res.status(200).json({
            friends: rows.filter(r => r.status === "accepted").map(shape),
            incoming: rows.filter(r => r.status === "pending" && !r.outgoing).map(shape),
            outgoing: rows.filter(r => r.status === "pending" && r.outgoing).map(shape)
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Send a request; if they already asked us, this accepts it
friendsRoutes.post("/:username", requireVerifiedEmail, async (req, res) => {
    try {
        const target = await resolveTarget(req);
        const existing = await friends.getFriendship(req.user.id, target.id);
        if (existing?.status === "accepted") {
            throw new ServerError("AlreadyFriends", "You’re already friends", HTTPcodes.conflict);
        }
        if (existing) {
            if (existing.requester_id === req.user.id) {
                throw new ServerError("RequestPending", "Your request is already on its way", HTTPcodes.conflict);
            }
            await friends.acceptRequest(existing.id);
            notifyFriendsChanged(req.user.id, target.id);
            return res.status(200).json({ relationship: "friends" });
        }
        if (await friends.countOutgoingPending(req.user.id) >= friends.MAX_PENDING_OUTGOING) {
            throw new ServerError("TooManyRequests", "You have a lot of requests waiting. Let a few get answered first", HTTPcodes.conflict);
        }
        await friends.createRequest(req.user.id, target.id);
        notifyFriendsChanged(req.user.id, target.id);
        return res.status(201).json({ relationship: "outgoing" });
    } catch (error) {
        if (error?.code === "23505") {
            return res.status(HTTPcodes.conflict).json({ error: "RequestPending", message: "A request already exists" });
        }
        return sendRouteError(res, error);
    }
});

friendsRoutes.put("/:username", requireVerifiedEmail, async (req, res) => {
    try {
        const target = await resolveTarget(req);
        const existing = await friends.getFriendship(req.user.id, target.id);
        if (!existing || existing.status !== "pending" || existing.addressee_id !== req.user.id) {
            throw new ServerError("NoRequest", "There’s no request from that player to accept", HTTPcodes.notFound);
        }
        await friends.acceptRequest(existing.id);
        notifyFriendsChanged(req.user.id, target.id);
        return res.status(200).json({ relationship: "friends" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

// Unfriend, decline an incoming request, or cancel an outgoing one
friendsRoutes.delete("/:username", async (req, res) => {
    try {
        const target = await resolveTarget(req);
        const existing = await friends.getFriendship(req.user.id, target.id);
        if (!existing) {
            throw new ServerError("NotFound", "Nothing to remove here", HTTPcodes.notFound);
        }
        await friends.deleteFriendship(existing.id);
        notifyFriendsChanged(req.user.id, target.id);
        return res.status(200).json({ relationship: "none" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

module.exports = friendsRoutes;
