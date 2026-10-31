import { withBase } from '@/lib/basePath'
import { lyricsOfItem, lrcOfItem, styleOfItem } from '@/lib/studio/lyricsOf'
import type { Track } from '@/types/music'

/** 곡 기록(song_history 행)에서 재생 주소로 쓸 값 — 없으면 재생할 수 없는 곡 */
export const historyAudioPath = (item: any): string => item?.audio_url || item?.stream_url || item?.url || ''

interface QueueOpts {
  artistName: string
  slug: string
  avatarUrl?: string | null
}

/**
 * 곡 기록 → 플레이어 Track.
 * fileUrl 을 주지 않으면 저장소 경로를 그대로 둔다 — 플레이어가 그 곡 차례가 될 때 서버 서명 라우트로 주소를 받는다(지연 해석).
 */
export function historyItemToTrack(item: any, opts: QueueOpts, fileUrl?: string, all?: any[]): Track {
  const path = historyAudioPath(item)
  const cover = item.image_url || withBase('/default-album.png')
  return {
    id: item.id,
    title: item.title || 'Untitled Track',
    file_url: fileUrl || path,
    raw_file_url: /^https?:/i.test(path) ? undefined : path,
    duration_sec: 180,
    lyrics: lyricsOfItem(item, all) || null,
    lrc: lrcOfItem(item, all),
    style_prompt: styleOfItem(item) || null,
    album_id: 'studio-generated',
    image_url: cover,
    album: {
      id: 'studio-generated',
      title: 'Studio Generation',
      cover_url: cover,
      artist: {
        name: item.artist || opts.artistName,
        slug: opts.slug,
        avatar_url: opts.avatarUrl || withBase('/default-album.png'),
        bio: 'AI Artist',
      },
    },
  } as unknown as Track
}

/** 보이는 목록 전체를 대기열로 — 휴지통 곡·주소 없는 곡은 뺀다 */
export function buildHistoryQueue(items: any[], opts: QueueOpts): Track[] {
  return items
    .filter((it) => it && !it.trashed_at && historyAudioPath(it))
    .map((it) => historyItemToTrack(it, opts, undefined, items))
}

/** 누른 곡은 이미 받은 재생 주소로, 나머지는 지연 해석 상태로 넣은 대기열 */
export function queueWithPlayable(queue: Track[], current: Track): Track[] {
  const has = queue.some((t) => t.id === current.id)
  return has ? queue.map((t) => (t.id === current.id ? { ...current, lyrics: current.lyrics || t.lyrics, style_prompt: current.style_prompt || t.style_prompt } : t)) : [current, ...queue]
}
