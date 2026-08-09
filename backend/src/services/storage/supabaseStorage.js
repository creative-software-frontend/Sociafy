/**
 * Supabase Storage S3-compatible provider.
 *
 * Uploads go directly to Supabase Storage through the official AWS S3 client.
 * The bucket is public, so `getPublicUrl()` returns the browser-accessible
 * public URL — never the S3 API endpoint.
 *
 * Credentials come exclusively from the environment. `ensureReady()` throws a
 * clear error at startup when `STORAGE_PROVIDER=supabase` and a required
 * variable is missing. There is NO fallback to local storage.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");

const REQUIRED = [
    "SUPABASE_S3_ENDPOINT",
    "SUPABASE_S3_REGION",
    "SUPABASE_S3_ACCESS_KEY_ID",
    "SUPABASE_S3_SECRET_ACCESS_KEY",
    "SUPABASE_STORAGE_BUCKET",
    "SUPABASE_STORAGE_PUBLIC_URL",
];

const ALLOWED_FOLDERS = new Set(["avatars", "posts", "deposits"]);
const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function getConfig() {
    const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
    if (missing.length) {
        throw new Error(
            `Supabase storage selected but missing required env variable(s): ${missing.join(", ")}. ` +
            "Supply valid Supabase S3 credentials before setting STORAGE_PROVIDER=supabase."
        );
    }
    return {
        endpoint: String(process.env.SUPABASE_S3_ENDPOINT).trim().replace(/\/+$/, ""),
        region: String(process.env.SUPABASE_S3_REGION).trim(),
        accessKeyId: String(process.env.SUPABASE_S3_ACCESS_KEY_ID),
        secretAccessKey: String(process.env.SUPABASE_S3_SECRET_ACCESS_KEY),
        bucket: String(process.env.SUPABASE_STORAGE_BUCKET).trim(),
        publicUrl: String(process.env.SUPABASE_STORAGE_PUBLIC_URL).trim().replace(/\/+$/, ""),
    };
}

let client = null;

function getClient() {
    if (!client) {
        const c = getConfig();
        client = new S3Client({
            region: c.region,
            endpoint: c.endpoint,
            credentials: {
                accessKeyId: c.accessKeyId,
                secretAccessKey: c.secretAccessKey,
            },
        });
    }
    return client;
}

function extFromName(name) {
    return path.extname(String(name || "")).toLowerCase();
}

/**
 * Provider-independent object key `folder/<random>.<ext>`, server-generated with
 * cryptographically secure randomness. Never derived from user input.
 */
function makeKey(folder, ext) {
    return `${folder}/${crypto.randomBytes(8).toString("hex")}${ext}`;
}

/**
 * Keys are always `avatars|posts|deposits/<single-segment-name>`. Rejects path
 * traversal (`..`), absolute paths, arbitrary buckets and any other structure.
 */
function isValidKey(key) {
    if (typeof key !== "string" || !key) return false;
    if (key.includes("..")) return false;
    if (key.startsWith("/") || key.includes("\\")) return false;
    const parts = key.split("/");
    if (parts.length !== 2) return false;
    const [folder, name] = parts;
    if (!ALLOWED_FOLDERS.has(folder)) return false;
    return typeof name === "string" && name.length > 0;
}

function ensureReady() {
    getConfig(); // throws if Supabase env vars are missing
}

async function uploadFile({ folder = "avatars", filename, buffer, mimetype }) {
    if (!ALLOWED_FOLDERS.has(folder)) {
        throw new Error("Invalid storage folder");
    }
    const ext = extFromName(filename);
    if (!ALLOWED_EXT.has(ext)) {
        throw new Error("Invalid file type");
    }
    const key = makeKey(folder, ext);
    const c = getConfig();
    await getClient().send(
        new PutObjectCommand({
            Bucket: c.bucket,
            Key: key,
            Body: buffer,
            ContentType: mimetype || "application/octet-stream",
        })
    );
    return { key, url: getPublicUrl(key) };
}

async function deleteFile(key) {
    if (!isValidKey(key)) {
        throw new Error("Invalid object key");
    }
    const c = getConfig();
    await getClient().send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
}

function getPublicUrl(key) {
    const c = getConfig();
    return `${c.publicUrl}/${key}`;
}

module.exports = {
    ensureReady,
    uploadFile,
    deleteFile,
    getPublicUrl,
    isValidKey,
    ALLOWED_FOLDERS,
};
