const { Router } = require("express");
const createLimiter = require("../middleware/createLimiter");
const requireUser = require("../middleware/requireUser");
const {
    handlePasswordVerification,
    handlePasswordChange,
    handleResendEmailVerification,
    handleEmailChange,
    handleAccountDeletion
} = require("../auth/handlers");
const { ServerError, HTTPcodes, requireFields, sendRouteError } = require("../util");
const { getUser, updateUser } = require("../database/users");
const {
    getActiveSessions,
    revokeSession
} = require("../database/sessions");

const accountRoutes = Router();
const defaultSettings = {
    privacy: true,
    dataSharing: false,
    cookies: true,
    emailRegistries: false
};
const settingKeys = Object.keys(defaultSettings);
const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/"
};

function createSensitiveLimiter() {
    return createLimiter({
        windowMs: 15 * 60 * 1000,
        limit: 5,
        message: "Too many attempts. Please try again later."
    });
}

function badRequest(message, type = "InvalidRequest") {
    return new ServerError(type, message, HTTPcodes.badRequest);
}

function hasOwn(object, key) {
    return Object.prototype.hasOwnProperty.call(object, key);
}

function clearRefreshCookie(res) {
    res.clearCookie("refreshToken", refreshCookieOptions);
}

accountRoutes.use(...requireUser);


