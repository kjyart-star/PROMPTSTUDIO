import { lyricsOfItem } from '@/lib/studio/lyricsOf'
import { withBase } from '@/lib/basePath'
import { createClient } from '@/lib/supabase/client'
import { analyzeAudio } from '@/lib/mastering/analyze'
import { masterToTarget } from '@/lib/mastering/automaster'
import { composeChoice, recommendGenres, type TextureId } from '@/lib/mastering/compose'
import type { MasterTemplate } from '@/lib/mastering/templates'
import { sourceSampleRate } from '@/lib/mastering/sniffRate'
import { newTrack, type LibrarySong } from './store'
import { cancelRef, decodeTrack, fetchSongBlob, measureFile, renderTrackFile, type ExportOpts } from './actions'

/** 간단 마스터링 선택지 — 화면 문구는 QuickMasterDialog 에 있다 */
export const QUICK_LUFS = [-14, -12, -10, -8] as const
export const QUICK_PEAK = [-2, -1, -0.5, 0] as const
export const QUICK_TONES = ['balanced', 'clear', 'warm', 'punch'] as const
export type QuickTone = (typeof QUICK_TONES)[number]

const TEXTURE: Record<QuickTone, TextureId | null> = { balanced: null, clear: 'tex-clean', warm: 'tex-warm', punch: 'tex-punch' }

/** 고른 음량·피크를 템플릿에 덮어쓴다 — 리미터 천장도 같이 맞춘다 */
export function quickTemplate(genre: string, tone: QuickTone, lufs: number, tp: number): MasterTemplate {
  const base = composeChoice({ use: 'use-stream', genre, texture: TEXTURE[tone] } as Parameters<typeof composeChoice>[0])
  return {
    ...base, id: `quick:${genre}:${tone}:${lufs}:${tp}`, lufs, tp,
    build: () => { const c = base.build(); c.limiter.ceiling = tp; return c },
  }
}

export interface QuickResult {
  id: string; title: string; integrated: number; truePeak: number; targetLufs: number
  /** 같은 처리 결과를 브라우저에서 WAV 로 만들어 돌려준다 — 업로드 없음, 내려받기 전용 */
  makeWav: (onProgress?: (p: number) => void) => Promise<Blob>
}

/**
 * 원곡은 그대로 두고 별도 MP3(320kbps)로 마스터링해 보관함에 새 곡으로 올린다. 샘플레이트는 원본(44.1/48kHz)을 따른다. 처리는 전부 브라우저에서 한다(서버 비용 0).
 */
export async function quickMaster(
  song: LibrarySong & { form?: any },
  opt: { lufs: number; tp: number; tone: QuickTone },
  onProgress: (label: string, p: number) => void,
): Promise<QuickResult> {
  cancelRef.cancelled = false
  onProgress('곡을 불러오는 중', 0.02)
  const blob = await fetchSongBlob(song)
  const t = newTrack({ title: song.title || '제목 없음', source: 'library', blob, song })
  const dec = await decodeTrack(t)
  onProgress('곡을 분석하는 중', 0.1)
  const a = await analyzeAudio(dec.channels, dec.sampleRate, { onProgress: p => onProgress('곡을 분석하는 중', 0.1 + p * 0.15) })
  const genre = recommendGenres(a, 1)[0]?.id ?? 'pop'
  const tpl = quickTemplate(genre, opt.tone, opt.lufs, opt.tp)
  onProgress('목표 음량에 맞추는 중', 0.25)
  const res = await masterToTarget(dec.channels, dec.sampleRate, a, tpl, { onProgress: p => onProgress('목표 음량에 맞추는 중', 0.25 + p * 0.35) })
  const rate = await sourceSampleRate(blob)
  const opts: ExportOpts = { format: 'mp3', bits: 24, rate, dither: 'tpdf', range: 'all' }
  onProgress('MP3 파일 만드는 중', 0.6)
  // 인코딩 뒤 다시 풀어 트루 피크·음량을 재고 천장을 넘으면 낮춰 다시 만든다(renderMp3Safe)
  const out = await renderTrackFile(t, opts, p => onProgress('MP3 파일 만드는 중', 0.6 + p * 0.3), { params: res.params })
  const rep = await measureFile(out.blob, `${t.title}.${out.ext}`, { ...opts, format: out.ext })
  onProgress('보관함에 올리는 중', 0.92)
  const r = await fetch(withBase('/api/studio/mastering-upload'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ext: out.ext }) })
  if (r.status === 401) throw new Error('login')
  const up = await r.json()
  if (!r.ok) throw new Error(up.error || 'upload')
  const { error } = await createClient().storage.from('tracks').uploadToSignedUrl(up.path, up.token, out.blob, { contentType: up.contentType })
  if (error) throw error
  const title = `${song.title || '제목 없음'} (마스터링)`
  const save = await fetch(withBase('/api/song-history'), {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      title, prompt: song.prompt ?? '', lyrics: lyricsOfItem(song), genre: song.genre ?? '',
      image_url: song.image_url ?? '', audio_url: up.path, status: 'completed', is_published: false,
      notes: `마스터링본 · ${rep.integrated.toFixed(1)} LUFS · ${rep.truePeak.toFixed(1)} dBTP`,
      form: { ...(song.form?.instrumentalOnly !== undefined ? { instrumentalOnly: song.form.instrumentalOnly } : {}), kind: 'mastering', source_id: song.id, target_lufs: res.targetLufs, ceiling: opt.tp, tone: opt.tone },
    }),
  })
  if (!save.ok) throw new Error('save')
  const row = await save.json().catch(() => ({}))
  onProgress('완료', 1)
  const makeWav = async (p?: (x: number) => void) => (await renderTrackFile(t, { ...opts, format: 'wav' }, x => p?.(x), { params: res.params })).blob
  return { id: row.id, title, integrated: rep.integrated, truePeak: rep.truePeak, targetLufs: res.targetLufs, makeWav }
}
