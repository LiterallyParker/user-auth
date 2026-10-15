const { ulid } = require("ulid");
const pool = require("./pool");

const MAX_PENDING_OUTGOING = 50;

function relationshipOf(row, viewerId) {
    if (!viewerId) return "none";
    if (row.id === viewerId) return "self";
    if (!row.friend_status) return "none";
    if (row.friend_status === "accepted") return "friends";
    return row.friend_requester === viewerId ? "outgoing" : "incoming";
}

async function findUserByUsername(username) {
    const { rows } = await pool.query(
        "SELECT id, username FROM users WHERE LOWER(username) = LOWER($1)",
        [username]
    );
    return rows[0] || null;
}

async function findUsernameById(id) {
    const { rows } = await pool.query("SELECT username FROM users WHERE id = $1", [id]);
    return rows[0]?.username || null;
}

async function getFriendship(a, b) {
    const { rows } = await pool.query(
        `SELECT id, requester_id, addressee_id, status FROM friendships
         WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
        [a, b]
    );
    return rows[0] || null;
}

async function countOutgoingPending(userId) {
    const { rows } = await pool.query(
        "SELECT COUNT(*)::int AS count FROM friendships WHERE requester_id = $1 AND status = 'pending'",
        [userId]
    );
    return rows[0].count;
}

async function createRequest(requesterId, addresseeId) {
    await pool.query(
        "INSERT INTO friendships (id, requester_id, addressee_id) VALUES ($1, $2, $3)",
        [ulid(), requesterId, addresseeId]
    );
}

async function acceptRequest(id) {
    await pool.query("UPDATE friendships SET status = 'accepted', updated_at = CURRENT_TIMESTAMP WHERE id = $1", [id]);
}

async function deleteFriendship(id) {
    await pool.query("DELETE FROM friendships WHERE id = $1", [id]);
}

// Lists the other person in every friendship row that involves the viewer
async function listFriendships(userId) {
    const { rows } = await pool.query(
        `SELECT u.username, u.avatar_url, f.status, f.requester_id = $1 AS outgoing
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         WHERE f.requester_id = $1 OR f.addressee_id = $1
         ORDER BY u.username ASC`,
        [userId]
    );
    return rows;
}

module.exports = {
    MAX_PENDING_OUTGOING,
    relationshipOf,
    findUserByUsername,
    findUsernameById,
    getFriendship,
    countOutgoingPending,
    createRequest,
    acceptRequest,
    deleteFriendship,
    listFriendships
};
