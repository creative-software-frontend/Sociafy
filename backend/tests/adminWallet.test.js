const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

process.env.JWT_SECRET = 'test-secret-admin-wallet-000';

// Simple in-memory DB stub tailored for admin wallet queries
let adminWalletRows = [{ id: 1, balance: 123.45 }];
let adminWalletTransactions = [
    { id: 1, type: 'membership_income', amount: 50, description: 'Member fee', reference_id: null, created_at: new Date().toISOString() },
];
let simulateMissingTables = false;

function route(sql, values) {
    const S = String(sql).toLowerCase();
    if (S.includes("select balance from admin_wallet")) return adminWalletRows;
    if (S.includes("select * from admin_wallet_transactions")) return adminWalletTransactions;
    if (simulateMissingTables && (S.includes('admin_wallet') || S.includes('admin_wallet_transactions'))) {
        throw new Error('Table not found');
    }
    // summary queries for different types
    if (S.includes("from admin_wallet_transactions") && S.includes("membership_income")) {
        return [{ total: adminWalletTransactions.filter(t => t.type === 'membership_income').reduce((s,v) => s + v.amount, 0) }];
    }
    if (S.includes("from admin_wallet_transactions") && S.includes("audio_call_income")) {
        return [{ total: adminWalletTransactions.filter(t => t.type === 'audio_call_income').reduce((s,v) => s + v.amount, 0) }];
    }
    if (S.includes("from admin_wallet_transactions") && S.includes("withdraw")) {
        return [{ total: adminWalletTransactions.filter(t => t.type === 'withdraw').reduce((s,v) => s + Math.abs(v.amount), 0) }];
    }
    // roleMiddleware / auth checks: return an admin row for id 1, a normal user otherwise
    if (/select role, is_active from users where id = \?/i.test(String(sql))) {
        const id = values && values[0];
        if (Number(id) === 1) return [{ role: 'admin', is_active: 1 }];
        return [{ role: 'user', is_active: 1 }];
    }
    return [];
}

function makeConnection() {
    return {
        query(sql, values) {
            return Promise.resolve([route(sql, values), []]);
        },
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

// Inject stubbed db before requiring app routes
const dbModulePath = require.resolve('../src/config/db.js');
require.cache[dbModulePath] = { id: dbModulePath, filename: dbModulePath, loaded: true, exports: stubDb };

const app = express();
app.use(express.json());
app.use('/api/admin/wallet', require('../src/routes/adminWalletRoutes'));
app.use((req, res) => res.status(404).json({ message: 'not found' }));

let server;
let base;

test.before(async () => {
    server = http.createServer(app);
    await new Promise(r => server.listen(0, r));
    base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
    if (server) await new Promise(r => server.close(r));
});

function sign(id, role) {
    return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' });
}

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

test('GET /api/admin/wallet rejects no token', async () => {
    const { status, json } = await call('GET', '/api/admin/wallet');
    assert.equal(status, 401);
    assert.equal(json.message, 'No token provided');
});

test('GET /api/admin/wallet rejects normal user token', async () => {
    const token = sign(999, 'user');
    const { status, json } = await call('GET', '/api/admin/wallet', { token });
    assert.equal(status, 403);
    assert.equal(json.message, 'Access denied');
});

test('GET /api/admin/wallet returns wallet structure for admin token', async () => {
    const token = sign(1, 'admin');
    const { status, json } = await call('GET', '/api/admin/wallet', { token });
    assert.equal(status, 200);
    assert.ok('balance' in json);
    assert.ok(Array.isArray(json.transactions));
});

test('GET /api/admin/wallet handles empty transactions gracefully', async () => {
    // simulate empty transactions and zero balance
    adminWalletRows = [];
    adminWalletTransactions = [];
    const token = sign(1, 'admin');
    const { status, json } = await call('GET', '/api/admin/wallet', { token });
    assert.equal(status, 200);
    assert.equal(json.balance, 0);
    assert.ok(Array.isArray(json.transactions));
    assert.equal(json.transactions.length, 0);
});

test('GET /api/admin/wallet returns 500 when tables missing', async () => {
    simulateMissingTables = true;
    const token = sign(1, 'admin');
    const { status, json } = await call('GET', '/api/admin/wallet', { token });
    // Controller surfaces a 500 on DB errors
    assert.equal(status, 500);
    simulateMissingTables = false;
});
