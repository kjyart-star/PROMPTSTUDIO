const fs = require('fs');

function walkSync(currentDirPath, callback) {
    const fs = require('fs'), path = require('path');
    fs.readdirSync(currentDirPath).forEach(function (name) {
        const filePath = path.join(currentDirPath, name);
        const stat = fs.statSync(filePath);
        if (stat.isFile() && filePath.endsWith('.tsx')) {
            callback(filePath, stat);
        } else if (stat.isDirectory() && !filePath.includes('node_modules')) {
            walkSync(filePath, callback);
        }
    });
}

walkSync('src/components', (filePath) => {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern: uiLanguage === 'KO' ? '...' : uiLanguage === 'JA' ? '...'' }
    const regex = /uiLanguage === 'KO'\s*\?\s*'([^']+)'\s*:\s*uiLanguage === 'JA'\s*\?\s*'([^']+)'\s*'\s*}/g;
    
    const newContent = content.replace(regex, (match, koText, jaText) => {
        return `uiLanguage === 'KO' ? '${koText}' : uiLanguage === 'JA' ? '${jaText}' : '${koText}'}`;
    });
    
    if (content !== newContent) {
        console.log('Fixed:', filePath);
        fs.writeFileSync(filePath, newContent, 'utf8');
    }
});
