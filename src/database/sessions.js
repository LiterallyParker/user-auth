const crypto = require("crypto");
const { ulid } = require("ulid");
const pool = require("./pool");
const { keysToCamel } = require("../util");

function hashRefreshToken(token) {
    return crypto.createHash("sha256").update(token).digest("hex");
}

async function createSession({
    id = ulid(),
    userId,
    refreshToken,
    expiresAt,
    userAgent,
    ipAddress
}) {
    const result = await pool.query(`
        INSERT INTO sessions (
            id, user_id, refresh_token_hash, expires_at, user_agent, ip_address
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING id, user_id, created_at, last_used_at, expires_at, user_agent;
    `, [
        id,
        userId,
        hashRefreshToken(refreshToken),
        expiresAt,
        typeof userAgent === "string" ? userAgent.slice(0, 512) : null,
        ipAddress || null
    ]);
    return keysToCamel(result.rows[0]);
}

async function getSession({ id, userId }) {
    const result = await pool.query(`
        SELECT id, user_id, refresh_token_hash, expires_at, revoked_at
        FROM sessions
        WHERE id = $1 AND user_id = $2;
    `, [id, userId]);
    return result.rows[0] ? keysToCamel(result.rows[0]) : undefined;
}

async function rotateSession({
    id,
    userId,
    currentRefreshToken,
    nextRefreshToken,
    expiresAt
}) {
    const result = await pool.query(`
        UPDATE sessions
        SET refresh_token_hash = $4,
            expires_at = $5,
            last_used_at = CURRENT_TIMESTAMP
        WHERE id = $1
            AND user_id = $2
            AND refresh_token_hash = $3
            AND revoked_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
        RETURNING id;
    `, [
        id,
        userId,
        hashRefreshToken(currentRefreshToken),
        hashRefreshToken(nextRefreshToken),
        expiresAt
    ]);
    return result.rowCount === 1;
}

async function revokeSession({ id, userId }) {
    const result = await pool.query(`
        UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
        RETURNING id;
    `, [id, userId]);
    return result.rowCount === 1;
}

async function revokeSessionWithRefreshToken({ id, userId, refreshToken }) {
    const result = await pool.query(`
        UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE id = $1
            AND user_id = $2
            AND refresh_token_hash = $3
            AND revoked_at IS NULL
        RETURNING id;
    `, [id, userId, hashRefreshToken(refreshToken)]);
    return result.rowCount === 1;
}

async function revokeAllSessions(userId) {
    const result = await pool.query(`
        UPDATE sessions
        SET revoked_at = CURRENT_TIMESTAMP
        WHERE user_id = $1 AND revoked_at IS NULL;
    `, [userId]);
    return result.rowCount;
}

async function getActiveSessions(userId) {
    const result = await pool.query(`
        SELECT id, created_at, last_used_at, expires_at, user_agent
        FROM sessions
        WHERE user_id = $1
            AND revoked_at IS NULL
            AND expires_at > CURRENT_TIMESTAMP
        ORDER BY last_used_at DESC;
    `, [userId]);
    return result.rows.map(keysToCamel);
}

async function deleteInactiveSessions() {
    const result = await pool.query(`
        DELETE FROM sessions
        WHERE expires_at <= CURRENT_TIMESTAMP
            OR revoked_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    `);
    return result.rowCount;
}

module.exports = {
    createSession,
    getSession,
    rotateSession,
    revokeSession,
    revokeSessionWithRefreshToken,
    revokeAllSessions,
    getActiveSessions,
    deleteInactiveSessions
};
