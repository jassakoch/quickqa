// Simple allowlist helper
// Reads ALLOWLIST_DOMAINS env var (comma-separated) and provides a check
// that returns true when a hostname (or URL) is allowed.

function parseAllowlist(envValue) {
    if (!envValue) return [];
    return envValue.split(',').map(s => s.trim()).filter(Boolean);
}

function hostFromInput(input) {
    // input can be a full URL or a hostname
    try {
        if (typeof input !== 'string') return '';
        if (input.includes('://')) {
            const u = new URL(input);
            return u.hostname;
        }
        return input;
    } catch (e) {
        return '';
    }
}

function matchesPattern(host, pattern) {
    // pattern examples:
    // - example.com -> matches example.com and sub.example.com (suffix match)
    // - .example.com -> same as above
    // - *.example.com -> same as above
    // - api.example.com -> exact match
    if (!host || !pattern) return false;
    const p = pattern.replace(/^\*\./, '').replace(/^\./, '').toLowerCase();
    const h = host.toLowerCase();
    if (h === p) return true;
    // suffix match: allow subdomains
    return h.endsWith('.' + p);
}

function createAllowlist(envValue) {
    const patterns = parseAllowlist(envValue);
    return {
        patterns,
        allows(input) {
            const host = hostFromInput(input);
            if (!host) return false;
            if (patterns.length === 0) return false; // empty allowlist means nothing allowed
            for (const p of patterns) {
                if (matchesPattern(host, p)) return true;
            }
            return false;
        }
    };
}

// default instance reading from env
const DEFAULT = createAllowlist(process.env.ALLOWLIST_DOMAINS || '');

module.exports = { createAllowlist, parseAllowlist, matchesPattern, DEFAULT };
