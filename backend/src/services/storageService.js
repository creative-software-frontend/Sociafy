/**
 * Storage service facade.
 *
 * The rest of the application talks to this module only. The active provider is
 * selected by `STORAGE_PROVIDER` (local | r2) via ./storage/index.js.
 *
 * `ensureReady()` runs once at require time so an invalid production
 * configuration (e.g. STORAGE_PROVIDER=r2 without credentials) fails at startup
 * instead of silently falling back to local storage.
 */

const { getProvider, getProviderName } = require("./storage");

const provider = getProvider();
const providerName = getProviderName();
if (providerName === "local" && process.env.NODE_ENV === "production") {
    console.warn(
        "[storage] WARNING: using LOCAL filesystem storage in production. Uploaded files will be lost on redeploy. " +
        "Set STORAGE_PROVIDER=supabase (or provide the SUPABASE_S3_* variables) for persistent storage."
    );
}
if (provider.ensureReady) provider.ensureReady();

module.exports = {
    uploadFile: provider.uploadFile.bind(provider),
    deleteFile: provider.deleteFile.bind(provider),
    getPublicUrl: provider.getPublicUrl.bind(provider),
};
