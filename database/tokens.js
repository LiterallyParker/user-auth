const factories = require("./factories");
const tableName = "tokens"

const createToken = factories.createFactory({
    tableName,
    columns: ["user_id", "token_type", "token", "expires_at"],
    returning: ["id", "user_id", "token"],
});

const getToken = factories.getFactory({
    tableName,
    allowedFields: ["id", "user_id", "token_type", "token", "expires_at", "created_at", "used_at"],
    allowedConditions: ["id", "user_id"]
});

const updateToken = factories.updateFactory({
    tableName,
    allowedFields: ["token", "expires_at"],
    allowedConditions: ["id", "user_id", "token_type"],
    returning: ["id", "updated_at"]
});

const deleteToken = factories.deleteFactory({
    tableName,
    allowedConditions: ["id", "user_id"]
});

module.exports = {
    createToken,
    getToken,
    updateToken,
    deleteToken
}