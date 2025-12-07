require("dotenv").config({ quiet: true });
const { pool } = require("../database");
const { tableFactory } = require("../database/factories");
async function before() {
    try {
        await pool.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto;`);
        await pool.query(`
            CREATE OR REPLACE FUNCTION update_updated_at_column()
            RETURNS TRIGGER AS $$
            BEGIN
                NEW.updated_at = CURRENT_TIMESTAMP;
                RETURN NEW;
            END;
            $$ language 'plpgsql';
        `);
    } catch (error) {
        console.error("Error while preping for creation\n", error)
    };
};
const createUsersTable = tableFactory({
    tableName: "users",
    columns: [
        { name: "id", type: "UUID", primaryKey: true, default: "gen_random_uuid()" },
        { name: "first_name", type: "VARCHAR(100)" },
        { name: "last_name", type: "VARCHAR(100)" },
        { name: "username", type: "VARCHAR(30)", notNull: true, unique: true, check: "length(username) >= 3 AND username ~ '^[a-zA-Z0-9._-]+$'"},
        { name: "email", type: "VARCHAR(255)", notNull: true, unique: true, check: "email = lower(email)"},
        { name: "email_verified", type: "BOOLEAN", default: "FALSE" },
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
        { name: "id", type: "UUID", primaryKey: true, default: "gen_random_uuid()" },
        { name: "user_id", type: "UUID", notNull: true, references: "users(id)", cascade: true },
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

async function createDB() {
    try {
        await before().then(() => console.log("Completed pre-build"));
        await createUsersTable().then(() => console.log("Table 'users' created"));
        await createTokensTable().then(() => console.log("Table 'tokens' created"));
        await pool.end();
    } catch (error) {
        console.error("Error creating database\n", error);
    };
};
createDB().then(() => {
    console.log("Database created");
});