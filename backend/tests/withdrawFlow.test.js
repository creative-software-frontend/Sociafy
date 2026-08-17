const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-secret-withdraw-flow-000';

// ── In-memory model of users / withdraw_requests / transactions ───────────────
let users = [];
let withdraws = [];
let transactions = [];
let nextWid = 500;
let nextTxId = 9000;

function reset() {
    users = [
        { id: 1, name: 'Admin', email: 'admin@x.com', role: 'admin', balance: 0, earnings: 0, is_active: 1, membership_package_id: null, membership_expires_at: null },
        { id: 10, name: 'Alice', email: 'alice@x.com', role: 'user', balance: 10000, earnings: 0, is_active: 1, membership_package_id: null, membership_expires_at: null },
        { id: 20, name: 'Bob', email: 'bob@x.com', role: 'provider', balance: 20000, earnings: 0, is_active: 1, membership_package_id: null, membership_expires_at: null },
    ];
    withdraws = [];
    transactions = [];
    nextWid = 500;
    nextTxId = 9000;
}

const rowShape = (w) => ({
    id: w.id,
    request_id: w.request_id,
    user_id: w.user_id,
    amount: w.amount,
    method: w.method,
    account_number: w.account_number,
    status: w.status,
    admin_note: w.admin_note,
    rejection_reason: w.rejection_reason,
    approved_by: w.approved_by,
    approved_at: w.approved_at,
    processed_by: w.processed_by,
    processed_at: w.processed_at,
    payment_transaction_id: w.payment_transaction_id,
    payment_amount: w.payment_amount,
    payment_method: w.payment_method,
    payment_proof: w.payment_proof,
    payment_at: w.payment_at,
    ledger_transaction_id: w.ledger_transaction_id,
    updated_at: w.updated_at,
    created_at: w.created_at,
});

function findUser(id) { return users.find(u => u.id === Number(id)); }
function findWd(id) { return withdraws.find(w => w.id === Number(id)); }

