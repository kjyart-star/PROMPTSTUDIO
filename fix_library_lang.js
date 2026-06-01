const fs = require('fs');

const file = 'src/components/library/LibraryClient.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace <div>제목</div>
code = code.replace(/<div>제목<\/div>/g, "<div>{uiLanguage === 'KO' ? '제목' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</div>");
// Replace <div>앨범</div>
code = code.replace(/<div>앨범<\/div>/g, "<div>{uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Album'}</div>");
// Replace <div>추가된 날짜</div>
code = code.replace(/<div>추가된 날짜<\/div>/g, "<div>{uiLanguage === 'KO' ? '추가된 날짜' : uiLanguage === 'JA' ? '追加された日付' : 'Date Added'}</div>");

// Also check for "플레이리스트에 들어있는 곡이 없습니다."
code = code.replace(
  /'플레이리스트에 들어있는 곡이 없습니다\.'/g,
  "(uiLanguage === 'KO' ? '플레이리스트에 들어있는 곡이 없습니다.' : uiLanguage === 'JA' ? 'プレイリストに曲がありません。' : 'No songs in this playlist.')"
);

// Also check for "순위" without translation in exposureOrder
code = code.replace(/\{pl\.exposureOrder\}순위/g, "{pl.exposureOrder}{uiLanguage === 'KO' ? '순위' : uiLanguage === 'JA' ? '順位' : ' Rank'}");


fs.writeFileSync(file, code);
