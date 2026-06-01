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
const regexAll = /uiLanguage === 'JA' \? (['"`])((?:(?!\1).)*)\1 : uiLanguage === 'JA' \? (['"`])((?:(?!\3).)*)\3/g;

walkDir('./src', function(filePath) {
  if (!targetExts.includes(path.extname(filePath))) return;
  
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;
  
  content = content.replace(regexAll, (match, p1, p2, p3, p4) => {
    return `uiLanguage === 'JA' ? ${p3}${p4}${p3}`;
  });
  
  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  }
});
