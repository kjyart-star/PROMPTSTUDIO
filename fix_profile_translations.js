const fs = require('fs');

function replaceFile(file, replacements) {
  let code = fs.readFileSync(file, 'utf8');
  for (const [target, replacement] of Object.entries(replacements)) {
    code = code.split(target).join(replacement);
  }
  fs.writeFileSync(file, code);
}

const profileReplacements = {
  // English fallbacks
  "uiLanguage === 'JA' ? '新しいチャンネルを作成' : '새 채널 추가'": "uiLanguage === 'JA' ? '新しいチャンネルを作成' : 'Create New Channel'",
  "uiLanguage === 'JA' ? '背景画像' : '배너 이미지 (Background image)'": "uiLanguage === 'JA' ? '背景画像' : 'Banner Image (Background image)'",
  "uiLanguage === 'JA' ? '写真をアップロード' : '이미지 업로드'": "uiLanguage === 'JA' ? '写真をアップロード' : 'Upload Image'",
  "uiLanguage === 'JA' ? 'プロフィール写真' : '프로필 사진 (Profile picture)'": "uiLanguage === 'JA' ? 'プロフィール写真' : 'Profile Picture (Profile picture)'",
  "uiLanguage === 'JA' ? '表示名' : '채널명 (Display Name)'": "uiLanguage === 'JA' ? '表示名' : 'Channel Name (Display Name)'",
  "uiLanguage === 'JA' ? 'マイニューアーティスト' : '새 아티스트 이름'": "uiLanguage === 'JA' ? 'マイニューアーティスト' : 'New Artist Name'",
  "uiLanguage === 'JA' ? '自己紹介を追加' : '소개글 (Bio)'": "uiLanguage === 'JA' ? '自己紹介を追加' : 'Bio (Bio)'",
  "uiLanguage === 'JA' ? 'このチャンネルについて教えてください...' : '채널에 대해 소개해주세요...'": "uiLanguage === 'JA' ? 'このチャンネルについて教えてください...' : 'Introduce your channel...'",
  "uiLanguage === 'JA' ? 'ハンドルネーム*' : '핸들 네임 (고유 URL)*'": "uiLanguage === 'JA' ? 'ハンドルネーム*' : 'Handle (Unique URL)*'",
  "uiLanguage === 'JA' ? 'ジャンル（オーバーライド）' : '장르 설정 (Genres Override)'": "uiLanguage === 'JA' ? 'ジャンル（オーバーライド）' : 'Genres Override'",
  "uiLanguage === 'JA' ? '音楽スタイルを説明するジャンルを最大5つ追加できます。空の場合、最も人気のある曲から推測されます。' : '최대 5개의 음악 장르를 추가할 수 있습니다. 비워둘 경우 가장 인기 있는 곡의 장르가 표시됩니다.'": "uiLanguage === 'JA' ? '音楽スタイルを説明するジャンルを最大5つ追加できます。空の場合、最も人気のある曲から推測されます。' : 'Add up to 5 genres. If left blank, the most popular genre will be shown.'",
  "uiLanguage === 'JA' ? 'ジャンルを入力...' : '장르 입력...'": "uiLanguage === 'JA' ? 'ジャンルを入力...' : 'Enter genre...'",
  "uiLanguage === 'JA' ? '詳細な統計情報 (手動設定)' : '고급 통계 설정 (Advanced Statistics)'": "uiLanguage === 'JA' ? '詳細な統計情報 (手動設定)' : 'Advanced Statistics'",
  "uiLanguage === 'JA' ? '管理ダッシュボード' : '관리 대시보드'": "uiLanguage === 'JA' ? '管理ダッシュボード' : 'Admin Dashboard'",
  "uiLanguage === 'JA' ? 'アーティストチャンネル' : '아티스트 채널'": "uiLanguage === 'JA' ? 'アーティストチャンネル' : 'Artist Channel'",
  "uiLanguage === 'JA' ? 'ジャンル (必須)' : '장르 카테고리 (필수)'": "uiLanguage === 'JA' ? 'ジャンル (必須)' : 'Genre Category (Required)'",
  "uiLanguage === 'JA' ? 'ジャンルを選択' : '장르 카테고리 선택'": "uiLanguage === 'JA' ? 'ジャンルを選択' : 'Select Genre Category'",

  // Hardcoded UI Strings in ProfileClient
  "{playlistType === 'album' ? '새 앨범 만들기' : '새 플레이리스트 만들기'}": "{playlistType === 'album' ? (uiLanguage === 'KO' ? '새 앨범 만들기' : uiLanguage === 'JA' ? '新しいアルバムを作成' : 'Create New Album') : (uiLanguage === 'KO' ? '새 플레이리스트 만들기' : uiLanguage === 'JA' ? '新しいプレイリストを作成' : 'Create New Playlist')}",
  "{playlistType === 'album' ? '앨범 제목' : '플레이리스트 제목'}": "{playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 제목' : uiLanguage === 'JA' ? 'アルバムのタイトル' : 'Album Title') : (uiLanguage === 'KO' ? '플레이리스트 제목' : uiLanguage === 'JA' ? 'プレイリストのタイトル' : 'Playlist Title')}",
  "{playlistType === 'album' ? '앨범 설명' : '플레이리스트 설명'}": "{playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 설명' : uiLanguage === 'JA' ? 'アルバムの説明' : 'Album Description') : (uiLanguage === 'KO' ? '플레이리스트 설명' : uiLanguage === 'JA' ? 'プレイリストの説明' : 'Playlist Description')}",
  "장르 카테고리 (필수)": "{uiLanguage === 'KO' ? '장르 카테고리 (필수)' : uiLanguage === 'JA' ? 'ジャンルカテゴリ (必須)' : 'Genre Category (Required)'}",
  "장르 카테고리 선택": "{uiLanguage === 'KO' ? '장르 카테고리 선택' : uiLanguage === 'JA' ? 'ジャンルカテゴリを選択' : 'Select Genre Category'}",
  "노출 순위 설정": "{uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順位設定' : 'Exposure Order Settings'}",
  "{playlistType === 'album' ? '앨범 퍼블리싱 (공개 여부)' : '플레이리스트 퍼블리싱 (공개 여부)'}": "{playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? 'アルバムの公開 (公開設定)' : 'Publish Album (Public)') : (uiLanguage === 'KO' ? '플레이리스트 퍼블리싱 (공개 여부)' : uiLanguage === 'JA' ? 'プレイリストの公開 (公開設定)' : 'Publish Playlist (Public)')}",
  "{playlistType === 'album' ? '앨범 커버 업로드' : '플레이리스트 커버 업로드'}": "{playlistType === 'album' ? (uiLanguage === 'KO' ? '앨범 커버 업로드' : uiLanguage === 'JA' ? 'アルバムカバーをアップロード' : 'Upload Album Cover') : (uiLanguage === 'KO' ? '플레이리스트 커버 업로드' : uiLanguage === 'JA' ? 'プレイリストカバーをアップロード' : 'Upload Playlist Cover')}",
  "<ArrowLeft className=\"w-4 h-4\" /> 목록으로": "<ArrowLeft className=\"w-4 h-4\" /> {uiLanguage === 'KO' ? '목록으로' : uiLanguage === 'JA' ? 'リストへ戻る' : 'Back to list'}",
  "title=\"노출 순위 설정\"": "title={uiLanguage === 'KO' ? '노출 순위 설정' : uiLanguage === 'JA' ? '表示順位設定' : 'Exposure Order Settings'}"
};

replaceFile('src/components/profile/ProfileClient.tsx', profileReplacements);

// For '보관함 폴더 • N곡' in ProfileClient
let profileCode = fs.readFileSync('src/components/profile/ProfileClient.tsx', 'utf8');
profileCode = profileCode.replace(
  /\{selectedPlaylist\.is_mock \? 'AI Artist' : '보관함 폴더'\} • \{selectedPlaylistTracks\.length\}곡/g,
  "{selectedPlaylist.is_mock ? 'AI Artist' : (uiLanguage === 'KO' ? '보관함 폴더' : uiLanguage === 'JA' ? 'ライブラリフォルダ' : 'Library Folder')} • {selectedPlaylistTracks.length}{uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : ' songs'}"
);
fs.writeFileSync('src/components/profile/ProfileClient.tsx', profileCode);

