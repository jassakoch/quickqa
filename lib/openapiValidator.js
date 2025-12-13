// Simple OpenAPI validator focused on teaching algorithmic thinking.
// It accepts an OpenAPI/Swagger spec as an object (already-parsed JSON)
// and returns a structured list of findings (errors/warnings).
// The implementation uses straightforward algorithms: tree traversal,
// set membership checks, and simple structural validations so you can
// step through the code and understand the logic.

function isObject(v) {
    return v && typeof v === 'object' && !Array.isArray(v);
}

function collectRefs(node, refs = []) {
    if (!isObject(node) && !Array.isArray(node)) return refs;
    if (Array.isArray(node)) {
        for (const item of node) collectRefs(item, refs);
        return refs;
    }
    for (const k of Object.keys(node)) {
        if (k === '$ref' && typeof node[k] === 'string') refs.push(node[k]);
        else collectRefs(node[k], refs);
    }
    return refs;
}

function getByPointer(root, pointer) {
    // pointer like '#/components/schemas/Pet'
    if (!pointer || typeof pointer !== 'string') return undefined;
    if (!pointer.startsWith('#/')) return undefined; // only handle internal refs
    const parts = pointer.slice(2).split('/').map(p => decodeURIComponent(p));
    let cur = root;
    for (const p of parts) {
        if (!isObject(cur) || !(p in cur)) return undefined;
        cur = cur[p];
    }
    return cur;
}

function validateSpec(spec) {
    const findings = [];

    if (!isObject(spec)) {
        findings.push({ level: 'error', message: 'Spec must be an object (parsed JSON/YAML)' });
        return { valid: false, findings };
    }

    // Basic top-level checks
    if (!spec.openapi && !spec.swagger) {
        findings.push({ level: 'error', message: 'Missing top-level `openapi` or `swagger` version property' });
    }
    if (!spec.info || !spec.info.title || !spec.info.version) {
        findings.push({ level: 'warning', message: '`info.title` and/or `info.version` are missing' });
    }
    if (!spec.paths || !isObject(spec.paths)) {
        findings.push({ level: 'error', message: 'Missing or invalid `paths` object' });
    } else {
        // Validate each path and operation minimally
        for (const pathKey of Object.keys(spec.paths)) {
            const pathItem = spec.paths[pathKey];
            if (!isObject(pathItem)) {
                findings.push({ level: 'error', message: `Path ${pathKey} must be an object` });
                continue;
            }
            for (const method of Object.keys(pathItem)) {
                if (method === 'parameters') continue;
                const op = pathItem[method];
                if (!isObject(op)) {
                    findings.push({ level: 'error', message: `Operation ${method.toUpperCase()} on ${pathKey} must be an object` });
                    continue;
                }
                if (!op.responses || !isObject(op.responses)) {
                    findings.push({ level: 'warning', message: `Operation ${method.toUpperCase()} ${pathKey} has no responses defined` });
                }
            }
        }
    }

    // Check components.schemas types
    if (spec.components && spec.components.schemas && isObject(spec.components.schemas)) {
        const validTypes = new Set(['object', 'array', 'string', 'number', 'integer', 'boolean', 'null']);
        for (const name of Object.keys(spec.components.schemas)) {
            const schema = spec.components.schemas[name];
            if (isObject(schema)) {
                if (schema.type && !validTypes.has(schema.type)) {
                    findings.push({ level: 'warning', message: `Schema components.schemas.${name} has unknown type '${schema.type}'` });
                }
            }
        }
    }

    // Collect $ref pointers and check they resolve to something inside the spec
    const refs = collectRefs(spec, []);
    const seen = new Set();
    for (const r of refs) {
        if (seen.has(r)) continue;
        seen.add(r);
        if (r.startsWith('#/')) {
            const target = getByPointer(spec, r);
            if (typeof target === 'undefined') {
                findings.push({ level: 'error', message: `Unresolved $ref '${r}'` });
            }
        } else {
            // external refs are noted but not resolved here
            findings.push({ level: 'warning', message: `External $ref '${r}' found (not resolved)` });
        }
    }

    const valid = !findings.some(f => f.level === 'error');
    return { valid, findings };
}

module.exports = { validateSpec, collectRefs, getByPointer };
