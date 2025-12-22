const { usernameConstraints, emailConstraints } = require("./constraints");
const { handlePassword, comparePassword } = require("./password");
const { handleConstraints, ServerError, HTTPcodes } = require("../util");
const { createAccessToken, createRefreshToken } = require("./jwt");
const { createUser, getUser, getUserWithHash, updateUser } = require("../database/users");
const { createToken, getToken, updateToken } = require("../database/tokens")
const { genHexToken } = require("./tokens");
const sendEmail = require("../emailer/sender");

async function handleRegistration({ firstName, lastName, username, email, reqPass, conPass }) {
    // Trim and normalize inputs
    firstName = firstName ? firstName.trim() : null;
    lastName = lastName ? lastName.trim() : null;
    email = email.toLowerCase().trim();
    username = username.trim();

    // Validate username
    handleConstraints(usernameConstraints, username);

    // Validate email
    handleConstraints(emailConstraints, email);

    // Check for existing username
    const usernameExists = await getUser({ username }, ['id']);
    if (usernameExists) throw new ServerError(
        type = "DuplicateUsername",
        message = "Username already exists",
        code = HTTPcodes.conflict
    );

    // Check for existing email
    const emailExists = await getUser({ email }, ['id']);
    if (emailExists) throw new ServerError(
        type = "DuplicateEmail",
        message = "Email already exists",
        code = HTTPcodes.conflict
    );

    // Handle password
    const hash = await handlePassword({ reqPass, conPass });

    // Create user record
    const user = await createUser({ firstName, lastName, username, email, hash });

    // Generate email verification
    const emailToken = genHexToken();

    // Add token to database, then send verification email
    createToken({
        userId: user.id,
        tokenType: "EmailVerification",
        token: emailToken
    }).then(() => sendEmail({ to: user.email, type: "VerifyEmail", data: { token: emailToken, username } }));

    // Create tokens
    const refreshToken = createRefreshToken({ id: user.id });
    const accessToken = createAccessToken({
        id: user.id,
        username: user.username,
        email: user.email
    });

    // Return
    return { user, refreshToken, accessToken };
};

async function handleLogin({ identifier, password }) {
    // Trim inputs
    identifier = identifier.trim();
    password = password.trim();

    // Determine if identifier is email or username
    const condition = identifier.includes('@') ? { email: identifier.toLowerCase() } : { username: identifier };

    // Retrieve user with password hash
    const userWithHash = await getUserWithHash(condition);

    // Compare password, using dummy hash if user not found to prevent timing attacks
    const hashToCompare = userWithHash?.hash || '$2b$10$abcdefghijklmnopqrstuvwxyz01234567890ABCDEFGHIJKLMN';
    const passwordMatch = await comparePassword(password, hashToCompare);
    delete userWithHash?.hash;

    // Validate credentials
    if (!userWithHash || !passwordMatch) throw new ServerError(
        type = "Credential",
        message = "Invalid credentials",
        code = HTTPcodes.unauthorized
    );

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
    return { user, refreshToken, accessToken };
};

async function handleEmailVerification({ token }) {
    // Retrieve the token record from the database
    const tokenRecord = await getToken({
        token,
        tokenType: "EmailVerification"
    });

    // Verify a token was retrieved
    if (!tokenRecord) throw new ServerError(
        type = "TokenInvalid",
        message = "Invalid token",
        code = HTTPcodes.badRequest
    );

    // Verify the token has not been used or expired
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) {
        throw new ServerError(
            type = "TokenExpired",
            message = "Token is expired",
            code = HTTPcodes.badRequest
        )
    };

    // Retrieve the associated user
    const user = await getUser({ id: tokenRecord.userId });

    // Verify the user exists
    if (!user) throw new ServerError(
        type = "UserNotFound",
        message = "User not found - No user with that token's userId",
        code = HTTPcodes.notFound
    );

    // Check if the email is already verified
    if (user.emailVerified) throw new ServerError(
        type = "AlreadyVerified",
        message = "Email is already verified",
        code = HTTPcodes.conflict
    );

    // Update the user's emailVerified status
    await updateUser({ id: user.id }, { emailVerified: true });

    // Mark the token as used
    await updateToken({ id: tokenRecord.id }, { usedAt: new Date() });

    return { message: "Email verified successfully" };
};

async function handleForgotPassword({ email }) {
    // Trim email
    email = email.trim();

    // Ensure email is valid
    handleConstraints(emailConstraints, email);

    // Find a user with the provided email
    const user = await getUser({ email }, ["id", "email"]);
    if (!user) throw new ServerError(
        type = "UserNotFound",
        message = "No user with the provided email was found",
        code = HTTPcodes.notFound
    );

    // Generate password reset token
    const resetToken = genHexToken();

    // Add token to database, then send reset email
    createToken({
        userId: user.id,
        tokenType: "PasswordReset",
        token: resetToken
    }).then(() => sendEmail({ to: user.email, type: "ResetPassword", data: { token: resetToken } }));

    return { message: "Password reset email sent"}
};

module.exports = {
    handleRegistration,
    handleLogin,
    handleEmailVerification,
    handleForgotPassword
};