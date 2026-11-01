import { LRC_AUTO_VERSION, LRC_GPU_MODEL, lyricsOfItem } from '@/lib/studio/lyricsOf'

/** 현재 판으로 맞추다 믿을 수 없어 접은 곡(다시 시도하지 않는다 — 판을 올리면 다시 맞춘다) */
export const gpuFailed = (f: any) => Number(f?.lrc_auto_fail?.v) === LRC_AUTO_VERSION
import { alignLineTexts } from './lrcValidate'

/**
 * 회사 PC 가사 정렬 워커(사전 계산)용 작업 목록 — 운영 DB 의 가사 있는 모든 곡(공개·비공개) 중
 * 아직 GPU 정렬(현재 판)을 받지 못한 곡을 최신순으로 고른다. 사용자가 올린 시간표(lrc_by='user')가 있는 곡은 건너뛴다.
 * 브라우저가 계산해 둔 결과(같은 판이라도 모델이 다름)는 GPU 결과로 다시 덮는다.
 */
export interface LrcJob {
  id: string
  title: string
  /** 원본 audio_url(절대 주소 또는 저장소 경로) — 라우트가 내려받을 수 있는 주소로 바꾼다 */
  audio: string
  is_published: boolean
  lines: string[]
  duration: number | null
}

export function gpuDone(f: any): boolean {
  return f?.lrc_auto_v === LRC_AUTO_VERSION && f?.lrc_auto_model === LRC_GPU_MODEL && Array.isArray(f?.lrc_auto) && f.lrc_auto.length >= 2
}

export function hasUserLrc(f: any): boolean {
  return f?.lrc_by === 'user' && Array.isArray(f?.lrc) && f.lrc.length >= 2
}

export function lrcJobsOf(rows: any[]): { jobs: LrcJob[]; total: number; done: number; failed: number } {
  const jobs: LrcJob[] = []
  let total = 0
  let done = 0
  let failed = 0
  const sorted = [...rows].sort((a, b) => String(b?.created_at ?? '').localeCompare(String(a?.created_at ?? '')))
  for (const it of sorted) {
    if (!it?.id || it.trashed_at || it.status === 'processing' || !it.audio_url) continue
    const f = it.form
    if (hasUserLrc(f)) continue
    const lines = alignLineTexts(lyricsOfItem(it, rows))
    if (lines.length < 2) continue
    total++
    if (gpuDone(f)) { done++; continue }
    if (gpuFailed(f)) { failed++; continue }
    jobs.push({
      id: it.id, title: String(it.title ?? ''), audio: String(it.audio_url), is_published: !!it.is_published, lines,
      duration: Number(f?.duration_sec ?? f?.duration) || null,
    })
  }
  return { jobs, total, done, failed }
}
