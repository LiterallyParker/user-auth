require("dotenv").config();
const { pool } = require("../database");
const { hashPassword } = require("../auth/password");
const { createUser } = require("../database/users");

async function seedUsers() {
    const hash = await hashPassword("SuperSecretPassword00!");
    const adminHash = await hashPassword("AdminSecretPassword00!");
    const admin = {
        firstName: "Admin",
        lastName: "Account",
        username: "admin",
        email: "admin@email.com",
        hash: adminHash
    }
    const userSeed = [
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
        for (const user of userSeed) await createUser(user)
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