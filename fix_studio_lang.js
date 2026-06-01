const fs = require('fs');

const file = 'src/components/studio/StudioClient.tsx';
let code = fs.readFileSync(file, 'utf8');

// Fix initialization
code = code.replace(
  /setUiLanguage\(storedLang\.toLowerCase\(\)\.startsWith\('ko'\) \? 'KO' : 'EN'\)/g,
  "setUiLanguage(storedLang.toLowerCase().startsWith('ko') ? 'KO' : storedLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN')"
);

fs.writeFileSync(file, code);
