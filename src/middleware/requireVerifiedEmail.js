const { HTTPcodes } = require("../util");
const { getUser } = require("../database/users");

// Checked against the database rather than the token, which can outlive a verification change
module.exports = async (req, res, next) => {
    try {
        const user = await getUser({ id: req.user.id }, ["id", "email_verified"]);
        if (!user?.emailVerified) {
            return res.status(HTTPcodes.forbidden).json({
                error: "EmailNotVerified",
                message: "Verify your email to message, add friends, or join and run clubs"
            });
        }
        return next();
    } catch (error) {
        return next(error);
    }
};
