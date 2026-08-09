const path = require("path");
const multer = require("multer");

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// Valid upload folders — object-key prefixes, never raw user paths.
const ALLOWED_FOLDERS = new Set(["avatars", "posts", "deposits"]);

function getExtFromOriginalName(originalName = "") {
    return path.extname(originalName).toLowerCase();
}

// Files are held in memory; the storage service (local or R2) writes the object.
const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        const ext = getExtFromOriginalName(file.originalname);
        if (!ALLOWED_EXT.has(ext)) {
            return cb(new Error("Only jpg/jpeg/png/webp files are allowed"));
        }
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error("Only jpg/jpeg/png/webp files are allowed"));
        }
        cb(null, true);
    },
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
    },
});

const uploadImageMiddleware = upload.single("image");

function resolveUploadFolder(req) {
    const raw = String(req.body?.folder ?? req.query?.folder ?? "avatars").toLowerCase();
    return ALLOWED_FOLDERS.has(raw) ? raw : "avatars";
}

module.exports = {
    uploadImageMiddleware,
    resolveUploadFolder,
    ALLOWED_EXT,
    ALLOWED_MIME,
    ALLOWED_FOLDERS,
};
