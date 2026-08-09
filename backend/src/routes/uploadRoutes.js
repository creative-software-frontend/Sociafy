const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { uploadImageMiddleware, resolveUploadFolder } = require("../middleware/uploadImageMiddleware");
const storageService = require("../services/storageService");
const { handleError } = require("../utils/httpError");

// POST /api/upload/image (authenticated only)
router.post("/image", authMiddleware, (req, res) => {
    uploadImageMiddleware(req, res, async (err) => {
        if (err) {
            // Multer validation/limits errors (safe messages only).
            return handleError(res, { statusCode: 400, message: err.message || "Upload failed" }, "Upload failed");
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        try {
            const { url } = await storageService.uploadFile({
                folder: resolveUploadFolder(req),
                filename: req.file.originalname,
                buffer: req.file.buffer,
                mimetype: req.file.mimetype,
            });
            res.json({ success: true, url });
        } catch (e) {
            return handleError(res, e, "Upload failed");
        }
    });
});

module.exports = router;
