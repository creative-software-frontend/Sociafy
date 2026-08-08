const path = require("path");
const fs = require("fs");
const multer = require("multer");
const crypto = require("crypto");

const ALLOWED_MIME = new Set([
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
]);

const ALLOWED_EXT = new Set([".jpg", ".jpeg", ".png", ".webp"]);

function ensureDirSync(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function getExtFromOriginalName(originalName = "") {
    const ext = path.extname(originalName).toLowerCase();
    return ext;
}

function makeUniqueFilename({ ext }) {
    const now = Date.now();
    const rand = crypto.randomBytes(8).toString("hex");
    return `img_${now}_${rand}${ext}`;
}

function createUploadImageMiddleware() {
    const uploadsRoot = path.join(process.cwd(), "uploads");
    const avatarDir = path.join(uploadsRoot, "avatars");
    const depositsDir = path.join(uploadsRoot, "deposits");
    const postsDir = path.join(uploadsRoot, "posts");

    // Ensure folders exist at startup
    ensureDirSync(uploadsRoot);
    ensureDirSync(avatarDir);
    ensureDirSync(depositsDir);
    ensureDirSync(postsDir);

    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            // Decide folder based on requested type.
            // Accepts: req.body.folder OR req.query.folder
            const folder = String(req.body?.folder ?? req.query?.folder ?? "avatars");

            let selected = avatarDir;
            if (folder === "deposits") selected = depositsDir;
            else if (folder === "posts") selected = postsDir;
            cb(null, selected);
        },
        filename: (req, file, cb) => {
            const ext = getExtFromOriginalName(file.originalname);
            if (!ALLOWED_EXT.has(ext) || !ALLOWED_MIME.has(file.mimetype)) {
                return cb(new Error("Invalid file type"));
            }
            const filename = makeUniqueFilename({ ext });
            cb(null, filename);
        },
    });

    const fileFilter = (req, file, cb) => {
        const ext = getExtFromOriginalName(file.originalname);
        if (!ALLOWED_EXT.has(ext)) {
            return cb(new Error("Only jpg/jpeg/png/webp files are allowed"));
        }
        if (!ALLOWED_MIME.has(file.mimetype)) {
            return cb(new Error("Only jpg/jpeg/png/webp files are allowed"));
        }
        cb(null, true);
    };

    const upload = multer({
        storage,
        fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB
        },
    });

    return upload.single("image");
}

const uploadImageMiddleware = createUploadImageMiddleware();

function resolvePublicUrl(req) {
    const folder = String(req.body?.folder ?? req.query?.folder ?? "avatars");
    let safeFolder = "avatars";
    if (folder === "deposits") safeFolder = "deposits";
    else if (folder === "posts") safeFolder = "posts";

    const filename = req.file?.filename;
    if (!filename) return null;

    return `/uploads/${safeFolder}/${filename}`;
}

module.exports = {
    uploadImageMiddleware,
    resolvePublicUrl,
};

