const scheduler = require("./scheduler")
const jobs = require("./jobs");
const { ANSIcolors } = require("../util");

module.exports = () => {
    const tasks = scheduler(jobs);
    console.log(`Started ${tasks.length} cron jobs`);
    for (const job of jobs) {
        console.log(`  ${ANSIcolors.magenta}${job.name}${ANSIcolors.reset}`)
    }
    return tasks;
};