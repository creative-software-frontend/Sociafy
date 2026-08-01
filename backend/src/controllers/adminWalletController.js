const adminWalletService = require("../services/adminWalletService");

async function getWallet(req, res) {
    try {
        const [summary, transactions] = await Promise.all([
            adminWalletService.getSummary(),
            adminWalletService.getTransactions(),
        ]);
        return res.json({ ...summary, transactions });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch admin wallet" });
    }
}

async function getTransactions(req, res) {
    try {
        const transactions = await adminWalletService.getTransactions();
        return res.json({ transactions });
    } catch (err) {
        return res.status(500).json({ message: err.message || "Failed to fetch transactions" });
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
        const statusCode = err.statusCode || 500;
        return res.status(statusCode).json({ message: err.message || "Withdraw failed" });
    }
}

module.exports = { getWallet, getTransactions, withdraw };
