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
let adminWallet = { id: 1, balance: 0 };
let adminWalletTransactions = [];
let nextGiftId = 1;
let nextChatId = 1;

function seed() {
    gifts = [
        { id: 1, name: 'Rose', icon: '🌹', image: null, price: 10, provider_percentage: 70, admin_percentage: 30, is_active: 1, created_at: null, updated_at: null },
        { id: 2, name: 'Diamond', icon: '💎', image: null, price: 100, provider_percentage: 70, admin_percentage: 30, is_active: 0, created_at: null, updated_at: null },
    ];
    users = [
        { id: 1, name: 'Admin', role: 'admin', balance: 0, earnings: 0 },
        { id: 2, name: 'User', role: 'user', balance: 100, earnings: 0 },
        { id: 3, name: 'Provider', role: 'provider', balance: 0, earnings: 0 },
    ];
    giftTransactions = [];
    chatMessages = [];
    transactions = [];
    adminWallet = { id: 1, balance: 0 };
    adminWalletTransactions = [];
    nextGiftId = 3;
    nextChatId = 1;
}

function route(sql, values = []) {
    const S = String(sql);

    // gift SELECTs
    if (/select \* from gifts where is_active = 1/i.test(S)) {
        return gifts.filter((g) => g.is_active === 1).map((g) => ({ ...g }));
    }
    if (/select \* from gifts\s+order by price asc/i.test(S)) {
        return gifts.map((g) => ({ ...g }));
    }
    if (/select \* from gifts where id = \?/i.test(S)) {
        const g = gifts.find((x) => x.id === Number(values[0]));
        return g ? [{ ...g }] : [];
    }
    // INSERT gift
    if (/^insert into gifts/i.test(S)) {
        const [name, icon, image, price, providerPct, adminPct, isActive] = values;
        const g = {
            id: nextGiftId++,
            name,
            icon: icon || null,
            image: image || null,
            price: Number(price),
            provider_percentage: Number(providerPct),
            admin_percentage: Number(adminPct),
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
