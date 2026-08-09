/**
 * Local filesystem storage provider (development default).
 *
 * Writes files under `./uploads` and serves them through the Express static
 * mount at `/uploads`. Keys are provider-independent (`folder/random.ext`).
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOADS_ROOT = path.join(process.cwd(), "uploads");

function ensureDir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}

function extFromName(name) {
    return path.extname(String(name || "")).toLowerCase();
}

function makeKey(folder, ext) {
    return `${folder}/${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function ensureReady() {
    ensureDir(UPLOADS_ROOT);
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
