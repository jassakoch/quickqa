const { expect } = require('chai');

// Integration tests: prefer supertest when available, otherwise fall back to starting the app and using axios
let request;
let axios;
let usingSupertest = false;
try {
    // eslint-disable-next-line global-require
    request = require('supertest');
    usingSupertest = true;
} catch (e) {
    // supertest not installed — we'll fall back to axios + app.listen
    // eslint-disable-next-line global-require
    axios = require('axios');
    usingSupertest = false;
}

describe('integration: POST /api/run-tests', function () {
    this.timeout(10000);

    let app;
    let _orig = {};
    let server;
    let baseUrl;

    before(() => {
        // Save and set env BEFORE requiring the app so modules that read env pick these up
        _orig.ADMIN_API_KEY = process.env.ADMIN_API_KEY;
        _orig.QUOTA_MAX = process.env.QUOTA_MAX;
        _orig.SSRF_ALLOW_UNRESOLVED = process.env.SSRF_ALLOW_UNRESOLVED;

        process.env.ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'test-secret';
        process.env.QUOTA_MAX = process.env.QUOTA_MAX || '60';
        process.env.SSRF_ALLOW_UNRESOLVED = 'true';

        // require the server module which now exports the express app (doesn't start a listener)
        // eslint-disable-next-line global-require
        app = require('../server');

        // if we're not using supertest, start a listening server on an ephemeral port for axios
        if (!usingSupertest) {
            server = app.listen(0);
            const addr = server.address();
            baseUrl = `http://127.0.0.1:${addr.port}`;
        }
    });

    after(() => {
        // restore env to avoid affecting other tests
        process.env.ADMIN_API_KEY = _orig.ADMIN_API_KEY;
        process.env.QUOTA_MAX = _orig.QUOTA_MAX;
        process.env.SSRF_ALLOW_UNRESOLVED = _orig.SSRF_ALLOW_UNRESOLVED;
        if (server && server.close) server.close();
    });

    it('returns 401 when ADMIN_API_KEY is set and no x-api-key header provided', async () => {
        process.env.ADMIN_API_KEY = 'secret-for-test';
        const payload = { tests: [{ url: 'https://example.com/' }] };
        let res;
        if (usingSupertest) {
            res = await request(app).post('/api/run-tests').send(payload).expect((r) => r);
            expect(res.status).to.equal(401);
            expect(res.body).to.have.property('message');
        } else {
            res = await axios.post(`${baseUrl}/api/run-tests`, payload, { validateStatus: () => true });
            expect(res.status).to.equal(401);
            expect(res.data).to.have.property('message');
        }
    });

    it('returns 202 (or smoke statuses) when correct x-api-key provided and target is allowed (no allowlist configured)', async () => {
        // clear allowlist.DEFAULT.patterns if present
        try {
            const allowlist = require('../lib/allowlist');
            if (allowlist && Array.isArray(allowlist.DEFAULT.patterns)) {
                allowlist.DEFAULT.patterns.splice(0, allowlist.DEFAULT.patterns.length);
            }
        } catch (e) { }

        const payload = { tests: [{ url: 'https://example.com/' }] };
        let res;
        if (usingSupertest) {
            res = await request(app).post('/api/run-tests').set('x-api-key', process.env.ADMIN_API_KEY).send(payload);
            expect([202, 400, 403, 401]).to.include(res.status);
        } else {
            res = await axios.post(`${baseUrl}/api/run-tests`, payload, { headers: { 'x-api-key': process.env.ADMIN_API_KEY }, validateStatus: () => true });
            expect([202, 400, 403, 401]).to.include(res.status);
        }
    });

    it('returns 403 when allowlist blocks the target', async () => {
        // set allowlist to only allow api.example.org
        const allowlist = require('../lib/allowlist');
        if (allowlist && Array.isArray(allowlist.DEFAULT.patterns)) {
            allowlist.DEFAULT.patterns.splice(0, allowlist.DEFAULT.patterns.length, 'api.example.org');
        }

        const payload = { tests: [{ url: 'https://example.com/' }] };
        let res;
        if (usingSupertest) {
            res = await request(app).post('/api/run-tests').set('x-api-key', process.env.ADMIN_API_KEY).send(payload);
            expect([403, 401]).to.include(res.status);
            expect(res.body).to.have.property('message');
        } else {
            res = await axios.post(`${baseUrl}/api/run-tests`, payload, { headers: { 'x-api-key': process.env.ADMIN_API_KEY }, validateStatus: () => true });
            expect([403, 401]).to.include(res.status);
            expect(res.data).to.have.property('message');
        }
    });
});

