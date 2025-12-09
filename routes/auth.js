const { Router } = require("express");
const { handleRegistration, handleLogin, handleEmailVerification } = require("../auth/handlers");
const { requireFields } = require("../util");
const authRoutes = Router();

authRoutes.post("/register", async (req, res) => {
    // Ensure required fields are provided
    const requiredFieldsResponse = requireFields(["username", "email", "reqPass", "conPass"], req.body);
    if (!requiredFieldsResponse.success) return res.status(401).json(requiredFieldsResponse);

    // Extract body data
    const {
        firstName,
        lastName,
        username,
        email,
        reqPass,
        conPass
    } = req.body;

    // Handle registration
    const result = await handleRegistration({ firstName, lastName, username, email, reqPass, conPass });
    if (!result.success) return res.status(401).json(result);

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
    res.status(200).json({ success: true, user, accessToken });
});

authRoutes.post("/login", async (req, res) => {
    // Ensure required fields are provided
    const requiredFieldsResponse = requireFields(["identifier", "password"], req.body);
    if (!requiredFieldsResponse.success) return res.status(401).json(requiredFieldsResponse);

    // Extract body data
    const {
        identifier,
        password
    } = req.body;

    // Handle login
    const result = await handleLogin({ identifier, password });
    if (!result.success) return res.status(401).json(result);

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
    res.status(200).json({ success: true, user, accessToken });
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
    const { token } = req.query;
    if (!token) return res.status(400).json({ success: false, error: "TokenRequired"});
    
    const result = await handleEmailVerification(token);
    
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