const { deleteBulkTokens } = require("../../database/tokens");

module.exports = {
    name: "CleanUsedTokens",
    cronExpression: "0 0 * * *", // at midnight
    job: async () => {
        try {
            const rows = await deleteBulkTokens({ usedAt$notNull: true })
            console.log(rows)
        } catch (error) {
            console.error(error);
        }
    }
};