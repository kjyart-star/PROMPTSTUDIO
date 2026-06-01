const fs = require('fs');

const files = [
  'src/components/artist/ArtistClient.tsx',
  'src/components/profile/ProfileClient.tsx',
  'src/components/studio/StudioClient.tsx',
  'src/components/library/LibraryClient.tsx'
];

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    // We are looking for ternary operators for uiLanguage that have Korean in the final (English) fallback
    if (line.includes("uiLanguage ===") && /[가-힣]/.test(line)) {
      // Find the last part of the ternary operator
      // e.g. uiLanguage === 'KO' ? '...' : uiLanguage === 'JA' ? '...' : 'English'
      // A naive check: see if there's Korean after the last colon in the line that belongs to a ternary
      const lastColonIndex = line.lastIndexOf(':');
      if (lastColonIndex > -1) {
        const afterLastColon = line.substring(lastColonIndex + 1);
        if (/[가-힣]/.test(afterLastColon) && !afterLastColon.includes("`") && !afterLastColon.includes("}")) {
            // It might be a match, but let's just print the whole line to review manually
            console.log(`${file}:${i+1}: ${line.trim()}`);
        } else if (/[가-힣]/.test(afterLastColon)) {
             console.log(`${file}:${i+1}: ${line.trim()}`);
        }
      }
    }
  });
});
