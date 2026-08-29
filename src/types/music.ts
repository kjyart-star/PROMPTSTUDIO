export type ReleaseType = 'single' | 'ep' | 'lp' | 'compilation' | 'playlist';
export type Status = 'draft' | 'published' | 'archived';

export interface Artist {
  id: string;
  slug: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  links: Record<string, any> | null;
  is_ai_generated: boolean;
  owner_user_id: string | null;
  created_at: string;
  updated_at: string;
  album_count?: number;
  followers?: number;
  is_user?: boolean;
}

export interface Album {
  id: string;
  slug: string;
  artist_id: string;
  title: string;
  release_type: ReleaseType;
  cover_url: string | null;
  release_date: string | null;
  genres: string[];
  moods: string[];
  description: string | null;
  status: Status;
  generation_tool: string | null;
  total_plays: number;
  total_likes: number;
  created_at: string;
  updated_at: string;
  artist?: Artist;
  track_count?: number;
}

export interface Track {
  id: string;
  album_id: string;
  track_number: number;
  title: string;
  duration_sec: number | null;
  file_url: string;
  /** file_url 이 서명 URL로 교체되기 전의 원본 스토리지 경로. 최근 재생 캐시에서 재서명하는 데 쓴다. */
  raw_file_url?: string;
  file_size: number | null;
  waveform_data: any | null;
  lyrics: string | null;
  style_prompt: string | null;
  bpm: number | null;
  song_key: string | null;
  prompt_meta: Record<string, any> | null;
  play_count: number;
  like_count: number;
  status: Status;
  created_at: string;
  updated_at: string;
  album?: Album;
  lyricist?: string;
  composer?: string;
  arranger?: string;
  image_url?: string;
  rank?: number;
}
