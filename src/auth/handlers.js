const { usernameConstraints, emailConstraints } = require("./constraints");
const { handlePassword, comparePassword } = require("./password");
const { handleConstraints, ServerError, HTTPcodes } = require("../util");
const { createAccessToken, createRefreshToken, verifyRefreshToken } = require("./jwt");
const { ulid } = require("ulid");
const { createUser, getUser, getUserWithHash, updateUser, deleteUser } = require("../database/users");
const {
    createToken,
    getToken,
    updateToken,
    deleteUserTokensByType
} = require("../database/tokens")
const {
    createSession,
    getSession,
    rotateSession,
    revokeSessionWithRefreshToken,
    revokeAllSessions
} = require("../database/sessions");
const { genHexToken } = require("./tokens");
const sendEmail = require("../emailer/sender");

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

async function createAuthSession(user, metadata = {}) {
    const sessionId = ulid();
    const refreshToken = createRefreshToken({ id: user.id, sid: sessionId });
    await createSession({
        id: sessionId,
        userId: user.id,
        refreshToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
        userAgent: metadata.userAgent,
        ipAddress: metadata.ipAddress
    });
    const accessToken = createAccessToken({
        id: user.id,
        username: user.username,
        email: user.email,
        sid: sessionId
    });
    return { refreshToken, accessToken };
}

async function handleRegistration({ firstName, lastName, username, email, reqPass, conPass }, metadata) {
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
    await createToken({
        userId: user.id,
        tokenType: "EmailVerification",
        token: emailToken
    });
    const emailResult = await sendEmail({
        to: user.email,
        type: "VerifyEmail",
        data: { token: emailToken, username }
    });
    if (!emailResult.success) {
        console.error("Failed to send verification email:", emailResult.error);
    }

    // Create tokens
    const { refreshToken, accessToken } = await createAuthSession(user, metadata);

    // Return
    return { user, refreshToken, accessToken };
};

async function handleLogin({ identifier, password }, metadata) {
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
    const { refreshToken, accessToken } = await createAuthSession(user, metadata);

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
    if (tokenRecord.usedAt) throw new ServerError(
        type = "TokenUsed",
        message = "Token has already been used",
        code = HTTPcodes.badRequest
    );

    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date()) {
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
    email = email.trim().toLowerCase();

    // Ensure email is valid
    handleConstraints(emailConstraints, email);

    // Find a user with the provided email
    const user = await getUser({ email }, ["id", "email"]);
    const genericResponse = {
        message: "If an account exists for that email, password reset instructions will be sent"
    };
    if (!user) return genericResponse;

    // Generate password reset token
    const resetToken = genHexToken();

    // Add token to database, then send reset email
    await createToken({
        userId: user.id,
        tokenType: "PasswordReset",
        token: resetToken
    });
    const emailResult = await sendEmail({
        to: user.email,
        type: "ResetPassword",
        data: { token: resetToken }
    });
    if (!emailResult.success) throw new ServerError(
        type = "EmailDeliveryFailed",
        message = "Failed to send password reset email",
        code = HTTPcodes.internal
    );

    return genericResponse;
};

async function handlePasswordReset({ token, reqPass, conPass }) {
    if (typeof token !== "string" || !/^[a-f0-9]{64}$/i.test(token)) {
        throw new ServerError(
            type = "TokenInvalid",
            message = "Invalid password reset token",
            code = HTTPcodes.badRequest
        );
    }

    const tokenRecord = await getToken({ token, tokenType: "PasswordReset" });
    if (!tokenRecord) throw new ServerError(
        type = "TokenInvalid",
        message = "Invalid password reset token",
        code = HTTPcodes.badRequest
    );
    if (tokenRecord.usedAt) throw new ServerError(
        type = "TokenUsed",
        message = "Password reset token has already been used",
        code = HTTPcodes.badRequest
    );
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) <= new Date()) {
        throw new ServerError(
            type = "TokenExpired",
            message = "Password reset token has expired",
            code = HTTPcodes.badRequest
        );
    }

    const user = await getUser({ id: tokenRecord.userId }, ["id"]);
    if (!user) throw new ServerError(
        type = "TokenInvalid",
        message = "Invalid password reset token",
        code = HTTPcodes.badRequest
    );

    const hash = await handlePassword({ reqPass, conPass });
    await updateUser({ id: user.id }, { hash });
    await updateToken({ id: tokenRecord.id }, { usedAt: new Date() });
    await revokeAllSessions(user.id);
};

