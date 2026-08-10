const jwt = require("jsonwebtoken");

const generateToken = (id, role, tokenVersion) => {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
        throw new Error(
            "Missing JWT_SECRET in environment. Create backend/.env with JWT_SECRET=<your_secret>."
        );
    }

    const payload = { id, role };
    // Embed the auth-session version so adminAuthMiddleware can reject stale
    // JWTs. Normal-user tokens omit it (their flow never checks it).
    if (tokenVersion !== undefined && tokenVersion !== null) {
        payload.token_version = Number(tokenVersion);
    }

    return jwt.sign(payload, secret, { expiresIn: "7d" });
};

module.exports = generateToken;

