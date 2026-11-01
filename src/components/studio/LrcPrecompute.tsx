'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LRC_AUTO_VERSION, lyricsOfItem } from '@/lib/studio/lyricsOf'
import { acquireAlignLock, releaseAlignLock, setPreemptHandler } from '@/lib/player/alignLock'
import { alignLineTexts, validateAutoLrc } from '@/lib/player/lrcValidate'
import { LrcPrecomputeQueue, freshPendingIds, pendingLrcSongs, type PrecomputeProgress } from '@/lib/player/lrcPrecompute'
import { analyzeSpans, autoAlign, canAlignForPublish, markFailed, recentlyFailed, saveCachedLrc } from '@/lib/player/lyricSyncClient'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { historyAudioPath } from '@/lib/studio/playQueue'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'
import { saveOwnLrc } from '@/lib/player/lrcShareClient'

const START_DELAY_MS = 12_000
/** 생성·업로드가 막 끝난 곡은 기다리지 않고 바로 맞춘다 */
const FRESH_DELAY_MS = 300

interface Props {
  userId?: string | null
  history: any[]
  lang: 'KO' | 'EN' | 'JA'
  /** 한 곡이 서버에 저장되면 — 보관함 목록(자동 배지)을 바로 갱신한다 */
  onSaved: (id: string, lrc: { t: number; text: string }[]) => void
  /** 「가사 시간 확인」 — 신뢰도가 낮은 곡을 시간 편집기로 연다(없으면 권유를 보이지 않는다) */
  onReview?: (item: any) => void
}

const LABEL = {
  KO: (n: number, t: number, pct: number) => `내 곡 가사 시간 맞추는 중 ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
  EN: (n: number, t: number, pct: number) => `Syncing lyric timing for my songs ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
  JA: (n: number, t: number, pct: number) => `マイ曲の歌詞タイミングを合わせ中 ${n}/${t}${pct ? ` · ${pct}%` : ''}`,
} as const
const REVIEW = {
  KO: (t: string) => `「${t}」 가사 시간이 정확하지 않을 수 있어요`,
  EN: (t: string) => `Lyric timing of "${t}" may be off`,
  JA: (t: string) => `「${t}」の歌詞タイミングがずれている可能性があります`,
} as const
const REVIEW_BTN = { KO: '가사 시간 확인', EN: 'Check timing', JA: 'タイミング確認' } as const
const CLOSE = { KO: '닫기', EN: 'Close', JA: '閉じる' } as const

/**
 * 스튜디오·프로필에 로그인해 있는 동안, 가사가 있고 자동 맞춤이 없는 내 곡을 한 곡씩 백그라운드로 맞춰 서버에 저장한다(만든 사람 브라우저 계산).
 * 생성·업로드가 막 끝난 곡은 곧바로, 처음 들어왔을 때 남아 있던 곡(창을 닫아 못 끝낸 곡 포함)은 화면이 한가해진 뒤에 맞춘다.
 * 재생은 하지 않고 음원 디코드만 한다. 동시에 1곡, 탭이 숨겨지면 멈춘다, 저사양·데이터 절약이면 돌리지 않는다.
 */
export default function LrcPrecompute({ userId, history, lang, onSaved, onReview }: Props) {
  const [prog, setProg] = useState<PrecomputeProgress | null>(null)
  const historyRef = useRef(history)
  historyRef.current = history
  const onSavedRef = useRef(onSaved)
  onSavedRef.current = onSaved
  const pendingIds = useMemo(() => pendingLrcSongs(history, recentlyFailed).map((it) => it.id as string), [history])
  const hasPending = pendingIds.length > 0
  // 새로 맞출 곡이 생겼는지(생성·업로드 완료) — 큐가 쉬고 있으면 바로 다시 띄운다
  const seenRef = useRef<Set<string> | null>(null)
  const runningRef = useRef(false)
  const freshRef = useRef(false)
  const [kick, setKick] = useState(0)
  useEffect(() => {
    const fresh = freshPendingIds(seenRef.current, pendingIds)
    seenRef.current = new Set([...(seenRef.current ?? []), ...pendingIds])
    if (fresh.length) {
      freshRef.current = true
      if (!runningRef.current) setKick((k) => k + 1) // 돌고 있는 큐는 다음 곡으로 집어 간다
    }
  }, [pendingIds])

  useEffect(() => {
    // 공개 요청 곡만 맞추므로 공개 단계 규칙(태블릿 포함, 공개자 기기가 계산)을 쓴다
    if (!userId || !hasPending || !canAlignForPublish()) return
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
          const res = await saveOwnLrc(item.id, out.lrc, !!out.lowConfidence)
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
    // 새로 끝난 곡은 곧바로, 아니면 브라우저가 한가할 때 시작한다
    let started = false
    const start = () => {
      if (started) return
      started = true
      runningRef.current = true
      freshRef.current = false
      // 공개 요청 곡은 공개자 기기가 계산한다(배터리·태블릿 규칙은 듣기 단계에서만)
      void queue.run().finally(() => { runningRef.current = false })
    }
    const fresh = freshRef.current
    const t = setTimeout(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number)
      if (fresh) start()
      else if (ric) ric(start, { timeout: 10_000 }); else start()
    }, fresh ? FRESH_DELAY_MS : START_DELAY_MS)
    return () => { setPreemptHandler(null); clearTimeout(t); document.removeEventListener('visibilitychange', onVis); queue.stop(); runningRef.current = false }
  }, [userId, hasPending, kick])

  const review = onReview ? history.find((it) => it?.form?.lrc_review && it.form?.lrc_by !== 'user' && !it.trashed_at) : null
  const [dismissed, setDismissed] = useState('')
  if (!prog && (!review || dismissed === review.id)) return null
  return (
    <div className="fixed left-4 bottom-24 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-1.5">
      {prog && (
        <div role="status" aria-live="polite" data-testid="lrc-precompute"
          className="max-w-full rounded-lg border border-white/10 bg-black/70 px-3 py-1.5 text-xs text-zinc-300 backdrop-blur tabular-nums">
          {LABEL[lang](Math.min(prog.done + 1, prog.total), prog.total, prog.pct)}
        </div>
      )}
      {review && dismissed !== review.id && (
        <div data-testid="lrc-review" className="flex max-w-full items-center gap-2 rounded-lg border border-amber-400/30 bg-black/80 px-3 py-1.5 text-xs text-zinc-200 backdrop-blur">
          <span className="min-w-0 truncate">{REVIEW[lang](String(review.title || ''))}</span>
          <button type="button" className="shrink-0 rounded-md bg-amber-400/20 px-2 py-0.5 font-bold text-amber-200 hover:bg-amber-400/30" onClick={() => onReview?.(review)}>{REVIEW_BTN[lang]}</button>
          <button type="button" aria-label={CLOSE[lang]} className="shrink-0 px-1 text-zinc-500 hover:text-zinc-200" onClick={() => setDismissed(review.id)}>×</button>
        </div>
      )}
    </div>
  )
}
