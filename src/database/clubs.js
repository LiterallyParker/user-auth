const { ulid } = require("ulid");
const pool = require("./pool");

const MAX_OWNED_CLUBS = 10;
const MAX_MEMBERS = 100;

async function createClub(ownerId, name) {
    const { rows } = await pool.query(
        "INSERT INTO clubs (id, owner_id, name) VALUES ($1, $2, $3) RETURNING id, name",
        [ulid(), ownerId, name]
    );
    return rows[0];
}

async function countOwnedClubs(ownerId) {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM clubs WHERE owner_id = $1", [ownerId]);
    return rows[0].count;
}

async function countMembers(clubId) {
    const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM club_members WHERE club_id = $1", [clubId]);
    return rows[0].count;
}

// Clubs the user owns or is connected to: member, invited, or asked to join
async function listForUser(userId) {
    const { rows } = await pool.query(
        `SELECT c.id, c.name, o.username AS owner, c.owner_id = $1 AS is_owner,
                COALESCE(m.status, 'accepted') AS status,
                (SELECT COUNT(*)::int FROM club_members cm WHERE cm.club_id = c.id AND cm.status = 'accepted') + 1 AS member_count,
                CASE WHEN c.owner_id = $1
                     THEN (SELECT COUNT(*)::int FROM club_members cm WHERE cm.club_id = c.id AND cm.status = 'requested')
                     ELSE 0 END AS request_count
         FROM clubs c
         JOIN users o ON o.id = c.owner_id
         LEFT JOIN club_members m ON m.club_id = c.id AND m.user_id = $1
         WHERE c.owner_id = $1 OR m.user_id IS NOT NULL
         ORDER BY LOWER(c.name)`,
        [userId]
    );
    return rows;
}

async function searchPublic(query) {
    const pattern = `%${query.replace(/[\\%_]/g, "\\$&")}%`;
    const { rows } = await pool.query(
        `SELECT c.id, c.name, o.username AS owner,
                (SELECT COUNT(*)::int FROM club_members cm WHERE cm.club_id = c.id AND cm.status = 'accepted') + 1 AS member_count
         FROM clubs c JOIN users o ON o.id = c.owner_id
         WHERE c.is_public AND c.name ILIKE $1
         ORDER BY LOWER(c.name) LIMIT 20`,
        [pattern]
    );
    return rows;
}

async function getClub(clubId) {
    const { rows } = await pool.query(
        `SELECT c.id, c.name, c.is_public, c.owner_id, o.username AS owner, o.avatar_url AS owner_avatar_url
         FROM clubs c JOIN users o ON o.id = c.owner_id WHERE c.id = $1`,
        [clubId]
    );
    return rows[0] || null;
}

async function getMembership(clubId, userId) {
    const { rows } = await pool.query(
        "SELECT status FROM club_members WHERE club_id = $1 AND user_id = $2",
        [clubId, userId]
    );
    return rows[0] || null;
}

async function listMembers(clubId) {
    const { rows } = await pool.query(
        `SELECT u.id, u.username, u.avatar_url, m.status
         FROM club_members m JOIN users u ON u.id = m.user_id
         WHERE m.club_id = $1 ORDER BY m.created_at`,
        [clubId]
    );
    return rows;
}

async function invite(clubId, userId) {
    await pool.query("INSERT INTO club_members (club_id, user_id) VALUES ($1, $2)", [clubId, userId]);
}

async function requestToJoin(clubId, userId) {
    await pool.query("INSERT INTO club_members (club_id, user_id, status) VALUES ($1, $2, 'requested')", [clubId, userId]);
}

// Moves a row from one status to another, e.g. an invitation (pending) or a join request (requested) to accepted
async function setStatus(clubId, userId, from, to) {
    const { rowCount } = await pool.query(
        "UPDATE club_members SET status = $4 WHERE club_id = $1 AND user_id = $2 AND status = $3",
        [clubId, userId, from, to]
    );
    return rowCount;
}

// Going private also withdraws any open join requests
async function setPublic(clubId, isPublic) {
    await pool.query("UPDATE clubs SET is_public = $2 WHERE id = $1", [clubId, isPublic]);
    if (!isPublic) await pool.query("DELETE FROM club_members WHERE club_id = $1 AND status = 'requested'", [clubId]);
}

// The new owner must already be a member; the old owner stays on as a regular member
async function transferOwnership(clubId, oldOwnerId, newOwnerId) {
    const client = await pool.connect();
    try {
        await client.query("BEGIN");
        const removed = await client.query(
            "DELETE FROM club_members WHERE club_id = $1 AND user_id = $2 AND status = 'accepted'",
            [clubId, newOwnerId]
        );
        if (!removed.rowCount) {
            await client.query("ROLLBACK");
            return false;
        }
        await client.query("UPDATE clubs SET owner_id = $2 WHERE id = $1", [clubId, newOwnerId]);
        await client.query("INSERT INTO club_members (club_id, user_id, status) VALUES ($1, $2, 'accepted')", [clubId, oldOwnerId]);
        await client.query("COMMIT");
        return true;
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

async function removeMember(clubId, userId) {
    const { rowCount } = await pool.query("DELETE FROM club_members WHERE club_id = $1 AND user_id = $2", [clubId, userId]);
    return rowCount;
}

async function deleteClub(clubId) {
    await pool.query("DELETE FROM clubs WHERE id = $1", [clubId]);
}

module.exports = {
    MAX_OWNED_CLUBS,
    MAX_MEMBERS,
    createClub,
    countOwnedClubs,
    countMembers,
    listForUser,
    getClub,
    getMembership,
    listMembers,
    searchPublic,
    invite,
    requestToJoin,
    setStatus,
    setPublic,
    transferOwnership,
    removeMember,
    deleteClub
};
