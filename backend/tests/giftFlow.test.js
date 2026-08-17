const test = require('node:test');
const assert = require('node:assert/strict');

// ── In-memory DB stub for the gift flow ─────────────────────────────────────
// Models gifts, users (role/balance), chat_messages, gift_transactions,
// transactions, and the admin wallet. Mutates in-memory state so tests can
// assert exact wallet/revenue outcomes.

let gifts = [];
let users = [];
let giftTransactions = [];
let chatMessages = [];
let transactions = [];
let assets = [];
let adminWallet = { id: 1, balance: 0 };
let adminWalletTransactions = [];
let nextGiftId = 1;
let nextChatId = 1;
let nextAssetId = 1;

function seed() {
    gifts = [
        { id: 1, name: 'Rose', icon: '🌹', image: null, price: 10, provider_percentage: 70, admin_percentage: 30, asset_id: null, is_active: 1, created_at: null, updated_at: null },
        { id: 2, name: 'Diamond', icon: '💎', image: null, price: 100, provider_percentage: 70, admin_percentage: 30, asset_id: null, is_active: 0, created_at: null, updated_at: null },
    ];
    users = [
        { id: 1, name: 'Admin', role: 'admin', balance: 0, earnings: 0 },
        { id: 2, name: 'User', role: 'user', balance: 100, earnings: 0 },
        { id: 3, name: 'Provider', role: 'provider', balance: 0, earnings: 0 },
    ];
    giftTransactions = [];
    chatMessages = [];
    transactions = [];
    assets = [];
    adminWallet = { id: 1, balance: 0 };
    adminWalletTransactions = [];
    nextGiftId = 3;
    nextChatId = 1;
    nextAssetId = 1;
}

