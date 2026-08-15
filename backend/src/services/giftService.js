const db = require("../config/db");
const { getPartnerRequestStatus } = require("./chatService");
const adminWalletService = require("./adminWalletService");

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
        created_at: row.created_at,
        updated_at: row.updated_at,
    };
}

async function getGifts({ includeInactive = false } = {}) {
    const where = includeInactive ? "" : "WHERE is_active = 1";
    const [rows] = await db.query(`SELECT * FROM gifts ${where} ORDER BY price ASC`);
    return rows.map(toGiftRow);
}

async function getGiftById(giftId) {
    const [rows] = await db.query("SELECT * FROM gifts WHERE id = ? LIMIT 1", [giftId]);
    return rows.length ? toGiftRow(rows[0]) : null;
}

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

        // Gift chat message (JSON marker so frontend renders it as a gift)
        const giftMessage = JSON.stringify({
            gift: true,
            giftId: gift.id,
            giftName: gift.name,
            icon: gift.icon || '🎁',
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
                sender.name AS sender_name, receiver.name AS receiver_name
         FROM gift_transactions gt
         JOIN gifts g ON g.id = gt.gift_id
         JOIN users sender ON sender.id = gt.sender_id
         JOIN users receiver ON receiver.id = gt.receiver_id
         WHERE gt.sender_id = ? OR gt.receiver_id = ?
         ORDER BY gt.created_at DESC
         LIMIT 200`,
        [userId, userId]
    );
    return rows;
}

async function createGift(data) {
    const [result] = await db.query(
        `INSERT INTO gifts (name, icon, image, price, provider_percentage, admin_percentage, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.name,
            data.icon || null,
            data.image || null,
            data.price,
            data.provider_percentage ?? 70,
            data.admin_percentage ?? 30,
            // New gifts are always created ACTIVE. `is_active` is never read from
            // the create payload — activation state is changed only via toggleGift().
            1,
        ]
    );
    return getGiftById(result.insertId);
}

async function updateGift(giftId, data) {
    await db.query(
        `UPDATE gifts SET
            name = ?, icon = ?, image = ?, price = ?,
            provider_percentage = ?, admin_percentage = ?
         WHERE id = ?`,
        [
            data.name,
            data.icon || null,
            data.image || null,
            data.price,
            data.provider_percentage ?? 70,
            data.admin_percentage ?? 30,
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
};
