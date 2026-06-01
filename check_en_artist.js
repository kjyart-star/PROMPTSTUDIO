const fs = require('fs');

const code = fs.readFileSync('src/components/artist/ArtistClient.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((line, i) => {
  if (line.includes("uiLanguage ===") && /[가-힣]/.test(line)) {
    const lastColonIndex = line.lastIndexOf(':');
    if (lastColonIndex > -1) {
      const afterLastColon = line.substring(lastColonIndex + 1);
      if (/[가-힣]/.test(afterLastColon) && !afterLastColon.includes("`") && !afterLastColon.includes("}")) {
          console.log(`ArtistClient.tsx:${i+1}: ${line.trim()}`);
      } else if (/[가-힣]/.test(afterLastColon)) {
          console.log(`ArtistClient.tsx:${i+1}: ${line.trim()}`);
      }
    }
  }
});
