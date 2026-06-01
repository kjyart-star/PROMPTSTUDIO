const fs = require('fs');

const files = [
  'src/components/profile/ProfileClient.tsx',
  'src/components/artist/ArtistClient.tsx',
  'src/components/library/LibraryClient.tsx',
  'src/components/studio/StudioClient.tsx'
];

files.forEach(file => {
  const code = fs.readFileSync(file, 'utf8');
  const lines = code.split('\n');
  let missing = [];
  lines.forEach((line, i) => {
    // Check if line has Korean but NO uiLanguage === 'KO' OR if it has a hardcoded string
    // To minimize noise, we'll just look for specific words from the screenshots
    const wordsToFind = [
      '관리 대시보드', '아티스트 채널', '새 앨범 만들기', '앨범 제목', '앨범 설명', 
      '장르 카테고리', '노출 순위 설정', '앨범 퍼블리싱', '앨범 커버 업로드',
      '새 채널 추가', '배너 이미지', '이미지 업로드', '프로필 사진', '채널명', 
      '새 아티스트 이름', '소개글', '채널에 대해 소개해주세요', '핸들 네임', 
      '장르 설정', '최대 5개의', '장르 입력', '고급 통계 설정', '목록으로', '보관함 폴더'
    ];
    
    wordsToFind.forEach(word => {
        if (line.includes(word)) {
            // Check if it's already translated with uiLanguage
            if (!line.includes("uiLanguage ===")) {
                missing.push(`${file}:${i+1}: ${line.trim()}`);
            } else {
                // Check if the English fallback contains Korean
                const match = line.match(/uiLanguage === 'KO' \? .* : uiLanguage === 'JA' \? .* : (['"`][^'"`]*['"`])/);
                if (match && /[가-힣]/.test(match[1])) {
                     missing.push(`${file}:${i+1} (fallback): ${line.trim()}`);
                }
            }
        }
    });
  });
  
  if (missing.length > 0) {
      console.log(`\n--- ${file} ---`);
      missing.forEach(m => console.log(m));
  }
});
