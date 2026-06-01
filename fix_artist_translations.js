const fs = require('fs');

const file = 'src/components/artist/ArtistClient.tsx';
let code = fs.readFileSync(file, 'utf8');

// Replace "관리 대시보드"
code = code.replace(/<Lock className="w-3\.5 h-3\.5" \/> 관리 대시보드/g, '<Lock className="w-3.5 h-3.5" /> {uiLanguage === \'KO\' ? \'관리 대시보드\' : uiLanguage === \'JA\' ? \'管理ダッシュボード\' : \'Admin Dashboard\'}');

// Replace "채널 관리"
code = code.replace(/<Users className="w-3\.5 h-3\.5" \/> 채널 관리/g, '<Users className="w-3.5 h-3.5" /> {uiLanguage === \'KO\' ? \'채널 관리\' : uiLanguage === \'JA\' ? \'チャンネル管理\' : \'Manage Channels\'}');

// Replace "아티스트 채널"
code = code.replace(/<Globe className="w-3\.5 h-3\.5" \/> 아티스트 채널/g, '<Globe className="w-3.5 h-3.5" /> {uiLanguage === \'KO\' ? \'아티스트 채널\' : uiLanguage === \'JA\' ? \'アーティストチャンネル\' : \'Artist Channel\'}');

// Replace "등록된 음원이 없습니다."
code = code.replace(/등록된 음원이 없습니다\./g, "{uiLanguage === 'KO' ? '등록된 음원이 없습니다.' : uiLanguage === 'JA' ? '登録されたトラックがありません。' : 'No registered tracks.'}");

// Replace "공개된 앨범이 없습니다."
code = code.replace(/공개된 앨범이 없습니다\./g, "{uiLanguage === 'KO' ? '공개된 앨범이 없습니다.' : uiLanguage === 'JA' ? '公開されたアルバムがありません。' : 'No public albums.'}");

// Replace "공개된 플레이리스트가 없습니다."
code = code.replace(/공개된 플레이리스트가 없습니다\./g, "{uiLanguage === 'KO' ? '공개된 플레이리스트가 없습니다.' : uiLanguage === 'JA' ? '公開されたプレイリストがありません。' : 'No public playlists.'}");

// Replace "Songs"
code = code.replace(/Songs <ChevronRight/g, "{uiLanguage === 'KO' ? '음원 목록' : uiLanguage === 'JA' ? 'トラック一覧' : 'Songs'} <ChevronRight");

// Replace "Albums"
code = code.replace(/Albums <ChevronRight/g, "{uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'} <ChevronRight");

// Replace "Playlists"
code = code.replace(/Playlists <ChevronRight/g, "{uiLanguage === 'KO' ? '플레이리스트' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlists'} <ChevronRight");

fs.writeFileSync(file, code);
console.log('Fixed translations in ArtistClient.tsx');
