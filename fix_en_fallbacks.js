const fs = require('fs');

function replaceFile(file, replacements) {
  let code = fs.readFileSync(file, 'utf8');
  for (const [target, replacement] of Object.entries(replacements)) {
    code = code.split(target).join(replacement);
  }
  fs.writeFileSync(file, code);
}

// 1. ProfileClient.tsx
replaceFile('src/components/profile/ProfileClient.tsx', {
  "'업로드 중...' : uiLanguage === 'JA' ? 'アップロード中...' : '업로드 중...'": "'업로드 중...' : uiLanguage === 'JA' ? 'アップロード中...' : 'Uploading...'",
  "'업로드 완료' : uiLanguage === 'JA' ? 'アップロード完了' : '업로드 완료'": "'업로드 완료' : uiLanguage === 'JA' ? 'アップロード完了' : 'Upload Complete'"
});

// 2. LibraryClient.tsx
replaceFile('src/components/library/LibraryClient.tsx', {
  "uiLanguage === 'JA' ? '順位' : '순위'": "uiLanguage === 'JA' ? '順位' : ' Rank'",
  "}곡": "} songs" // This one is tricky, let's target more specifically
});

// For }곡 in LibraryClient:
let libCode = fs.readFileSync('src/components/library/LibraryClient.tsx', 'utf8');
libCode = libCode.replace(/\{activePlaylist\.tracks\.length\}곡/g, "{activePlaylist.tracks.length}{uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : ' songs'}");
fs.writeFileSync('src/components/library/LibraryClient.tsx', libCode);

// 3. StudioClient.tsx
const studioReplacements = {
  ": '가사 분량'": ": 'Lyrics Density'",
  ": '보이스 톤'": ": 'Vocal Tone'",
  ": '보컬 나이'": ": 'Vocal Age'",
  ": '보컬 젠더/구성'": ": 'Vocal Gender/Format'",
  ": '언어 1'": ": 'Language 1'",
  ": '언어 2'": ": 'Language 2'",
  ": '언어 비중'": ": 'Language Ratio'",
  ": '샘플 생성'": ": 'Generate Sample'",
  ": '곡 구조 설계 (마디수/BPM)'": ": 'Structure & BPM Plan'",
  ": '생성 시 곡의 총 마디 수와 BPM 배분표가 여기에 표시됩니다.'": ": 'Structure and BPM plan will be shown here.'",
  ": '제목, 스타일 설명 검색...'": ": 'Search title, style description...'",
  ": '전체'": ": 'All'",
  ": '좋아요 표시한 음악'": ": 'Liked Songs'",
  ": '보관된 음원이나 프롬프트가 없습니다.'": ": 'No saved tracks or prompts.'",
  ": '번호'": ": 'No.'",
  ": '작성일'": ": 'Created At'",
  ": '제목'": ": 'Title'",
  ": '스타일 설명 (STYLE DESCRIPTION)'": ": 'STYLE DESCRIPTION'",
  ": '언어'": ": 'Language'",
  ": '재생 시간'": ": 'Duration'",
  ": '좋아요'": ": 'Like'",
  ": '공개 여부'": ": 'Public/Private'",
  ": '관리'": ": 'Manage'",
  ": '생성 중'": ": 'Generating'",
  ": '다운로드'": ": 'Download'",
  ": '채널 연결'": ": 'Connect Channel'",
  ": '메인 프로필 (채널 없음)'": ": 'Main Profile (No Channel)'",
  ": '플레이리스트에 추가'": ": 'Add to Playlist'",
  ": '생성된 플레이리스트 없음'": ": 'No playlists created'",
  ": '삭제 확인'": ": 'Confirm Delete'",
  ": '정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.'": ": 'Are you sure you want to delete? This action cannot be undone.'",
  ": '음원 퍼블리싱'": ": 'Publish Track'",
  ": '장르 선택'": ": 'Select Genre'",
  ": '퍼블리싱'": ": 'Publish'"
};

let studioCode = fs.readFileSync('src/components/studio/StudioClient.tsx', 'utf8');
const lines = studioCode.split('\n');
const fixedLines = lines.map(line => {
    if (line.includes("uiLanguage === 'KO'")) {
        let newLine = line;
        for (const [target, rep] of Object.entries(studioReplacements)) {
            // make sure we are only replacing the last fallback
            // regex to replace : 'Korean' with : 'English' at the end of the ternary
            const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`${escapedTarget}(?=[^a-zA-Z가-힣]*$)`, 'g');
            newLine = newLine.replace(regex, rep);
        }
        return newLine;
    }
    return line;
});
fs.writeFileSync('src/components/studio/StudioClient.tsx', fixedLines.join('\n'));

