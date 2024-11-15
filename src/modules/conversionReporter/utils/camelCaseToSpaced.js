function camelCaseToSpaced(str) {
    try {
        // Split string at capital letters and join with space
        const result = str.replace(/([A-Z])/g, ' $1').trim();
        return result;
    } catch (error) {
        console.error('Error converting camelCase to spaced string:', error);
        throw error;
    }
}

module.exports = camelCaseToSpaced;
