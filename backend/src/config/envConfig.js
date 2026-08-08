/**
 * Central environment configuration + validation.
 *
 * Loads CORS origins from CORS_ORIGIN (comma-separated) and validates that all
 * critical production variables are present. Never uses `*` when credentials are
 * enabled, and never exposes secret values in error messages.
 */

const DEV_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
];

function getCorsOrigins() {
    const raw = String(process.env.CORS_ORIGIN || "").trim();
    if (!raw) return DEV_ORIGINS.slice();
    const list = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    return list;
}

const REQUIRED = [
    "DB_HOST",
    "DB_USER",
    "DB_PASSWORD",
    "DB_NAME",
    "JWT_SECRET",
    "CORS_ORIGIN",
];

/**
 * Throws a clear (non-secret) error listing which required variables are missing
 * or invalid. Call at server startup so misconfiguration fails fast.
 *
 * A variable is "missing" when it is not declared at all (process.env[k] is
 * undefined). Values may legitimately be empty in local development (e.g. an
 * empty DB_PASSWORD for a root-less local MySQL).
 */
function validateEnv() {
    const missing = REQUIRED.filter((k) => process.env[k] === undefined);
    if (missing.length) {
        throw new Error("Missing required environment variable(s): " + missing.join(", "));
    }

    const origins = getCorsOrigins();
    if (origins.some((o) => o === "*")) {
        throw new Error("CORS_ORIGIN must not contain '*' when credentials are enabled");
    }

    const secretLen = String(process.env.JWT_SECRET || "").trim().length;
    const isProduction = process.env.NODE_ENV === "production";
    if (secretLen < 16) {
        if (isProduction) {
            throw new Error("JWT_SECRET is too weak. Use a random secret of at least 16 characters in production.");
        }
        console.warn("[config] WARNING: JWT_SECRET is short. Use a strong random secret in production.");
    }

    return true;
}

module.exports = { getCorsOrigins, validateEnv, DEV_ORIGINS };