async function handleRefresh({ refreshToken }) {
    if (!refreshToken) throw new ServerError(
        type = "MissingRefreshToken",
        message = "Refresh token is missing",
        code = 401
    );

    const result = verifyRefreshToken(refreshToken);
    if (!result.valid) throw new ServerError(
        type = "InvalidRefreshToken",
        message = "Refresh token is invalid",
        code = 403
    );

    const sessionId = result.data.sid;
    if (!sessionId) throw new ServerError(
        type = "InvalidRefreshToken",
        message = "Refresh token is invalid",
        code = HTTPcodes.unauthorized
    );

    const session = await getSession({ id: sessionId, userId: result.data.id });
    if (!session || session.revokedAt || new Date(session.expiresAt) <= new Date()) {
        throw new ServerError(
            type = "InvalidRefreshToken",
            message = "Refresh token is invalid",
            code = HTTPcodes.unauthorized
        );
    }

    const user = await getUser({ id: result.data.id }, ["id", "username", "email"]);
    if (!user) throw new ServerError(
        type = "UserNotFound",
        message = "User associated with refresh token no longer exists",
        code = HTTPcodes.unauthorized
    );
    const newRefreshToken = createRefreshToken({ id: user.id, sid: sessionId });
    const rotated = await rotateSession({
        id: sessionId,
        userId: user.id,
        currentRefreshToken: refreshToken,
        nextRefreshToken: newRefreshToken,
        expiresAt: new Date(Date.now() + SESSION_DURATION_MS)
    });
    if (!rotated) throw new ServerError(
        type = "InvalidRefreshToken",
        message = "Refresh token has already been rotated or revoked",
        code = HTTPcodes.unauthorized
    );

    const accessToken = createAccessToken({
        ...user,
        sid: sessionId
    });
    return { accessToken, refreshToken: newRefreshToken }
};

async function handleLogout({ refreshToken }) {
    if (!refreshToken) return;
    const result = verifyRefreshToken(refreshToken);
    if (!result.valid || !result.data.sid || !result.data.id) return;
    await revokeSessionWithRefreshToken({
        id: result.data.sid,
        userId: result.data.id,
        refreshToken
    });
}

async function handlePasswordVerification({ userId, password }) {
    const user = await getUserWithHash({ id: userId });
    if (!user || typeof password !== "string" || !(await comparePassword(password, user.hash))) {
        throw new ServerError(
            type = "Credential",
            message = "Invalid password",
            code = HTTPcodes.unauthorized
        );
    }
    return { valid: true };
}

async function handlePasswordChange({ userId, currentPassword, reqPass, conPass }) {
    await handlePasswordVerification({ userId, password: currentPassword });
    const hash = await handlePassword({ reqPass, conPass });
    await updateUser({ id: userId }, { hash });
    await revokeAllSessions(userId);
}

async function createEmailVerification(user) {
    const token = genHexToken();
    await createToken({
        userId: user.id,
        tokenType: "EmailVerification",
        token
    });
    const result = await sendEmail({
        to: user.email,
        type: "VerifyEmail",
        data: { token, username: user.username }
    });
    if (!result.success) throw new ServerError(
        type = "EmailDeliveryFailed",
        message = "Failed to send verification email",
        code = HTTPcodes.internal
    );
}

async function handleResendEmailVerification(userId) {
    const user = await getUser({ id: userId }, ["id", "username", "email", "emailVerified"]);
    if (!user) throw new ServerError(
        type = "UserNotFound",
        message = "User not found",
        code = HTTPcodes.notFound
    );
    if (user.emailVerified) throw new ServerError(
        type = "AlreadyVerified",
        message = "Email is already verified",
        code = HTTPcodes.conflict
    );
    await createEmailVerification(user);
}

async function handleEmailChange({ userId, currentPassword, email }) {
    if (typeof email !== "string") throw new ServerError(
        type = "InvalidEmail",
        message = "Email must be a string",
        code = HTTPcodes.badRequest
    );
    email = email.trim().toLowerCase();
    handleConstraints(emailConstraints, email, "Email");
    await handlePasswordVerification({ userId, password: currentPassword });

    const existing = await getUser({ email }, ["id"]);
    if (existing) throw new ServerError(
        type = "DuplicateEmail",
        message = "Email already exists",
        code = HTTPcodes.conflict
    );

    try {
        await updateUser({ id: userId }, { email, emailVerified: false });
    } catch (error) {
        if (error.psqlCode === "23505") throw new ServerError(
            type = "DuplicateEmail",
            message = "Email already exists",
            code = HTTPcodes.conflict
        );
        throw error;
    }

    await deleteUserTokensByType(userId, "EmailVerification");
    const user = await getUser({ id: userId }, ["id", "username", "email"]);
    await createEmailVerification(user);
    await revokeAllSessions(userId);
}

async function handleAccountDeletion({ userId, password }) {
    await handlePasswordVerification({ userId, password });
    const deleted = await deleteUser({ id: userId });
    if (!deleted) throw new ServerError(
        type = "UserNotFound",
        message = "User not found",
        code = HTTPcodes.notFound
    );
    return true;
}

module.exports = {
    handleRegistration,
    handleLogin,
    handleEmailVerification,
    handleForgotPassword,
    handlePasswordReset,
    handleRefresh,
    handleLogout,
    handlePasswordVerification,
    handlePasswordChange,
    handleResendEmailVerification,
    handleEmailChange,
    handleAccountDeletion
};