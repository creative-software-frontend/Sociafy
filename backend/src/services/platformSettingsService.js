const db = require("../config/db");

const DEFAULT_RATE = 2.00;
let cachedRate = null;

async function getCallRate() {
    if (cachedRate != null) return cachedRate;
    try {
        const [rows] = await db.query(
            "SELECT call_rate_per_minute FROM platform_settings WHERE id = 1 LIMIT 1"
        );
        if (rows.length) {
            cachedRate = Number(rows[0].call_rate_per_minute);
            if (!Number.isFinite(cachedRate) || cachedRate <= 0) cachedRate = DEFAULT_RATE;
        } else {
            cachedRate = DEFAULT_RATE;
        }
    } catch (err) {
        cachedRate = DEFAULT_RATE;
    }
    return cachedRate;
}

async function updateCallRate(rate) {
    await db.query(
        "UPDATE platform_settings SET call_rate_per_minute = ?, updated_at = NOW() WHERE id = 1",
        [rate]
    );
    cachedRate = Number(rate);
    return cachedRate;
}

function invalidateCache() {
    cachedRate = null;
}

function perSecond(perMinute) {
    return Math.round((perMinute / 60) * 1000000) / 1000000;
}

async function getCallRates() {
    const rate = await getCallRate();
    return {
        call_rate_per_minute: rate,
        call_rate_per_second: perSecond(rate),
    };
}

module.exports = { getCallRate, updateCallRate, invalidateCache, getCallRates, perSecond, DEFAULT_RATE };
