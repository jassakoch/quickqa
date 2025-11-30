const { expect } = require('chai');
const quotas = require('../lib/quotas');

describe('lib/quotas', function() {
  beforeEach(() => {
    quotas.resetAll();
  });

  it('allows requests under the limit and then blocks', () => {
    const apiKey = 'testkey';
    const ip = '1.2.3.4';
    const opts = { windowMs: 1000, max: 3 };
    let r = quotas.hit(apiKey, ip, opts);
    expect(r.allowed).to.be.true;
    expect(r.remaining).to.equal(2);
    r = quotas.hit(apiKey, ip, opts);
    expect(r.allowed).to.be.true;
    expect(r.remaining).to.equal(1);
    r = quotas.hit(apiKey, ip, opts);
    expect(r.allowed).to.be.true;
    expect(r.remaining).to.equal(0);
    r = quotas.hit(apiKey, ip, opts);
    expect(r.allowed).to.be.false;
  });

  it('separates keys and ips', () => {
    quotas.resetAll();
    const a = quotas.hit('k1', '1.1.1.1', { windowMs: 1000, max: 1 });
    const b = quotas.hit(null, '1.1.1.1', { windowMs: 1000, max: 1 });
    expect(a.allowed).to.be.true;
    expect(b.allowed).to.be.true;
  });
});
