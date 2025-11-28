const { expect } = require('chai');
const dns = require('dns').promises;
const ssrf = require('../lib/ssrf');

describe('lib/ssrf', () => {
    let origLookup;
    beforeEach(() => {
        origLookup = dns.lookup;
    });
    afterEach(() => {
        dns.lookup = origLookup;
    });

    it('blocks IP literal loopback (127.0.0.1)', async () => {
        const res = await ssrf.validateTestsArePublic([{ url: 'http://127.0.0.1:8000' }]);
        expect(res).to.be.an('array');
        expect(res.length).to.be.greaterThan(0);
        expect(res[0]).to.have.property('reason');
    });

    it('allows public domain when DNS resolves to a public IP', async () => {
        dns.lookup = async () => [{ address: '8.8.8.8', family: 4 }];
        const res = await ssrf.validateTestsArePublic([{ url: 'http://example.com' }]);
        expect(res).to.be.an('array').and.to.have.lengthOf(0);
    });

    it('treats DNS resolution failures as suspicious by default', async () => {
        dns.lookup = async () => { throw new Error('ENOTFOUND'); };
        const res = await ssrf.validateTestsArePublic([{ url: 'http://does-not-resolve.example' }]);
        expect(res).to.be.an('array').and.to.have.lengthOf(1);
        expect(res[0]).to.have.property('reason');
    });
});
