const { Router } = require("express");
const createLimiter = require("../middleware/createLimiter");
const requireUser = require("../middleware/requireUser");
const requireVerifiedEmail = require("../middleware/requireVerifiedEmail");
const { ServerError, HTTPcodes, sendRouteError } = require("../util");
const { findUserByUsername, findUsernameById } = require("../database/friends");
const { emitToUser } = require("../realtime");
const messages = require("../database/messages");

const messagesRoutes = Router();
const MAX_BODY = 256;

const limiter = createLimiter({ limit: 120, message: "Easy there, dealer. Try again in a minute." });
const sendLimiter = createLimiter({
    limit: 20,
    keyGenerator: req => req.user.id,
    message: "You’re sending messages awfully fast. Take a breath."
});
messagesRoutes.use(...requireUser, limiter);

// Every thread route goes through here, so messaging is friends-only by construction
async function resolveFriend(req) {
    const target = await findUserByUsername(req.params.username);
    if (!target || target.id === req.user.id || !(await messages.areFriends(req.user.id, target.id))) {
        throw new ServerError("NotFriends", "You can only message your friends", HTTPcodes.forbidden);
    }
    return target;
}

messagesRoutes.get("/", async (req, res) => {
    try {
        const rows = await messages.listConversations(req.user.id);
        return res.status(200).json({
            conversations: rows.map(row => ({
                username: row.username,
                avatarUrl: row.avatar_url || null,
                lastMessage: row.last_body ? { body: row.last_body, createdAt: row.last_at, mine: row.last_mine } : null,
                unread: row.unread
            }))
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

messagesRoutes.get("/:username", async (req, res) => {
    try {
        const friend = await resolveFriend(req);
        const before = typeof req.query.before === "string" && /^[0-9A-Z]{26}$/.test(req.query.before)
            ? req.query.before
            : null;
        const rows = await messages.getThread(req.user.id, friend.id, before);
        // A hidden tab peeks without marking anything read; otherwise the sender's heart turns red early
        const peek = req.query.peek === "1";
        if (!before && !peek && await messages.markRead(req.user.id, friend.id)) {
            emitToUser(friend.id, "message", { username: await findUsernameById(req.user.id) });
        }
        return res.status(200).json({
            messages: rows.map(row => ({ id: row.id, body: row.body, createdAt: row.created_at, mine: row.mine, read: row.read }))
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

messagesRoutes.post("/:username", requireVerifiedEmail, sendLimiter, async (req, res) => {
    try {
        const friend = await resolveFriend(req);
        const body = typeof req.body?.body === "string" ? req.body.body.trim() : "";
        if (!body || body.length > MAX_BODY) {
            throw new ServerError("InvalidRequest", `Messages need 1 to ${MAX_BODY} characters`, HTTPcodes.badRequest);
        }
        const message = await messages.createMessage(req.user.id, friend.id, body);
        const senderName = await findUsernameById(req.user.id);
        emitToUser(friend.id, "message", { username: senderName });
        emitToUser(req.user.id, "message", { username: friend.username });
        return res.status(201).json({
            message: { id: message.id, body: message.body, createdAt: message.created_at, mine: true, read: false }
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

module.exports = messagesRoutes;
