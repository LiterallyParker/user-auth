const { usernameConstraints, emailConstraints } = require("./constraints");
const { handlePassword, comparePassword } = require("./password");
const { handleConstraints } = require("../util");
const { createAccessToken, createRefreshToken } = require("./jwt");
const { createUser, getUser, getUserWithHash } = require("../database/users");
const { createToken } = require("../database/tokens")
const { genEmailToken } = require("./tokens");
const sendEmail = require("../emailer/sender");

async function handleRegistration({ firstName, lastName, username, email, reqPass, conPass }) {

    firstName = firstName ? firstName.trim() : null;
    lastName = lastName ? lastName.trim() : null;
    email = email.toLowerCase().trim();
    username = username.trim();

    const usernameEval = handleConstraints(usernameConstraints, username);
    if (!usernameEval.valid) {
        return { success: false, error: usernameEval.errors[0] };
    };
    const emailEval = handleConstraints(emailConstraints, email);
    if (!emailEval.valid) {
        return { success: false, error: emailEval.errors[0] };
    };

    try {
        const usernameExists = await getUser({ username }, ['id']);
        if (usernameExists) return { success: false, error: "UsernameExists" };

        const emailExists = await getUser({ email }, ['id']);
        if (emailExists) return { success: false, error: "EmailExists" };

        const passwordResponse = await handlePassword(reqPass, conPass);
        if (!passwordResponse.success) return { success: false, error: passwordResponse.error };
        const { hash } = passwordResponse;
        
        const user = await createUser({ firstName, lastName, username, email, hash });
        
        const emailToken = genEmailToken();
        createToken({
            userId: user.id,
            tokenType: "EmailVerification",
            token: emailToken
        }).then(() => sendEmail({ to: user.email, type: "VerifyEmail", data: { token: emailToken, username }}));
        
        const refreshToken = createRefreshToken({ id: user.id });
        const accessToken = createAccessToken({
            id: user.id,
            username: user.username,
            email: user.email
        });

        return { success: true, user, refreshToken, accessToken };

    } catch (error) {
        console.error("Error while registering new user\n", error);
        return { success: false, error: "RegistrationFailed" };
    }
};

async function handleLogin({ identifier, password }) {
    identifier = identifier.trim();
    password = password.trim();

    try {
        const condition = identifier.includes('@') ? { email: identifier.toLowerCase() } : { username: identifier };

        const userWithHash = await getUserWithHash(condition);

        // Timing attack prevention
        const hashToCompare = userWithHash?.hash || '$2b$10$abcdefghijklmnopqrstuvwxyz01234567890ABCDEFGHIJKLMN';
        const passwordMatch = await comparePassword(password, hashToCompare);
        delete userWithHash?.hash;

        if (!userWithHash || !passwordMatch) {
            return { success: false, error: "InvalidCredentials" };
        };

        const user = await getUser(condition);

        const refreshToken = createRefreshToken({ id: user.id });
        const accessToken = createAccessToken({
            id: user.id,
            username: user.username,
            email: user.email
        });

        return { success: true, user, refreshToken, accessToken };

    } catch (error) {
        console.error("Error while logging in user\n", error);
        return { success: false, error: "LoginFailed" };
    };
};

async function handleVerifyEmail(token) {

}

module.exports = {
    handleRegistration,
    handleLogin
};