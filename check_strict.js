const fs = require('fs');
const files = [
  'src/components/artist/ArtistClient.tsx',
  'src/components/profile/ProfileClient.tsx',
  'src/components/studio/StudioClient.tsx',
  'src/components/studio/MasteringClient.tsx',
  'src/components/library/LibraryClient.tsx'
];

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  lines.forEach((line, i) => {
    if (line.includes("uiLanguage ===") && /[가-힣]/.test(line)) {
      const lastColonIndex = line.lastIndexOf(':');
      if (lastColonIndex > -1) {
        const afterLastColon = line.substring(lastColonIndex + 1);
        if (/[가-힣]/.test(afterLastColon) && !afterLastColon.includes("`") && !afterLastColon.includes("}")) {
            console.log(`${file}:${i+1}: ${line.trim()}`);
        }
      }
    }
  });
});
