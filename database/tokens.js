const factories = require("./factories");
const tableName = "tokens"

const createToken = factories.createFactory({
    tableName,
    columns: ["user_id", "token_type", "token"],
    returning: ["id", "user_id"],
});

const getToken = factories.getFactory({
    tableName,
    allowedFields: ["id", "user_id", "token_type", "token", "expires_at", "created_at", "used_at"],
    allowedConditions: ["id", "user_id", "token_type"]
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

const deleteBulkTokens = factories.deleteBulkFactory({
    tableName,
    allowedConditions: ["expires_at", "used_at"]
});

module.exports = {
    createToken,
    getToken,
    updateToken,
    deleteToken,
    deleteBulkTokens
};