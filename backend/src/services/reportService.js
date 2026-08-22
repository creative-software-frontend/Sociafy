const db = require("../config/db");
const { boom } = require("../utils/httpError");

const reportSelect = `r.id, r.description, r.status, r.admin_note, r.reviewed_at, r.created_at, r.updated_at,
  r.reporter_id, reporter.name AS reporter_name, reporter.email AS reporter_email, reporter.role AS reporter_role,
  r.reported_user_id, reported.name AS reported_name, reported.email AS reported_email, reported.role AS reported_role,
  r.reason_id, rr.name AS reason_name, rr.description AS reason_description,
  r.reviewed_by, reviewer.name AS reviewer_name, reviewer.email AS reviewer_email`;

async function getActiveReasons() {
  const [rows] = await db.query("SELECT id, name, description FROM report_reasons WHERE is_active = 1 ORDER BY name ASC");
  return rows;
}

async function listReasons() {
  const [rows] = await db.query("SELECT id, name, description, is_active, created_at, updated_at FROM report_reasons ORDER BY name ASC");
  return rows;
}

async function createReason({ name, description, isActive = true }) {
  if (typeof name !== "string" || !name.trim()) throw boom(400, "Reason name is required");
  try {
    const [result] = await db.query("INSERT INTO report_reasons (name, description, is_active) VALUES (?, ?, ?)", [name.trim(), description || null, isActive ? 1 : 0]);
    const [rows] = await db.query("SELECT id, name, description, is_active, created_at, updated_at FROM report_reasons WHERE id = ?", [result.insertId]);
    return rows[0];
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw boom(409, "A report reason with that name already exists");
    throw err;
  }
}

async function updateReason(id, { name, description, isActive }) {
  const fields = [];
  const values = [];
  if (name !== undefined) {
    if (typeof name !== "string" || !name.trim()) throw boom(400, "Reason name is required");
    fields.push("name = ?"); values.push(name.trim());
  }
  if (description !== undefined) { fields.push("description = ?"); values.push(description || null); }
  if (isActive !== undefined) { fields.push("is_active = ?"); values.push(isActive ? 1 : 0); }
  if (!fields.length) throw boom(400, "No changes supplied");
  values.push(id);
  try { await db.query(`UPDATE report_reasons SET ${fields.join(", ")} WHERE id = ?`, values); }
  catch (err) { if (err.code === "ER_DUP_ENTRY") throw boom(409, "A report reason with that name already exists"); throw err; }
  const [rows] = await db.query("SELECT id, name, description, is_active, created_at, updated_at FROM report_reasons WHERE id = ?", [id]);
  if (!rows.length) throw boom(404, "Report reason not found");
  return rows[0];
}

async function toggleReason(id, isActive) { return updateReason(id, { isActive }); }

async function deleteReason(id) {
  const [result] = await db.query("UPDATE report_reasons SET is_active = 0 WHERE id = ?", [id]);
  if (!result.affectedRows) throw boom(404, "Report reason not found");
  return { id: Number(id), is_active: 0 };
}

async function createReport({ reporterId, reportedUserId, reasonId, description }) {
  if (!Number.isInteger(Number(reportedUserId)) || !Number.isInteger(Number(reasonId))) throw boom(400, "A valid reported user and reason are required");
  if (Number(reporterId) === Number(reportedUserId)) throw boom(400, "You cannot report yourself");
  const [targetRows] = await db.query("SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1", [reportedUserId]);
  if (!targetRows.length || !["user", "provider"].includes(targetRows[0].role) || Number(targetRows[0].is_active) !== 1) throw boom(400, "Reported account is invalid");
  const [reasonRows] = await db.query("SELECT id FROM report_reasons WHERE id = ? AND is_active = 1 LIMIT 1", [reasonId]);
  if (!reasonRows.length) throw boom(400, "Report reason is invalid or disabled");
  try {
    const [result] = await db.query("INSERT INTO user_reports (reporter_id, reported_user_id, reason_id, description) VALUES (?, ?, ?, ?)", [reporterId, reportedUserId, reasonId, description ? String(description).trim() : null]);
    const [rows] = await db.query(`SELECT ${reportSelect} FROM user_reports r JOIN users reporter ON reporter.id = r.reporter_id JOIN users reported ON reported.id = r.reported_user_id JOIN report_reasons rr ON rr.id = r.reason_id LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by WHERE r.id = ?`, [result.insertId]);
    return rows[0];
  } catch (err) {
    if (err.code === "ER_DUP_ENTRY") throw boom(409, "A pending report for this account and reason already exists");
    throw err;
  }
}

async function listReports(filters) {
  const where = []; const values = [];
  const add = (sql, value) => { where.push(sql); values.push(value); };
  if (filters.status) add("r.status = ?", filters.status);
  if (filters.reportedUserId) add("r.reported_user_id = ?", filters.reportedUserId);
  if (filters.reporterId) add("r.reporter_id = ?", filters.reporterId);
  if (filters.reasonId) add("r.reason_id = ?", filters.reasonId);
  if (filters.from) add("r.created_at >= ?", filters.from);
  if (filters.to) add("r.created_at <= ?", filters.to);
  const [rows] = await db.query(`SELECT ${reportSelect} FROM user_reports r JOIN users reporter ON reporter.id = r.reporter_id JOIN users reported ON reported.id = r.reported_user_id JOIN report_reasons rr ON rr.id = r.reason_id LEFT JOIN users reviewer ON reviewer.id = r.reviewed_by ${where.length ? `WHERE ${where.join(" AND ")}` : ""} ORDER BY r.created_at DESC`, values);
  return rows;
}

async function reviewReport(id, { status, adminNote, adminId }) {
  if (!["Pending", "Reviewed", "Dismissed"].includes(status)) throw boom(400, "Invalid report status");
  const [result] = await db.query("UPDATE user_reports SET status = ?, admin_note = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?", [status, adminNote || null, adminId, id]);
  if (!result.affectedRows) throw boom(404, "Report not found");
  await db.query("INSERT INTO moderation_audit_log (admin_id, action, report_id, note) VALUES (?, ?, ?, ?)", [adminId, `report_${status.toLowerCase()}`, id, adminNote || null]);
  const rows = await listReports({});
  return rows.find((row) => Number(row.id) === Number(id));
}

async function setAccountActive({ adminId, userId, isActive, note }) {
  const [users] = await db.query("SELECT id, role, is_active FROM users WHERE id = ? LIMIT 1", [userId]);
  if (!users.length || !["user", "provider"].includes(users[0].role)) throw boom(404, "User or provider not found");
  await db.query("UPDATE users SET is_active = ? WHERE id = ?", [isActive ? 1 : 0, userId]);
  await db.query("INSERT INTO moderation_audit_log (admin_id, action, target_user_id, note) VALUES (?, ?, ?, ?)", [adminId, isActive ? "account_unbanned" : "account_banned", userId, note || null]);
  return { id: Number(userId), is_active: isActive ? 1 : 0 };
}

module.exports = { getActiveReasons, listReasons, createReason, updateReason, toggleReason, deleteReason, createReport, listReports, reviewReport, setAccountActive };