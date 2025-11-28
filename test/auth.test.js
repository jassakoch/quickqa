const { expect } = require('chai');
const { requireApiKey } = require('../lib/auth');

describe('lib/auth', () => {
  let origKey;
  beforeEach(() => {
    origKey = process.env.ADMIN_API_KEY;
  });
  afterEach(() => {
    process.env.ADMIN_API_KEY = origKey;
  });

  it('allows when ADMIN_API_KEY is not set', (done) => {
    delete process.env.ADMIN_API_KEY;
    const req = { header: () => undefined };
    const res = {};
    requireApiKey(req, res, () => done());
  });

  it('rejects missing key when ADMIN_API_KEY is set', () => {
    process.env.ADMIN_API_KEY = 'secret';
    const req = { header: () => undefined };
    let statusCode = null;
    let body = null;
    const res = { status: (code) => { statusCode = code; return { json: (b) => { body = b; } }; } };
    const next = () => { throw new Error('should not call next'); };
    requireApiKey(req, res, next);
    expect(statusCode).to.equal(401);
    expect(body).to.have.property('message');
  });

  it('allows when correct key provided', (done) => {
    process.env.ADMIN_API_KEY = 'secret';
    const req = { header: (name) => 'secret' };
    const res = {};
    requireApiKey(req, res, () => done());
  });
});
