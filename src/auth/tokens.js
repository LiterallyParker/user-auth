const crypto = require("crypto");

function genHexToken() {
    return crypto.randomBytes(32).toString("hex");
};

module.exports = {
    genHexToken
};