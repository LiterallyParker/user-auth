const scheduler = require("./scheduler")
const jobs = require("./jobs");

module.exports = () => {
    const tasks = scheduler(jobs);
    console.log(`Started ${tasks.length} cron jobs`);
    return tasks;
};