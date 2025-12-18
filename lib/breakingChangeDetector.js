function detectBreakingChanges(oldSpec, newSpec) {
    //Returns: { breaking: [...], nonBreaking: [...]}
    //breaking: things that will crash old clients
    //nonBreaking: safe changes

    const findings = {
        breaking: [],
        nonBreaking:[]
    };
    const newPaths = new Set(Object.keys(newSpec.paths || {}));

    for( const oldPath of Object.keys(oldSpec.paths || {})) {
        if(!newPaths.has(oldPath)) {
            findings.breaking.push({ type: 'removed_path', path: oldPath });
        }
    }


    return findings;
}


module.exports = { detectBreakingChanges }