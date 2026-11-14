'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'
import { alignLineTexts } from '@/lib/player/lrcValidate'
import { autoAlign, canAlignForPublish, type AlignOutcome } from '@/lib/player/lyricSyncClient'
import { saveOwnLrc } from '@/lib/player/lrcShareClient'
import LyricTimingEditor from '@/components/studio/LyricTimingEditor'

export type SyncedLine = { t: number; text: string }
type Phase = 'idle' | 'confirm' | 'running' | 'paused'

const MODEL_KEY = 'cm.align-model-ready'
const modelReady = () => { try { return localStorage.getItem(MODEL_KEY) === '1' } catch { return false } }
const markModelReady = () => { try { localStorage.setItem(MODEL_KEY, '1') } catch { /* 저장소 없음 */ } }

/** 실패 원인 → 사용자 안내 */
export function syncErrorMessage(code: string): string {
  switch (code) {
    case 'no-lyrics': return '맞출 가사가 2줄 이상 있어야 해요.'
    case 'no-audio': return '음원을 불러오지 못했어요. 잠시 뒤 다시 시도해 주세요.'
    case 'unsupported': return '이 브라우저에서는 가사 동기화를 쓸 수 없어요. 최신 크롬이나 엣지에서 열어 주세요.'
    case 'login': return '로그인이 필요해요. 로그인한 뒤 다시 시도해 주세요.'
    case 'save': return '가사 시간을 저장하지 못했어요. 네트워크를 확인하고 다시 시도해 주세요.'
    case 'memory': return '이 컴퓨터의 메모리가 부족해 끝내지 못했어요. 다른 탭을 닫고 다시 시도해 주세요.'
    default: return '소리에서 가사 위치를 찾지 못했어요. 목소리가 또렷한 곡인지, 가사가 곡과 같은지 확인해 주세요.'
  }
}

/**
 * 「가사 동기화」 — 지금 곡의 가사 시간표를 이 컴퓨터(브라우저)에서 바로 맞춘다.
 * 무료 · 서버·유료 API 없음 · 계산은 Web Worker(WebGPU 우선, 안 되면 WASM). 서버로는 결과 시간표만 저장한다.
 * 곡 주인에게만 보여 주는 것은 부르는 쪽이 정한다(visible).
 */
