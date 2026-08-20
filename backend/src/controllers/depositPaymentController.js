const depositPaymentService = require("../services/depositPaymentService");
const { handleError } = require("../utils/httpError");

// Only whitelisted fields are read from the client — arbitrary fields ignored.
async function listActive(req, res) {
    try {
        const methods = await depositPaymentService.getActiveMethods();
        return res.json({ methods });
    } catch (err) {
        return handleError(res, err, "Failed to fetch deposit payment methods");
    }
}

async function adminList(req, res) {
    try {
        const methods = await depositPaymentService.listMethods({ includeInactive: true });
        return res.json({ methods });
    } catch (err) {
        return handleError(res, err, "Failed to fetch deposit payment methods");
    }
}

async function adminCreate(req, res) {
    try {
        const method = await depositPaymentService.createMethod({
            method: req.body?.method,
            account_number: req.body?.account_number,
            account_type: req.body?.account_type,
            is_active: req.body?.is_active !== false,
        });
        return res.status(201).json({ method });
    } catch (err) {
        return handleError(res, err, "Failed to create deposit payment method");
    }
}

async function adminUpdate(req, res) {
    try {
        const id = Number(req.params.id);
        const method = await depositPaymentService.updateMethod(id, {
            account_number: req.body?.account_number,
            account_type: req.body?.account_type,
            is_active: req.body?.is_active,
        });
        return res.json({ method });
    } catch (err) {
        return handleError(res, err, "Failed to update deposit payment method");
    }
}

async function adminToggle(req, res) {
    try {
        const id = Number(req.params.id);
        const isActive = req.body?.is_active !== undefined ? !!req.body.is_active : true;
        const method = await depositPaymentService.toggleMethod(id, isActive);
        return res.json({ method });
    } catch (err) {
        return handleError(res, err, "Failed to update deposit payment method");
    }
}

module.exports = {
    listActive,
    adminList,
    adminCreate,
    adminUpdate,
    adminToggle,
};