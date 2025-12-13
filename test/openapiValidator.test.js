const { expect } = require('chai');
const { validateSpec } = require('../lib/openapiValidator');

describe('openapiValidator', () => {
    it('flags missing top-level fields and unresolved $ref', () => {
        const badSpec = {
            openapi: '3.0.0',
            info: { title: 'Test API' }, // missing version
            paths: {
                '/pets': {
                    get: {
                        // no responses -> should warn
                        responses: undefined
                    }
                }
            },
            components: {
                schemas: {
                    Pet: { type: 'object', properties: { id: { type: 'integer' } } }
                }
            },
            // a reference that does not exist
            x: { refToMissing: { $ref: '#/components/schemas/NoSuchSchema' } }
        };

        const result = validateSpec(badSpec);
        expect(result.valid).to.be.false;
        const messages = result.findings.map(f => f.message);
        expect(messages.some(m => m.includes('info.title'))).to.be.true;
        expect(messages.some(m => m.includes('has no responses'))).to.be.true;
        expect(messages.some(m => m.includes('Unresolved $ref'))).to.be.true;
    });

    it('accepts a minimal valid spec', () => {
        const goodSpec = {
            openapi: '3.0.0',
            info: { title: 'Good API', version: '1.0.0' },
            paths: {
                '/pets': {
                    get: {
                        responses: { '200': { description: 'OK' } }
                    }
                }
            },
            components: { schemas: { Pet: { type: 'object', properties: {} } } }
        };
        const result = validateSpec(goodSpec);
        expect(result.valid).to.be.true;
        expect(result.findings).to.be.an('array');
    });
});
