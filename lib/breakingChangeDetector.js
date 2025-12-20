function detectBreakingChanges(oldSpec, newSpec) {
    //Returns: { breaking: [...], nonBreaking: [...]}
    //breaking: things that will crash old clients
    //nonBreaking: safe changes

    const findings = {
        breaking: [],
        nonBreaking: []
    };

    const oldPaths = oldSpec.paths || {};
    const newPaths = newSpec.paths || {};
    const newPathKeys = new Set(Object.keys(newPaths));

    // Check for removed paths
    for (const oldPath of Object.keys(oldPaths)) {
        if (!newPathKeys.has(oldPath)) {
            findings.breaking.push({ type: 'removed_path', path: oldPath });
        } else {
            // Check for removed methods and parameter changes within each path
            checkPathChanges(oldPath, oldPaths[oldPath], newPaths[oldPath], findings);
        }
    }

    return findings;
}

function checkPathChanges(path, oldPathObj, newPathObj, findings) {
    const httpMethods = ['get', 'post', 'put', 'patch', 'delete', 'head', 'options'];
    const newMethodKeys = new Set(Object.keys(newPathObj || {}).filter(k => httpMethods.includes(k.toLowerCase())));

    // Check for removed methods
    for (const method of httpMethods) {
        if (oldPathObj && oldPathObj[method] && !newMethodKeys.has(method)) {
            findings.breaking.push({ type: 'removed_method', path, method });
        }
    }

    // Check parameter and response changes for each method
    for (const method of httpMethods) {
        if (oldPathObj && oldPathObj[method] && newPathObj && newPathObj[method]) {
            checkMethodChanges(path, method, oldPathObj[method], newPathObj[method], findings);
        }
    }
}

function checkMethodChanges(path, method, oldMethod, newMethod, findings) {
    // Check for new required parameters
    checkParameterChanges(path, method, oldMethod, newMethod, findings);
    // Check for response field changes
    checkResponseChanges(path, method, oldMethod, newMethod, findings);
}

function checkParameterChanges(path, method, oldMethod, newMethod, findings) {
    const oldParams = oldMethod.parameters || [];
    const newParams = newMethod.parameters || [];

    const oldParamMap = new Map(oldParams.map(p => [p.name, p]));
    const newParamMap = new Map(newParams.map(p => [p.name, p]));

    // Check for new required parameters
    for (const newParam of newParams) {
        const oldParam = oldParamMap.get(newParam.name);
        if (!oldParam && newParam.required) {
            findings.breaking.push({
                type: 'required_parameter_added',
                path,
                method,
                parameter: newParam.name
            });
        }
    }

    // Check for parameters that became optional (non-breaking)
    for (const oldParam of oldParams) {
        const newParam = newParamMap.get(oldParam.name);
        if (newParam && oldParam.required && !newParam.required) {
            findings.nonBreaking.push({
                type: 'required_parameter_made_optional',
                path,
                method,
                parameter: oldParam.name
            });
        }
    }
}

function checkResponseChanges(path, method, oldMethod, newMethod, findings) {
    const oldResponses = oldMethod.responses || {};
    const newResponses = newMethod.responses || {};

    for (const statusCode of Object.keys(oldResponses)) {
        const oldResponse = oldResponses[statusCode];
        const newResponse = newResponses[statusCode];

        if (!oldResponse.schema || !newResponse || !newResponse.schema) {
            continue;
        }

        // Check if response schema type changed
        if (oldResponse.schema.type && newResponse.schema.type && oldResponse.schema.type !== newResponse.schema.type) {
            findings.breaking.push({
                type: 'response_schema_type_changed',
                path,
                method,
                statusCode,
                oldType: oldResponse.schema.type,
                newType: newResponse.schema.type
            });
        }

        // Check for removed required response fields
        const oldRequired = new Set(oldResponse.schema.required || []);
        const newRequired = new Set(newResponse.schema.required || []);

        for (const field of oldRequired) {
            if (!newRequired.has(field)) {
                findings.breaking.push({
                    type: 'removed_required_response_field',
                    path,
                    method,
                    statusCode,
                    field
                });
            }
        }
    }
}


module.exports = { detectBreakingChanges }