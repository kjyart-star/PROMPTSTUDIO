const fs = require('fs');
const file = 'src/components/library/LibraryClient.tsx';
const code = fs.readFileSync(file, 'utf8');

const match = code.match(/localStorage\.getItem\('language'\)[\s\S]*?setUiLanguage\([^)]*\)/);
if (match) {
  console.log(match[0]);
} else {
  console.log('Not found');
}
