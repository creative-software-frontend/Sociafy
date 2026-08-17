const db = require("../config/db");
const storageService = require("./storageService");
const { getPartnerRequestStatus } = require("./chatService");
const adminWalletService = require("./adminWalletService");

const GIFT_ASSET_SELECT = `g.*,
    ga.id AS ga_id, ga.name AS asset_name, ga.asset_type, ga.url AS asset_url`;

function toGiftRow(row) {
    return {
        id: row.id,
        name: row.name,
        icon: row.icon,
        image: row.image,
        price: Number(row.price),
        provider_percentage: Number(row.provider_percentage),
        admin_percentage: Number(row.admin_percentage),
        is_active: Number(row.is_active),
        asset_id: row.asset_id ?? null,
        asset: row.asset_id
            ? { id: Number(row.ga_id), name: row.asset_name, asset_type: row.asset_type, url: row.asset_url }
            : null,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function getGifts({ includeInactive = false } = {}) {
    const where = includeInactive ? "" : "WHERE g.is_active = 1";
    // Active assets are exposed to users; admins see the asset even when inactive.
    const assetActive = includeInactive ? "" : " AND ga.is_active = 1";
    const [rows] = await db.query(
        `SELECT ${GIFT_ASSET_SELECT}
         FROM gifts g
         LEFT JOIN gift_assets ga ON ga.id = g.asset_id${assetActive}
         ${where}
         ORDER BY g.price ASC`
    );
    return rows.map(toGiftRow);
}

async function getGiftById(giftId) {
    const [rows] = await db.query(
        `SELECT ${GIFT_ASSET_SELECT}
         FROM gifts g
         LEFT JOIN gift_assets ga ON ga.id = g.asset_id
         WHERE g.id = ? LIMIT 1`,
        [giftId]
    );
    return rows.length ? toGiftRow(rows[0]) : null;
}

/* ── Gift Asset Library ─────────────────────────────────────────────────────── */

async function getGiftAssets({ includeInactive = false } = {}) {
    const where = includeInactive ? "" : "WHERE is_active = 1";
    const [rows] = await db.query(
        `SELECT id, name, asset_type, url, storage_key, is_active, created_at, updated_at
         FROM gift_assets ${where} ORDER BY created_at DESC`
    );
    return rows;
}

async function getGiftAssetById(assetId) {
    const [rows] = await db.query(
        `SELECT id, name, asset_type, url, storage_key, is_active, created_at, updated_at
         FROM gift_assets WHERE id = ? LIMIT 1`,
        [assetId]
    );
    return rows.length ? rows[0] : null;
}

async function createGiftAsset(data) {
    const [result] = await db.query(
        `INSERT INTO gift_assets (name, asset_type, url, storage_key, is_active)
         VALUES (?, ?, ?, ?, 1)`,
        [data.name, data.asset_type, data.url, data.storage_key || null]
    );
    return getGiftAssetById(result.insertId);
}

async function updateGiftAsset(assetId, data) {
    const current = await getGiftAssetById(assetId);
    if (!current) return null;
    await db.query(
        `UPDATE gift_assets SET
            name = ?, is_active = ?
         WHERE id = ?`,
        [
            data.name !== undefined ? data.name : current.name,
            data.is_active !== undefined ? (data.is_active ? 1 : 0) : current.is_active,
            assetId,
        ]
    );
    return getGiftAssetById(assetId);
}

/**
 * Deleting an asset that is still referenced by gifts is prevented — the gift
 * must be reassigned first. Unreferenced assets are removed from the DB and
 * their stored file is deleted (best-effort, storage provider aware).
 */
async function deleteGiftAsset(assetId) {
    const [refs] = await db.query("SELECT id FROM gifts WHERE asset_id = ? LIMIT 1", [assetId]);
    if (refs.length) {
        const err = new Error("This asset is used by one or more gifts. Reassign those gifts before deleting it.");
        err.statusCode = 409;
        throw err;
    }
    const asset = await getGiftAssetById(assetId);
    if (!asset) return;
    if (asset.storage_key) {
        try { await storageService.deleteFile(asset.storage_key); } catch (_) { /* best-effort */ }
    }
    await db.query("DELETE FROM gift_assets WHERE id = ?", [assetId]);
}

/* ── Gift purchasing ────────────────────────────────────────────────────────── */

async function sendGift({ senderId, receiverId, giftId }) {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();

        const sId = Number(senderId);
        const rId = Number(receiverId);

        if (sId === rId) {
            const err = new Error("Cannot send a gift to yourself");
            err.statusCode = 400;
            throw err;
        }

        // Role validation: USER → PROVIDER only
        const [sRows] = await connection.query("SELECT role FROM users WHERE id = ? LIMIT 1", [sId]);
        const [rRows] = await connection.query("SELECT role FROM users WHERE id = ? LIMIT 1", [rId]);
        if (!sRows.length || !rRows.length) {
            const err = new Error("User not found");
            err.statusCode = 404;
            throw err;
        }
        const senderRole = sRows[0].role;
        const receiverRole = rRows[0].role;
        if (senderRole !== "user" || receiverRole !== "provider") {
            const err = new Error("Only a User can send gifts to a Provider");
            err.statusCode = 403;
            throw err;
        }

        // Partner request must be accepted
        const partnerStatus = await getPartnerRequestStatus({ userId: sId, providerId: rId });
        if (partnerStatus !== "accepted") {
            const err = new Error("Partner request must be accepted to send gifts");
            err.statusCode = 403;
            throw err;
        }

        // Gift must be active
        const gift = await getGiftById(giftId);
        if (!gift || !gift.is_active) {
            const err = new Error("Gift not found or inactive");
            err.statusCode = 400;
            throw err;
        }

        const price = gift.price;
        const providerPct = gift.provider_percentage;
        const adminPct = gift.admin_percentage;
        const providerAmount = Math.round((price * providerPct) / 100 * 100) / 100;
        const adminAmount = Math.round((price * adminPct) / 100 * 100) / 100;

        // Lock sender wallet
        const [walletRows] = await connection.query(
            "SELECT balance FROM users WHERE id = ? FOR UPDATE",
            [sId]
        );
        const senderBalance = walletRows.length ? Number(walletRows[0].balance) || 0 : 0;
        if (senderBalance < price) {
            const err = new Error("Insufficient wallet balance");
            err.statusCode = 400;
            throw err;
        }

        // Deduct full amount from USER
        await connection.query("UPDATE users SET balance = balance - ? WHERE id = ?", [price, sId]);

        // Credit PROVIDER wallet 70% (goes to balance, not earnings)
        await connection.query("UPDATE users SET balance = balance + ? WHERE id = ?", [providerAmount, rId]);

        // Credit ADMIN wallet 30% (same transaction)
        await adminWalletService.credit(
            adminAmount,
            "gift_income",
            `Gift income - ${gift.name} (from user #${sId})`,
            null,
            connection
        );

        // Gift chat message (JSON marker so frontend renders it as a gift).
        // The recipient renders the persistent asset URL when available, else
        // the legacy image/icon fallback so old gifts keep working.
        const assetUrl = gift.asset?.url || null;
        const giftMessage = JSON.stringify({
            gift: true,
            giftId: gift.id,
            giftName: gift.name,
            icon: gift.icon || '🎁',
            image: assetUrl ?? gift.image,
            price,
        });

        // Insert chat message
        const [msgResult] = await connection.query(
            "INSERT INTO chat_messages (sender_id, receiver_id, message) VALUES (?, ?, ?)",
            [sId, rId, giftMessage]
        );
        const messageId = msgResult.insertId;

        // Insert gift transaction
        await connection.query(
            `INSERT INTO gift_transactions
               (sender_id, receiver_id, gift_id, gift_price, provider_amount, admin_amount, message_id)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [sId, rId, gift.id, price, providerAmount, adminAmount, messageId]
        );

        // User transaction: gift_purchase (negative)
        await connection.query(
            "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'gift_purchase', ?, 'completed', ?)",
            [sId, -price, `Gift sent - ${gift.name} to #${rId}`]
        );

        // Provider transaction: gift_income (positive)
        await connection.query(
            "INSERT INTO transactions (user_id, type, amount, status, description) VALUES (?, 'gift_income', ?, 'completed', ?)",
            [rId, providerAmount, `Gift received - ${gift.name} from #${sId}`]
        );

        await connection.commit();

        // Fetch sender name for the socket payload
        const [nameRows] = await db.query("SELECT name FROM users WHERE id = ?", [sId]);
        return {
            id: messageId,
            sender_id: sId,
            receiver_id: rId,
            message: giftMessage,
            created_at: new Date().toISOString(),
            sender_name: nameRows[0]?.name || "Unknown",
        };
    } catch (err) {
        await connection.rollback();
        throw err;
    } finally {
        connection.release();
    }
}

async function getGiftHistory(userId) {
    const [rows] = await db.query(
        `SELECT gt.*, g.name AS gift_name, g.icon AS gift_icon,
                ga.url AS gift_asset_url, ga.asset_type AS gift_asset_type,
                sender.name AS sender_name, receiver.name AS receiver_name
         FROM gift_transactions gt
         JOIN gifts g ON g.id = gt.gift_id
         LEFT JOIN gift_assets ga ON ga.id = g.asset_id
         JOIN users sender ON sender.id = gt.sender_id
         JOIN users receiver ON receiver.id = gt.receiver_id
         WHERE gt.sender_id = ? OR gt.receiver_id = ?
         ORDER BY gt.created_at DESC
         LIMIT 200`,
        [userId, userId]
    );
    return rows;
}

/* ── Admin gift CRUD (business logic unchanged) ─────────────────────────────── */

async function createGift(data) {
    if (data.asset_id !== undefined && data.asset_id !== null) {
        const asset = await getGiftAssetById(data.asset_id);
        if (!asset) {
            const err = new Error("Gift asset not found");
            err.statusCode = 400;
            throw err;
        }
    }
    const [result] = await db.query(
        `INSERT INTO gifts (name, icon, image, price, provider_percentage, admin_percentage, asset_id, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            data.name,
            data.icon || null,
            data.image || null,
            data.price,
            data.provider_percentage ?? 70,
            data.admin_percentage ?? 30,
            data.asset_id ?? null,
            // New gifts are always created ACTIVE.
            1,
        ]
    );
    return getGiftById(result.insertId);
}

async function updateGift(giftId, data) {
    if (data.asset_id !== undefined && data.asset_id !== null) {
        const asset = await getGiftAssetById(data.asset_id);
        if (!asset) {
            const err = new Error("Gift asset not found");
            err.statusCode = 400;
            throw err;
        }
    }
    await db.query(
        `UPDATE gifts SET
            name = ?, icon = ?, image = ?, price = ?,
            provider_percentage = ?, admin_percentage = ?, asset_id = ?
         WHERE id = ?`,
        [
            data.name,
            data.icon || null,
            data.image || null,
            data.price,
            data.provider_percentage ?? 70,
            data.admin_percentage ?? 30,
            data.asset_id ?? null,
            giftId,
        ]
    );
    return getGiftById(giftId);
}

async function toggleGift(giftId, isActive) {
    await db.query("UPDATE gifts SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, giftId]);
    return getGiftById(giftId);
}

async function deleteGift(giftId) {
    await db.query("DELETE FROM gifts WHERE id = ?", [giftId]);
}

module.exports = {
    getGifts,
    getGiftById,
    sendGift,
    getGiftHistory,
    createGift,
    updateGift,
    toggleGift,
    deleteGift,
    getGiftAssets,
    getGiftAssetById,
    createGiftAsset,
    updateGiftAsset,
    deleteGiftAsset,
};