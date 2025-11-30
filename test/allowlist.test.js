const { expect } = require('chai');
const { createAllowlist } = require('../lib/allowlist');

describe('lib/allowlist', () => {
    it('allows exact host match', () => {
        const a = createAllowlist('api.example.com');
        expect(a.allows('http://api.example.com')).to.be.true;
        expect(a.allows('api.example.com')).to.be.true;
        expect(a.allows('http://other.example.com')).to.be.false;
    });

    it('allows suffix / wildcard matches', () => {
        const a = createAllowlist('example.com');
        expect(a.allows('api.example.com')).to.be.true;
        expect(a.allows('sub.api.example.com')).to.be.true;
        expect(a.allows('example.org')).to.be.false;
    });

    it('handles empty allowlist as nothing allowed', () => {
        const a = createAllowlist('');
        expect(a.patterns).to.have.lengthOf(0);
        expect(a.allows('example.com')).to.be.false;
    });
});
