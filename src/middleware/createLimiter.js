const { rateLimit } = require("express-rate-limit");

function createLimiter({ limit, message, windowMs = 60 * 1000, keyGenerator }) {
    return rateLimit({
        windowMs,
        limit,
        standardHeaders: true,
        legacyHeaders: false,
        ...(keyGenerator ? { keyGenerator } : {}),
        message: { error: "TooManyRequests", message }
    });
}

module.exports = createLimiter;
