const express = require("express");
const router = express.Router();
const authMiddleware = require("../middleware/authMiddleware");
const { uploadImageMiddleware, resolvePublicUrl } = require("../middleware/uploadImageMiddleware");

// POST /api/upload/image (authenticated only)
router.post("/image", authMiddleware, (req, res) => {
    // Multer middleware must run before we can compute filename/url
    uploadImageMiddleware(req, res, (err) => {
        if (err) {
            const message = err.message || "Upload failed";
            return res.status(400).json({ success: false, message });
        }

        const url = resolvePublicUrl(req);
        if (!url) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        res.json({
            success: true,
            url,
        });
    });
});

module.exports = router;

