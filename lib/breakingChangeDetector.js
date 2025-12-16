function detectBreakingChanges(oldSpec, newSpec) {
    //Returns: { breaking: [...], nonBreaking: [...]}
    //breaking: things that will crash old clients
    //nonBreaking: safe changes

    const findings = {
        breaking: [],
        nonBreaking:[]
    };

    //TODO: find removed paths
    //TODO: find removed operations (GET /pets existes in old but not in new)
    //TODO: find changed response types
    //TODO: find removed required fields

    return findings;
}


module.exports = { detectBreakingChanges }