const { verifyAccessToken } = require("../auth/jwt");
const { getSession } = require("../database/sessions");

module.exports = async (req, res, next) => {
    try {
        const prefix = "Bearer ";
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            return next()
        };
        if (!authHeader.startsWith(prefix)) {
            return next();
        };
        const accessToken = authHeader.slice(prefix.length);
        const response = verifyAccessToken(accessToken);
        if (!response.valid || !response.data.sid || !response.data.id) {
            return next();
        };

        const session = await getSession({
            id: response.data.sid,
            userId: response.data.id
        });
        if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
            return next();
        }

        req.user = response.data;
        return next();
        
    } catch (error) {
        return next(error);
    };
};