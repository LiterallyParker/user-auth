const cron = require("node-cron");
const { ANSIcolors } = require("../util");

module.exports = (jobs = []) => {
    const scheduledTasks = [];

    for (const { name, cronExpression, job } of jobs) {
        try {
            if (!cron.validate(cronExpression)) {
                console.error(`${ANSIcolors.red}Invalid cron expression: ${cronExpression}${ANSIcolors.reset}`);
                continue
            };

            const task = cron.schedule(cronExpression, async () => {
                const jobName = name || "Unnamed job";
                try {
                    console.log(`${ANSIcolors.cyan}Running cron job ${jobName}`)
                    await job();
                } catch (error) {
                    console.error(`${ANSIcolors.red}Error in cron job ${jobName}`)
                }
            });

            scheduledTasks.push(task);
            console.log(`${ANSIcolors.green}Scheduled: ${name || "Unnamed job"} (${cronExpression})${ANSIcolors.reset}`);
        } catch (error) {
            console.error(`${ANSIcolors.red}Error scheduling a cron job${ANSIcolors.reset}\n`, error)
        }
    }

    return scheduledTasks;
}