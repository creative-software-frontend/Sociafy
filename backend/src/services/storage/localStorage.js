/**
 * Local filesystem storage provider (development default).
 *
 * Writes files under `./uploads` and serves them through the Express static
 * mount at `/uploads`. Keys are provider-independent (`folder/random.ext`).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOADS_ROOT = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads"));

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function extFromName(name) {
    return path.extname(String(name || "")).toLowerCase();
}

function makeKey(folder, ext) {
    return `${folder}/${crypto.randomBytes(8).toString("hex")}${ext}`;
}

// Best-effort: on free hosting the working directory may be read-only. Do not
// crash the whole server at boot — individual uploads will surface a clear
// error instead, and production should use Supabase storage anyway.
function ensureReady() {
    try {
        ensureDir(UPLOADS_ROOT);
    } catch (err) {
        console.warn(`[storage] local uploads directory unavailable (${err.message}) — uploads will fail. Use STORAGE_PROVIDER=supabase in production.`);
    }
}

async function uploadFile({ folder = "avatars", filename, buffer, mimetype }) {
    const ext = extFromName(filename);
    const key = makeKey(folder, ext);
    const full = path.join(UPLOADS_ROOT, key);
    if (!full.startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) {
        throw new Error("Invalid upload path");
    }
    ensureDir(path.dirname(full));
    fs.writeFileSync(full, buffer);
    return { key, url: getPublicUrl(key) };
}

async function deleteFile(key) {
    const full = path.resolve(UPLOADS_ROOT, key);
    if (!full.startsWith(path.resolve(UPLOADS_ROOT) + path.sep)) return;
    fs.rmSync(full, { force: true });
}

function getPublicUrl(key) {
    return `/uploads/${key}`;
}

module.exports = { ensureReady, uploadFile, deleteFile, getPublicUrl, extFromName };
