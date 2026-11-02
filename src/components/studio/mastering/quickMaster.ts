import { lyricsOfItem } from '@/lib/studio/lyricsOf'
import { withBase } from '@/lib/basePath'
import { createClient } from '@/lib/supabase/client'
import { analyzeAudio } from '@/lib/mastering/analyze'
import { masterToTarget } from '@/lib/mastering/automaster'
import { composeChoice, recommendGenres, type TextureId, type UseId } from '@/lib/mastering/compose'
import type { MasterTemplate } from '@/lib/mastering/templates'
import type { ChainParams } from '@/lib/mastering/dsp'
import { sourceSampleRate } from '@/lib/mastering/sniffRate'
import { withAiClean, type AiCleanMode } from '@/lib/mastering/aiclean'
import { releaseCheck, type CheckItem } from '@/lib/mastering/releaseCheck'
import { newTrack, type LibrarySong } from './store'
import { cancelRef, decodeTrack, fetchSongBlob, measureFile, renderChecked, renderTrackFile, type ExportOpts } from './actions'

/** 간단 마스터링 선택지 — 화면 문구는 QuickMasterDialog 에 있다 */
/** 음량 3단 — 조용하게·보통·크게 (대략의 LUFS 는 화면에 작게) */
export const QUICK_LOUDNESS = [
  { id: 'quiet', label: '조용하게', lufs: -14 },
  { id: 'normal', label: '보통', lufs: -12 },
  { id: 'loud', label: '크게', lufs: -9 },
] as const
export type QuickLoudness = (typeof QUICK_LOUDNESS)[number]['id']
export const QUICK_LUFS = QUICK_LOUDNESS.map(l => l.lufs)
export const QUICK_PEAK = [-2, -1, -0.5, 0] as const
export const QUICK_TONES = ['balanced', 'clear', 'warm', 'punch'] as const
export type QuickTone = (typeof QUICK_TONES)[number]

/** 용도 한 줄 — 고르면 어울리는 음량이 먼저 골라진다(바꿀 수 있다) */
export const QUICK_USES: { id: UseId; label: string; plain: string; loud: QuickLoudness }[] = [
  { id: 'use-stream', label: '음원 스트리밍', plain: '음원 사이트에서 다른 곡과 비슷한 크기로', loud: 'quiet' },
  { id: 'use-video', label: '동영상', plain: '노트북·폰 스피커에서도 또렷하게', loud: 'quiet' },
  { id: 'use-shorts', label: '짧은 영상', plain: '폰 스피커에서도 저음이 느껴지게', loud: 'loud' },
  { id: 'use-bgm', label: '영상 배경음악', plain: '말소리가 묻히지 않게 가운데를 비워 둬요', loud: 'quiet' },
  { id: 'use-club', label: '클럽 · DJ', plain: '큰 스피커에서 단단하고 크게', loud: 'loud' },
  { id: 'use-cd', label: 'CD · 음반', plain: '음반처럼 꽉 차게', loud: 'loud' },
]

const TEXTURE: Record<QuickTone, TextureId | null> = { balanced: null, clear: 'tex-clean', warm: 'tex-warm', punch: 'tex-punch' }

/** 고른 음량·피크를 템플릿에 덮어쓴다 — 리미터 천장도 같이 맞추고, AI 곡이면 체인 맨 앞에서 고음을 정리한다 */
export function quickTemplate(genre: string, tone: QuickTone, lufs: number, tp: number, use: UseId = 'use-stream', aiClean: AiCleanMode | null = null): MasterTemplate {
  const base = composeChoice({ use, genre, texture: TEXTURE[tone] } as Parameters<typeof composeChoice>[0])
  return {
    ...base, id: `quick:${use}:${genre}:${tone}:${lufs}:${tp}:${aiClean ?? 'off'}`, lufs, tp,
    build: () => { const c = base.build(); c.limiter.ceiling = tp; return aiClean ? withAiClean(c, aiClean) : c },
  }
}

export interface QuickOptions { lufs: number; tp: number; tone: QuickTone; use?: UseId; aiClean?: AiCleanMode | null }

