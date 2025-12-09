const { deleteToken } = require("../../database/tokens");

const cleanExpiredTokens = {
    cron: "0 * * * *", // Every hour at minute 0
    job: async () => {
        const expiredRows = await deleteToken({ expiresAt: expiresAt > new Date() });
        const usedRows = await deleteToken({ usedAt: usedAt !== null });
    }
};