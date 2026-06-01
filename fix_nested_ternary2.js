const fs = require('fs');
let code = fs.readFileSync('src/components/profile/ProfileClient.tsx', 'utf8');

code = code.replace(
  /\{uiLanguage === 'KO' \? '\{uiLanguage === 'KO' \? '장르 카테고리 \(필수\)' : uiLanguage === 'JA' \? 'ジャンル \(必須\)' : 'Genre Category \(Required\)\}' : uiLanguage === 'JA' \? 'ジャンル \(必須\)' : 'Genre Category \(Required\)'\}/g,
  "{uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンル (必須)' : 'Genre Category (Required)'}"
);

fs.writeFileSync('src/components/profile/ProfileClient.tsx', code);
