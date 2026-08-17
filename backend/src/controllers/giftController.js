const path = require("path");
const giftService = require("../services/giftService");
const storageService = require("../services/storageService");
const { handleError } = require("../utils/httpError");

function parsePrice(v) {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
}

function parsePercent(v, fallback) {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 100) return null;
    return n;
}

function requireName(v) {
    return typeof v === "string" && v.trim() ? v.trim() : null;
}

function assetTypeFromName(name) {
    const ext = path.extname(String(name || "")).toLowerCase();
    if (ext === ".gif") return "gif";
    if (ext === ".jpg" || ext === ".jpeg") return "jpg";
    if (ext === ".webp") return "webp";
    return "png";
}

/* ── Public / User endpoints ── */
async function listGifts(req, res) {
    try {
        const gifts = await giftService.getGifts();
        return res.json({ gifts });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gifts");
    }
}

async function listAssets(req, res) {
    try {
        const assets = await giftService.getGiftAssets();
        return res.json({ assets });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gift assets");
    }
}

async function sendGift(req, res) {
    try {
        const { receiver_id, gift_id } = req.body || {};
        if (!Number(receiver_id) || !Number(gift_id)) {
            return res.status(400).json({ message: "receiver_id and gift_id are required" });
        }
        const result = await giftService.sendGift({
            senderId: req.user.id,
            receiverId: Number(receiver_id),
            giftId: Number(gift_id),
        });
        return res.json({ message: "Gift sent", ...result });
    } catch (err) {
        return handleError(res, err, "Failed to send gift");
    }
}

async function getHistory(req, res) {
    try {
        const history = await giftService.getGiftHistory(req.user.id);
        return res.json({ history });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gift history");
    }
}

/* ── Admin endpoints ── */
async function adminListGifts(req, res) {
    try {
        const gifts = await giftService.getGifts({ includeInactive: true });
        return res.json({ gifts });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gifts");
    }
}

async function adminCreateGift(req, res) {
    try {
        const name = requireName(req.body.name);
        if (!name) return res.status(400).json({ message: "Name is required" });
        const price = parsePrice(req.body.price);
        if (price === null) return res.status(400).json({ message: "Price must be > 0" });
        const providerPct = parsePercent(req.body.provider_percentage, 70);
        const adminPct = parsePercent(req.body.admin_percentage, 30);
        if (providerPct === null || adminPct === null) {
            return res.status(400).json({ message: "Percentages must be between 0 and 100" });
        }

        const gift = await giftService.createGift({
            name,
            icon: req.body.icon,
            image: req.body.image,
            price,
            provider_percentage: providerPct,
            admin_percentage: adminPct,
            asset_id: req.body.asset_id !== undefined && req.body.asset_id !== null && req.body.asset_id !== ''
                ? Number(req.body.asset_id)
                : null,
        });
        return res.json({ gift });
    } catch (err) {
        return handleError(res, err, "Failed to create gift");
    }
}

async function adminUpdateGift(req, res) {
    try {
        const id = Number(req.params.id);
        const body = req.body || {};

        const name = body.name !== undefined ? requireName(body.name) : undefined;
        const price = body.price !== undefined ? parsePrice(body.price) : undefined;
        const providerPct = body.provider_percentage !== undefined ? parsePercent(body.provider_percentage, 70) : undefined;
        const adminPct = body.admin_percentage !== undefined ? parsePercent(body.admin_percentage, 30) : undefined;

        if (body.name !== undefined && !name) return res.status(400).json({ message: "Name is required" });
        if (body.price !== undefined && price === null) return res.status(400).json({ message: "Price must be > 0" });
        if (body.provider_percentage !== undefined && providerPct === null) return res.status(400).json({ message: "Provider percentage invalid" });
        if (body.admin_percentage !== undefined && adminPct === null) return res.status(400).json({ message: "Admin percentage invalid" });

        const current = await giftService.getGiftById(id);
        if (!current) return res.status(404).json({ message: "Gift not found" });

        const gift = await giftService.updateGift(id, {
            name: name ?? current.name,
            icon: body.icon !== undefined ? body.icon : current.icon,
            image: body.image !== undefined ? body.image : current.image,
            price: price ?? current.price,
            provider_percentage: providerPct ?? current.provider_percentage,
            admin_percentage: adminPct ?? current.admin_percentage,
            asset_id: body.asset_id !== undefined && body.asset_id !== null && body.asset_id !== ''
                ? Number(body.asset_id)
                : (body.asset_id === null ? null : current.asset_id),
        });
        return res.json({ gift });
    } catch (err) {
        return handleError(res, err, "Failed to update gift");
    }
}

async function adminToggleGift(req, res) {
    try {
        const id = Number(req.params.id);
        const isActive = req.body.is_active !== undefined ? !!req.body.is_active : true;
        const gift = await giftService.toggleGift(id, isActive);
        if (!gift) return res.status(404).json({ message: "Gift not found" });
        return res.json({ gift });
    } catch (err) {
        return handleError(res, err, "Failed to toggle gift");
    }
}

async function adminDeleteGift(req, res) {
    try {
        await giftService.deleteGift(Number(req.params.id));
        return res.json({ message: "Gift deleted" });
    } catch (err) {
        return handleError(res, err, "Failed to delete gift");
    }
}

/* ── Admin Gift Asset Library ── */
async function adminListAssets(req, res) {
    try {
        const assets = await giftService.getGiftAssets({ includeInactive: true });
        return res.json({ assets });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gift assets");
    }
}

async function adminCreateAsset(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "An image/gif file is required" });
        }
        const name = requireName(req.body.name) || requireName(req.file.originalname) || "Gift asset";
        const { key, url } = await storageService.uploadFile({
            folder: "gifts",
            filename: req.file.originalname,
            buffer: req.file.buffer,
            mimetype: req.file.mimetype,
        });
        const asset = await giftService.createGiftAsset({
            name,
            asset_type: assetTypeFromName(req.file.originalname),
            url,
            storage_key: key,
        });
        return res.status(201).json({ asset });
    } catch (err) {
        return handleError(res, err, "Failed to create gift asset");
    }
}

async function adminUpdateAsset(req, res) {
    try {
        const id = Number(req.params.id);
        const body = req.body || {};
        const asset = await giftService.updateGiftAsset(id, {
            name: body.name !== undefined ? requireName(body.name) : undefined,
            is_active: body.is_active !== undefined ? !!body.is_active : undefined,
        });
        if (!asset) return res.status(404).json({ message: "Gift asset not found" });
        return res.json({ asset });
    } catch (err) {
        return handleError(res, err, "Failed to update gift asset");
    }
}

async function adminDeleteAsset(req, res) {
    try {
        await giftService.deleteGiftAsset(Number(req.params.id));
        return res.json({ message: "Gift asset deleted" });
    } catch (err) {
        return handleError(res, err, "Failed to delete gift asset");
    }
}

module.exports = {
    listGifts,
    listAssets,
    sendGift,
    getHistory,
    adminListGifts,
    adminCreateGift,
    adminUpdateGift,
    adminToggleGift,
    adminDeleteGift,
    adminListAssets,
    adminCreateAsset,
    adminUpdateAsset,
    adminDeleteAsset,
};