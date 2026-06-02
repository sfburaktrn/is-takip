function getBaseCompany(name) {
    if (!name) return null;
    let baseName = String(name).trim().toUpperCase();
    // Remove trailing numbers like "1", "2", etc.
    baseName = baseName.replace(/\s*\d+\s*$/, '');
    // Remove trailing dashes like "EFATUR-1" -> "EFATUR"
    baseName = baseName.replace(/\s*[-_]\s*\d*\s*$/, '');
    return baseName.trim();
}

module.exports = { getBaseCompany };

