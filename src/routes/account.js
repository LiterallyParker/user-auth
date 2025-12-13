const { Router } = require("express");
const accountRoutes = Router();

accountRoutes.post("/export", (req, res) => {
    // Export account data
    // Strict rate limiting
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.post("/change-password", (req, res) => {
    // Change account password
    // Strict rate limiting
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.post("/verify-password", (req, res) => {
    // Verify account password
    // Strict rate limiting
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.post("/resend-verify-email", (req, res) => {
    // Resend email verification
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.get("/", (req, res) => {
    // Get account info
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.get("/settings", (req, res) => {
    // Get account settings
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.get("/sessions", (req, res) => {
    // Get account sessions
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.patch("/", (req, res) => {
    // Update select account info (Name, Bio, profile image, any other non-sensitive info)
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.patch("/settings", (req, res) => {
    // Update select account settings (Privacy, Data sharing, Cookies, Email registries)
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.patch("/email", (req, res) => {
    // Update account email
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.delete("/", (req, res) => {
    // Delete account
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.delete("/sessions", (req, res) => {
    // Revoke all sessions
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

accountRoutes.delete("/sessions/:id", (req, res) => {
    // Revoke a single session
    res.status(200).json({ message: `Hit ${req.method} ${req.path}` });
});

module.exports = accountRoutes