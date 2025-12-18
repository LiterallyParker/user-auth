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

function handleConstraints(constraints, string, fieldName = null) {
    const failed = Object.entries(constraints)
        .filter(([rule, regex]) => !regex.test(string))
        .map(([rule]) => rule);
    
    if (failed.length > 0) throw new ServerError(
        type = "Constraint",
        message = `${fieldName ? fieldName : "Field"} validation failed`,
        code = HTTPcodes.badRequest,
        options = {
            failed
        }
    )
};

function requireFields(requiredFields, data) {
    const missing = [];
    requiredFields.forEach(field => {
        if (!data[field]) missing.push(field);
    });
    if (missing.length > 0) throw new ServerError(
        type = "MissingFields",
        message = "One or more required fields are missing",
        code = HTTPcodes.badRequest,
        options = {
            missing
        }
    );
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

class ServerError extends Error {
    constructor(type, message, code, options = {}) {
        super(message);
        this.type = type;
        this.code = code
        Object.entries(options).forEach(([key, value]) => { this[key] = value });
    }
}

const HTTPcodes = {
    okay: 200,
    created: 201,
    badRequest: 400,
    unauthorized: 401,
    forbidden: 403,
    notFound: 404,
    conflict: 409,
    internal: 500
}

module.exports = {
    ANSIcolors,
    handleConstraints,
    requireFields,
    snakeToCamel,
    camelToSnake,
    keysToCamel,
    keysToSnake,
    ServerError,
    HTTPcodes
};