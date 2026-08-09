/**
 * Cloudflare R2 storage provider (S3-compatible API).
 *
 * Structurally ready for real credentials. Does NOT connect when
 * `STORAGE_PROVIDER=local`. When `STORAGE_PROVIDER=r2` but the required R2
 * environment variables are missing, `ensureReady()` throws a clear error at
 * startup — there is deliberately NO fallback to local storage.
 *
 * No credentials are hardcoded; everything comes from the environment.
 */

const { S3Client, PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const path = require("path");
const crypto = require("crypto");

const REQUIRED = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];

function getConfig() {
    const missing = REQUIRED.filter((k) => !process.env[k] || !String(process.env[k]).trim());
    if (missing.length) {
        throw new Error(
            `R2 storage selected but missing required env variable(s): ${missing.join(", ")}. ` +
            "Set STORAGE_PROVIDER=r2 only after the Cloudflare account provides these values."
        );
    }
    return {
        accountId: process.env.R2_ACCOUNT_ID,
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        bucket: process.env.R2_BUCKET_NAME,
        publicUrl: String(process.env.R2_PUBLIC_URL || "").replace(/\/+$/, ""),
    };
}

let client = null;

function getClient() {
    if (!client) {
        const c = getConfig();
        client = new S3Client({
            region: "auto",
            endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
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

function makeKey(folder, ext) {
    return `${folder}/${crypto.randomBytes(8).toString("hex")}${ext}`;
}

function ensureReady() {
    getConfig(); // throws if R2 env vars are missing
}

async function uploadFile({ folder = "avatars", filename, buffer, mimetype }) {
    const ext = extFromName(filename);
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
    const c = getConfig();
    await getClient().send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
}

function getPublicUrl(key) {
    const c = getConfig();
    return `${c.publicUrl}/${key}`;
}

module.exports = { ensureReady, uploadFile, deleteFile, getPublicUrl, extFromName };
