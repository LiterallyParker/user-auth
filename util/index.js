const ANSIcolors = {
    // Styles
    reset: "\x1b[0m",
    bright: "\x1b[1m",
    dim: "\x1b[2m",

    // Colors
    black: "\x1b[30m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    magenta: "\x1b[35m",
    cyan: "\x1b[36m",
    white: "\x1b[37m",
};

function handleConstraints(constraints, string) {
    const failed = Object.entries(constraints)
        .filter(([rule, regex]) => !regex.test(string))
        .map(([rule]) => rule);

    return failed.length > 0
        ? { valid: false, errors: failed }
        : { valid: true };
};

function requireFields(requiredFields, data) {
    const missing = [];
    requiredFields.forEach(field => {
        if (!data[field]) missing.push(field);
    });
    if (missing.length > 0) return { success: false, error: "MissingFields", missing };
    return { success: true }
};

function snakeToCamel(str) {
    return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
};

function camelToSnake(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
};

function keysToCamel(obj) {
    return Object.entries(obj).reduce((result, [k, v]) => {
        result[snakeToCamel(k)] = v;
        return result;
    }, {});
};

function keysToSnake(obj) {
    return Object.entries(obj).reduce((result, [k, v]) => {
        result[camelToSnake(k)] = v;
        return result;
    }, {});
};

module.exports = {
    ANSIcolors,
    handleConstraints,
    requireFields,
    snakeToCamel,
    camelToSnake,
    keysToCamel,
    keysToSnake
};