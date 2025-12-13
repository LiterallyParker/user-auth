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
    try {
        // Verify required fields
        requireFields(["username", "email", "reqPass", "conPass"], req.body);
        
        // Handle registration
        const result = await handleRegistration(req.body);

        // Send refresh token as a cookie
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
        });

        // Respond
        return res.status(201).json({
            user: result.user,
            accessToken: result.accessToken
        });

    } catch (error) {
        // Error handling
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
                errors: error.errors
            });
        }
        if (error.name === "DuplicateError") {
            return res.status(409).json({
                message: error.message
            });
        };
        if (error.name === "DatabaseError") {
            return res.status(500).json({
                message: "A database error occured"
            });
        };
        // Unexpected Errors
        console.error("Unexpected registration error:", error)
        return res.status(500).json({
            message: "Internal server error"
        });
    };
});

authRoutes.post("/login", async (req, res) => {
    /*
    * Expects body:
    * {
    *   identifier: string (username or email) (required),
    *   password: string (required)
    * }
    */
    try {
        // Verify required fields
        requireFields(["identifier", "password"], req.body);
        
        // Handle login
        const result = await handleLogin(req.body);

        // Send refresh token as a cookie
        res.cookie("refreshToken", result.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            sameSite: "strict",
            maxAge: 7 * 24 * 60 * 60 * 1000 // 7 Days
        });

        // Respond
        return res.status(200).json({
            user: result.user,
            accessToken: result.accessToken
        });

    } catch (error) {
        // Error handling
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
                errors: error.errors
            });
        };
        if (error.name === "AuthError") {
            return res.status(401).json({
                message: error.message
            });
        };
        if (error.name === "DatabaseError") {
            return res.status(500).json({
                message: "A database error occured"
            });
        };
        // Unexpected Errors
        console.error("Unexpected login error:", error)
        return res.status(500).json({
            message: "Internal server error"
        });
    };
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
    try {
        // Verify required fields
        requireFields(["token"], req.query);

        // Handle verification
        await handleEmailVerification(req.query);

        // Respond
        return res.status(200).json({
            message: "Email verified successfully"
        });

    } catch (error) {
        // Error handling
        if (error.name === "ValidationError") {
            return res.status(400).json({
                message: error.message,
                errors: error.errors
            });
        };
        if (error.name === "TokenError") {
            const statusCode = error.message.includes("expired") ? 410 : 400;
            return res.status(statusCode).json({
                message: error.message
            });
        };
        if (error.name === "DatabaseError") {
            return res.status(500).json({
                message: "A database error occured"
            });
        };
        // Unexpected Errors
        console.error("Unexpected email verification error:", error)
        return res.status(500).json({
            message: "Internal server error"
        });
    };
});

module.exports = authRoutes;