// Returns ROW ARRAYS for SELECTs and a ResultSetHeader object for DML.
function route(sql, values) {
    const S = String(sql).toLowerCase();
    const v = values || [];

    if (S.includes('select membership_package_id, membership_expires_at from users')) {
        const u = findUser(v[0]);
        return u ? [{ membership_package_id: u.membership_package_id, membership_expires_at: u.membership_expires_at }] : [];
    }
    if (S.includes('update users set last_seen')) return { affectedRows: 1 };
    if (/select role, is_active from users where id = \?/i.test(S)) {
        const u = findUser(v[0]);
        return u ? [{ role: u.role, is_active: u.is_active }] : [];
    }
    if (S.includes('select id, balance, earnings, role from users where id = ? for update')) {
        const u = findUser(v[0]);
        return [{ id: u.id, balance: u.balance, earnings: u.earnings, role: u.role }];
    }
    if (S.includes('update users set balance = balance - ? where id = ?')) {
        const u = findUser(v[1]);
        u.balance = Number(u.balance) - Number(v[0]);
        return { affectedRows: 1 };
    }
    if (S.includes('update users set balance = balance + ? where id = ?')) {
        const u = findUser(v[1]);
        u.balance = Number(u.balance) + Number(v[0]);
        return { affectedRows: 1 };
    }
    if (S.includes('insert into withdraw_requests')) {
        const nid = nextWid++;
        withdraws.push({
            id: nid, user_id: v[0], amount: v[1], method: v[2], account_number: v[3], status: 'Pending',
            request_id: null, admin_note: null, rejection_reason: null, approved_by: null, approved_at: null,
            processed_by: null, processed_at: null, payment_transaction_id: null, payment_amount: null,
            payment_method: null, payment_proof: null, payment_at: null, ledger_transaction_id: null,
            updated_at: null, created_at: new Date(2026, 7, 16, 12, 42).toISOString(),
        });
        return { insertId: nid, affectedRows: 1 };
    }
    if (S.includes('update withdraw_requests set request_id = ? where id')) {
        findWd(v[1]).request_id = v[0];
        return { affectedRows: 1 };
    }
    if (S.includes('select id, user_id, amount, status from withdraw_requests where id = ? for update')) {
        const w = findWd(v[0]);
        return w ? [{ id: w.id, user_id: w.user_id, amount: w.amount, status: w.status }] : [];
    }
    if (S.includes('from withdraw_requests where id = ? limit 1')) {
        const w = findWd(v[0]);
        return w ? [rowShape(w)] : [];
    }
    if (S.includes("set status = 'approved'")) {
        const w = findWd(v[2]);
        w.status = 'Approved'; w.approved_by = v[1]; w.approved_at = new Date().toISOString();
        return { affectedRows: 1 };
    }
    if (S.includes("set status = 'rejected'")) {
        const w = findWd(v[3]);
        w.status = 'Rejected'; w.rejection_reason = v[0]; w.admin_note = v[1]; w.approved_by = v[2];
        w.approved_at = new Date().toISOString();
        return { affectedRows: 1 };
    }
    if (S.includes("set status = 'completed'")) {
        const w = findWd(v[6]);
        w.status = 'Completed'; w.payment_transaction_id = v[0]; w.payment_amount = v[1];
        w.payment_method = v[2]; w.payment_proof = v[3]; w.processed_by = v[4];
        w.payment_at = new Date().toISOString();
        return { affectedRows: 1 };
    }
    if (S.includes('insert into transactions') && S.includes("'withdraw'")) {
        const txid = nextTxId++;
        transactions.push({ id: txid, user_id: v[0], type: 'withdraw', amount: v[1], status: 'completed', description: v[2] });
        return { insertId: txid, affectedRows: 1 };
    }
    if (S.includes('update withdraw_requests set ledger_transaction_id')) {
        findWd(v[1]).ledger_transaction_id = Number(v[0]);
        return { affectedRows: 1 };
    }
    if (S.includes('select wr.id, wr.user_id, wr.request_id')) {
        return withdraws.map(w => ({
            ...rowShape(w),
            user_name: findUser(w.user_id)?.name || null,
            user_email: findUser(w.user_id)?.email || null,
            user_role: findUser(w.user_id)?.role || null,
            user_balance: findUser(w.user_id)?.balance ?? null,
            approved_by_name: findUser(w.approved_by)?.name || null,
            processed_by_name: findUser(w.processed_by)?.name || null,
        }));
    }
    if (S.includes('from withdraw_requests where user_id = ? order by created_at desc')) {
        return withdraws.filter(w => w.user_id === Number(v[0])).map(rowShape);
    }
    return [];
}

function makeConnection() {
    return {
        query(sql, values) { return Promise.resolve([route(sql, values), []]); },
        beginTransaction() { return Promise.resolve(); },
        commit() { return Promise.resolve(); },
        rollback() { return Promise.resolve(); },
        release() { return Promise.resolve(); },
    };
}

const stubDb = {
    query(sql, values, cb) {
        if (typeof values === 'function') { cb = values; values = undefined; }
        const rows = route(sql, values || []);
        if (typeof cb === 'function') return cb(null, rows);
        return Promise.resolve([rows, []]);
    },
    getConnection() { return Promise.resolve(makeConnection()); },
};

// Inject stubbed db before requiring services/routes.
const dbModulePath = require.resolve('../src/config/db.js');
require.cache[dbModulePath] = { id: dbModulePath, filename: dbModulePath, loaded: true, exports: stubDb };

const walletService = require('../src/services/walletService');

// ── Service-level lifecycle tests ──────────────────────────────────────────────
test.before(() => reset());

test('user can create a withdrawal (Pending, reserve deducted, WD reference)', async () => {
    reset();
    const row = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    assert.equal(row.status, 'Pending');
    assert.ok(/^WD-\d{8}-\d{5}$/.test(row.request_id || ''), `request_id ${row.request_id}`);
    assert.equal(findUser(10).balance, 9000);
});

