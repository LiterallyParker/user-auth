require("dotenv").config({ quiet: true });
const { pool } = require("../src/database");
const { tableFactory } = require("../src/database/factories");

async function createFunctions() {
    console.log("Ensuring functions...");
    await pool.query(`
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = CURRENT_TIMESTAMP;
            RETURN NEW;
        END;
        $$ language 'plpgsql';
    `);
    console.log("Function 'update_updated_at_column' ensured");
};

const createUsersTable = tableFactory({
    tableName: "users",
    columns: [
        { name: "id", type: "CHAR(26)", primaryKey: true },
        { name: "first_name", type: "VARCHAR(100)" },
        { name: "last_name", type: "VARCHAR(100)" },
        { name: "username", type: "VARCHAR(30)", notNull: true, unique: true, check: "length(username) >= 3 AND username ~ '^[a-zA-Z0-9._-]+$'"},
        { name: "email", type: "VARCHAR(255)", notNull: true, unique: true, check: "email = lower(email)"},
        { name: "email_verified", type: "BOOLEAN", default: "FALSE" },
        { name: "bio", type: "TEXT" },
        { name: "avatar_url", type: "VARCHAR(2048)" },
        { name: "settings", type: "JSONB", notNull: true, default: "'{}'::jsonb" },
        { name: "hash", type: "CHAR(60)", notNull: true },
        { name: "created_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "updated_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" }
    ],
    triggers: [
        { name: 'update_users_updated_at', timing: 'BEFORE', event: 'UPDATE', function: 'update_updated_at_column()' }
    ]
});

const createTokensTable = tableFactory({
    tableName: "tokens",
    columns: [
        { name: "id", type: "CHAR(26)", primaryKey: true },
        { name: "user_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "token_type", type: "VARCHAR(255)", notNull: true },
        { name: "token", type: "VARCHAR(255)", notNull: true, unique: true},
        { name: "expires_at", type: "TIMESTAMP", default : "CURRENT_TIMESTAMP + INTERVAL '1 hour'" },
        { name: "created_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "used_at", type: "TIMESTAMP" }
    ],
    indexes: [
        { name: "idx_tokens_user_id", columns: ["user_id"] }
    ]
});

const createSessionsTable = tableFactory({
    tableName: "sessions",
    columns: [
        { name: "id", type: "CHAR(26)", primaryKey: true },
        { name: "user_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "refresh_token_hash", type: "CHAR(64)", notNull: true, unique: true },
        { name: "expires_at", type: "TIMESTAMP", notNull: true },
        { name: "created_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "last_used_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "revoked_at", type: "TIMESTAMP" },
        { name: "user_agent", type: "VARCHAR(512)" },
        { name: "ip_address", type: "VARCHAR(64)" }
    ],
    indexes: [
        { name: "idx_sessions_user_id", columns: ["user_id"] }
    ]
});

const createFriendshipsTable = tableFactory({
    tableName: "friendships",
    columns: [
        { name: "id", type: "CHAR(26)", primaryKey: true },
        { name: "requester_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "addressee_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "status", type: "VARCHAR(10)", notNull: true, default: "'pending'", check: "status IN ('pending', 'accepted')" },
        { name: "created_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "updated_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" }
    ],
    constraints: ["requester_id <> addressee_id"],
    indexes: [
        { name: "idx_friendships_pair", unique: true, columns: ["LEAST(requester_id, addressee_id)", "GREATEST(requester_id, addressee_id)"] },
        { name: "idx_friendships_addressee", columns: ["addressee_id"] },
        { name: "idx_friendships_requester", columns: ["requester_id"] }
    ]
});

const createMessagesTable = tableFactory({
    tableName: "messages",
    columns: [
        { name: "id", type: "CHAR(26)", primaryKey: true },
        { name: "sender_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "recipient_id", type: "CHAR(26)", notNull: true, references: "users(id)", cascade: true },
        { name: "body", type: "VARCHAR(256)", notNull: true, check: "length(btrim(body)) > 0" },
        { name: "created_at", type: "TIMESTAMP", default: "CURRENT_TIMESTAMP" },
        { name: "read_at", type: "TIMESTAMP" }
    ],
    constraints: ["sender_id <> recipient_id"],
    indexes: [
        { name: "idx_messages_pair", columns: ["LEAST(sender_id, recipient_id)", "GREATEST(sender_id, recipient_id)", "id DESC"] },
        { name: "idx_messages_unread", columns: ["recipient_id"], where: "read_at IS NULL" },
        { name: "idx_messages_read_at", columns: ["read_at"], where: "read_at IS NOT NULL" }
    ]
});

async function createDB() {
    try {
        await createFunctions();
        console.log("\nCreating table 'users'...");
        const usersResult = await createUsersTable();
        console.log(usersResult.message + "\n");
        console.log("Creating table 'Tokens'...");
        const tokensResult = await createTokensTable();
        console.log(tokensResult.message + "\n");
        console.log("Creating table 'sessions'...");
        const sessionsResult = await createSessionsTable();
        console.log(sessionsResult.message + "\n");
        console.log("Creating table 'friendships'...");
        const friendshipsResult = await createFriendshipsTable();
        console.log(friendshipsResult.message + "\n");
        console.log("Creating table 'messages'...");
        const messagesResult = await createMessagesTable();
        console.log(messagesResult.message + "\n");
    } catch (error) {
        console.error("Error creating database\n", error);
        throw error;
    } finally {
        await pool.end();
    };
};

createDB()
    .then(() => console.log("Database created"))
    .catch(() => {
        process.exitCode = 1;
    });