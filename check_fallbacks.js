const fs = require('fs');
const file = 'src/components/studio/StudioClient.tsx';
const code = fs.readFileSync(file, 'utf8');

const lines = code.split('\n');
lines.forEach((line, i) => {
  if (line.includes("uiLanguage === 'KO'") && /[가-힣]/.test(line)) {
    // Check if the fallback (the last part of the ternary) contains Korean
    const parts = line.split("uiLanguage === 'KO'");
    if (parts.length > 1) {
      const match = line.match(/uiLanguage === 'KO' \? (.*?) : uiLanguage === 'JA' \? (.*?) : (.*?)$/);
      if (match) {
        if (/[가-힣]/.test(match[3])) {
          console.log(`${i+1}: ${line.trim()}`);
        }
      } else {
        // Just print lines with Korean that aren't matching the 3-part ternary perfectly, maybe they are just hardcoded Korean fallback
        if (!line.includes("uiLanguage === 'JA'")) {
          // console.log(`${i+1} (no JA): ${line.trim()}`);
        } else {
          // manually check the last part
          const lastPartIdx = line.lastIndexOf(':');
          if (lastPartIdx > -1 && /[가-힣]/.test(line.substring(lastPartIdx))) {
             console.log(`${i+1} (fallback): ${line.trim()}`);
          }
        }
      }
    }
  }
});
