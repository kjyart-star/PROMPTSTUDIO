import type { LibrarySong } from '../mastering/store'
import { fetchSongBlob } from '../mastering/actions'
import { decodeToChannels } from '@/lib/cinema/render'
import type { CinemaLyrics } from '@/lib/cinema/lyrics'
import type { CinemaSettings } from '@/lib/cinema/render'
import { withBase } from '@/lib/basePath'

export interface CTrack {
  id: string
  title: string
  song?: LibrarySong
  file?: File
  duration: number
  lyricsRaw: string
  lyrics: CinemaLyrics
}

export const DEFAULT_SETTINGS: CinemaSettings & { name: string; saveMode: 'download' | 'file' } = {
  name: '',
  aspect: '16:9', shortSide: 1080, fps: 30, loops: 1, lufsTarget: -14,
  templateId: 'cinema-flow', shape: 'ring-line', paletteId: 'rainbow',
  headline: '', kind: 'lyrics', saveMode: 'download',
}
export type FullSettings = typeof DEFAULT_SETTINGS

// 곡 파일·커버는 최근 몇 개만 메모리에 둔다(긴 재생목록에서 전부 쌓지 않는다)
const blobCache = new Map<string, Blob>()
const coverCache = new Map<string, Blob | null>()
const KEEP = 4
function remember<T>(m: Map<string, T>, k: string, v: T) { m.delete(k); m.set(k, v); while (m.size > KEEP) m.delete(m.keys().next().value as string) }

export async function loadAudioBlob(t: CTrack): Promise<Blob> {
  const hit = blobCache.get(t.id)
  if (hit) return hit
  const b = t.file ? t.file : await fetchSongBlob(t.song!)
  remember(blobCache, t.id, b)
  return b
}

/** 예시 앨범아트(public/cinema/covers). 곡에 커버가 없을 때 곡마다 고정된 한 장을 기본 커버로 쓴다. */
export interface SampleCover { id: string; file: string; mood: string }
let sampleList: Promise<SampleCover[]> | null = null
export function loadSampleCovers(): Promise<SampleCover[]> {
  sampleList ??= fetch(withBase('/cinema/covers/index.json')).then(r => (r.ok ? r.json() : [])).catch(() => [])
  return sampleList
}
export async function loadSampleCoverBlob(id: string | number): Promise<Blob | null> {
  try {
    const list = await loadSampleCovers()
    if (!list.length) return null
    const c = typeof id === 'number' ? list[id % list.length] : list.find(x => x.id === id) ?? list[0]
    const r = await fetch(withBase(`/cinema/covers/${c.file}`))
    return r.ok ? await r.blob() : null
  } catch { return null }
}
function hashIdx(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h }

export async function loadCoverBlob(t: CTrack): Promise<Blob | null> {
  if (coverCache.has(t.id)) return coverCache.get(t.id)!
  let b: Blob | null = null
  const url = t.song?.image_url
  if (url) {
    try {
      const r = await fetch(/^https?:|^data:|^blob:/.test(url) ? url : withBase(url), { cache: 'no-store' })
      if (r.ok) { const x = await r.blob(); if (x.type.startsWith('image/')) b = x }
    } catch { b = null }
  }
  if (!b) b = await loadSampleCoverBlob(hashIdx(t.id))
  remember(coverCache, t.id, b)
  return b
}

export async function probeDuration(t: CTrack): Promise<number> {
  const ch = await decodeToChannels(await loadAudioBlob(t))
  return ch[0].length / 48000
}

export function newId(): string { return crypto.randomUUID() }
