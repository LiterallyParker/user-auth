const { usernameConstraints, emailConstraints } = require("./constraints");
const { handlePassword, comparePassword } = require("./password");
const { handleConstraints } = require("../util");
const { createAccessToken, createRefreshToken } = require("./jwt");
const { createUser, getUser, getUserWithHash } = require("../database/users");
const { createToken, getToken } = require("../database/tokens")
const { genEmailToken } = require("./tokens");
const sendEmail = require("../emailer/sender");

async function handleRegistration({ firstName, lastName, username, email, reqPass, conPass }) {
    // Trim and normalize inputs
    firstName = firstName ? firstName.trim() : null;
    lastName = lastName ? lastName.trim() : null;
    email = email.toLowerCase().trim();
    username = username.trim();
    // Validate username
    const usernameEval = handleConstraints(usernameConstraints, username);
    if (!usernameEval.valid) return { success: false, error: usernameEval.errors[0] };
    // Validate email
    const emailEval = handleConstraints(emailConstraints, email);
    if (!emailEval.valid) return { success: false, error: emailEval.errors[0] };

    try {
        // Check for existing username
        const usernameExists = await getUser({ username }, ['id']);
        if (usernameExists) return { success: false, error: "UsernameExists" };
        // Check for existing email
        const emailExists = await getUser({ email }, ['id']);
        if (emailExists) return { success: false, error: "EmailExists" };
        // Handle password
        const passwordResponse = await handlePassword(reqPass, conPass);
        if (!passwordResponse.success) return { success: false, error: passwordResponse.error };
        const { hash } = passwordResponse;
        // Create user record
        const user = await createUser({ firstName, lastName, username, email, hash });
        // Generate email verification token and send email
        const emailToken = genEmailToken();
        createToken({
            userId: user.id,
            tokenType: "EmailVerification",
            token: emailToken
        }).then(() => sendEmail({ to: user.email, type: "VerifyEmail", data: { token: emailToken, username }}));
        // Create tokens
        const refreshToken = createRefreshToken({ id: user.id });
        const accessToken = createAccessToken({
            id: user.id,
            username: user.username,
            email: user.email
        });
        // Return success response
        return { success: true, user, refreshToken, accessToken };
    } catch (error) {
        console.error("Error while registering new user\n", error);
        return { success: false, error: "RegistrationFailed" };
    }
};

async function handleLogin({ identifier, password }) {
    // Trim inputs
    identifier = identifier.trim();
    password = password.trim();
    try {
        // Determine if identifier is email or username
        const condition = identifier.includes('@') ? { email: identifier.toLowerCase() } : { username: identifier };
        // Retrieve user with password hash
        const userWithHash = await getUserWithHash(condition);
        // Compare password, using dummy hash if user not found to prevent timing attacks
        const hashToCompare = userWithHash?.hash || '$2b$10$abcdefghijklmnopqrstuvwxyz01234567890ABCDEFGHIJKLMN';
        const passwordMatch = await comparePassword(password, hashToCompare);
        delete userWithHash?.hash;
        // Validate credentials
        if (!userWithHash || !passwordMatch) {
            return { success: false, error: "InvalidCredentials" };
        };
        // Retrieve full user record
        const user = await getUser(condition);
        // Create tokens
        const refreshToken = createRefreshToken({ id: user.id });
        const accessToken = createAccessToken({
            id: user.id,
            username: user.username,
            email: user.email
        });
        // Return success response
        return { success: true, user, refreshToken, accessToken };
    } catch (error) {
        console.error("Error while logging in user\n", error);
        return { success: false, error: "LoginFailed" };
    };
};

async function handleEmailVerification(token) {
    try {
        // Retrieve the token record from the database
        const tokenRecord = await getToken({
            token: token.trim(),
            tokenType: "EmailVerification"
        });
        // Verify a token was retrieved
        if (!tokenRecord) return { success: false, error: "InvalidToken" };
        // Verify the token has not been used or expired
        if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) return { success: false, error: "TokenExpired" };
        // Retrieve the associated user
        const user = await getUser({ id: tokenRecord.userId });
        // Verify the user exists
        if (!user) return { success: false, error: "UserNotFound" };
        // Check if the email is already verified
        if (user.emailVerified) return { success: false, error: "EmailAlreadyVerified" };
        // Update the user's emailVerified status
        await updateUser({ id: user.id }, { emailVerified: true });
        // Mark the token as used
        await updateToken({ id: tokenRecord.id }, { usedAt: new Date() });
        // Return success response
        return { success: true };
    } catch (error) {
        console.error("Error while verifying email token\n", error);
        return { success: false, error: "EmailVerificationFailed" };
    };
};

module.exports = {
    handleRegistration,
    handleLogin,
    handleEmailVerification
};