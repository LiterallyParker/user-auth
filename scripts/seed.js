require("dotenv").config({ quiet: true });
const { pool } = require("../database");
const { hashPassword } = require("../auth/password");
const { createUser } = require("../database/users");

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
                await createUser(user)
            } catch (error) {
                if (error.name === "DatabaseError" && error.code === "23505") continue;
                console.error(error);
                return;
            };
        }
        console.log("Seeding admin...")
        await createUser(admin)

    } catch (error) {
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