test('provider can create a withdrawal', async () => {
    reset();
    const row = await walletService.createWithdrawRequest(20, { amount: 500, method: 'Nagad', account_number: '01900000000' });
    assert.equal(row.status, 'Pending');
    assert.equal(findUser(20).balance, 19500);
});

test('insufficient balance is rejected and balance unchanged', async () => {
    reset();
    await assert.rejects(
        () => walletService.createWithdrawRequest(10, { amount: 99999, method: 'bKash', account_number: '01880299555' }),
        /Insufficient|reserved/
    );
    assert.equal(findUser(10).balance, 10000);
});

test('withdrawal request is not created for another user via payload', async () => {
    reset();
    const row = await walletService.createWithdrawRequest(10, { amount: 250, method: 'bKash', account_number: '01880299555' });
    assert.equal(row.user_id, 10);
});

test('admin can approve a Pending withdrawal → Approved, no second deduction', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    const before = findUser(10).balance; // 9000
    const approved = await walletService.approveWithdrawRequest(1, created.id, 'ok');
    assert.equal(approved.status, 'Approved');
    assert.equal(approved.approved_by, 1);
    assert.equal(findUser(10).balance, before); // no deduction at approval (reserved at creation)
});

test('admin cannot approve twice', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.approveWithdrawRequest(1, created.id, 'ok');
    await assert.rejects(() => walletService.approveWithdrawRequest(1, created.id, 'again'), /no longer pending/);
});

test('admin cannot approve a Rejected withdrawal', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.rejectWithdrawRequest(1, created.id, 'fraud concern');
    await assert.rejects(() => walletService.approveWithdrawRequest(1, created.id, 'ok'), /no longer pending/);
});

test('rejection requires a reason', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await assert.rejects(() => walletService.rejectWithdrawRequest(1, created.id, ''), /rejection reason/);
});

test('rejection stores reason and refunds the reserve exactly once', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    assert.equal(findUser(10).balance, 9000);
    const rejected = await walletService.rejectWithdrawRequest(1, created.id, 'insufficient verification');
    assert.equal(rejected.status, 'Rejected');
    assert.equal(rejected.rejection_reason, 'insufficient verification');
    assert.equal(findUser(10).balance, 10000); // refunded once
});

test('only Approved withdrawal can be completed', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await assert.rejects(
        () => walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: 'T1', payment_amount: 1000, payment_method: 'bKash' }),
        /must be approved/
    );
});

test('completion requires a payment TXID', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.approveWithdrawRequest(1, created.id);
    await assert.rejects(
        () => walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: '', payment_amount: 1000, payment_method: 'bKash' }),
        /Payment transaction ID is required/
    );
});

test('completion records TXID, amount, admin and links exactly one ledger transaction', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.approveWithdrawRequest(1, created.id);
    const done = await walletService.completeWithdrawRequest(1, created.id, {
        payment_transaction_id: 'PAYOUT-998877', payment_amount: 1000, payment_method: 'bKash', admin_note: 'batch 7',
    });
    assert.equal(done.status, 'Completed');
    assert.equal(done.payment_transaction_id, 'PAYOUT-998877');
    assert.equal(String(done.payment_amount), '1000.00');
    assert.equal(done.processed_by, 1);
    const ledger = transactions.filter(t => t.type === 'withdraw');
    assert.equal(ledger.length, 1); // exactly one ledger entry
    assert.equal(done.ledger_transaction_id, ledger[0].id); // traceable linkage
});

test('completion cannot happen twice and does not create a second ledger entry', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.approveWithdrawRequest(1, created.id);
    await walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: 'T-X', payment_amount: 1000, payment_method: 'Nagad' });
    await assert.rejects(
        () => walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: 'T-Y', payment_amount: 1000, payment_method: 'Nagad' }),
        /must be approved/
    );
    assert.equal(transactions.filter(t => t.type === 'withdraw').length, 1);
});