function route(sql, values = []) {
    const S = String(sql).toLowerCase();

    // gift SELECTs (now LEFT JOINs the gift asset library)
    if (S.includes('from gifts g') && S.includes('left join gift_assets')) {
        const rows = S.includes('where g.is_active = 1') ? gifts.filter((g) => g.is_active === 1) : gifts;
        const withAsset = (g) => {
            const a = g.asset_id != null ? assets.find((x) => x.id === Number(g.asset_id)) : null;
            return {
                ...g,
                asset_id: g.asset_id ?? null,
                ga_id: a ? a.id : null,
                asset_name: a ? a.name : null,
                asset_type: a ? a.asset_type : null,
                asset_url: a ? a.url : null,
            };
        };
        if (S.includes('where g.id = ?')) {
            const g = rows.find((x) => x.id === Number(values[0]));
            return g ? [withAsset(g)] : [];
        }
        return rows.map(withAsset);
    }
    // Gift asset library (service-level)
    if (S.startsWith('select') && S.includes('from gift_assets')) {
        const base = S.includes('where is_active = 1')
            ? assets.filter((a) => a.is_active === 1)
            : assets;
        if (S.includes('where id = ?')) {
            const a = base.find((x) => x.id === Number(values[0]));
            return a ? [{ ...a }] : [];
        }
        return base.map((a) => ({ ...a }));
    }
    if (S.includes('insert into gift_assets')) {
        const [name, assetType, url, storageKey] = values;
        const a = {
            id: nextAssetId++,
            name,
            asset_type: assetType,
            url,
            storage_key: storageKey,
            is_active: 1,
            created_at: null,
            updated_at: null,
        };
        assets.push(a);
        return { insertId: a.id, affectedRows: 1 };
    }
    if (S.includes('update gift_assets set')) {
        const matches = S.match(/update gift_assets set name = \?, is_active = \? where id = \?/);
        const [name, isActive, id] = values;
        const a = assets.find((x) => x.id === Number(id));
        if (a) { if (name !== undefined) a.name = name; a.is_active = Number(isActive); }
        return { affectedRows: a ? 1 : 0 };
    }
    if (S.includes('delete from gift_assets')) {
        const id = Number(values[0]);
        const idx = assets.findIndex((x) => x.id === id);
        if (idx >= 0) assets.splice(idx, 1);
        return { affectedRows: idx >= 0 ? 1 : 0 };
    }
    if (S.includes('select id from gifts where asset_id = ?')) {
        const existing = gifts.find((g) => g.asset_id === Number(values[0]));
        return existing ? [{ id: existing.id }] : [];
    }
    // INSERT gift
    if (/^insert into gifts/i.test(S)) {
        const [name, icon, image, price, providerPct, adminPct, assetId, isActive] = values;
        const g = {
            id: nextGiftId++,
            name,
            icon: icon || null,
            image: image || null,
            price: Number(price),
            provider_percentage: Number(providerPct),
            admin_percentage: Number(adminPct),
            asset_id: assetId ? Number(assetId) : null,
            is_active: Number(isActive),
            created_at: null,
            updated_at: null,
        };
        gifts.push(g);
        return { insertId: g.id, affectedRows: 1 };
    }
    // UPDATE gift is_active (toggle)
    if (/^update gifts set is_active/i.test(S)) {
        const [isActive, id] = values;
        const g = gifts.find((x) => x.id === Number(id));
        if (g) g.is_active = Number(isActive);
        return { affectedRows: g ? 1 : 0 };
    }

    // users role / name lookups
    if (/select role from users where id = \?/i.test(S)) {
        const u = users.find((x) => x.id === Number(values[0]));
        return u ? [{ role: u.role }] : [];
    }
    if (/select name from users where id = \?/i.test(S)) {
        const u = users.find((x) => x.id === Number(values[0]));
        return u ? [{ name: u.name }] : [];
    }
    if (/select balance from users where id = \? for update/i.test(S)) {
        const u = users.find((x) => x.id === Number(values[0]));
        return u ? [{ balance: u.balance }] : [];
    }
    if (/^update users set balance = balance - \?/i.test(S)) {
        const [amt, id] = values;
        const u = users.find((x) => x.id === Number(id));
        if (u) u.balance = Number(u.balance) - Number(amt);
        return { affectedRows: 1 };
    }
    if (/^update users set balance = balance \+ \?/i.test(S)) {
        const [amt, id] = values;
        const u = users.find((x) => x.id === Number(id));
        if (u) u.balance = Number(u.balance) + Number(amt);
        return { affectedRows: 1 };
    }

    // admin wallet (credit path used by giftService)
    if (/^update admin_wallet set balance = balance \+ \?/i.test(S)) {
        adminWallet.balance = Number(adminWallet.balance) + Number(values[0]);
        return { affectedRows: 1 };
    }
    if (/^insert into admin_wallet_transactions/i.test(S)) {
        const [type, amount, description, referenceId] = values;
        adminWalletTransactions.push({
            id: adminWalletTransactions.length + 1,
            type,
            amount: Number(amount),
            description,
            reference_id: referenceId,
            created_at: new Date().toISOString(),
        });
        return { insertId: adminWalletTransactions.length, affectedRows: 1 };
    }

    // chat message + gift + user/provider transactions
    if (/^insert into chat_messages/i.test(S)) {
        const [sender, receiver, message] = values;
        const id = nextChatId++;
        chatMessages.push({ id, sender_id: sender, receiver_id: receiver, message, created_at: new Date().toISOString() });
        return { insertId: id, affectedRows: 1 };
    }
    if (/^insert into gift_transactions/i.test(S)) {
        const [sender, receiver, giftId, price, providerAmount, adminAmount, messageId] = values;
        giftTransactions.push({
            id: giftTransactions.length + 1,
            sender_id: sender,
            receiver_id: receiver,
            gift_id: giftId,
            gift_price: Number(price),
            provider_amount: Number(providerAmount),
            admin_amount: Number(adminAmount),
            message_id: messageId,
            created_at: new Date().toISOString(),
        });
        return { insertId: giftTransactions.length, affectedRows: 1 };
    }
    if (/^insert into transactions/i.test(S)) {
        const [userId, amount, description] = values;
        const type = S.includes('gift_purchase') ? 'gift_purchase' : S.includes('gift_income') ? 'gift_income' : 'unknown';
        transactions.push({
            id: transactions.length + 1,
            user_id: userId,
            type,
            amount: Number(amount),
            status: 'completed',
            description,
            created_at: new Date().toISOString(),
        });
        return { insertId: transactions.length, affectedRows: 1 };
    }

    if (S.includes('select membership_package_id, membership_expires_at from users')) {
        const u = users.find((x) => x.id === Number(values[0]));
        return u ? [{ membership_package_id: null, membership_expires_at: null }] : [];
    }
    if (S.includes('update users set last_seen')) return { affectedRows: 1 };
    if (/select role, is_active from users where id = \?/i.test(S)) {
        const u = users.find((x) => x.id === Number(values[0]));
        return u ? [{ role: u.role, is_active: 1 }] : [];
    }

    return [];
}

