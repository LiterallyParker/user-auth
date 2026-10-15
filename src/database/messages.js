const { ulid } = require("ulid");
const pool = require("./pool");

const PAGE_SIZE = 50;
const READ_TTL = "24 hours";

// Read messages disappear READ_TTL after being read; the cron job just reclaims the rows
const ALIVE = `(m.read_at IS NULL OR m.read_at > CURRENT_TIMESTAMP - INTERVAL '${READ_TTL}')`;

async function areFriends(a, b) {
    const { rows } = await pool.query(
        `SELECT 1 FROM friendships
         WHERE status = 'accepted'
           AND ((requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1))`,
        [a, b]
    );
    return rows.length > 0;
}

async function createMessage(senderId, recipientId, body) {
    const { rows } = await pool.query(
        `INSERT INTO messages (id, sender_id, recipient_id, body) VALUES ($1, $2, $3, $4)
         RETURNING id, body, created_at`,
        [ulid(), senderId, recipientId, body]
    );
    return rows[0];
}

// Newest PAGE_SIZE messages of a thread, returned oldest first
async function getThread(userId, otherId, before = null) {
    const { rows } = await pool.query(
        `SELECT m.id, m.body, m.created_at, m.sender_id = $1 AS mine, m.read_at IS NOT NULL AS read FROM messages m
         WHERE ((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))
           AND ($3::text IS NULL OR m.id < $3::text)
           AND ${ALIVE}
         ORDER BY m.id DESC LIMIT $4`,
        [userId, otherId, before, PAGE_SIZE]
    );
    return rows.reverse();
}

async function markRead(userId, otherId) {
    const { rowCount } = await pool.query(
        `UPDATE messages SET read_at = CURRENT_TIMESTAMP
         WHERE recipient_id = $1 AND sender_id = $2 AND read_at IS NULL`,
        [userId, otherId]
    );
    return rowCount;
}

// One row per current friend with their latest message and unread count
async function listConversations(userId) {
    const { rows } = await pool.query(
        `SELECT u.username, u.avatar_url,
                last.body AS last_body, last.created_at AS last_at, last.sender_id = $1 AS last_mine,
                COALESCE(unread.count, 0)::int AS unread
         FROM friendships f
         JOIN users u ON u.id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
         LEFT JOIN LATERAL (
             SELECT body, created_at, sender_id FROM messages m
             WHERE ((m.sender_id = $1 AND m.recipient_id = u.id) OR (m.sender_id = u.id AND m.recipient_id = $1))
               AND ${ALIVE}
             ORDER BY m.id DESC LIMIT 1
         ) last ON TRUE
         LEFT JOIN LATERAL (
             SELECT COUNT(*) AS count FROM messages m
             WHERE m.sender_id = u.id AND m.recipient_id = $1 AND m.read_at IS NULL
         ) unread ON TRUE
         WHERE f.status = 'accepted' AND (f.requester_id = $1 OR f.addressee_id = $1)
         ORDER BY last.created_at DESC NULLS LAST, u.username ASC`,
        [userId]
    );
    return rows;
}

async function deleteExpiredMessages() {
    const { rowCount } = await pool.query(
        `DELETE FROM messages m WHERE m.read_at IS NOT NULL AND NOT ${ALIVE}`
    );
    return rowCount;
}

module.exports = { deleteExpiredMessages, areFriends, createMessage, getThread, markRead, listConversations };
