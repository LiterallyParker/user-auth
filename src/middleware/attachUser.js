const { verifyAccessToken } = require("../auth/jwt");

module.exports = async (req, res, next) => {
    try {
        const prefix = "Bearer ";
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next()
        };
        if (!authHeader.startsWith(prefix)) {
            console.error("Malformed authorization header.");
            return next();
        };
        const accessToken = authHeader.slice(prefix.length);
        const response = verifyAccessToken(accessToken);
        if (!response.valid) {
            return next();
        };

        req.user = response.data;
        return next();
        
    } catch (error) {
        console.error("Error while verifying JWTs\n", error);
        next();
    };
};