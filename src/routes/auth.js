const { Router } = require("express");
const {
    handleRegistration,
    handleLogin,
    handleEmailVerification,
    handleForgotPassword,
    handlePasswordReset,
    handleRefresh,
    handleLogout
} = require("../auth/handlers");
const { requireFields } = require("../util");
const authRoutes = Router();

function getSessionMetadata(req) {
    return {
        userAgent: req.get("user-agent"),
        ipAddress: req.ip
    };
}

const refreshCookieOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000
};

function sendRouteError(res, error) {
    const status = Number.isInteger(error?.code) ? error.code : 500;
    if (status >= 500) console.error(error);
    return res.status(status).json({
        error: error?.type || "InternalServerError",
        message: status >= 500 ? "An unexpected error occurred" : error.message,
        ...(error?.missing ? { missing: error.missing } : {}),
        ...(error?.failed ? { failed: error.failed } : {})
    });
}

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
        requireFields(["username", "email", "reqPass", "conPass"], req.body || {});

        // Handle registration
        const result = await handleRegistration(req.body, getSessionMetadata(req));

        // Send refresh token as a cookie
        res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

        // Respond
        return res.status(201).json({
            user: result.user,
            accessToken: result.accessToken
        });

    } catch (error) {
        return sendRouteError(res, error);
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
        requireFields(["identifier", "password"], req.body || {});

        // Handle login
        const result = await handleLogin(req.body, getSessionMetadata(req));

        // Send refresh token as a cookie
        res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

        // Respond
        return res.status(200).json({
            user: result.user,
            accessToken: result.accessToken
        });

    } catch (error) {
        return sendRouteError(res, error);
    };
});

authRoutes.post("/logout", async (req, res) => {
    try {
        await handleLogout({ refreshToken: req.cookies?.refreshToken });
    } catch (error) {
        res.clearCookie("refreshToken", refreshCookieOptions);
        return sendRouteError(res, error);
    }
    res.clearCookie("refreshToken", refreshCookieOptions);
    return res.status(200).json({ message: "Logged out successfully" });
}); // Revokes the server-side session and clears the refresh-token cookie.

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
        requireFields(["email"], req.body || {});

        // Handle reset request
        const response = await handleForgotPassword(req.body);

        // Return
        return res.status(200).json(response);
    } catch (error) {
        return sendRouteError(res, error);
    };
});

authRoutes.get("/reset-password", async (req, res) => {
    /*
    * Expects query:
    * ?token={resetToken}
    */
    const token = req.query.token;
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
        return res.status(400).json({
            error: "TokenInvalid",
            message: "Invalid or missing password reset link"
        });
    }

    const resetURL = new URL(
        "/",
        process.env.CLIENT_URL || `${req.protocol}://${req.get("host")}`
    );
    resetURL.searchParams.set("resetPassword", token);
    return res.redirect(302, resetURL.toString());
});

authRoutes.post("/reset-password", async (req, res) => {
    /*
    * Expects body:
    * {
    *   token: string,
    *   reqPass: string,
    *   conPass: string
    * }
    */
    try {
        requireFields(["token", "reqPass", "conPass"], req.body || {});
        await handlePasswordReset(req.body);
        res.clearCookie("refreshToken", refreshCookieOptions);
        return res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
        return sendRouteError(res, error);
    }
});

authRoutes.post("/refresh", async (req, res) => {
    /*
    * Expects cookie refreshToken
    */
    const refreshToken = req.cookies?.refreshToken
    try {
        const result = await handleRefresh({ refreshToken });

        res.cookie("refreshToken", result.refreshToken, refreshCookieOptions);

        return res.status(200).json({ accessToken: result.accessToken });

    } catch (error) {
        res.clearCookie("refreshToken", refreshCookieOptions);
        return sendRouteError(res, error);
    }

});

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
        return sendRouteError(res, error);
    };
});

module.exports = authRoutes;