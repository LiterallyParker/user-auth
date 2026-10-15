const factories = require("./factories");
const pool = require("./pool");
const tableName = "users";

const createUser = factories.createFactory({
    tableName,
    columns: ["first_name", "last_name", "username", "email", "hash"],
    returning: ["id", "first_name", "last_name", "username", "email", "email_verified", "created_at", "updated_at"],
});

const getUser = factories.getFactory({
    tableName,
    allowedFields: ["id", "first_name", "last_name", "username", "email", "email_verified", "bio", "avatar_url", "settings", "created_at", "updated_at"],
    allowedConditions: ["id", "username", "email"]
});

const getUserWithHash = factories.getFactory({
    tableName,
    allowedFields: ["id", "hash"],
    allowedConditions: ["id", "username", "email"]
});

const updateUser = factories.updateFactory({
    tableName,
    allowedFields: ["first_name", "last_name", "username", "email", "hash", "email_verified", "bio", "avatar_url", "settings"],
    allowedConditions: ["id"],
    returning: ["id", "updated_at"]
});

const deleteUser = factories.deleteFactory({
    tableName,
    allowedConditions: ["id"]
});

// Profile privacy defaults to ON when the user has never saved the setting
const PRIVACY_SQL = "COALESCE((settings->>'privacy')::boolean, true)";

const FRIEND_JOIN = `
    LEFT JOIN friendships f ON
        (f.requester_id = u.id AND f.addressee_id = $2::text)
        OR (f.addressee_id = u.id AND f.requester_id = $2::text)`;

async function searchUsers({ query, viewerId, limit = 12 }) {
    const escaped = query.replace(/[\\%_]/g, "\\$&");
    const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url, u.first_name, u.last_name,
                ${PRIVACY_SQL} AS private, f.status AS friend_status, f.requester_id AS friend_requester
         FROM users u ${FRIEND_JOIN}
         WHERE u.username ILIKE $1 ESCAPE '\\' AND ($2::text IS NULL OR u.id <> $2::text)
         ORDER BY (u.username ILIKE $3 ESCAPE '\\') DESC, u.username ASC
         LIMIT $4`,
        [`%${escaped}%`, viewerId, `${escaped}%`, limit]
    );
    return rows;
}

async function getProfileByUsername(username, viewerId = null) {
    const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url, u.bio, u.first_name, u.last_name, u.created_at,
                ${PRIVACY_SQL} AS private, f.status AS friend_status, f.requester_id AS friend_requester
         FROM users u ${FRIEND_JOIN}
         WHERE LOWER(u.username) = LOWER($1)`,
        [username, viewerId]
    );
    return rows[0] || null;
}

module.exports = {
    searchUsers,
    getProfileByUsername,
    createUser,
    getUser,
    getUserWithHash,
    updateUser,
    deleteUser
};