export default function LyricSyncButton({
  songId, lyrics, audioPath, synced, visible = true, onApplied, className = '', song,
}: {
  songId: string
  lyrics: string | null | undefined
  /** 저장소 경로 또는 재생 주소 */
  audioPath: string
  /** 이미 시간표가 있으면 「다시 맞추기」 */
  synced: boolean
  visible?: boolean
  onApplied?: (lines: SyncedLine[]) => void
  className?: string
  /** 「가사 싱크 확인」 편집기에 넘길 곡(audio_url·lyrics·form) — 있으면 고치기·직접 찍기 버튼을 보여 준다 */
  song?: any
}) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [pct, setPct] = useState(0)
  const [err, setErr] = useState('')
  const [done, setDone] = useState(false)
  const [editing, setEditing] = useState(false)
  const ctl = useRef<AbortController | null>(null)
  const phaseRef = useRef<Phase>('idle')
  phaseRef.current = phase
  const alive = useRef(true)
  useEffect(() => () => { alive.current = false; ctl.current?.abort() }, [])
  // 곡이 바뀌면 상태를 비운다
  useEffect(() => { ctl.current?.abort(); setPhase('idle'); setErr(''); setDone(false); setPct(0) }, [songId])

  const start = useCallback(async () => {
    const lines = alignLineTexts(lyrics || '')
    if (lines.length < 2) { setErr(syncErrorMessage('no-lyrics')); setPhase('idle'); return }
    if (!canAlignForPublish()) { setErr(syncErrorMessage('unsupported')); setPhase('idle'); return }
    const c = new AbortController()
    ctl.current = c
    setErr(''); setDone(false); setPct(1); setPhase('running')
    try {
      const base = await resolveStudioAudioUrl(audioPath).catch(() => null)
      if (!base) throw new Error('no-audio')
      const url = withCorsCacheKey(base)
      const run = async (forceWasm: boolean): Promise<AlignOutcome | null> => {
        try {
          return await autoAlign(url, lines, 0, null, (ph, p) => {
            const v = ph === 'listen' ? Math.min(99, Math.round(20 + p * 0.8)) : ph === 'download' ? Math.round(2 + p * 0.18) : 1
            if (alive.current && !c.signal.aborted) setPct(v)
          }, c.signal, { forceWasm })
        } catch {
          if (c.signal.aborted) throw new Error('aborted')
          return null
        }
      }
      let out = await run(false)
      if (!out?.ok) out = await run(true) // WebGPU 를 끄고 가장 가벼운 WASM 으로 한 번 더
      if (c.signal.aborted) throw new Error('aborted')
      if (!out?.ok || !out.lrc) throw new Error('fail')
      markModelReady()
      // 결과 시간표만 저장한다(음원·모델은 올리지 않는다)
      // 확신이 낮은 결과만 자동 초안(lrc_auto + 확인 권유)으로, 나머지는 내가 직접 맞춘 시간표(lrc)로 저장해 비공개 곡에서도 바로 쓴다
      const res = !out.lowConfidence
        ? await fetch(`/api/song-history/${songId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc: out.lrc }) })
        : await saveOwnLrc(songId, out.lrc, !!out.lowConfidence)
      if (!res.ok) throw new Error(res.status === 401 ? 'login' : 'save')
      if (!alive.current) return
      onApplied?.(out.lrc)
      setDone(true); setPhase('idle')
    } catch (e: any) {
      if (!alive.current) return
      if (e?.message === 'aborted') return // 취소·일시정지는 아래 핸들러가 상태를 정한다
      setErr(syncErrorMessage(['no-audio', 'login', 'save', 'unsupported'].includes(e?.message) ? e.message : e?.message === 'fail' ? 'fail' : 'memory'))
      setPhase('idle')
    }
  }, [lyrics, audioPath, synced, songId, onApplied])

  // 탭이 가려지면 일시정지, 다시 보이면 이어서 한다(브라우저가 가려진 탭의 계산을 늦추기 때문)
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === 'running') { ctl.current?.abort(); setPhase('paused') }
      else if (!document.hidden && phaseRef.current === 'paused') void start()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [start])

  if (!visible) return null
  const press = () => { setErr(''); if (modelReady()) void start(); else setPhase('confirm') }
  const cancel = () => { ctl.current?.abort(); setPhase('idle'); setPct(0) }
  const saveEdited = async (lines: SyncedLine[]) => {
    const res = await fetch(`/api/song-history/${songId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc: lines }) })
    if (!res.ok) { setErr(syncErrorMessage(res.status === 401 ? 'login' : 'save')); return }
    onApplied?.(lines); setEditing(false); setDone(true)
  }
  const cls = `inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-white/20 focus-visible:outline focus-visible:outline-2 ${className}`

  return (
    <div className="lyric-sync-btn flex flex-col items-end gap-1.5" data-testid="lyric-sync">
      {phase === 'idle' && (
        <button type="button" className={cls} onClick={press} data-testid="lyric-sync-run">
          <span>{synced || done ? '다시 맞추기' : '가사 동기화'}</span>
          <span className="rounded bg-emerald-500/20 px-1.5 py-0.5 text-[11px] font-bold text-emerald-300">무료 · 내 컴퓨터에서 처리</span>
        </button>
      )}
      {phase === 'confirm' && (
        <div role="dialog" aria-label="가사 동기화 안내" className="max-w-[300px] rounded-xl border border-white/15 bg-black/80 p-3 text-[12px] text-white/90" data-testid="lyric-sync-confirm">
          <p className="mb-2">처음 한 번 약 77~291MB를 받습니다. 받은 파일은 이 브라우저에 저장돼 다음부터는 받지 않아요. 무료이고, 계산은 이 컴퓨터에서만 하며 결과 시간표만 저장합니다.</p>
          <div className="flex justify-end gap-2">
            <button type="button" className="rounded-md px-2 py-1 text-white/70 hover:text-white" onClick={() => setPhase('idle')}>취소</button>
            <button type="button" className="rounded-md bg-white px-2.5 py-1 font-bold text-black" onClick={() => void start()} data-testid="lyric-sync-start">시작</button>
          </div>
        </div>
      )}
      {(phase === 'running' || phase === 'paused') && (
        <div className="flex items-center gap-2 rounded-lg border border-white/15 bg-black/60 px-3 py-1.5 text-[12px] text-white" role="status" aria-live="polite" data-testid="lyric-sync-progress">
          <span>{phase === 'paused' ? '탭이 가려져 멈췄어요 — 돌아오면 이어서 맞춰요' : `가사 맞추는 중 · ${pct}%`}</span>
          <button type="button" className="rounded-md border border-white/25 px-2 py-0.5 hover:bg-white/10" onClick={cancel} data-testid="lyric-sync-cancel">취소</button>
        </div>
      )}
      {done && phase === 'idle' && <p className="text-[12px] text-emerald-300" role="status" data-testid="lyric-sync-done">가사를 맞췄어요. 바로 적용됐습니다.</p>}
      {song && phase === 'idle' && (done || err) && (
        <button type="button" className="text-[12px] text-white/80 underline hover:text-white" onClick={() => setEditing(true)} data-testid="lyric-sync-edit">{err ? '직접 시간 찍기' : '시간 확인·고치기'}</button>
      )}
      {editing && song && (
        <LyricTimingEditor song={{ ...song, form: song.form ?? {} }} title="가사 싱크 확인" saveLabel="저장" onSave={saveEdited} onClose={() => setEditing(false)} />
      )}
      {err && <p className="max-w-[300px] text-right text-[12px] text-red-300" role="alert" data-testid="lyric-sync-error">{err}</p>}
    </div>
  )
}
