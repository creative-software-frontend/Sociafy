const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const http = require("http");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "report-test-secret";

const users = new Map([
  [1, { id: 1, name: "User", email: "user@example.com", role: "user", is_active: 1 }],
  [2, { id: 2, name: "Provider", email: "provider@example.com", role: "provider", is_active: 1 }],
  [3, { id: 3, name: "Admin", email: "admin@example.com", role: "admin", is_active: 1 }],
]);
const reasons = [{ id: 5, name: "Spam", description: null, is_active: 1 }];
const reports = [];
let nextReportId = 1;

function rowsForUser(id) {
  const user = users.get(Number(id));
  return user ? [{ id: user.id, role: user.role, is_active: user.is_active, name: user.name, email: user.email }] : [];
}
function reportRow(report) {
  const reporter = users.get(report.reporter_id);
  const reported = users.get(report.reported_user_id);
  const reason = reasons.find((item) => item.id === report.reason_id);
  return { ...report, reporter_name: reporter.name, reporter_email: reporter.email, reporter_role: reporter.role, reported_name: reported.name, reported_email: reported.email, reported_role: reported.role, reason_name: reason.name, reason_description: reason.description, reviewer_name: null, reviewer_email: null };
}
function queryResult(sql, values = []) {
  const statement = String(sql).toLowerCase();
  if (statement.includes("select role, is_active from users")) return rowsForUser(values[0]);
  if (statement.includes("select id, role, is_active from users")) return rowsForUser(values[0]);
  if (statement.includes("select id, name, description from report_reasons where is_active = 1")) return reasons.filter((reason) => reason.is_active === 1);
  if (statement.includes("select id from report_reasons where id = ? and is_active = 1")) return reasons.filter((reason) => reason.id === Number(values[0]) && reason.is_active === 1);
  if (statement.startsWith("insert into user_reports")) {
    if (reports.some((report) => report.reporter_id === Number(values[0]) && report.reported_user_id === Number(values[1]) && report.reason_id === Number(values[2]) && report.status === "Pending")) {
      const error = new Error("duplicate"); error.code = "ER_DUP_ENTRY"; throw error;
    }
    const report = { id: nextReportId++, reporter_id: Number(values[0]), reported_user_id: Number(values[1]), reason_id: Number(values[2]), description: values[3], status: "Pending", admin_note: null, reviewed_by: null, reviewed_at: null, created_at: null, updated_at: null };
    reports.push(report);
    return { insertId: report.id };
  }
  if (statement.includes("from user_reports r")) return reports.map(reportRow);
  return [];
}
const dbPath = require.resolve("../src/config/db.js");
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: {
  query(sql, values, callback) {
    if (typeof values === "function") { callback = values; values = []; }
    try {
      const result = queryResult(sql, values || []);
      if (callback) return callback(null, result);
      return Promise.resolve([result, []]);
    } catch (error) {
      if (callback) return callback(error);
      return Promise.reject(error);
    }
  },
} };

const app = express();
app.use(express.json());
app.use("/api", require("../src/routes/reportRoutes"));
app.use("/api/admin", require("../src/routes/adminReportRoutes"));
app.use((req, res) => res.status(404).json({ message: "not found" }));
let server;
let base;
test.before(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(async () => { await new Promise((resolve) => server.close(resolve)); });
function token(id) { return jwt.sign({ id, role: users.get(id)?.role }, process.env.JWT_SECRET); }
async function call(method, path, options = {}) {
  const response = await fetch(`${base}${path}`, { method, headers: { ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}), ...(options.body ? { "Content-Type": "application/json" } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  return { status: response.status, json: await response.json() };
}

test("unauthenticated report requests return 401", async () => {
  const response = await call("POST", "/api/reports", { body: { reported_user_id: 2, reason_id: 5 } });
  assert.equal(response.status, 401);
});

test("user and provider can report, and reporter ID is derived from auth", async () => {
  const userResponse = await call("POST", "/api/reports", { token: token(1), body: { reported_user_id: 2, reason_id: 5, reporter_id: 2 } });
  assert.equal(userResponse.status, 201);
  assert.equal(userResponse.json.report.reporter_id, 1);
  const providerResponse = await call("POST", "/api/reports", { token: token(2), body: { reported_user_id: 1, reason_id: 5 } });
  assert.equal(providerResponse.status, 201);
});

test("self reports, invalid targets, disabled reasons, and duplicate pending reports are rejected", async () => {
  assert.equal((await call("POST", "/api/reports", { token: token(1), body: { reported_user_id: 1, reason_id: 5 } })).status, 400);
  assert.equal((await call("POST", "/api/reports", { token: token(1), body: { reported_user_id: 99, reason_id: 5 } })).status, 400);
  reasons[0].is_active = 0;
  assert.equal((await call("POST", "/api/reports", { token: token(1), body: { reported_user_id: 2, reason_id: 5 } })).status, 400);
  reasons[0].is_active = 1;
  assert.equal((await call("POST", "/api/reports", { token: token(1), body: { reported_user_id: 2, reason_id: 5 } })).status, 409);
});

test("inactive accounts cannot access report endpoints and unbanned accounts can", async () => {
  users.get(1).is_active = 0;
  assert.equal((await call("GET", "/api/report-reasons", { token: token(1) })).status, 403);
  users.get(1).is_active = 1;
  assert.equal((await call("GET", "/api/report-reasons", { token: token(1) })).status, 200);
});

test("admin report endpoints are role protected", async () => {
  assert.equal((await call("GET", "/api/admin/reports/users", { token: token(1) })).status, 403);
  const reportsResponse = await call("GET", "/api/admin/reports/users", { token: token(3) });
  assert.equal(reportsResponse.status, 200);
  const reasonsResponse = await call("GET", "/api/admin/report-reasons", { token: token(3) });
  assert.equal(reasonsResponse.status, 200);
});
