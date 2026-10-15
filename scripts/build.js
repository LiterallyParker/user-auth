require("dotenv").config({ quiet: true });
const { pool } = require("../src/database");
const { tableFactory } = require("../src/database/factories");

async function createExtenstions() {
    try {
        console.log("Ensuring extensions...");

        console.log("No extensions to ensure");
    } catch (error) {
        console.error("Error while preping for creation\n", error)
    };
};

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

async function migrateUsersTable() {
    await pool.query(`
        ALTER TABLE users
            ADD COLUMN IF NOT EXISTS bio TEXT,
            ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(2048),
            ADD COLUMN IF NOT EXISTS settings JSONB NOT NULL DEFAULT '{}'::jsonb;
    `);
}

async function createDB() {
    try {
        await createExtenstions();
        await createFunctions();
        console.log("\nCreating table 'users'...");
        const usersResult = await createUsersTable();
        console.log(usersResult.message + "\n");
        await migrateUsersTable();
        console.log("Creating table 'Tokens'...");
        const tokensResult = await createTokensTable();
        console.log(tokensResult.message + "\n");
        console.log("Creating table 'sessions'...");
        const sessionsResult = await createSessionsTable();
        console.log(sessionsResult.message + "\n");
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