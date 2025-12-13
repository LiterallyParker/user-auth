const emailConstraints = {
    "EmailFormat": /^[a-zA-Z0-9._+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    "EmailSpaces": /^\S+$/,
    "EmailLength": /^.{1,320}$/
};

const usernameConstraints = {
    "UsernameFormat": /^[a-zA-Z0-9._-]+$/,
    "UsernameEnds": /^[^._-].*[^._-]$/,
    "UsernameLength": /^.{3,30}$/
};

module.exports = {
    emailConstraints,
    usernameConstraints
};