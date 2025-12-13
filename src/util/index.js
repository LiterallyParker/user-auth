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
    
    if (failed.length > 0) throw new ValidationError(`${fieldName ? fieldName : "Field"} validation failed`, failed)
};

function requireFields(requiredFields, data) {
    const missing = [];
    requiredFields.forEach(field => {
        if (!data[field]) missing.push(field);
    });
    if (missing.length > 0) throw new ValidationError("Missing a required field", missing);
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

class DatabaseError extends Error {
    constructor(message, { table, operation, code } = {}) {
        super(message);
        this.name = "DatabaseError";
        this.table = table;
        this.operation = operation;
        this.code = code;
    };
};

class ValidationError extends Error {
    constructor(message, errors = []) {
        super(message);
        this.name = "ValidationError";
        this.errors = Array.isArray(errors) ? errors : [errors];
    };
};

class TokenError extends Error {
    constructor(message) {
        super(message);
        this.name = "TokenError"
    };
};

class DuplicateError extends Error {
    constructor(message) {
        super(message);
        this.name = "DuplicateError"
    };
};

class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError"
    };
};

class AuthError extends Error {
    constructor(message) {
        super(message);
        this.name = "AuthError"
    };
};

module.exports = {
    ANSIcolors,
    handleConstraints,
    requireFields,
    snakeToCamel,
    camelToSnake,
    keysToCamel,
    keysToSnake,
    DatabaseError,
    ValidationError,
    TokenError,
    DuplicateError,
    NotFoundError,
    AuthError
};