function makeConnection() {
    return {
        async query(sql, values) { return [route(sql, values), []]; },
        async beginTransaction() {},
        async commit() {},
        async rollback() {},
        async release() {},
    };
}

const stubDb = {
    query(sql, values, cb) {
        if (typeof values === 'function') { cb = values; values = undefined; }
        const rows = route(sql, values || []);
        if (typeof cb === 'function') { cb(null, rows); return {}; }
        return Promise.resolve([rows, []]);
    },
    getConnection() { return Promise.resolve(makeConnection()); },
};

// Inject the stub DB before requiring any module that loads ../config/db.
const dbPath = require.resolve('../src/config/db.js');
require.cache[dbPath] = { id: dbPath, filename: dbPath, loaded: true, exports: stubDb };

// giftService requires chatService.getPartnerRequestStatus — stub it as always
// "accepted" so the tests exercise the gift logic without chat machinery.
const chatServicePath = require.resolve('../src/services/chatService.js');
require.cache[chatServicePath] = {
    id: chatServicePath,
    filename: chatServicePath,
    loaded: true,
    exports: { getPartnerRequestStatus: async () => 'accepted' },
};

const giftService = require('../src/services/giftService');

/* ══ Admin gift management ══ */

test('createGift always creates a gift as active (is_active = 1)', async () => {
    seed();
    const g = await giftService.createGift({ name: 'Rose', icon: '🌹', price: 10, provider_percentage: 70, admin_percentage: 30 });
    assert.equal(g.is_active, 1);
    assert.equal(gifts.find((x) => x.id === g.id).is_active, 1);
});

test('client-supplied is_active = 0 cannot create an inactive gift', async () => {
    seed();
    const g = await giftService.createGift({ name: 'Rose', price: 10, provider_percentage: 70, admin_percentage: 30, is_active: 0 });
    assert.equal(g.is_active, 1);
    assert.equal(gifts.find((x) => x.id === g.id).is_active, 1);
});

test('client-supplied is_active = 1 still creates an active gift', async () => {
    seed();
    const g = await giftService.createGift({ name: 'Rose', price: 10, provider_percentage: 70, admin_percentage: 30, is_active: 1 });
    assert.equal(g.is_active, 1);
});

test('toggleGift changes an active gift to inactive', async () => {
    seed();
    const g = await giftService.toggleGift(1, false);
    assert.equal(g.is_active, 0);
    assert.equal(gifts.find((x) => x.id === 1).is_active, 0);
});

test('toggleGift changes an inactive gift to active', async () => {
    seed();
    const g = await giftService.toggleGift(2, true);
    assert.equal(g.is_active, 1);
    assert.equal(gifts.find((x) => x.id === 2).is_active, 1);
});

test('getGifts returns only active gifts for users', async () => {
    seed();
    const list = await giftService.getGifts();
    assert.ok(list.every((g) => g.is_active === 1), 'all returned gifts must be active');
    assert.ok(list.some((g) => g.id === 1), 'active gift must be present');
    assert.ok(!list.some((g) => g.id === 2), 'inactive gift must be excluded');
});

test('admin list includes inactive gifts', async () => {
    seed();
    const list = await giftService.getGifts({ includeInactive: true });
    assert.equal(list.length, 2);
});

/* ══ Gift sending ══ */