accountRoutes.post("/export", createSensitiveLimiter(), async (req, res) => {
    try {
        const user = await getUser({ id: req.user.id });
        if (!user) throw new ServerError("UserNotFound", "User not found", HTTPcodes.notFound);
        const sessions = await getActiveSessions(req.user.id);
        return res.status(200).json({
            exportedAt: new Date().toISOString(),
            account: user,
            settings: { ...defaultSettings, ...(user.settings || {}) },
            sessions: sessions.map(({ id, createdAt, lastUsedAt, expiresAt, userAgent }) => ({
                id,
                createdAt,
                lastUsedAt,
                expiresAt,
                userAgent,
                current: id === req.user.sid
            }))
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.post("/change-password", createSensitiveLimiter(), async (req, res) => {
    try {
        requireFields(["currentPassword", "reqPass", "conPass"], req.body || {});
        await handlePasswordChange({
            userId: req.user.id,
            currentPassword: req.body.currentPassword,
            reqPass: req.body.reqPass,
            conPass: req.body.conPass
        });
        clearRefreshCookie(res);
        return res.status(200).json({
            message: "Password changed successfully. Please sign in again."
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.post("/verify-password", createSensitiveLimiter(), async (req, res) => {
    try {
        requireFields(["password"], req.body || {});
        await handlePasswordVerification({ userId: req.user.id, password: req.body.password });
        return res.status(200).json({ valid: true });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.post("/resend-verify-email", createSensitiveLimiter(), async (req, res) => {
    try {
        await handleResendEmailVerification(req.user.id);
        return res.status(200).json({ message: "Verification email sent" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.get("/", async (req, res) => {
    try {
        const account = await getUser({ id: req.user.id });
        if (!account) throw new ServerError("UserNotFound", "User not found", HTTPcodes.notFound);
        return res.status(200).json({ account });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.get("/settings", async (req, res) => {
    try {
        const user = await getUser({ id: req.user.id }, ["id", "settings"]);
        if (!user) throw new ServerError("UserNotFound", "User not found", HTTPcodes.notFound);
        return res.status(200).json({
            settings: { ...defaultSettings, ...(user.settings || {}) }
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.get("/sessions", async (req, res) => {
    try {
        const sessions = await getActiveSessions(req.user.id);
        return res.status(200).json({
            sessions: sessions.map(({ id, createdAt, lastUsedAt, expiresAt, userAgent }) => ({
                id,
                createdAt,
                lastUsedAt,
                expiresAt,
                userAgent,
                current: id === req.user.sid
            }))
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.patch("/", async (req, res) => {
    try {
        const body = req.body || {};
        const allowedFields = ["firstName", "lastName", "bio", "avatarUrl"];
        const providedFields = Object.keys(body);
        if (!providedFields.length || providedFields.some(field => !allowedFields.includes(field))) {
            throw badRequest("Provide one or more supported profile fields only");
        }

        const updates = {};
        for (const field of ["firstName", "lastName"]) {
            if (!hasOwn(body, field)) continue;
            const value = body[field];
            if (value !== null && (typeof value !== "string" || value.trim().length > 100)) {
                throw badRequest(`${field} must be a string of at most 100 characters or null`);
            }
            updates[field] = value === null ? null : value.trim() || null;
        }
        if (hasOwn(body, "bio")) {
            const value = body.bio;
            if (value !== null && (typeof value !== "string" || value.length > 5000)) {
                throw badRequest("bio must be a string of at most 5000 characters or null");
            }
            updates.bio = value === null ? null : value.trim() || null;
        }
        if (hasOwn(body, "avatarUrl")) {
            const value = body.avatarUrl;
            if (value !== null && typeof value !== "string") {
                throw badRequest("avatarUrl must be an HTTP(S) URL or null");
            }
            if (value !== null) {
                let parsed;
                try {
                    parsed = new URL(value);
                } catch {
                    throw badRequest("avatarUrl must be an HTTP(S) URL or null");
                }
                if (!["http:", "https:"].includes(parsed.protocol) || value.length > 2048) {
                    throw badRequest("avatarUrl must be an HTTP(S) URL of at most 2048 characters");
                }
            }
            updates.avatarUrl = value;
        }

        await updateUser({ id: req.user.id }, updates);
        const account = await getUser({ id: req.user.id });
        if (!account) throw new ServerError("UserNotFound", "User not found", HTTPcodes.notFound);
        return res.status(200).json({ account });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.patch("/settings", async (req, res) => {
    try {
        const body = req.body || {};
        const fields = Object.keys(body);
        if (!fields.length || fields.some(field => !settingKeys.includes(field))) {
            throw badRequest("Provide one or more supported settings only");
        }
        for (const field of fields) {
            if (typeof body[field] !== "boolean") throw badRequest(`${field} must be a boolean`);
        }

        const user = await getUser({ id: req.user.id }, ["id", "settings"]);
        if (!user) throw new ServerError("UserNotFound", "User not found", HTTPcodes.notFound);
        const settings = { ...defaultSettings, ...(user.settings || {}), ...body };
        await updateUser({ id: req.user.id }, { settings });
        return res.status(200).json({ settings });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.patch("/email", createSensitiveLimiter(), async (req, res) => {
    try {
        requireFields(["email", "currentPassword"], req.body || {});
        await handleEmailChange({
            userId: req.user.id,
            currentPassword: req.body.currentPassword,
            email: req.body.email
        });
        clearRefreshCookie(res);
        return res.status(200).json({
            message: "Email updated. Check your new address to verify it, then sign in again."
        });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.delete("/", createSensitiveLimiter(), async (req, res) => {
    try {
        requireFields(["password"], req.body || {});
        await handleAccountDeletion({ userId: req.user.id, password: req.body.password });
        clearRefreshCookie(res);
        return res.status(200).json({ message: "Account deleted successfully" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

accountRoutes.delete("/sessions/:id", async (req, res) => {
    try {
        if (!/^[0-9A-HJKMNP-TV-Z]{26}$/i.test(req.params.id)) {
            throw badRequest("Invalid session ID");
        }
        const revoked = await revokeSession({ id: req.params.id, userId: req.user.id });
        if (!revoked) throw new ServerError("SessionNotFound", "Session not found", HTTPcodes.notFound);
        if (req.params.id === req.user.sid) {
            clearRefreshCookie(res);
        }
        return res.status(200).json({ message: "Session revoked successfully" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

module.exports = accountRoutes;
