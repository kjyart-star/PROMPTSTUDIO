const fs = require('fs');
let code = fs.readFileSync('src/components/profile/ProfileClient.tsx', 'utf8');

code = code.replace(
  /title="\{uiLanguage === 'KO' \? '노출 순위 설정' : uiLanguage === 'JA' \? '表示順位設定' : 'Exposure Order Settings'\}"/g,
  "title={uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順位設定' : 'Exposure Order Settings'}"
);

fs.writeFileSync('src/components/profile/ProfileClient.tsx', code);