test('concurrent/late duplicate completion is rejected by the guards (row-lock outcome)', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    await walletService.approveWithdrawRequest(1, created.id);
    // Two "simultaneous" completes: the second must observe status != Approved.
    await walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: 'C1', payment_amount: 1000, payment_method: 'bKash' });
    await assert.rejects(
        () => walletService.completeWithdrawRequest(1, created.id, { payment_transaction_id: 'C2', payment_amount: 1000, payment_method: 'bKash' }),
        /must be approved/
    );
    assert.equal(transactions.filter(t => t.type === 'withdraw').length, 1);
});

test('admin list exposes requester identity, role and server wallet balance', async () => {
    reset();
    await walletService.createWithdrawRequest(10, { amount: 1000, method: 'bKash', account_number: '01880299555' });
    const list = await walletService.getAdminWithdrawRequests();
    assert.equal(list.length, 1);
    assert.equal(list[0].user_role, 'user');
    assert.equal(list[0].user_email, 'alice@x.com');
    assert.equal(list[0].user_balance, 9000); // server-derived, after reservation
});

// ── HTTP route-level authorization tests ───────────────────────────────────────
const app = express();
app.use(express.json());
app.use('/api/admin-wallet', require('../src/routes/admin.wallet.routes'));
app.use('/api/user-wallet', require('../src/routes/wallet.routes'));
app.use((req, res) => res.status(404).json({ message: 'not found' }));

let server; let base;

test.before(async () => {
    server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise(r => server.close(r));
});

function sign(id, role) { return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' }); }
async function call(method, path, { token, body } = {}) {
    const res = await fetch(`${base}${path}`, {
        method,
        headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
}

test('route: no token → 401 for admin withdraw listing', async () => {
    reset();
    const { status } = await call('GET', '/api/admin-wallet/withdraw-requests');
    assert.equal(status, 401);
});

test('route: normal user/provider cannot approve', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 100, method: 'bKash', account_number: '01880299555' });
    const userTok = sign(10, 'user');
    const provTok = sign(20, 'provider');
    assert.equal((await call('PATCH', `/api/admin-wallet/withdraw/${created.id}/approve`, { token: userTok })).status, 403);
    assert.equal((await call('PATCH', `/api/admin-wallet/withdraw/${created.id}/approve`, { token: provTok })).status, 403);
});

test('route: admin can approve a Pending withdrawal', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 100, method: 'bKash', account_number: '01880299555' });
    const adminTok = sign(1, 'admin');
    const { status, json } = await call('PATCH', `/api/admin-wallet/withdraw/${created.id}/approve`, { token: adminTok, body: { admin_note: 'ok' } });
    assert.equal(status, 200);
    assert.equal(json.status, 'Approved');
});

test('route: reject without a reason → 400', async () => {
    reset();
    const created = await walletService.createWithdrawRequest(10, { amount: 100, method: 'bKash', account_number: '01880299555' });
    const adminTok = sign(1, 'admin');
    const { status } = await call('PATCH', `/api/admin-wallet/withdraw/${created.id}/reject`, { token: adminTok, body: { admin_note: '' } });
    assert.equal(status, 400);
});

test('route: user can create a withdrawal with a valid token; no token → 401', async () => {
    reset();
    const userTok = sign(10, 'user');
    const { status, json } = await call('POST', '/api/user-wallet/withdraw-request', {
        token: userTok,
        body: { amount: 200, method: 'bKash', account_number: '01880299555' },
    });
    assert.equal(status, 201);
    assert.equal(json.status, 'Pending');
    const noTok = await call('POST', '/api/user-wallet/withdraw-request', { body: { amount: 200, method: 'bKash', account_number: '01880299555' } });
    assert.equal(noTok.status, 401);
});