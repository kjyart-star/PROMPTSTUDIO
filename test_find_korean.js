const fs = require('fs');

const extractKorean = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    // skip lines that already contain uiLanguage logic
    if (/[가-힣]/.test(line) && !line.includes('uiLanguage ===')) {
      console.log(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}

extractKorean('src/components/library/LibraryClient.tsx');
