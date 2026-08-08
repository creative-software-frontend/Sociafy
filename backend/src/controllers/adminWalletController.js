const adminWalletService = require("../services/adminWalletService");
const { handleError } = require("../utils/httpError");

async function getWallet(req, res) {
    try {
        const [summary, transactions] = await Promise.all([
            adminWalletService.getSummary(),
            adminWalletService.getTransactions(),
        ]);
        return res.json({ ...summary, transactions });
    } catch (err) {
        return handleError(res, err, "Failed to fetch admin wallet");
    }
}

async function getTransactions(req, res) {
    try {
        const transactions = await adminWalletService.getTransactions();
        return res.json({ transactions });
    } catch (err) {
        return handleError(res, err, "Failed to fetch transactions");
    }
}

async function withdraw(req, res) {
    try {
        const { amount, method, trx_id } = req.body || {};
        const value = Number(amount);

        if (!Number.isFinite(value) || value <= 0) {
            return res.status(400).json({ message: "Amount must be greater than 0" });
        }

        const result = await adminWalletService.withdraw({
            amount: Math.round(value * 100) / 100,
            method: method || "bank",
            trxId: trx_id || null,
        });
        return res.json(result);
    } catch (err) {
        // 4xx (e.g. "Cannot withdraw more than balance") keeps its message;
        // 5xx returns a generic message.
        return handleError(res, err, "Withdraw failed");
    }
}

module.exports = { getWallet, getTransactions, withdraw };