const walletService = require("../services/walletService");
const { handleError } = require("../utils/httpError");

async function createDepositRequest(req, res) {
    try {
        const result = await walletService.createDepositRequest(req.user.id, req.body || {});
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function getDepositHistory(req, res) {
    try {
        const result = await walletService.getUserDepositHistory(req.user.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function createWithdrawRequest(req, res) {
    try {
        const result = await walletService.createWithdrawRequest(req.user.id, req.body || {});
        return res.status(201).json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function getWithdrawHistory(req, res) {
    try {
        const result = await walletService.getUserWithdrawHistory(req.user.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function getWallet(req, res) {
    try {
        const result = await walletService.getWalletSummary(req.user.id);
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function getAdminDepositRequests(req, res) {
    try {
        const result = await walletService.getAdminDepositRequests();
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function approveDeposit(req, res) {
    try {
        const result = await walletService.approveDepositRequest(req.user.id, req.params.id, req.body?.admin_note || "");
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function rejectDeposit(req, res) {
    try {
        const result = await walletService.rejectDepositRequest(req.user.id, req.params.id, req.body?.admin_note || "");
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function getAdminWithdrawRequests(req, res) {
    try {
        const result = await walletService.getAdminWithdrawRequests();
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function approveWithdraw(req, res) {
    try {
        const result = await walletService.approveWithdrawRequest(req.user.id, req.params.id, req.body?.admin_note || "");
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function rejectWithdraw(req, res) {
    try {
        const result = await walletService.rejectWithdrawRequest(
            req.user.id,
            req.params.id,
            req.body?.rejection_reason || "",
            req.body?.admin_note || ""
        );
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

async function completeWithdraw(req, res) {
    try {
        const result = await walletService.completeWithdrawRequest(req.user.id, req.params.id, req.body || {});
        return res.json(result);
    } catch (error) {
        return handleError(res, error);
    }
}

module.exports = {
    createDepositRequest,
    getDepositHistory,
    createWithdrawRequest,
    getWithdrawHistory,
    getWallet,
    getAdminDepositRequests,
    approveDeposit,
    rejectDeposit,
    getAdminWithdrawRequests,
    approveWithdraw,
    rejectWithdraw,
    completeWithdraw,
};
