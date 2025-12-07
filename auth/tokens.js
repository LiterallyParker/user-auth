const crypto = require("crypto");

function genEmailToken() {
    return crypto.randomBytes(32).toString("hex");
};

module.exports = {
    genEmailToken
};