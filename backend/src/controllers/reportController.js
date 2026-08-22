const reportService = require("../services/reportService");
const { handleError } = require("../utils/httpError");

async function activeReasons(req, res) {
  try { return res.json({ reasons: await reportService.getActiveReasons() }); }
  catch (err) { return handleError(res, err, "Failed to fetch report reasons"); }
}

async function create(req, res) {
  try {
    const report = await reportService.createReport({
      reporterId: req.user.id,
      reportedUserId: req.body?.reported_user_id,
      reasonId: req.body?.reason_id,
      description: req.body?.description,
    });
    return res.status(201).json({ report });
  } catch (err) { return handleError(res, err, "Failed to create report"); }
}

async function adminList(req, res) {
  try {
    const reports = await reportService.listReports({
      status: req.query.status,
      reportedUserId: req.query.reported_user_id,
      reporterId: req.query.reporter_id,
      reasonId: req.query.reason_id,
      from: req.query.from,
      to: req.query.to,
    });
    return res.json({ reports });
  } catch (err) { return handleError(res, err, "Failed to fetch reports"); }
}

async function adminReview(req, res) {
  try {
    const report = await reportService.reviewReport(req.params.id, {
      status: req.body?.status,
      adminNote: req.body?.admin_note,
      adminId: req.user.id,
    });
    return res.json({ report });
  } catch (err) { return handleError(res, err, "Failed to review report"); }
}

async function adminReasonList(req, res) {
  try { return res.json({ reasons: await reportService.listReasons() }); }
  catch (err) { return handleError(res, err, "Failed to fetch report reasons"); }
}

async function adminReasonCreate(req, res) {
  try {
    const reason = await reportService.createReason({ name: req.body?.name, description: req.body?.description, isActive: req.body?.is_active !== false });
    return res.status(201).json({ reason });
  } catch (err) { return handleError(res, err, "Failed to create report reason"); }
}

async function adminReasonUpdate(req, res) {
  try {
    const reason = await reportService.updateReason(req.params.id, { name: req.body?.name, description: req.body?.description, isActive: req.body?.is_active });
    return res.json({ reason });
  } catch (err) { return handleError(res, err, "Failed to update report reason"); }
}

async function adminReasonToggle(req, res) {
  try {
    const reason = await reportService.toggleReason(req.params.id, req.body?.is_active !== false);
    return res.json({ reason });
  } catch (err) { return handleError(res, err, "Failed to update report reason"); }
}

async function adminReasonDelete(req, res) {
  try { return res.json({ reason: await reportService.deleteReason(req.params.id) }); }
  catch (err) { return handleError(res, err, "Failed to disable report reason"); }
}

async function accountStatus(req, res, isActive) {
  try {
    const result = await reportService.setAccountActive({ adminId: req.user.id, userId: req.params.id, isActive, note: req.body?.admin_note });
    return res.json(result);
  } catch (err) { return handleError(res, err, "Failed to update account status"); }
}

module.exports = { activeReasons, create, adminList, adminReview, adminReasonList, adminReasonCreate, adminReasonUpdate, adminReasonToggle, adminReasonDelete, ban: (req, res) => accountStatus(req, res, false), unban: (req, res) => accountStatus(req, res, true) };