export interface QuickResult {
  id: string; title: string; integrated: number; truePeak: number; targetLufs: number
  /** 같은 처리 결과를 브라우저에서 WAV 로 만들어 돌려준다 — 업로드 없음, 내려받기 전용 */
  makeWav: (onProgress?: (p: number) => void) => Promise<Blob>
  /** 내보내기 전 자동 검수 6항목(마스터링 결과) */
  checks: CheckItem[]
  /** 원곡 점검(비교용) */
  srcChecks: CheckItem[]
  /** 자동으로 한 번 다시 처리했으면 바꾼 내용 */
  retried: string[]
  /** AI 곡 고음 정리가 가장 많이 줄인 양(dB, 0 이하) — 켜지 않았으면 null */
  aiCleanMaxCut: number | null
  /** 전후 비교 재생용 — 원곡과 마스터링본, 각각의 통합 음량 */
  srcBlob: Blob; outBlob: Blob; srcIntegrated: number
  /** 「고급 마스터링에서 이어서」로 넘길 설정 */
  params: ChainParams
  options: QuickOptions & { genre: string }
}

/**
 * 원곡은 그대로 두고 별도 MP3(320kbps)로 마스터링해 보관함에 새 곡으로 올린다. 샘플레이트는 원본(44.1/48kHz)을 따른다.
 * 처리는 전부 브라우저에서 한다(분석·렌더는 Web Worker, 서버 비용 0). 저장 전에 자동 검수하고 문제가 있으면 한 번 다시 만든다.
 */
export async function quickMaster(
  song: LibrarySong & { form?: any },
  opt: QuickOptions,
  onProgress: (label: string, p: number) => void,
): Promise<QuickResult> {
  cancelRef.cancelled = false
  const use = opt.use ?? 'use-stream'
  const aiClean = opt.aiClean ?? null
  onProgress('곡을 불러오는 중', 0.02)
  const blob = await fetchSongBlob(song)
  const t = newTrack({ title: song.title || '제목 없음', source: 'library', blob, song })
  const dec = await decodeTrack(t)
  onProgress('곡을 분석하는 중', 0.1)
  const a = await analyzeAudio(dec.channels, dec.sampleRate, { harsh: true, onProgress: p => onProgress('곡을 분석하는 중', 0.1 + p * 0.15) })
  const genre = recommendGenres(a, 1)[0]?.id ?? 'pop'
  const tpl = quickTemplate(genre, opt.tone, opt.lufs, opt.tp, use, aiClean)
  onProgress('목표 음량에 맞추는 중', 0.25)
  const res = await masterToTarget(dec.channels, dec.sampleRate, a, tpl, { onProgress: p => onProgress('목표 음량에 맞추는 중', 0.25 + p * 0.3) })
  const rate = await sourceSampleRate(blob)
  const opts: ExportOpts = { format: 'mp3', bits: 24, rate, dither: 'tpdf', range: 'all' }
  onProgress('MP3 파일 만들고 점검하는 중', 0.55)
  // 인코딩 뒤 다시 풀어 6항목을 재고, 문제가 있으면 설정을 고쳐 한 번 더 만든다(renderChecked)
  const ck = await renderChecked(t, opts, p => onProgress('MP3 파일 만들고 점검하는 중', 0.55 + p * 0.37), { params: res.params, target: { lufs: res.targetLufs, tp: opt.tp } })
  const out = ck.out
  const rep = await measureFile(out.blob, `${t.title}.${out.ext}`, { ...opts, format: out.ext }, { id: 'quick', label: '간단 마스터링', lufs: ck.target.lufs, tp: opt.tp }, ck.analysis)
  onProgress('보관함에 올리는 중', 0.93)
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
      form: { ...(song.form?.instrumentalOnly !== undefined ? { instrumentalOnly: song.form.instrumentalOnly } : {}), kind: 'mastering', source_id: song.id, target_lufs: ck.target.lufs, ceiling: opt.tp, tone: opt.tone, use, ai_clean: aiClean ?? 'off' },
    }),
  })
  if (!save.ok) throw new Error('save')
  const row = await save.json().catch(() => ({}))
  onProgress('완료', 1)
  const params = ck.params
  const makeWav = async (p?: (x: number) => void) => (await renderTrackFile(t, { ...opts, format: 'wav' }, x => p?.(x), { params })).blob
  return {
    id: row.id, title, integrated: rep.integrated, truePeak: rep.truePeak, targetLufs: ck.target.lufs, makeWav,
    checks: ck.checks, srcChecks: releaseCheck(a, null), retried: ck.retried,
    aiCleanMaxCut: aiClean ? out.aiCleanMaxCut ?? 0 : null,
    srcBlob: blob, outBlob: out.blob, srcIntegrated: a.integrated,
    params, options: { ...opt, use, aiClean, genre },
  }
}
