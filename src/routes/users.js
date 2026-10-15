const { Router } = require("express");
const createLimiter = require("../middleware/createLimiter");
const attachUser = require("../middleware/attachUser");
const { ServerError, HTTPcodes, sendRouteError } = require("../util");
const { searchUsers, getProfileByUsername } = require("../database/users");
const { relationshipOf } = require("../database/friends");
const { usernameConstraints } = require("../auth/constraints");

const usersRoutes = Router();

const limiter = createLimiter({ limit: 60, message: "Slow down a little and try again in a minute." });
// Public lookup: a signed-in viewer is only used to hide themselves from results
usersRoutes.use(attachUser, limiter);

const fullName = row => [row.first_name, row.last_name].filter(Boolean).join(" ") || null;

// Private profiles only expose username and avatar, unless the viewer is a friend
function toPublic(row, viewerId) {
    const relationship = relationshipOf(row, viewerId);
    const base = {
        username: row.username,
        avatarUrl: row.avatar_url || null,
        private: row.private,
        relationship
    };
    const visible = !row.private || relationship === "friends" || relationship === "self";
    return visible ? { ...base, name: fullName(row) } : base;
}

usersRoutes.get("/", async (req, res) => {
    try {
        const query = typeof req.query.q === "string" ? req.query.q.trim() : "";
        if (query.length < 2 || query.length > 30) {
            throw new ServerError("InvalidRequest", "Search needs 2 to 30 characters", HTTPcodes.badRequest);
        }
        const rows = await searchUsers({ query, viewerId: req.user?.id || null });
        return res.status(200).json({ users: rows.map(row => toPublic(row, req.user?.id)) });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

usersRoutes.get("/:username", async (req, res) => {
    try {
        const { username } = req.params;
        const valid = Object.values(usernameConstraints).every(rule => rule.test(username));
        const row = valid ? await getProfileByUsername(username, req.user?.id || null) : null;
        if (!row) throw new ServerError("UserNotFound", "We couldn’t find a player with that name", HTTPcodes.notFound);
        const profile = toPublic(row, req.user?.id);
        if ("name" in profile) {
            profile.bio = row.bio || null;
            profile.memberSince = row.created_at;
        }
        return res.status(200).json({ user: profile });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

module.exports = usersRoutes;
