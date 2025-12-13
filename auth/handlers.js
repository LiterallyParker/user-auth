const { usernameConstraints, emailConstraints } = require("./constraints");
const { handlePassword, comparePassword } = require("./password");
const { handleConstraints, TokenError, NotFoundError, AuthError, DuplicateError } = require("../util");
const { createAccessToken, createRefreshToken } = require("./jwt");
const { createUser, getUser, getUserWithHash, updateUser } = require("../database/users");
const { createToken, getToken, updateToken } = require("../database/tokens")
const { genEmailToken } = require("./tokens");
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
    if (usernameExists) throw new DuplicateError("Username already exists")

    // Check for existing email
    const emailExists = await getUser({ email }, ['id']);
    if (emailExists) throw new DuplicateError("Email already exists")

    // Handle password
    const hash = await handlePassword(reqPass, conPass);

    // Create user record
    const user = await createUser({ firstName, lastName, username, email, hash });

    // Generate email verification
    const emailToken = genEmailToken();

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
    if (!userWithHash || !passwordMatch) throw new AuthError("Invalid credentials")
    
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
        token: token.trim(),
        tokenType: "EmailVerification"
    });

    // Verify a token was retrieved
    if (!tokenRecord) throw new TokenError("Invalid token");

    // Verify the token has not been used or expired
    if (tokenRecord.expiresAt && new Date(tokenRecord.expiresAt) < new Date()) throw new TokenError("Token is expired");

    // Retrieve the associated user
    const user = await getUser({ id: tokenRecord.userId });

    // Verify the user exists
    if (!user) throw new NotFoundError("User not found - No user with that token's userId");

    // Check if the email is already verified
    if (user.emailVerified) throw new TokenError("Email is already verified");

    // Update the user's emailVerified status
    await updateUser({ id: user.id }, { emailVerified: true });

    // Mark the token as used
    await updateToken({ id: tokenRecord.id }, { usedAt: new Date() });
};

module.exports = {
    handleRegistration,
    handleLogin,
    handleEmailVerification
};