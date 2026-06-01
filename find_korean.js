const fs = require('fs');

const extractKorean = (file) => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (/[가-힣]/.test(line)) {
      console.log(`${file}:${i + 1}: ${line.trim()}`);
    }
  });
}

extractKorean('src/components/library/LibraryClient.tsx');
