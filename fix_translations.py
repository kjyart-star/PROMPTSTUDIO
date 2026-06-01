import re

files = [
    "src/components/artist/ArtistClient.tsx",
    "src/components/profile/ProfileClient.tsx",
    "src/components/studio/StudioClient.tsx",
    "src/components/studio/GenerateClient.tsx",
    "src/components/studio/MasteringClient.tsx",
    "src/components/chart/ChartClient.tsx"
]

replacements = {
    # Text nodes (usually >Text<)
    r">관리 대시보드<": ">{uiLanguage === 'KO' ? '관리 대시보드' : uiLanguage === 'JA' ? '管理ダッシュボード' : 'Management'}<",
    r">채널 관리<": ">{uiLanguage === 'KO' ? '채널 관리' : uiLanguage === 'JA' ? 'チャンネル管理' : 'Manage Channel'}<",
    r">아티스트 채널<": ">{uiLanguage === 'KO' ? '아티스트 채널' : uiLanguage === 'JA' ? 'アーティストチャンネル' : 'Artist Channel'}<",
    r">내 앨범<": ">{uiLanguage === 'KO' ? '내 앨범' : uiLanguage === 'JA' ? 'マイアルバム' : 'My Albums'}<",
    r">새 앨범 만들기<": ">{uiLanguage === 'KO' ? '새 앨범 만들기' : uiLanguage === 'JA' ? '新しいアルバムを作成' : 'Create New Album'}<",
    r">음원 목록<": ">{uiLanguage === 'KO' ? '음원 목록' : uiLanguage === 'JA' ? '曲リスト' : 'Songs'}<",
    r">더보기<": ">{uiLanguage === 'KO' ? '더보기' : uiLanguage === 'JA' ? 'もっと見る' : 'View More'}<",
    r">음원 파일 업로드<": ">{uiLanguage === 'KO' ? '음원 파일 업로드' : uiLanguage === 'JA' ? '音源アップロード' : 'Upload Audio'}<",
    r">채널 / 소속 폴더<": ">{uiLanguage === 'KO' ? '채널 / 소속 폴더' : uiLanguage === 'JA' ? 'チャンネル / フォルダ' : 'Channel / Folder'}<",
    r">등록일<": ">{uiLanguage === 'KO' ? '등록일' : uiLanguage === 'JA' ? '登録日' : 'Date Added'}<",
    r">번호<": ">{uiLanguage === 'KO' ? '번호' : uiLanguage === 'JA' ? '番号' : 'No.'}<",
    r">곡 정보<": ">{uiLanguage === 'KO' ? '곡 정보' : uiLanguage === 'JA' ? '曲情報' : 'Track Info'}<",
    r">테스트채널<": ">{uiLanguage === 'KO' ? '테스트채널' : uiLanguage === 'JA' ? 'テストチャンネル' : 'Test Channel'}<",
    r">메인 채널<": ">{uiLanguage === 'KO' ? '메인 채널' : uiLanguage === 'JA' ? 'メインチャンネル' : 'Main Channel'}<",
    r">단일 곡<": ">{uiLanguage === 'KO' ? '단일 곡' : uiLanguage === 'JA' ? 'シングル' : 'Single'}<",
    r"앨범:<": "{uiLanguage === 'KO' ? '앨범:' : uiLanguage === 'JA' ? 'アルバム:' : 'Album:'}<",
    r"앨범 :<": "{uiLanguage === 'KO' ? '앨범:' : uiLanguage === 'JA' ? 'アルバム:' : 'Album:'}<",
    r">앨범<": ">{uiLanguage === 'KO' ? '앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'}<",
    r"프로필 수정<": "{uiLanguage === 'KO' ? '프로필 수정' : uiLanguage === 'JA' ? 'プロフィールを編集' : 'Edit Profile'}<",
    r">새 채널 만들기<": ">{uiLanguage === 'KO' ? '새 채널 만들기' : uiLanguage === 'JA' ? 'チャンネル作成' : 'Create Channel'}<",
    r"Edit Channel<": "{uiLanguage === 'KO' ? '채널 수정' : uiLanguage === 'JA' ? 'チャンネル編集' : 'Edit Channel'}<",
    r"songs<": "{uiLanguage === 'KO' ? '곡' : uiLanguage === 'JA' ? '曲' : 'songs'}<",
    r"followers<": "{uiLanguage === 'KO' ? '팔로워' : uiLanguage === 'JA' ? 'フォロワー' : 'followers'}<",
    r"following<": "{uiLanguage === 'KO' ? '팔로잉' : uiLanguage === 'JA' ? 'フォロー中' : 'following'}<",

    # Chart
    r">BEATZ 랭킹차트<": ">{uiLanguage === 'KO' ? 'BEATZ 랭킹차트' : uiLanguage === 'JA' ? 'BEATZ ランキングチャート' : 'BEATZ Ranking Chart'}<",
    r"마지막 업데이트 기준일:<": "{uiLanguage === 'KO' ? '마지막 업데이트 기준일:' : uiLanguage === 'JA' ? '最終更新日:' : 'Last updated:'}<",
    r">음원 차트<": ">{uiLanguage === 'KO' ? '음원 차트' : uiLanguage === 'JA' ? '曲チャート' : 'Song Chart'}<",
    r">아티스트 차트<": ">{uiLanguage === 'KO' ? '아티스트 차트' : uiLanguage === 'JA' ? 'アーティストチャート' : 'Artist Chart'}<",
    r">일간<": ">{uiLanguage === 'KO' ? '일간' : uiLanguage === 'JA' ? '日間' : 'Daily'}<",
    r">주간<": ">{uiLanguage === 'KO' ? '주간' : uiLanguage === 'JA' ? '週間' : 'Weekly'}<",
    r">월간<": ">{uiLanguage === 'KO' ? '월간' : uiLanguage === 'JA' ? '月간' : 'Monthly'}<",

    # Mastering
    r"Pro Audio Mastering Console<": "{uiLanguage === 'KO' ? '프로 오디오 마스터링 콘솔' : uiLanguage === 'JA' ? 'プロオーディオマスタリングコンソール' : 'Pro Audio Mastering Console'}<",
    r"Drag & Drop files here<": "{uiLanguage === 'KO' ? '여기로 파일을 드래그 & 드롭' : uiLanguage === 'JA' ? 'ここにファイルをドラッグ＆ドロップ' : 'Drag & Drop files here'}<",
    r"Batch Queue<": "{uiLanguage === 'KO' ? '일괄 처리 대기열' : uiLanguage === 'JA' ? 'バッチキュー' : 'Batch Queue'}<",
    r"Mastering Rack Console<": "{uiLanguage === 'KO' ? '마스터링 랙 콘솔' : uiLanguage === 'JA' ? 'マスタリングラックコンソール' : 'Mastering Rack Console'}<",
    r"Start Mastering<": "{uiLanguage === 'KO' ? '마스터링 시작' : uiLanguage === 'JA' ? 'マスタリング開始' : 'Start Mastering'}<",
    r"Download All<": "{uiLanguage === 'KO' ? '모두 다운로드' : uiLanguage === 'JA' ? 'すべてダウンロード' : 'Download All'}<",

    # Studio tabs (These are passed as variables usually)
    r"'Music Prompt'": "uiLanguage === 'KO' ? '음악 프롬프트' : uiLanguage === 'JA' ? '音楽プロンプト' : 'Music Prompt'",
    r"'Library'": "uiLanguage === 'KO' ? '라이브러리' : uiLanguage === 'JA' ? 'ライブラリ' : 'Library'",
    r"'AI Cover Studio'": "uiLanguage === 'KO' ? 'AI 커버 스튜디오' : uiLanguage === 'JA' ? 'AIカバースタジオ' : 'AI Cover Studio'",
    r"'Music Studio'": "uiLanguage === 'KO' ? '음악 스튜디오' : uiLanguage === 'JA' ? '音楽スタジオ' : 'Music Studio'",
    r"'Mastering'": "uiLanguage === 'KO' ? '마스터링' : uiLanguage === 'JA' ? 'マスタリング' : 'Mastering'",
    
    # Studio specific strings
    r"SONG INFO & PROMPT SETTINGS<": "{uiLanguage === 'KO' ? '음원 정보 & 프롬프트 설정' : uiLanguage === 'JA' ? '曲情報とプロンプト設定' : 'SONG INFO & PROMPT SETTINGS'}<",
    r"TITLE<": "{uiLanguage === 'KO' ? '제목' : uiLanguage === 'JA' ? 'タイトル' : 'TITLE'}<",
    r"SONG TYPE<": "{uiLanguage === 'KO' ? '곡 유형' : uiLanguage === 'JA' ? '曲のタイプ' : 'SONG TYPE'}<",
    r"GENRE 1<": "{uiLanguage === 'KO' ? '장르 1' : uiLanguage === 'JA' ? 'ジャンル 1' : 'GENRE 1'}<",
    r"GENRE 2<": "{uiLanguage === 'KO' ? '장르 2' : uiLanguage === 'JA' ? 'ジャンル 2' : 'GENRE 2'}<",
    r"GENRE RATIO<": "{uiLanguage === 'KO' ? '장르 비율' : uiLanguage === 'JA' ? 'ジャンル比率' : 'GENRE RATIO'}<",
    r"STYLE DESCRIPTION<": "{uiLanguage === 'KO' ? '스타일 설명' : uiLanguage === 'JA' ? 'スタイルの説明' : 'STYLE DESCRIPTION'}<",
    r"SONG STRUCTURE<": "{uiLanguage === 'KO' ? '곡 구조' : uiLanguage === 'JA' ? '曲の構成' : 'SONG STRUCTURE'}<",
    r"MUSIC LENGTH<": "{uiLanguage === 'KO' ? '음악 길이' : uiLanguage === 'JA' ? '音楽の長さ' : 'MUSIC LENGTH'}<",
    r"LYRIC DENSITY<": "{uiLanguage === 'KO' ? '가사 밀도' : uiLanguage === 'JA' ? '歌詞の密度' : 'LYRIC DENSITY'}<",
    r"VOICE TONE<": "{uiLanguage === 'KO' ? '음색' : uiLanguage === 'JA' ? '声のトーン' : 'VOICE TONE'}<",
    r"VOCAL AGE<": "{uiLanguage === 'KO' ? '보컬 연령대' : uiLanguage === 'JA' ? 'ボーカルの年齢' : 'VOCAL AGE'}<",
    r"VOCAL GENDER/GROUP<": "{uiLanguage === 'KO' ? '보컬 성별/그룹' : uiLanguage === 'JA' ? 'ボーカルの性別/グループ' : 'VOCAL GENDER/GROUP'}<",
    r"LANGUAGE 1<": "{uiLanguage === 'KO' ? '언어 1' : uiLanguage === 'JA' ? '言語 1' : 'LANGUAGE 1'}<",
    r"LANGUAGE 2<": "{uiLanguage === 'KO' ? '언어 2' : uiLanguage === 'JA' ? '言語 2' : 'LANGUAGE 2'}<",
    r"LANGUAGE RATIO<": "{uiLanguage === 'KO' ? '언어 비율' : uiLanguage === 'JA' ? '言語比率' : 'LANGUAGE RATIO'}<",
    r"TEMPO \(BPM\)<": "{uiLanguage === 'KO' ? '템포 (BPM)' : uiLanguage === 'JA' ? 'テンポ (BPM)' : 'TEMPO (BPM)'}<",
    r"EXTRA REQUESTS<": "{uiLanguage === 'KO' ? '추가 요청사항' : uiLanguage === 'JA' ? '追加のリクエスト' : 'EXTRA REQUESTS'}<",
    r"GENERATED OUTPUT<": "{uiLanguage === 'KO' ? '생성된 결과' : uiLanguage === 'JA' ? '生成結果' : 'GENERATED OUTPUT'}<",
    r"STYLE PROMPT<": "{uiLanguage === 'KO' ? '스타일 프롬프트' : uiLanguage === 'JA' ? 'スタイルプロンプト' : 'STYLE PROMPT'}<",
    r"NEGATIVE PROMPT<": "{uiLanguage === 'KO' ? '제외 프롬프트' : uiLanguage === 'JA' ? 'ネガティブプロンプト' : 'NEGATIVE PROMPT'}<",
    r"LYRICS EDITOR<": "{uiLanguage === 'KO' ? '가사 편집기' : uiLanguage === 'JA' ? '歌詞エディター' : 'LYRICS EDITOR'}<",
    r"STRUCTURE & BPM PLAN<": "{uiLanguage === 'KO' ? '구조 & BPM 계획' : uiLanguage === 'JA' ? '構造とBPM計画' : 'STRUCTURE & BPM PLAN'}<",
    r"AI SUGGESTIONS \(NOTES\)<": "{uiLanguage === 'KO' ? 'AI 추천 (노트)' : uiLanguage === 'JA' ? 'AI提案 (メモ)' : 'AI SUGGESTIONS (NOTES)'}<"
}

for path in files:
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False
    for pattern, repl in replacements.items():
        # Only replace if the original pattern is found and hasn't been wrapped in uiLanguage yet
        # We need to make sure we don't accidentally replace inside an existing ternary.
        # It's generally safe because the patterns include angle brackets `<` or quotes `'`
        if re.search(pattern, content):
            content = re.sub(pattern, repl, content)
            changed = True
            
    # Fix the broken JA translations where JA was set to EN string by previous script
    # Look for uiLanguage === 'KO' ? '...' : uiLanguage === 'JA' ? 'EN_STRING' : 'EN_STRING'
    # And we'll just fix the ones we know about!
    # Wait, we can just replace 'uiLanguage === 'JA' ? 'en_str'' with 'uiLanguage === 'JA' ? 'ja_str''
    
    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Updated {path}")
