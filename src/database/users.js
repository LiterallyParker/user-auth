const factories = require("./factories");
const tableName = "users";

const createUser = factories.createFactory({
    tableName,
    columns: ["first_name", "last_name", "username", "email", "hash"],
    returning: ["id", "first_name", "last_name", "username", "email", "email_verified", "created_at", "updated_at"],
});

const getUser = factories.getFactory({
    tableName,
    allowedFields: ["id", "first_name", "last_name", "username", "email", "email_verified", "created_at", "updated_at"],
    allowedConditions: ["id", "username", "email"]
});

const getPublicUser = factories.getFactory({
    tableName,
    allowedFields: ["id", "first_name", "last_name", "username", "email_verified", "created_at"],
    allowedConditions: ["id"]
});

const getUserWithHash = factories.getFactory({
    tableName,
    allowedFields: ["id", "hash"],
    allowedConditions: ["username", "email"]
});

const updateUser = factories.updateFactory({
    tableName,
    allowedFields: ["first_name", "last_name", "username", "email", "hash", "email_verified"],
    allowedConditions: ["id"],
    returning: ["id", "updated_at"]
});

const deleteUser = factories.deleteFactory({
    tableName,
    allowedConditions: ["id"]
});

module.exports = {
    createUser,
    getUser,
    getPublicUser,
    getUserWithHash,
    updateUser,
    deleteUser
};