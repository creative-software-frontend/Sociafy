const giftService = require("../services/giftService");
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

/* ── Public / User endpoints ── */
async function listGifts(req, res) {
    try {
        const gifts = await giftService.getGifts();
        return res.json({ gifts });
    } catch (err) {
        return handleError(res, err, "Failed to fetch gifts");
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
            // is_active is intentionally NOT forwarded: createGift() always
            // creates gifts as ACTIVE. Activation state is changed only through
            // the dedicated toggle endpoint.
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

module.exports = {
    listGifts,
    sendGift,
    getHistory,
    adminListGifts,
    adminCreateGift,
    adminUpdateGift,
    adminToggleGift,
    adminDeleteGift,
};