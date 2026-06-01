const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('src/components', (filePath) => {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    const code = fs.readFileSync(filePath, 'utf8');
    const lines = code.split('\n');
    lines.forEach((line, i) => {
      if (line.includes("uiLanguage ===") && /[가-힣]/.test(line)) {
        const lastColonIndex = line.lastIndexOf(':');
        if (lastColonIndex > -1) {
          const afterLastColon = line.substring(lastColonIndex + 1);
          // Check if the part after the last colon contains Korean and isn't just a generic string format
          if (/[가-힣]/.test(afterLastColon) && !afterLastColon.includes("`") && !afterLastColon.includes("}")) {
              console.log(`${filePath}:${i+1}: ${line.trim()}`);
          }
        }
      }
    });
  }
});
