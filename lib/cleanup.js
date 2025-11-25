const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '..', 'reports');

function cleanReports({ ttlDays = 7, dryRun = false } = {}) {
    if (!fs.existsSync(REPORTS_DIR)) return { cleaned: 0 };
    const files = fs.readdirSync(REPORTS_DIR);
    const now = Date.now();
    const cutoff = now - ttlDays * 24 * 60 * 60 * 1000;
    let cleaned = 0;
    for (const f of files) {
        const full = path.join(REPORTS_DIR, f);
        try {
            const stat = fs.statSync(full);
            if (stat.isFile() && stat.mtimeMs < cutoff) {
                if (!dryRun) fs.unlinkSync(full);
                cleaned++;
            }
        } catch (e) {
            // ignore and continue
        }
    }
    return { cleaned };
}

function scheduleCleanup({ ttlDays = 7, intervalMs = 24 * 60 * 60 * 1000 } = {}) {
    // run immediately, then schedule daily
    try {
        cleanReports({ ttlDays });
    } catch (e) {
        // ignore errors
    }
    const id = setInterval(() => {
        try {
            cleanReports({ ttlDays });
        } catch (e) {
            // ignore
        }
    }, intervalMs);
    // return a handle to allow clearing when needed
    return id;
}

module.exports = { cleanReports, scheduleCleanup };
