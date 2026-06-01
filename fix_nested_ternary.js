const fs = require('fs');
let code = fs.readFileSync('src/components/profile/ProfileClient.tsx', 'utf8');

code = code.replace(
  /\{uiLanguage === 'KO' \? '\{uiLanguage === 'KO' \? '장르 카테고리 선택' : uiLanguage === 'JA' \? 'ジャンルカテゴリを選択' : 'Select Genre Category'\}' : uiLanguage === 'JA' \? 'ジャンルを選択' : 'Select Genre Category'\}/g,
  "{uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリを選択' : 'Select Genre Category'}"
);

fs.writeFileSync('src/components/profile/ProfileClient.tsx', code);
