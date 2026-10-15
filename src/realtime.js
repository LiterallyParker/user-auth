const { verifyAccessToken } = require("./auth/jwt");
const { getSession } = require("./database/sessions");

const MAX_SOCKETS_PER_USER = 5;
const room = userId => `user:${userId}`;

let io = null;

// Browsers don't enforce CORS on WebSockets, so reject cross-origin upgrades explicitly
function allowRequest(req, callback) {
    const origin = req.headers.origin;
    if (!origin) return callback(null, true);
    try {
        return callback(null, new URL(origin).host === req.headers.host);
    } catch {
        return callback(null, false);
    }
}

async function authenticate(socket, next) {
    try {
        const token = socket.handshake.auth?.token;
        if (typeof token !== "string") return next(new Error("unauthorized"));
        const result = verifyAccessToken(token);
        if (!result.valid || !result.data.sid || !result.data.id) return next(new Error("unauthorized"));

        const session = await getSession({ id: result.data.sid, userId: result.data.id });
        if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
            return next(new Error("unauthorized"));
        }
        if ((io.sockets.adapter.rooms.get(room(result.data.id))?.size || 0) >= MAX_SOCKETS_PER_USER) {
            return next(new Error("too_many_connections"));
        }
        socket.data.userId = result.data.id;
        socket.data.expiresAt = result.data.exp * 1000;
        return next();
    } catch (error) {
        return next(new Error("unauthorized"));
    }
}

function initRealtime(socketServer) {
    io = socketServer;
    io.engine.opts.allowRequest = allowRequest;
    io.use(authenticate);
    io.on("connection", socket => {
        socket.join(room(socket.data.userId));
        // The token's lifetime bounds the socket's; the client refreshes and reconnects
        const timer = setTimeout(() => socket.disconnect(true), Math.max(socket.data.expiresAt - Date.now(), 0));
        socket.on("disconnect", () => clearTimeout(timer));
    });
}

// Events carry only "something changed"; clients re-fetch through the authorized REST routes
function emitToUser(userId, event, payload = {}) {
    if (io) io.to(room(userId)).emit(event, payload);
}

module.exports = { initRealtime, emitToUser };
