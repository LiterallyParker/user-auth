const { deleteBulkTokens } = require("../../database/tokens");

module.exports = {
    name: "CleanExpiredTokens",
    cronExpression: "0 0 * * *", // at midnight
    job: async () => {
        try {
            const rows = await deleteBulkTokens({ expiresAt$lt: new Date() })
            console.log(rows)
        } catch (error) {
            console.error(error);
        }
    }
};