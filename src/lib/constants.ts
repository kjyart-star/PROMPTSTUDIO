export interface Genre {
  name: string;
  korean: string;
  color: string;
  q: string;
  image: string;
}

export const GENRES: Genre[] = [
  { name: 'K-Pop', korean: '케이팝', color: 'bg-[#ff9432]', q: 'k-pop', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Pop', korean: '팝', color: 'bg-[#e133ff]', q: 'pop', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Hip Hop', korean: '힙합', color: 'bg-[#a21caf]', q: 'hip hop', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'R&B', korean: '알앤비', color: 'bg-[#1db954]', q: 'r&b', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Dance', korean: '댄스', color: 'bg-[#ec4899]', q: 'dance', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Electronic', korean: '일렉트로닉', color: 'bg-[#1dbbff]', q: 'electronic', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Rock', korean: '록', color: 'bg-[#ff9432]', q: 'rock', image: 'https://images.unsplash.com/photo-1482440308425-276ad0f28b19?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Indie Rock', korean: '인디 록', color: 'bg-[#4338ca]', q: 'indie rock', image: 'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'J-Pop', korean: '제이팝', color: 'bg-[#ea3a60]', q: 'j-pop', image: 'https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'City Pop', korean: '시티팝', color: 'bg-[#14b8a6]', q: 'city pop', image: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Jazz', korean: '재즈', color: 'bg-[#4f46e5]', q: 'jazz', image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Classical', korean: '클래식', color: 'bg-[#b45309]', q: 'classical', image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Ambient', korean: '앰비언트', color: 'bg-[#0369a1]', q: 'ambient', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Chill', korean: '칠아웃', color: 'bg-[#1db954]', q: 'chill', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Soundtrack', korean: '사운드트랙', color: 'bg-[#312e81]', q: 'soundtrack', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Animation', korean: '애니메이션', color: 'bg-[#ff5e3a]', q: 'animation', image: 'https://images.unsplash.com/photo-1541562232579-512a21360020?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Trot', korean: '트로트', color: 'bg-[#fbbf24]', q: 'trot', image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Blues', korean: '블루스', color: 'bg-[#0f172a]', q: 'blues', image: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Country', korean: '컨트리', color: 'bg-[#509bf5]', q: 'country', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Latin', korean: '라틴', color: 'bg-[#ff2a5f]', q: 'latin', image: 'https://images.unsplash.com/photo-1511192336575-5a79af67a629?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Afrobeats', korean: '아프로비트', color: 'bg-[#1c1c1c]', q: 'afrobeats', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Shoegaze', korean: '슈게이징', color: 'bg-[#7c3aed]', q: 'shoegaze', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Experimental', korean: '실험 음악', color: 'bg-[#65a30d]', q: 'experimental', image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Alternative', korean: '얼터너티브', color: 'bg-[#db2777]', q: 'alternative', image: 'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Folk', korean: '포크', color: 'bg-[#0891b2]', q: 'folk', image: 'https://images.unsplash.com/photo-1498038432885-c6f3f1b912ee?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'House', korean: '하우스', color: 'bg-[#ea580c]', q: 'house', image: 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Punk', korean: '펑크', color: 'bg-[#dc2626]', q: 'punk', image: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Reggae', korean: '레게', color: 'bg-[#15803d]', q: 'reggae', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Hyperpop', korean: '하이퍼팝', color: 'bg-[#f43f5e]', q: 'hyperpop', image: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Metal', korean: '메탈', color: 'bg-[#1e293b]', q: 'metal', image: 'https://images.unsplash.com/photo-1524368535928-5b5e00ddc76b?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Funk Soul', korean: '펑크 소울', color: 'bg-[#b45309]', q: 'funk soul', image: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Gospel', korean: '가스펠', color: 'bg-[#ff4632]', q: 'gospel', image: 'https://images.unsplash.com/photo-1510915228340-29c85a43dcfe?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Podcasts', korean: '팟캐스트', color: 'bg-[#509bf5]', q: 'podcasts', image: 'https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=200&h=200&q=80' },
  { name: 'Other', korean: '기타', color: 'bg-[#6b7280]', q: 'other', image: 'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=200&h=200&q=80' }
];
