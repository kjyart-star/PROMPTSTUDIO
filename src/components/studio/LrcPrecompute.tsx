'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { lyricsOfItem } from '@/lib/studio/lyricsOf'
import { acquireAlignLock, releaseAlignLock, setPreemptHandler } from '@/lib/player/alignLock'
import { alignLineTexts, validateAutoLrc } from '@/lib/player/lrcValidate'
import { LrcPrecomputeQueue, freshPendingIds, pendingLrcSongs } from '@/lib/player/lrcPrecompute'
import { analyzeSpans, autoAlign, canAlignForPublish, markFailed, recentlyFailed, saveCachedLrc } from '@/lib/player/lyricSyncClient'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { historyAudioPath } from '@/lib/studio/playQueue'
import { withCorsCacheKey } from '@/lib/audio/corsUrl'
import { saveOwnLrc } from '@/lib/player/lrcShareClient'
import { runAlignJob } from '@/lib/player/alignJobs'

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
    // 만든 사람 기기가 백그라운드로 계산한다(태블릿 포함 — 폰·태블릿 「계산 안 함」 규칙은 듣기 단계에만)
    if (!userId || !hasPending || !canAlignForPublish()) return
    const queue = new LrcPrecomputeQueue({
      getHistory: () => historyRef.current,
      skip: recentlyFailed,
      acquire: acquireAlignLock,
      release: releaseAlignLock,
      onProgress: () => { /* 백그라운드 — 진행 표시 없음 */ },
      processOne: async (item, signal, onPct) => {
        // 공개 창이 같은 곡을 맞추고 있으면 그 작업을 함께 기다린다(두 번 계산하지 않음)
        const lrc = await runAlignJob(item.id, async (onJob) => {
          const base = await resolveStudioAudioUrl(historyAudioPath(item))
          if (!base || signal.aborted) throw new Error(signal.aborted ? 'aborted' : 'no-audio')
          const url = withCorsCacheKey(base)
          const lines = alignLineTexts(lyricsOfItem(item, historyRef.current))
          const spans = await analyzeSpans(item.id, url)
          const out = await autoAlign(url, lines, 0, spans, (phase, pct) => {
            const v = phase === 'listen' ? Math.min(99, Math.round(20 + pct * 0.8)) : phase === 'download' ? Math.round(5 + pct * 0.15) : 2
            onPct(v); onJob(v)
          }, signal)
          if (!out.ok || !out.lrc || !validateAutoLrc(out.lrc, { expectedTexts: lines }).ok) return null
          saveCachedLrc(item.id, out.lrc)
          // 초안 저장 — 비공개 곡은 화면에 일반 가사로 보이고, 공개할 때 확인 단계에서 확정한다
          const res = await saveOwnLrc(item.id, out.lrc, !!out.lowConfidence)
          return res.ok ? out.lrc : null
        }).catch((e) => { if (!signal.aborted) markFailed(item.id); throw e })
        if (!lrc) { markFailed(item.id); return 'failed' }
        onSavedRef.current(item.id, lrc)
        return 'saved'
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
  // 백그라운드 계산은 진행 표시를 하지 않는다(생성 화면에서는 가사만). 남은 진행률은 공개 창에서만 보인다
  if (!review || dismissed === review.id) return null
  return (
    <div className="fixed left-4 bottom-24 z-[60] flex max-w-[calc(100vw-2rem)] flex-col items-start gap-1.5">
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
