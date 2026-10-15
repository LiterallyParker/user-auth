const jwt = require("jsonwebtoken");
const { ulid } = require("ulid");

function createAccessToken(payload) {
    const token = jwt.sign(payload, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "15m",
        algorithm: "HS256",
        issuer: process.env.JWT_ISSUER,
        jwtid: ulid()
    });
    return token;
};

function createRefreshToken(payload) {
    return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: "7d",
        algorithm: "HS256",
        issuer: process.env.JWT_ISSUER,
        jwtid: ulid()
    });
};

function verifyAccessToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, {
            algorithms: ["HS256"],
            issuer: process.env.JWT_ISSUER
        });
        return { valid: true, data: decoded };   
    } catch (error) {
        return {
            valid: false,
            error
        };
    };
};

function verifyRefreshToken(token) {
    try {
        const decoded = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET, {
            algorithms: ["HS256"],
            issuer: process.env.JWT_ISSUER
        });
        return { valid: true, data: decoded };   
    } catch (error) {
        return {
            valid: false,
            error
        };
    };
};

module.exports = {
    createAccessToken,
    createRefreshToken,
    verifyAccessToken,
    verifyRefreshToken
};