const fs = require('fs');

function replaceFile(file, replacements) {
  let code = fs.readFileSync(file, 'utf8');
  for (const [target, replacement] of Object.entries(replacements)) {
    code = code.split(target).join(replacement);
  }
  fs.writeFileSync(file, code);
}

const studioReplacements = {
  "uiLanguage === 'JA' ? '歌詞の密度' : '가사 분량'": "uiLanguage === 'JA' ? '歌詞の密度' : 'Lyrics Density'",
  "uiLanguage === 'JA' ? 'ボーカルのトーン' : '보이스 톤'": "uiLanguage === 'JA' ? 'ボーカルのトーン' : 'Vocal Tone'",
  "uiLanguage === 'JA' ? 'ボーカルの年齢' : '보컬 나이'": "uiLanguage === 'JA' ? 'ボーカルの年齢' : 'Vocal Age'",
  "uiLanguage === 'JA' ? 'ボーカルの性別/編成' : '보컬 젠더/구성'": "uiLanguage === 'JA' ? 'ボーカルの性別/編成' : 'Vocal Gender/Format'",
  "uiLanguage === 'JA' ? '言語 1' : '언어 1'": "uiLanguage === 'JA' ? '言語 1' : 'Language 1'",
  "uiLanguage === 'JA' ? '言語 2' : '언어 2'": "uiLanguage === 'JA' ? '言語 2' : 'Language 2'",
  "uiLanguage === 'JA' ? '言語比率' : '언어 비중'": "uiLanguage === 'JA' ? '言語比率' : 'Language Ratio'",
  "uiLanguage === 'JA' ? '構成 & BPM計画' : '곡 구조 설계 (마디수/BPM)'": "uiLanguage === 'JA' ? '構成 & BPM計画' : 'Structure & BPM Plan'",
  "uiLanguage === 'JA' ? 'お気に入りの曲' : '좋아요 표시한 음악'": "uiLanguage === 'JA' ? 'お気に入りの曲' : 'Liked Songs'",
  "uiLanguage === 'JA' ? '番号' : '번호'": "uiLanguage === 'JA' ? '番号' : 'No.'",
  "uiLanguage === 'JA' ? '作成日' : '작성일'": "uiLanguage === 'JA' ? '作成日' : 'Created At'",
  "uiLanguage === 'JA' ? 'タイトル' : '제목'": "uiLanguage === 'JA' ? 'タイトル' : 'Title'",
  "uiLanguage === 'JA' ? 'スタイルの説明 (STYLE DESCRIPTION)' : '스타일 설명 (STYLE DESCRIPTION)'": "uiLanguage === 'JA' ? 'スタイルの説明 (STYLE DESCRIPTION)' : 'STYLE DESCRIPTION'",
  "uiLanguage === 'JA' ? '言語' : '언어'": "uiLanguage === 'JA' ? '言語' : 'Language'",
  "uiLanguage === 'JA' ? '再生時間' : '재생 시간'": "uiLanguage === 'JA' ? '再生時間' : 'Duration'",
  "uiLanguage === 'JA' ? 'いいね' : '좋아요'": "uiLanguage === 'JA' ? 'いいね' : 'Like'",
  "uiLanguage === 'JA' ? '公開' : '공개 여부'": "uiLanguage === 'JA' ? '公開' : 'Public/Private'",
  "uiLanguage === 'JA' ? '管理' : '관리'": "uiLanguage === 'JA' ? '管理' : 'Manage'",
  "uiLanguage === 'JA' ? 'メインプロフィール (チャンネルなし)' : '메인 프로필 (채널 없음)'": "uiLanguage === 'JA' ? 'メインプロフィール (チャンネルなし)' : 'Main Profile (No Channel)'",
  "uiLanguage === 'JA' ? 'ジャンルを選択' : '장르 선택'": "uiLanguage === 'JA' ? 'ジャンルを選択' : 'Select Genre'"
};

replaceFile('src/components/studio/StudioClient.tsx', studioReplacements);

const masteringReplacements = {
  "uiLanguage === 'JA' ? '暖かさ' : '저역'": "uiLanguage === 'JA' ? '暖かさ' : 'Low'",
  "uiLanguage === 'JA' ? 'サチュレーション & 広がり' : '새츄레이션 & 공간감'": "uiLanguage === 'JA' ? 'サチュレーション & 広がり' : 'Saturation & Width'",
  "uiLanguage === 'JA' ? '真空管の暖かみ' : '진공관 따뜻함'": "uiLanguage === 'JA' ? '真空管の暖かみ' : 'Tube Warmth'",
  "uiLanguage === 'JA' ? 'アナログ真空管の高調波増幅 (温かみのある質感)' : '아날로그 진공관 배음 증폭 (따뜻하고 묵직한 질감)'": "uiLanguage === 'JA' ? 'アナログ真空管の高調波増幅 (温かみのある質感)' : 'Analog tube harmonic amplification (warm and heavy texture)'",
  "uiLanguage === 'JA' ? 'ステレオ拡張' : '스테레오 확장'": "uiLanguage === 'JA' ? 'ステレオ拡張' : 'Stereo Width'",
  "uiLanguage === 'JA' ? 'ステレオ幅を拡張して空間感を最大化' : '좌우 위상 확장으로 공간감 극대화'": "uiLanguage === 'JA' ? 'ステレオ幅を拡張して空間感を最大化' : 'Maximize spatial feel by expanding stereo phase'",
  "uiLanguage === 'JA' ? 'ダイナミクス' : '다이내믹스'": "uiLanguage === 'JA' ? 'ダイナミクス' : 'Dynamics'",
  "uiLanguage === 'JA' ? 'ラウドネス' : '음압'": "uiLanguage === 'JA' ? 'ラウドネス' : 'Loudness'",
  "uiLanguage === 'JA' ? '目標ラウドネス' : '목표 음압 (Loudness Target)'": "uiLanguage === 'JA' ? '目標ラウドネス' : 'Loudness Target'",
  "uiLanguage === 'JA' ? 'ストリーミング標準 (-14 LUFS)' : '스트리밍 기본 (-14 LUFS)'": "uiLanguage === 'JA' ? 'ストリーミング標準 (-14 LUFS)' : 'Streaming Default (-14 LUFS)'",
  "uiLanguage === 'JA' ? 'モダン・ラウド (-10 LUFS)' : '모던 라우드 (-10 LUFS)'": "uiLanguage === 'JA' ? 'モダン・ラウド (-10 LUFS)' : 'Modern Loud (-10 LUFS)'",
  "uiLanguage === 'JA' ? 'エクストリーム・ブースター' : '익스트림 부스터 (Extreme)'": "uiLanguage === 'JA' ? 'エクストリーム・ブースター' : 'Extreme Booster'",
  "uiLanguage === 'JA' ? 'アグレッシブなコンプレッションとゲインブースト' : '공격적인 압축 및 게인 부스트 (음압 극대화)'": "uiLanguage === 'JA' ? 'アグレッシブなコンプレッションとゲインブースト' : 'Aggressive compression and gain boost'",
  "uiLanguage === 'JA' ? 'トゥルーピーク・ガード' : '트루 피크 가드 (True Peak)'": "uiLanguage === 'JA' ? 'トゥルーピーク・ガード' : 'True Peak Guard'",
  "uiLanguage === 'JA' ? '出力のクリッピングを防ぐリミッター' : '출력 전단 클리핑 방지 리미터 적용'": "uiLanguage === 'JA' ? '出力のクリッピングを防ぐリミッター' : 'Limiter to prevent clipping'"
};

replaceFile('src/components/studio/MasteringClient.tsx', masteringReplacements);
