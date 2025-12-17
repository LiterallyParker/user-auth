require("dotenv").config({ quiet: true });
const { spawn } = require("child_process");
const { ANSIcolors } = require("../src/util");
const { pool } = require("../src/database");

async function runScript(scriptPath, label) {
    return new Promise((res, rej) => {
        console.log(`\n${ANSIcolors.blue}-= ${label} =-\n${ANSIcolors.yellow}-= ${scriptPath} =-\n${ANSIcolors.reset}`);
        const child = spawn("node", [scriptPath]);

        child.stdout.on("data", (data) => process.stdout.write(`  ${ANSIcolors.green}${data}${ANSIcolors.reset}`));
        child.stderr.on("data", (data) => process.stderr.write(`  ${ANSIcolors.red}${data}${ANSIcolors.reset}`));

        child.on("close", (code) => {
            if (code === 0) {
                res();
            } else {
                rej(new Error(`Process '${label}' failed with code ${code}`));
            };
        });
    });
};

async function test() {
    try {
        await runScript("./scripts/build.js", "Building Database");
        await runScript("./scripts/seed.js", "Seeding Database");

        console.log(`${ANSIcolors.bright}${ANSIcolors.green}\n-= Tests Complete =-${ANSIcolors.reset}`);
        pool.end();
    } catch (error) {
        console.error(`${ANSIcolors.bright}${ANSIcolors.red}xX Test Failed Xx\n${error.message}${ANSIcolors.reset}`);
        process.exit(1);
    };
};

test();