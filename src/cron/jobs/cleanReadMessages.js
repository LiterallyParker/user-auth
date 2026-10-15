const { deleteExpiredMessages } = require("../../database/messages");

module.exports = {
    name: "CleanReadMessages",
    cronExpression: "0 * * * *", // hourly
    job: async () => {
        const rows = await deleteExpiredMessages();
        console.log(`Removed ${rows} expired messages`);
    }
};
