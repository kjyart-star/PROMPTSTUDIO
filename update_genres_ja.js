const fs = require('fs');

const file = 'src/lib/constants.ts';
let code = fs.readFileSync(file, 'utf8');

const GENRE_MAP_JA = {
  'All': 'すべて', 'Pop': 'ポップ', 'K-Pop': 'K-POP', 'J-Pop': 'J-POP', 'Gospel': 'ゴスペル', 
  'Electronic': 'エレクトロニック', 'Rock': 'ロック', 'R&B': 'R&B', 'Country': 'カントリー', 
  'Latin': 'ラテン', 'Afrobeats': 'アフロビーツ', 'Shoegaze': 'シューゲイザー', 'Experimental': '実験音楽', 
  'Alternative': 'オルタナティヴ', 'Folk': 'フォーク', 'Jazz': 'ジャズ', 'Blues': 'ブルース', 
  'House': 'ハウス', 'Punk': 'パンク', 'Dance': 'ダンス', 'Indie Rock': 'インディーロック', 
  'Hip Hop': 'ヒップホップ', 'Reggae': 'レゲエ', 'Hyperpop': 'ハイパーポップ', 'Metal': 'メタル', 
  'Funk Soul': 'ファンク/ソウル', 'Soundtrack': 'サントラ', 'Classical': 'クラシック', 
  'Ambient': 'アンビエント', 'Chill': 'チルアウト', 'Podcasts': 'ポッドキャスト',
  'Animation': 'アニメ', 'City Pop': 'シティ・ポップ', 'Trot': 'トロット', 'Other': 'その他'
};

// 1. Update interface
if (!code.includes('japanese: string;')) {
  code = code.replace(/korean: string;/g, 'korean: string;\n  japanese: string;');
}

// 2. Add japanese: '...' to each genre object
for (const [name, ja] of Object.entries(GENRE_MAP_JA)) {
  if (name === 'All') continue;
  const regex = new RegExp(`({ name: '${name}', korean: '.*?',) (color: '.*?')`, 'g');
  if (code.match(regex)) {
      if (!code.includes(`japanese: '${ja}'`)) {
          code = code.replace(regex, `$1 japanese: '${ja}', $2`);
      }
  }
}

fs.writeFileSync(file, code);
console.log('Updated constants.ts with Japanese genres');
