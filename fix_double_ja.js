const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const targetExts = ['.tsx', '.ts', '.js', '.jsx'];
const regex1 = /uiLanguage === 'JA' \? '([^']+)' : uiLanguage === 'JA' \? '([^']+)'/g;
const regex2 = /uiLanguage === 'JA' \? "([^"]+)" : uiLanguage === 'JA' \? "([^"]+)"/g;
const regex3 = /uiLanguage === 'JA' \? `([^`]+)` : uiLanguage === 'JA' \? `([^`]+)`/g;

walkDir('./src', function(filePath) {
  if (!targetExts.includes(path.extname(filePath))) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(regex1, "uiLanguage === 'JA' ? '$2'");
  content = content.replace(regex2, 'uiLanguage === \'JA\' ? "$2"');
  content = content.replace(regex3, 'uiLanguage === \'JA\' ? `$2`');
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
});
