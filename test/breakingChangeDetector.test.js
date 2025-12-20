const { expect } = require('chai');
const { detectBreakingChanges } = require('../lib/breakingChangeDetector');

describe('Breaking Change Detector', () => {
    describe('Removed Paths', () => {
        it('should detect when a path is removed', () => {
            const oldSpec = {
                paths: {
                    '/users': {},
                    '/posts': {}
                }
            };
            const newSpec = {
                paths: {
                    '/posts': {}
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(1);
            expect(result.breaking[0]).to.deep.equal({
                type: 'removed_path',
                path: '/users'
            });
        });

        it('should not report breaking changes when paths are added', () => {
            const oldSpec = {
                paths: {
                    '/users': {}
                }
            };
            const newSpec = {
                paths: {
                    '/users': {},
                    '/posts': {}
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });

        it('should handle empty old spec', () => {
            const oldSpec = { paths: {} };
            const newSpec = { paths: { '/users': {} } };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });

        it('should handle missing paths object', () => {
            const oldSpec = {};
            const newSpec = { paths: { '/users': {} } };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });
    });

    describe('Removed HTTP Methods', () => {
        it('should detect when an HTTP method is removed from a path', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: { summary: 'List users' },
                        post: { summary: 'Create user' }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: { summary: 'List users' }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            const removedMethod = result.breaking.find(b => b.type === 'removed_method');
            expect(removedMethod).to.deep.equal({
                type: 'removed_method',
                path: '/users',
                method: 'post'
            });
        });

        it('should detect multiple removed methods', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {},
                        post: {},
                        put: {},
                        delete: {}
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {}
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            const removedMethods = result.breaking.filter(b => b.type === 'removed_method');
            expect(removedMethods).to.have.lengthOf(3);
        });

        it('should not report breaking changes when methods are added', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {}
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {},
                        post: {}
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });
    });

    describe('Required Parameter Changes', () => {
        it('should detect when a new required parameter is added to a request', () => {
            const oldSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            parameters: [
                                { name: 'id', required: true }
                            ]
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            parameters: [
                                { name: 'id', required: true },
                                { name: 'format', required: true }
                            ]
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            const breaking = result.breaking.find(b => b.type === 'required_parameter_added');
            expect(breaking).to.exist;
            expect(breaking.path).to.equal('/users/{id}');
            expect(breaking.method).to.equal('get');
            expect(breaking.parameter).to.equal('format');
        });

        it('should not report breaking changes when optional parameters are added', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [{ name: 'limit', required: false }]
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [
                                { name: 'limit', required: false },
                                { name: 'offset', required: false }
                            ]
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });

        it('should detect when a required parameter becomes optional', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [{ name: 'format', required: true }]
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [{ name: 'format', required: false }]
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.nonBreaking).to.have.length.greaterThan(0);
            const nonBreaking = result.nonBreaking.find(nb => nb.type === 'required_parameter_made_optional');
            expect(nonBreaking).to.exist;
        });
    });

    describe('Required Response Field Changes', () => {
        it('should detect when a required response field is removed', () => {
            const oldSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            responses: {
                                200: {
                                    schema: {
                                        type: 'object',
                                        required: ['id', 'name', 'email']
                                    }
                                }
                            }
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            responses: {
                                200: {
                                    schema: {
                                        type: 'object',
                                        required: ['id', 'name']
                                    }
                                }
                            }
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            const breaking = result.breaking.find(b => b.type === 'removed_required_response_field');
            expect(breaking).to.exist;
            expect(breaking.path).to.equal('/users/{id}');
            expect(breaking.method).to.equal('get');
            expect(breaking.field).to.equal('email');
        });

        it('should detect when response schema changes type', () => {
            const oldSpec = {
                paths: {
                    '/data': {
                        get: {
                            responses: {
                                200: {
                                    schema: { type: 'object' }
                                }
                            }
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/data': {
                        get: {
                            responses: {
                                200: {
                                    schema: { type: 'array' }
                                }
                            }
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            const breaking = result.breaking.find(b => b.type === 'response_schema_type_changed');
            expect(breaking).to.exist;
        });

        it('should not report breaking changes when optional response fields are removed', () => {
            const oldSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            responses: {
                                200: {
                                    schema: {
                                        type: 'object',
                                        required: ['id', 'name'],
                                        properties: {
                                            id: {},
                                            name: {},
                                            extra: {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users/{id}': {
                        get: {
                            responses: {
                                200: {
                                    schema: {
                                        type: 'object',
                                        required: ['id', 'name'],
                                        properties: {
                                            id: {},
                                            name: {}
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });
    });

    describe('Return Value', () => {
        it('should return both breaking and nonBreaking arrays', () => {
            const oldSpec = { paths: {} };
            const newSpec = { paths: {} };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result).to.have.property('breaking');
            expect(result).to.have.property('nonBreaking');
            expect(Array.isArray(result.breaking)).to.be.true;
            expect(Array.isArray(result.nonBreaking)).to.be.true;
        });
    });

    describe('Complex Scenarios', () => {
        it('should detect multiple breaking changes', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {},
                        post: {}
                    },
                    '/posts': {
                        get: {}
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {}
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking.length).to.be.greaterThan(1);
            expect(result.breaking.some(b => b.type === 'removed_path')).to.be.true;
            expect(result.breaking.some(b => b.type === 'removed_method')).to.be.true;
        });

        it('should handle specs with no breaking changes', () => {
            const oldSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [{ name: 'limit', required: false }]
                        }
                    }
                }
            };
            const newSpec = {
                paths: {
                    '/users': {
                        get: {
                            parameters: [{ name: 'limit', required: false }]
                        },
                        post: {}
                    }
                }
            };

            const result = detectBreakingChanges(oldSpec, newSpec);
            expect(result.breaking).to.have.lengthOf(0);
        });
    });
});
