/**
 * Central storage provider factory.
 *
 * Provider selection:
 *   - `STORAGE_PROVIDER` explicitly set  → used as-is (local | supabase | r2).
 *   - production (`NODE_ENV=production`) with full Supabase config present and
 *     no explicit choice → `supabase` (persistent S3-compatible storage). This
 *     prevents deployed apps from silently using the ephemeral backend
 *     filesystem, which is the #1 cause of "works locally, 500 after deploy".
 *   - otherwise → `local` (development default).
 *
 * Application code must never need to know which provider is active.
 */

function hasSupabaseConfig() {
    return [
        "SUPABASE_S3_ENDPOINT",
        "SUPABASE_S3_REGION",
        "SUPABASE_S3_ACCESS_KEY_ID",
        "SUPABASE_S3_SECRET_ACCESS_KEY",
        "SUPABASE_STORAGE_BUCKET",
        "SUPABASE_STORAGE_PUBLIC_URL",
    ].every((k) => !!process.env[k] && String(process.env[k]).trim());
}

function getProviderName() {
    const explicit = String(process.env.STORAGE_PROVIDER || "").trim().toLowerCase();
    if (explicit) return explicit;
    // No explicit STORAGE_PROVIDER: in production prefer persistent Supabase
    // storage; in development default to the local filesystem.
    if (process.env.NODE_ENV === "production" && hasSupabaseConfig()) return "supabase";
    return "local";
}

function getProvider() {
    const name = getProviderName();
    if (name === "supabase") return require("./supabaseStorage");
    if (name === "local") return require("./localStorage");
    if (name === "r2") return require("./r2Storage");
    throw new Error(`Unknown STORAGE_PROVIDER "${name}". Use "local" or "supabase".`);
}

module.exports = { getProvider, getProviderName, hasSupabaseConfig };