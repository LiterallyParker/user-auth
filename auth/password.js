const bcrypt = require("bcrypt");
const SALT_ROUNDS = parseInt(process.env.SALT_ROUNDS);
const { handleConstraints, ValidationError } = require("../util")

const passwordConstraints = {
    "PassLower": /[a-z]/,
    "PassUpper": /[A-Z]/,
    "PassNumber": /[0-9]/,
    "PassSpecial": /[!@#$%^&*]/,
    "PassLength": /.{12,}/,
};

async function hashPassword(password) {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    return hash;
};

async function comparePassword(password, hash) {
    const response = await bcrypt.compare(password, hash);
    return response;
};

async function handlePassword(reqPass, conPass) {
    // Trim whitespace
    reqPass = reqPass.trim();
    conPass = conPass.trim();

    // Compare requested and confirmed passwords
    if (reqPass !== conPass) throw new ValidationError("Passwords do not match", ["PasswordMismatch"]);
    
    // Ensure Password requirements are met
    handleConstraints(passwordConstraints, reqPass);
    
    // Hash requested password
    const hash = await hashPassword(reqPass);
    
    // Return success
    return hash;
};

module.exports = {
    hashPassword,
    comparePassword,
    handlePassword
};