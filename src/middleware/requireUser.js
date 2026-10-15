const attachUser = require("./attachUser");
const { HTTPcodes } = require("../util");

function rejectAnonymous(req, res, next) {
    if (!req.user?.id) {
        return res.status(HTTPcodes.unauthorized).json({
            error: "AuthenticationRequired",
            message: "A valid access token is required"
        });
    }
    return next();
}

// Use as `router.use(...requireUser)`: resolves the session, then rejects anonymous requests
module.exports = [attachUser, rejectAnonymous];
