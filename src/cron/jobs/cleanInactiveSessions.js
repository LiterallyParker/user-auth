const { deleteInactiveSessions } = require("../../database/sessions");

module.exports = {
    name: "CleanInactiveSessions",
    cronExpression: "0 0 * * *",
    job: async () => {
        const rows = await deleteInactiveSessions();
        console.log(`Removed ${rows} inactive sessions`);
    }
};
