const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Simple in-memory job store
const jobs = new Map();
const reportsDir = path.join(__dirname, '..', 'reports');
if (!fs.existsSync(reportsDir)) fs.mkdirSync(reportsDir, { recursive: true });

function createJob(tests, options = {}) {
    const jobId = uuidv4();
    const job = {
        id: jobId,
        status: 'queued', // queued | running | done | failed
        total: tests.length,
        completed: 0,
        results: null,
        error: null,
        createdAt: Date.now(),
        reportId: null
    };
    jobs.set(jobId, job);

    // start processing asynchronously
    (async () => {
        try {
            job.status = 'running';
            const results = new Array(tests.length);
            let idx = 0;
            const timeoutMs = options.timeoutMs || 8000;
            const concurrency = Math.max(1, Math.min(options.concurrency || 5, tests.length));

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
                            validateStatus: () => true
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
                    job.completed = results.filter(r => r).length;
                }
            };

            const workers = [];
            for (let w = 0; w < concurrency; w++) workers.push(worker());
            await Promise.all(workers);

            job.results = results;
            job.status = 'done';
            job.completed = results.length;

            // Persist report to disk
            const reportId = uuidv4();
            const report = { id: reportId, createdAt: Date.now(), results, summary: { total: results.length, passed: results.filter(r => r.ok).length, failed: results.filter(r => !r.ok).length } };
            const filePath = path.join(reportsDir, `${reportId}.json`);
            fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
            job.reportId = reportId;
        } catch (err) {
            job.status = 'failed';
            job.error = err && err.message ? err.message : String(err);
        }
    })();

    return jobId;
}

function getJob(jobId) {
    return jobs.get(jobId) || null;
}

function getReport(reportId) {
    const filePath = path.join(reportsDir, `${reportId}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf8');
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

module.exports = { createJob, getJob, getReport };
