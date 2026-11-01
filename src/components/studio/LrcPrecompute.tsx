'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LRC_AUTO_VERSION, lyricsOfItem } from '@/lib/studio/lyricsOf'
import { acquireAlignLock, releaseAlignLock, setPreemptHandler } from '@/lib/player/alignLock'
import { alignLineTexts, validateAutoLrc } from '@/lib/player/lrcValidate'
import { LrcPrecomputeQueue, pendingLrcSongs, type PrecomputeProgress } from '@/lib/player/lrcPrecompute'
import { analyzeSpans, autoAlign, canAutoAlign, markFailed, recentlyFailed, saveCachedLrc } from '@/lib/player/lyricSyncClient'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { historyAudioPath } from '@/lib/studio/playQueue'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'

const START_DELAY_MS = 12_000

interface Props {
  userId?: string | null
  history: any[]
  lang: 'KO' | 'EN' | 'JA'
  /** 한 곡이 서버에 저장되면 — 보관함 목록(자동 배지)을 바로 갱신한다 */
  onSaved: (id: string, lrc: { t: number; text: string }[]) => void
}

const LABEL = {
  KO: (n: number, t: number, pct: number) => `내 곡 가사 시간 맞추는 중 ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
  EN: (n: number, t: number, pct: number) => `Syncing lyric timing for my songs ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
  JA: (n: number, t: number, pct: number) => `マイ曲の歌詞タイミングを合わせ中 ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
} as const

/**
 * 스튜디오에 로그인해 있는 동안, 유휴 시간에 가사가 있고 자동 맞춤(v2)이 없는 내 곡을 한 곡씩 백그라운드로 맞춰 서버에 저장한다.
 * 재생은 하지 않고 음원 디코드만 한다. 동시에 1곡, 탭이 숨겨지면 멈춘다, 저사양·데이터 절약이면 돌리지 않는다.
 */
export default function LrcPrecompute({ userId, history, lang, onSaved }: Props) {
  const [prog, setProg] = useState<PrecomputeProgress | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const hasPending = useMemo(() => pendingLrcSongs(history, recentlyFailed).length > 0, [history])

  useEffect(() => {
    if (!userId || !hasPending || !canAutoAlign()) return
    const queue = new LrcPrecomputeQueue({
      getHistory: () => historyRef.current,
      skip: recentlyFailed,
      acquire: acquireAlignLock,
      release: releaseAlignLock,
      onProgress: setProg,
      processOne: async (item, signal, onPct) => {
        const base = await resolveStudioAudioUrl(historyAudioPath(item))
        if (!base || signal.aborted) throw new Error(signal.aborted ? 'aborted' : 'no-audio')
        const url = withCorsCacheKey(base)
        const lines = alignLineTexts(lyricsOfItem(item, historyRef.current))
        try {
          const spans = await analyzeSpans(item.id, url)
          const out = await autoAlign(url, lines, 0, spans, (phase, pct) => {
            onPct(phase === 'listen' ? Math.min(99, Math.round(20 + pct * 0.8)) : phase === 'download' ? Math.round(5 + pct * 0.15) : 2)
          }, signal)
          if (!out.ok || !out.lrc || !validateAutoLrc(out.lrc, { expectedTexts: lines }).ok) { markFailed(item.id); return 'failed' }
          saveCachedLrc(item.id, out.lrc)
          const res = await fetch(`/api/song-history/${item.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc_auto: out.lrc, lrc_auto_v: LRC_AUTO_VERSION }),
          })
          if (!res.ok) return 'failed'
          onSavedRef.current(item.id, out.lrc)
          return 'saved'
        } catch (e) {
          if (!signal.aborted) markFailed(item.id)
          throw e
        }
      },
    })
    setPreemptHandler(() => queue.preempt())
    const onVis = () => queue.setVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVis)
    queue.setVisible(document.visibilityState !== 'hidden')
    // 브라우저가 한가할 때 시작한다
    let started = false
    const start = () => { if (!started) { started = true; void queue.run() } }
    const t = setTimeout(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number)
      if (ric) ric(start, { timeout: 10_000 }); else start()
    }, START_DELAY_MS)
    return () => { setPreemptHandler(null); clearTimeout(t); document.removeEventListener('visibilitychange', onVis); queue.stop() }
  }, [userId, hasPending])

  if (!prog) return null
  return (
    <div role="status" aria-live="polite" data-testid="lrc-precompute"
      className="fixed left-4 bottom-24 z-[60] max-w-[calc(100vw-2rem)] rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur tabular-nums">
      {LABEL[lang](Math.min(prog.done + 1, prog.total), prog.total, prog.pct)}
    </div>
  )
}
