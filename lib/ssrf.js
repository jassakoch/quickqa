const dns = require('dns').promises;
const net = require('net');

// IPv4 ranges to block (as [start, end] integers)
function ipv4ToInt(ip) {
    return ip.split('.').reduce((acc, oct) => (acc << 8) + parseInt(oct, 10), 0) >>> 0;
}

function inRange(ipInt, start, end) {
    return ipInt >= start && ipInt <= end;
}

const PRIVATE_RANGES = [
    // 10.0.0.0/8
    [ipv4ToInt('10.0.0.0'), ipv4ToInt('10.255.255.255')],
    // 172.16.0.0/12
    [ipv4ToInt('172.16.0.0'), ipv4ToInt('172.31.255.255')],
    // 192.168.0.0/16
    [ipv4ToInt('192.168.0.0'), ipv4ToInt('192.168.255.255')],
    // 127.0.0.0/8 (loopback)
    [ipv4ToInt('127.0.0.0'), ipv4ToInt('127.255.255.255')],
    // 169.254.0.0/16 (link-local)
    [ipv4ToInt('169.254.0.0'), ipv4ToInt('169.254.255.255')]
];

function isPrivateIPv4(ip) {
    try {
        if (!ip || net.isIP(ip) !== 4) return false;
        const ipInt = ipv4ToInt(ip);
        return PRIVATE_RANGES.some(([s, e]) => inRange(ipInt, s, e));
    } catch (e) {
        return false;
    }
}

function isLocalhostHost(host) {
    if (!host) return false;
    if (host === 'localhost') return true;
    // IPv6 loopback
    if (host === '::1') return true;
    return false;
}

async function resolvesToPrivate(host) {
    // If host is an IP literal, check directly
    if (net.isIP(host)) {
        if (net.isIP(host) === 4) return isPrivateIPv4(host);
        // For IPv6, block loopback and unique local addresses (fc00::/7)
        if (net.isIP(host) === 6) {
            if (host === '::1') return true;
            // simple fc00/7 check
            const lower = host.toLowerCase();
            return lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80');
        }
    }

    // Otherwise resolve DNS
    try {
        const addrs = await dns.lookup(host, { all: true });
        // optional debug
        if (process.env.SSRF_DEBUG === 'true') console.log('ssrf: resolved', host, addrs);
        for (const a of addrs) {
            if (a.family === 4) {
                if (isPrivateIPv4(a.address)) return true;
            } else if (a.family === 6) {
                const lower = a.address.toLowerCase();
                if (lower === '::1' || lower.startsWith('fc') || lower.startsWith('fd') || lower.startsWith('fe80')) return true;
            }
        }
        return false;
    } catch (err) {
        // If DNS fails, default behavior used to allow the request (avoid false positives).
        // For safety, we now allow configuration: treat unresolved hosts as suspicious unless
        // SSRF_ALLOW_UNRESOLVED is set to 'true'. This helps fail-closed for public services.
        if (process.env.SSRF_DEBUG === 'true') console.warn('ssrf: dns.lookup failed for', host, err && err.code ? err.code : err);
        const allowUnresolved = String(process.env.SSRF_ALLOW_UNRESOLVED || '').toLowerCase() === 'true';
        return !allowUnresolved;
    }
}

async function validateTestsArePublic(tests) {
    const errors = [];
    for (let i = 0; i < tests.length; i++) {
        const t = tests[i];
        try {
            const url = new URL(t.url);
            const host = url.hostname;
            if (isLocalhostHost(host)) {
                errors.push({ index: i, url: t.url, reason: 'Refused: localhost is not allowed' });
                continue;
            }
            const isPrivate = await resolvesToPrivate(host);
            if (isPrivate) {
                errors.push({ index: i, url: t.url, reason: 'Refused: resolves to a private or loopback address' });
            }
        } catch (e) {
            errors.push({ index: i, url: t.url, reason: 'Invalid URL' });
        }
    }
    return errors;
}

module.exports = { validateTestsArePublic };
