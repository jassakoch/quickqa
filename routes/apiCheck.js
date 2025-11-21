const express = require("express");
const axios = require("axios");
const Ajv = require('ajv');

const router = express.Router();
const ajv = new Ajv({ allErrors: true, coerceTypes: true });

router.post("/check", async (req, res) => {
    // Debug log: show incoming body
    console.log('apiCheck handler - req.body =', req.body);

    // Guard against missing or non-JSON bodies
    const { url } = req.body || {};
    if (!url) {
        return res.status(400).json({
            message: 'Bad Request',
            detail: 'Request body must be JSON and include a "url" property'
        });
    }

    try {
        const start = Date.now();
        // Add a timeout so requests don't hang for minutes
        const response = await axios.get(url, { timeout: 8000 });
        const duration = Date.now() - start;
        return res.status(200).json({
            status: response.status,
            time: `${duration}ms`,
            message: "✅ API is reachable"
        });
    } catch (error) {
        // Log the underlying error for server-side diagnostics
        console.error('Upstream request error:', error && error.stack ? error.stack : error);

        // Timeout
        if (error.code === 'ECONNABORTED') {
            return res.status(504).json({ message: 'Upstream request timed out', error: error.message });
        }

        // Upstream returned a non-2xx response
        if (error.response) {
            return res.status(502).json({ message: 'Upstream returned an error', status: error.response.status, data: error.response.data });
        }

        // Other network/DNS errors
        return res.status(502).json({
            message: "❌ API request failed",
            error: error && error.message ? error.message : String(error)
        });
    }
});

module.exports = router;

// POST /api/run-tests
// Body: { tests: [{ url, method?, expectedStatus?, headers?, body? }], timeoutMs?, concurrency? }
router.post('/run-tests', async (req, res) => {
    const body = req.body || {};
    const schema = {
        type: 'object',
        properties: {
            tests: {
                type: 'array',
                minItems: 1,
                items: {
                    type: 'object',
                    properties: {
                        url: { type: 'string', pattern: '^(https?:)\\/\\/' },
                        method: { type: 'string' },
                        expectedStatus: { type: 'integer' },
                        headers: { type: 'object' },
                        body: {}
                    },
                    required: ['url'],
                    additionalProperties: false
                }
            },
            timeoutMs: { type: 'integer', minimum: 100 },
            concurrency: { type: 'integer', minimum: 1 }
        },
        required: ['tests'],
        additionalProperties: false
    };

    const validate = ajv.compile(schema);
    const valid = validate(body);
    if (!valid) {
        return res.status(400).json({ message: 'Bad Request', errors: validate.errors });
    }

    const { tests, timeoutMs = 8000, concurrency = 5 } = body;

    // Prepare results array so we preserve input order
    const results = new Array(tests.length);
    let idx = 0;

    const worker = async () => {
        while (true) {
            const i = idx++;
            if (i >= tests.length) return;
            const t = tests[i];
            const method = (t.method || 'GET').toUpperCase();
            const expected = typeof t.expectedStatus === 'number' ? t.expectedStatus : null;

            const start = Date.now();
            try {
                const response = await axios.request({
                    url: t.url,
                    method,
                    headers: t.headers,
                    data: t.body,
                    timeout: timeoutMs,
                    validateStatus: () => true // capture non-2xx responses as normal responses
                });
                const duration = Date.now() - start;
                const actualStatus = response.status;
                const ok = expected === null ? (actualStatus >= 200 && actualStatus < 300) : actualStatus === expected;
                results[i] = { url: t.url, method, expectedStatus: expected, actualStatus, timeMs: duration, ok, error: null };
            } catch (err) {
                const duration = Date.now() - start;
                const errMsg = err && err.message ? err.message : String(err);
                results[i] = { url: t.url, method, expectedStatus: expected, actualStatus: null, timeMs: duration, ok: false, error: errMsg };
            }
        }
    };

    const workers = [];
    const workerCount = Math.max(1, Math.min(concurrency, tests.length));
    for (let w = 0; w < workerCount; w++) workers.push(worker());
    await Promise.all(workers);

    const summary = { total: results.length, passed: results.filter(r => r && r.ok).length, failed: results.filter(r => r && !r.ok).length };
    return res.status(200).json({ results, summary });
});
