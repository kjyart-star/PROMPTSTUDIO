const fs = require('fs');

const files = [
  'src/components/profile/ProfileClient.tsx',
  'src/components/artist/ArtistClient.tsx'
];

for (const file of files) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/▶ {tracksCount} 곡/g, "▶ {tracksCount} {uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : 'songs'}");
  fs.writeFileSync(file, code);
  console.log('Fixed "곡" in ' + file);
}
