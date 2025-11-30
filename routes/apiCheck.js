const express = require("express");
const axios = require("axios");
const Ajv = require('ajv');
const ssrf = require('../lib/ssrf');
const allowlist = require('../lib/allowlist');

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

// (export at end after all routes)

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
        // Format AJV errors into friendlier messages for the frontend
        const errors = (validate.errors || []).map(err => {
            // err.instancePath is a JSON Pointer like '/tests/0/url'
            const path = err.instancePath ? err.instancePath.replace(/\//g, '.').replace(/^\./, '') : '';
            const field = path || (err.params && err.params.missingProperty) ? (path ? path : err.params.missingProperty) : '';
            const message = err.message || '';
            return { field, message, keyword: err.keyword };
        });
        return res.status(400).json({ message: 'Bad Request', errors });
    }

    // Switch to async job-based processing: validate allowlist, then SSRF rules, create a job and return its id
    const { tests, timeoutMs = 8000, concurrency = 5 } = body;

    // Allowlist check (if configured). If ALLOWLIST_DOMAINS is set, only requests
    // to allowed domains will be accepted. Empty allowlist means nothing allowed.
    try {
        const patterns = allowlist.DEFAULT.patterns;
        if (patterns && patterns.length) {
            const blocked = [];
            for (let i = 0; i < tests.length; i++) {
                const t = tests[i];
                if (!allowlist.DEFAULT.allows(t.url)) {
                    blocked.push({ index: i, url: t.url, reason: 'Not in allowlist' });
                }
            }
            if (blocked.length) {
                return res.status(403).json({ message: 'Forbidden - allowlist', errors: blocked });
            }
        }
    } catch (err) {
        console.error('Allowlist validation failed', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }
    // SSRF protection: reject tests that point to localhost or private IP ranges
    try {
        const ssrfErrors = await ssrf.validateTestsArePublic(tests);
        console.log('ssrf.validateTestsArePublic ->', ssrfErrors);
        if (ssrfErrors && ssrfErrors.length) {
            return res.status(400).json({ message: 'Bad Request - SSRF protection', errors: ssrfErrors });
        }
    } catch (err) {
        console.error('SSRF validation failed', err);
        return res.status(500).json({ message: 'Internal Server Error' });
    }

    const jobQueue = require('../lib/jobQueue');
    const jobId = jobQueue.createJob(tests, { timeoutMs, concurrency });
    return res.status(202).json({ jobId, message: 'Job accepted' });
});

// GET /api/jobs/:id - check job status
router.get('/jobs/:id', (req, res) => {
    const { id } = req.params;
    const jobQueue = require('../lib/jobQueue');
    const job = jobQueue.getJob(id);
    if (!job) return res.status(404).json({ message: 'Not Found' });
    return res.status(200).json(job);
});

// GET /reports/:id - fetch saved report JSON
router.get('/reports/:id', (req, res) => {
    const { id } = req.params;
    const jobQueue = require('../lib/jobQueue');
    const report = jobQueue.getReport(id);
    if (!report) return res.status(404).json({ message: 'Not Found' });
    return res.status(200).json(report);
});

module.exports = router;
