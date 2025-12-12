const { Router } = require("express");
const { handleRegistration, handleLogin, handleEmailVerification } = require("../auth/handlers");
const { requireFields } = require("../util");
const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
    /*
    * Expects body:
    * {
    *   firstName: string (optional),
    *   lastName: string (optional),
    *   username: string (required),
    *   email: string (required),
    *   reqPass: string ,
    *   conPass: string
    * }
    */
    // Ensure required fields are provided
    const requiredFieldsResponse = requireFields(["username", "email", "reqPass", "conPass"], req.body);
    if (!requiredFieldsResponse.success) return res.status(401).json(requiredFieldsResponse);
    // Handle registration
    const result = await handleRegistration(req.body);
    if (!result.success) {
        const errorCodes = {
            // User existence errors
            UsernameExists: 409,
            EmailExists: 409,
            // Email errors
            EmailFormat: 400,
            EmailSpaces: 400,
            EmailLength: 400,
            // Username errors
            UsernameFormat: 400,
            UsernameEnds: 400,
            UsernameLength: 400,
            // Password errors
            PassLower: 400,
            PassUpper: 400,
            PassNumber: 400,
            PassSpecial: 400,
            PassLength: 400,
            PasswordMismatch: 400,
            // General registration failure
            RegistrationFailed: 500,
        };
        return res.status(errorCodes[result.error]).json(result)
    };
    // Extract registration data
    const { user, refreshToken, accessToken } = result;
    // Make refresh token a cookie (yum)
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
    });
    // Return success
    return res.status(200).json({ success: true, user, accessToken });
});

authRoutes.post("/login", async (req, res) => {
    /*
    * Expects body:
    * {
    *   identifier: string (username or email) (required),
    *   password: string (required)
    * }
    */
    // Ensure required fields are provided
    const requiredFieldsResponse = requireFields(["identifier", "password"], req.body);
    if (!requiredFieldsResponse.success) return res.status(401).json(requiredFieldsResponse);
    // Handle login
    const result = await handleLogin(req.body);
    if (!result.success) {
        const errorCodes = {
            InvalidCredentials: 401,
            LoginFailed: 500
        };
        return res.status(errorCodes[result.error]).json(result);
    };
    // Extract login data
    const { user, refreshToken, accessToken } = result;
    // Make refresh token a cookie (yum)
    res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
    });
    // Return success
    return res.status(200).json({ success: true, user, accessToken });
});

authRoutes.post("/logout", async (req, res) => {
    // Log out of the current session
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

authRoutes.post("/forgot-password", async (req, res) => {
    // Initiate forgot password instructions
    // Strict rate limiting
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

authRoutes.post("/reset-password", async (req, res) => {
    // Complete password reset
    // query: ?token={reset_token}
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

authRoutes.post("/refresh", async (req, res) => {
    // Refresh access tokens
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

authRoutes.get("/verify-email", async (req, res) => {
    /*
    * Expects query:
    * ?token={email_verification_token}
    */
    if (!req.query.token) return res.status(400).json({ success: false, error: "TokenRequired"});
    const result = await handleEmailVerification(req.query.token);
    if (!result.success) {
        const errorMap = {
            InvalidToken: 400,
            TokenExpired: 410,
            UserNotFound: 404,
            EmailAlreadyVerified: 409,
            EmailVerificationFailed: 500
        };
        return res.status(errorMap[result.error]).json(result);
    };

    return res.status(200).json(result);
});

module.exports = authRoutes;