test('sendGift rejects an inactive gift', async () => {
    seed();
    await assert.rejects(
        () => giftService.sendGift({ senderId: 2, receiverId: 3, giftId: 2 }),
        /Gift not found or inactive/
    );
    assert.equal(giftTransactions.length, 0, 'no transaction may be recorded for a rejected gift');
});

test('sendGift sends an active gift successfully', async () => {
    seed();
    const result = await giftService.sendGift({ senderId: 2, receiverId: 3, giftId: 1 });
    assert.ok(result.id, 'chat message id returned');
    assert.equal(chatMessages.length, 1);
    assert.equal(giftTransactions.length, 1);
    assert.equal(users.find((u) => u.id === 2).balance, 90, 'sender pays full ৳10');
    assert.equal(users.find((u) => u.id === 3).balance, 7, 'provider credited ৳7');
    assert.equal(adminWallet.balance, 3, 'admin credited ৳3');
    const purchase = transactions.find((t) => t.type === 'gift_purchase');
    const income = transactions.find((t) => t.type === 'gift_income');
    assert.equal(purchase.amount, -10);
    assert.equal(income.amount, 7);
});

test('a ৳10 gift distributes ৳7 to provider and ৳3 to admin', async () => {
    seed();
    await giftService.sendGift({ senderId: 2, receiverId: 3, giftId: 1 });
    const tx = giftTransactions[0];
    assert.equal(tx.gift_price, 10);
    assert.equal(tx.provider_amount, 7);
    assert.equal(tx.admin_amount, 3);
    assert.equal(users.find((u) => u.id === 3).balance, 7);
    assert.equal(adminWallet.balance, 3);
});


// -- Asset library + route-level authorization tests ----------------------------
const test2 = test;

const storageServicePath = require.resolve('../src/services/storageService.js');
require.cache[storageServicePath] = {
    id: storageServicePath,
    filename: storageServicePath,
    loaded: true,
    exports: {
        uploadFile: async ({ folder, filename, buffer, mimetype }) => ({
            key: `${folder}/asset-${nextAssetId}.gif`,
            url: `https://cdn.example.com/${folder}/asset-${nextAssetId}.gif`,
        }),
        deleteFile: async () => {},
        getPublicUrl: () => '',
    },
};

const giftController = require('../src/controllers/giftController');
const giftRoutes = require('../src/routes/giftRoutes');

const http = require('http');
const jwt = require('jsonwebtoken');
const express = require('express');
process.env.JWT_SECRET = 'test-secret-gift-assets-000';

const assetApp = express();
assetApp.use(express.json());
assetApp.use('/api/admin/gifts', giftRoutes.adminRouter);
assetApp.use('/api/gift', giftRoutes.userRouter);
assetApp.use((req, res) => res.status(404).json({ message: 'not found' }));

let assetServer;
let assetBase;

test2.before(async () => {
    assetServer = http.createServer(assetApp);
    await new Promise((r) => assetServer.listen(0, r));
    assetBase = `http://127.0.0.1:${assetServer.address().port}`;
});

test2.after(async () => {
    if (assetServer) await new Promise((r) => assetServer.close(r));
});

function assetSign(id, role) { return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: '1h' }); }

async function assetCall(method, path, { token, body, formData } = {}) {
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (body) headers['Content-Type'] = 'application/json';
    const res = await fetch(`${assetBase}${path}`, {
        method,
        headers,
        body: formData || (body ? JSON.stringify(body) : undefined),
    });
    let json = null;
    try { json = await res.json(); } catch (_) {}
    return { status: res.status, json };
}

test2('asset library: admin can create an asset (stored through the storage abstraction)', async () => {
    seed();
    const asset = await giftService.createGiftAsset({ name: 'Rose anim', asset_type: 'gif', url: 'https://cdn.example.com/gifts/x.gif', storage_key: 'gifts/x.gif' });
    assert.equal(asset.id, 1);
    assert.equal(asset.asset_type, 'gif');
    assert.equal(asset.is_active, 1);
    assert.equal(assets.length, 1);
});

