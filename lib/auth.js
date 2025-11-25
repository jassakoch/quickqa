// Simple API key middleware. If ADMIN_API_KEY is set in env, require X-API-KEY header to match.
function requireApiKey(req, res, next) {
    const apiKey = process.env.ADMIN_API_KEY;
    // debug
    if (process.env.SSRF_DEBUG === 'true') console.log('auth: requireApiKey called, ADMIN_API_KEY set?', !!apiKey);
    if (!apiKey) {
        // no key configured — allow but warn once
        if (!requireApiKey._warned) {
            console.warn('ADMIN_API_KEY not set; API key checks are disabled');
            requireApiKey._warned = true;
        }
        return next();
    }

    const provided = req.header('x-api-key') || req.header('X-API-KEY');
    if (process.env.SSRF_DEBUG === 'true') console.log('auth: provided key present?', !!provided);
    if (!provided) return res.status(401).json({ message: 'Unauthorized: missing API key' });
    if (provided !== apiKey) return res.status(401).json({ message: 'Unauthorized: invalid API key' });
    return next();
}

module.exports = { requireApiKey };
