/**
 * Central storage provider factory.
 *
 * Selects the provider from `STORAGE_PROVIDER`:
 *   local     → localStorage
 *   supabase  → supabaseStorage (S3-compatible, production)
 *   r2        → r2Storage (legacy Cloudflare R2; kept for reference)
 *
 * Application code must never need to know which provider is active.
 */

function getProviderName() {
    return String(process.env.STORAGE_PROVIDER || "local").trim().toLowerCase();
}

function getProvider() {
    const name = getProviderName();
    if (name === "supabase") return require("./supabaseStorage");
    if (name === "local") return require("./localStorage");
    if (name === "r2") return require("./r2Storage");
    throw new Error(`Unknown STORAGE_PROVIDER "${name}". Use "local" or "supabase".`);
}

module.exports = { getProvider, getProviderName };