test2('asset library: inactive assets are not exposed via getGiftAssets()', async () => {
    seed();
    await giftService.createGiftAsset({ name: 'A', asset_type: 'png', url: 'https://cdn/a.png', storage_key: 'gifts/a.png' });
    await giftService.createGiftAsset({ name: 'B', asset_type: 'gif', url: 'https://cdn/b.gif', storage_key: 'gifts/b.gif' });
    await giftService.updateGiftAsset(2, { is_active: false });
    const active = await giftService.getGiftAssets();
    assert.equal(active.length, 1);
    assert.equal(active[0].id, 1);
});

test2('asset library: a gift can reference an asset and exposes it', async () => {
    seed();
    const asset = await giftService.createGiftAsset({ name: 'Rose anim', asset_type: 'gif', url: 'https://cdn/rose.gif', storage_key: 'gifts/rose.gif' });
    const g = await giftService.createGift({ name: 'Rose', icon: '??', price: 10, provider_percentage: 70, admin_percentage: 30, asset_id: asset.id });
    assert.equal(g.asset_id, asset.id);
    assert.equal(g.asset?.url, 'https://cdn/rose.gif');
    assert.equal(g.asset?.asset_type, 'gif');
});

test2('asset library: deleting a referenced asset is rejected', async () => {
    seed();
    const asset = await giftService.createGiftAsset({ name: 'Rose anim', asset_type: 'gif', url: 'https://cdn/rose.gif', storage_key: 'gifts/rose.gif' });
    await giftService.createGift({ name: 'Rose', price: 10, provider_percentage: 70, admin_percentage: 30, asset_id: asset.id });
    await assert.rejects(() => giftService.deleteGiftAsset(asset.id), /used by one or more gifts/);
    assert.equal(assets.length, 1, 'asset must still exist');
});

test2('asset library: unreferenced asset can be deleted', async () => {
    seed();
    const asset = await giftService.createGiftAsset({ name: 'Orphan', asset_type: 'png', url: 'https://cdn/orphan.png', storage_key: 'gifts/orphan.png' });
    await giftService.deleteGiftAsset(asset.id);
    assert.equal(assets.length, 0);
});

test2('route: non-admin cannot create an asset (403)', async () => {
    seed();
    const token = assetSign(2, 'user');
    const { status } = await assetCall('POST', '/api/admin/gifts/assets', { token });
    assert.equal(status, 403);
});

test2('route: admin GIF upload is accepted and stored via the storage abstraction', async () => {
    seed();
    const token = assetSign(1, 'admin');
    const fd = new FormData();
    fd.append('name', 'Animated rose');
    fd.append('image', new Blob([Buffer.from([0x47, 0x49, 0x46])], { type: 'image/gif' }), 'rose.gif');
    const { status, json } = await assetCall('POST', '/api/admin/gifts/assets', { token, formData: fd });
    assert.equal(status, 201);
    assert.equal(json.asset.asset_type, 'gif');
    assert.ok(json.asset.url.includes('cdn.example.com'), 'asset persisted through storage abstraction');
});

test2('route: unsupported file type is rejected (400)', async () => {
    seed();
    const token = assetSign(1, 'admin');
    const fd = new FormData();
    fd.append('name', 'bad');
    fd.append('image', new Blob([Buffer.from('MZ')], { type: 'application/x-msdownload' }), 'evil.exe');
    const { status } = await assetCall('POST', '/api/admin/gifts/assets', { token, formData: fd });
    assert.equal(status, 400);
});

test2('route: existing gift sending still works over the API (points + split unchanged)', async () => {
    seed();
    const userTok = assetSign(2, 'user');
    const { status } = await assetCall('POST', '/api/gift/send', { token: userTok, body: { receiver_id: 3, gift_id: 1 } });
    assert.equal(status, 200);
    assert.equal(users.find((u) => u.id === 2).balance, 90);
    assert.equal(users.find((u) => u.id === 3).balance, 7);
    assert.equal(adminWallet.balance, 3);
    assert.equal(giftTransactions.length, 1);
});
