// Simple in-memory quota (fixed window) keyed by API key or IP.
// Not distributed — suitable for development or single-instance deployments.

const DEFAULT_WINDOW_MS = parseInt(process.env.QUOTA_WINDOW_MS || '60000', 10);
const DEFAULT_MAX = parseInt(process.env.QUOTA_MAX || '60', 10);

const store = new Map();

function _now() { return Date.now(); }

function makeKey(apiKey, ip) {
    if (apiKey) return `key:${apiKey}`;
    return `ip:${ip || 'anonymous'}`;
}

function hit(apiKey, ip, opts = {}) {
    const windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
    const max = typeof opts.max === 'number' ? opts.max : DEFAULT_MAX;
    const key = makeKey(apiKey, ip);
    const now = _now();
    let entry = store.get(key);
    if (!entry || now - entry.windowStart >= windowMs) {
        entry = { windowStart: now, count: 1 };
        store.set(key, entry);
        return { allowed: true, remaining: max - 1, resetMs: windowMs };
    }
    entry.count += 1;
    const allowed = entry.count <= max;
    const remaining = Math.max(0, max - entry.count);
    const resetMs = Math.max(0, windowMs - (now - entry.windowStart));
    return { allowed, remaining, resetMs };
}

function getUsage(apiKey, ip) {
    const key = makeKey(apiKey, ip);
    const entry = store.get(key);
    if (!entry) return { count: 0, windowStart: null };
    return { count: entry.count, windowStart: entry.windowStart };
}

function reset(apiKey, ip) {
    const key = makeKey(apiKey, ip);
    store.delete(key);
}

function resetAll() {
    store.clear();
}

module.exports = { hit, getUsage, reset, resetAll, DEFAULT_WINDOW_MS, DEFAULT_MAX };
