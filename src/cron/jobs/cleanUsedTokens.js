const { deleteToken } = require("../../database/tokens");

module.exports = {
    name: "CleanUsedTokens",
    cronExpression: "0 0 * * *", // at midnight
    job: async () => {
        const expiredRows = await deleteToken({ expiresAt: expiresAt > new Date() });
        const usedRows = await deleteToken({ usedAt: usedAt !== null });
    }
};