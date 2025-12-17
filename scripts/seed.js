require("dotenv").config({ quiet: true });
const { pool } = require("../src/database");
const { hashPassword } = require("../src/auth/password");
const { createUser } = require("../src/database/users");

async function seedUsers() {
    const hash = await hashPassword("SuperSecretPassword00!");
    const adminHash = await hashPassword("AdminSecretPassword00!");
    const admin = {
        firstName: "Seeded",
        lastName: "Account",
        username: "admin",
        email: "admin@email.com",
        hash: adminHash
    }
    const userSeed = [
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user1",
            email: "user1@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user2",
            email: "user2@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user3",
            email: "user3@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user4",
            email: "user4@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user5",
            email: "user5@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user6",
            email: "user6@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user7",
            email: "user7@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user8",
            email: "user8@email.com",
            hash
        },
        {
            firstName: "Seeded",
            lastName: "Account",
            username: "user9",
            email: "user9@email.com",
            hash
        },
    ];
    try {
        for (const user of userSeed) {
            console.log("Seeding user:", user.username);
            try {
                await createUser(user);
                console.log("Seeded")
            } catch (error) {
                if (error.code === "23505") {
                    console.error("Already seeded");
                    continue;
                }; // User already seeded
                console.error(error);
            };
        }
        console.log("Seeding admin...")
        try {
            await createUser(admin)
        } catch (error) {
            if (error.code === "23505") {
                console.error("Already seeded");
                return
            };
            console.error(error)
        }

    } catch (error) {
        if (error.code === "23505") return;
        console.log("Error seeding users\n", error);
        throw error;
    }
};

async function seedDB() {
    await seedUsers();
    await pool.end();
    console.log("Seeding complete");
};

seedDB();