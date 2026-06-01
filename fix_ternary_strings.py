import re
import os

files = [
    "src/components/profile/ProfileClient.tsx",
    "src/components/studio/StudioClient.tsx",
    "src/components/studio/GenerateClient.tsx",
    "src/components/studio/MasteringClient.tsx",
    "src/components/chart/ChartClient.tsx",
    "src/components/artist/ArtistClient.tsx"
]

corrections = {
    "My Albums": "マイアルバム",
    "Create New Album": "新しいアルバムを作成",
    "Songs": "曲リスト",
    "View More": "もっと見る",
    "Upload Audio": "音源アップロード",
    "Track Info": "曲情報",
    "No.": "番号",
    "Channel / Folder": "チャンネル / フォルダ",
    "Date Added": "登録日",
    "Manage": "管理",
    "Test Channel": "テストチャンネル",
    "Main Channel": "メインチャンネル",
    "Single": "シングル",
    "Album:": "アルバム:",
    "Edit Profile": "プロフィールを編集",
    "Create Channel": "チャンネル作成",
    "BEATZ Ranking": "BEATZ ランキング",
    "Song Chart": "曲チャート",
    "Artist Chart": "アーティストチャート",
    "Daily": "日間",
    "Weekly": "週間",
    "Monthly": "月間",
    "Input Settings": "入力設定 (Input)",
    "Select AI Engine": "AIエンジン選択",
    "Model Version": "モデルバージョン",
    "Custom Mode": "カスタムモード",
    "Instrumental Only": "インストゥルメンタルのみ",
    "Prompt / Lyrics": "プロンプト / 歌詞",
    "Style": "スタイル",
    "Title": "タイトル (Title)",
    "Vocal Gender": "ボーカルの性別",
    "Negative Tags": "除外するタグ (Negative Tags)",
    "Style Weight": "スタイルの強度",
    "Weirdness": "独創性 (Weirdness)",
    "Audio Weight": "オーディオの影響",
    "Reset": "リセット",
    "Generate (10 Credits)": "生成する (10クレジット)",
    "Status & Completed Tracks": "進行状況と完了した曲",
    "SONG INFO & PROMPT SETTINGS": "曲情報とプロンプト設定",
    "TITLE": "タイトル",
    "SONG TYPE": "曲のタイプ",
    "GENRE 1": "ジャンル 1",
    "GENRE 2": "ジャンル 2",
    "GENRE RATIO": "ジャンル比率",
    "STYLE DESCRIPTION": "スタイルの説明",
    "SONG STRUCTURE": "曲の構成",
    "MUSIC LENGTH": "音楽の長さ",
    "LYRIC DENSITY": "歌詞の密度",
    "VOICE TONE": "声のトーン",
    "VOCAL AGE": "ボーカルの年齢",
    "VOCAL GENDER/GROUP": "ボーカルの性別/グループ",
    "LANGUAGE 1": "言語 1",
    "LANGUAGE 2": "言語 2",
    "LANGUAGE RATIO": "言語比率",
    "TEMPO (BPM)": "テンポ (BPM)",
    "EXTRA REQUESTS": "追加のリクエスト",
    "GENERATED OUTPUT": "生成結果",
    "STYLE PROMPT": "スタイルプロンプト",
    "NEGATIVE PROMPT": "ネガティブプロンプト",
    "LYRICS EDITOR": "歌詞エディター",
    "STRUCTURE & BPM PLAN": "構造とBPM計画",
    "AI SUGGESTIONS (NOTES)": "AI提案 (メモ)"
}

for path in files:
    if not os.path.exists(path): continue
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    changed = False
    for en_str, ja_str in corrections.items():
        # Replace instances of uiLanguage === 'JA' ? 'en_str' with uiLanguage === 'JA' ? 'ja_str'
        # Account for both single and double quotes
        pattern1 = f"uiLanguage === 'JA' \\? '{en_str}'"
        repl1 = f"uiLanguage === 'JA' ? '{ja_str}'"
        
        pattern2 = f'uiLanguage === "JA" \\? "{en_str}"'
        repl2 = f'uiLanguage === "JA" ? "{ja_str}"'

        if re.search(pattern1, content):
            content = re.sub(pattern1, repl1, content)
            changed = True
        
        if re.search(pattern2, content):
            content = re.sub(pattern2, repl2, content)
            changed = True

    if changed:
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"Fixed incorrect JA ternary strings in {path}")
