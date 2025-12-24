const { Router } = require("express");
const { handleRegistration, handleLogin, handleEmailVerification, handleForgotPassword } = require("../auth/handlers");
const { requireFields } = require("../util");
const { verifyRefreshToken, createAccessToken } = require("../auth/jwt");
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
        console.error(error);
        return res.status(error.code).json(error);
    };
}); // Y

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
        console.error(error);
        return res.status(error.code).json(error);
    };
}); // Y

authRoutes.post("/logout", async (req, res) => {
    // Log out of the current session
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
}); // N

authRoutes.post("/forgot-password", async (req, res) => {
    /*
    * Expects body:
    * {
    *   email: string (required)
    * }
    * 
    */
    try {
        // Verify required fields
        requireFields(["email"], req.body);
    
        // Handle reset request
        const response = await handleForgotPassword(req.body);
    
        // Return
        return res.status(200).json(response);
    } catch (error) {
        console.log(error)
        return res.status(error.code).json(error);
    };
}); // Y

authRoutes.get("/reset-password", async (req, res) => {
    /*
    * Expects query:
    * ?token={resetToken}
    */
    res.status(200).json({ message: `Hit ${req.method} ${req.path}`})
}); // N

authRoutes.post("/refresh", async (req, res) => {
    /*
    * Expects cookie refreshToken
    */
    const refreshToken = req.cookies?.refreshToken;
    if (!refreshToken) {
        return res.status(401).json({ error: "Refresh token missing" });
    };

    const result = verifyRefreshToken(refreshToken);
    if (!result.valid) {
        return res.status(403).json({ error: "Invalid refresh token" });
    };

    const accessToken = createAccessToken({ id: result.data.id, email: result.data.email });
    return res.status(200).json({ accessToken });
}); // Y

authRoutes.get("/verify-email", async (req, res) => {
    /*
    * Expects query:
    * ?token={emailToken}
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
        console.error(error);
        return res.status(error.code).json(error);
    };
}); // Y

module.exports = authRoutes;