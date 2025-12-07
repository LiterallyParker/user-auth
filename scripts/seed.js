const { pool } = require("../database");
const { hashPassword } = require("../auth/password");

async function resetSeeds(tablesToClear = ['users']) {
    try {
        const resetPromises = tablesToClear.map(table => 
            pool.query(`
                DELETE FROM ${table};
            `)
        );
        await Promise.all(resetPromises);
        console.log("Seeds reset");
    } catch (error) {
        console.error("Error reseting seeds\n", error);
        throw error;
    };
};

async function seedUsers() {
    const hash = await hashPassword("SuperSecretPassword00!");
    const adminHash = await hashPassword("AdminSecretPassword00!");
    const userSeed = [
        {
            firstName: "Admin",
            lastName: "Account",
            username: "admin",
            email: "admin@email.com",
            hash: adminHash
        },
        {
            firstName: "Seeded",
            lastName: "User1",
            username: "user1",
            email: "user1@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User2",
            username: "user2",
            email: "user2@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User3",
            username: "user3",
            email: "user3@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User4",
            username: "user4",
            email: "user4@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User5",
            username: "user5",
            email: "user5@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User6",
            username: "user6",
            email: "user6@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User7",
            username: "user7",
            email: "user7@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User8",
            username: "user8",
            email: "user8@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "User9",
            username: "user9",
            email: "user9@email.com",
            hash
        },
    ];
    try {
        const insertPromises = userSeed.map(user =>
            pool.query(`
                INSERT INTO users (first_name, last_name, username, email, hash)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING *;
            `, [user.firstName, user.lastName, user.username, user.email, user.hash])
        );

        const results = await Promise.all(insertPromises);
        const seeded = results.map(r => r.rows[0]);

        console.log(`Successfully seeded ${seeded.length} entries into table 'users'`);
        return seeded;

    } catch (error) {
        console.log("Error seeding users\n", error);
        throw error;
    }
};

async function seedDB() {
    await resetSeeds();
    await seedUsers();
    await pool.end();
    console.log("Seeding complete");
};

seedDB();