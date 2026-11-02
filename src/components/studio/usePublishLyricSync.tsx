'use client'

import { useState, type ReactNode } from 'react'
import LyricTimingEditor from './LyricTimingEditor'
import { prepareSyncForPublish, type PublishSyncPrep } from '@/lib/lyricsSync/publishFlow'
import { needsSync } from '@/lib/lyricsSync/publishGate'

type Lang = 'KO' | 'EN' | 'JA'

/** 이 곡을 공개하려면 「가사 싱크 확인」 단계를 거쳐야 하는지(가사 2줄 이상이고 사람이 확인한 시간표가 없음) */
export function publishNeedsSyncStep(item: any, all: any[]): boolean {
  const f = item?.form ?? {}
  return needsSync(item, all) && !(f.lrc_by === 'user' && Array.isArray(f.lrc) && f.lrc.length >= 2)
}

/**
 * 모든 공개 진입점이 함께 쓰는 공개 흐름 — 가사 싱크 준비(대개 백그라운드 초안이 이미 있음) → 「가사 싱크 확인」 → 공개.
 * run(item, all, publish): 싱크가 필요 없으면 곧바로 publish(), 필요하면 확인 편집기를 띄우고 「확인하고 공개」 때
 * 사람이 확인한 시간표를 저장한 뒤 publish() 를 부른다. 확인 창을 닫으면 공개하지 않는다.
 */
export function usePublishLyricSync(lang: Lang): {
  syncPct: number | null
  run: (item: any, all: any[], publish: () => Promise<void>) => Promise<void>
  element: ReactNode
} {
  const [syncPct, setSyncPct] = useState<number | null>(null)
  const [review, setReview] = useState<{ song: any; manual: boolean; publish: () => Promise<void> } | null>(null)
  const [err, setErr] = useState('')

  const run = async (item: any, all: any[], publish: () => Promise<void>) => {
    setErr('')
    setSyncPct(0)
    let prep: PublishSyncPrep = { status: 'manual', song: item }
    try { prep = await prepareSyncForPublish(item, all, setSyncPct) } catch { /* 수동 싱크로 */ }
    setSyncPct(null)
    if (prep.status === 'none') { await publish(); return }
    setReview({ song: prep.song, manual: prep.status === 'manual', publish })
  }

  const T = (ko: string, en: string) => (lang === 'KO' ? ko : en)
  const element = (
    <>
      {review && (
        <LyricTimingEditor
          song={review.song}
          title={T('가사 싱크 확인', 'Check lyric sync')}
          hint={review.manual
            ? T('이 기기에서 자동으로 맞추지 못했어요. 재생하면서 줄이 시작할 때마다 「지금 찍기」를 눌러 주세요.', 'Automatic sync failed on this device. Play and press "Stamp now" as each line starts.')
            : T('재생하면 지금 부르는 줄이 강조됩니다. 어긋난 줄은 번호를 눌러 고른 뒤 그 줄이 시작할 때 「지금 찍기」를 누르세요.', 'Play to see the current line highlighted. Fix a line by selecting it and pressing "Stamp now" when it starts.')}
          saveLabel={T('확인하고 공개', 'Confirm and publish')}
          onSave={async (lines) => {
            // 사람이 확인한 시간표 — 가장 우선이다. 저장 뒤 공개(시간표가 있으므로 바로 공개된다)
            const res = await fetch(`/api/song-history/${review.song.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc: lines }) })
            if (res.ok) await review.publish()
            else setErr(T('가사 시간을 저장하지 못했습니다.', 'Could not save lyric timing.'))
          }}
          onClose={() => setReview(null)}
        />
      )}
      {err && <p role="alert" className="fixed bottom-24 left-1/2 z-[130] -translate-x-1/2 rounded-lg border border-red-900/40 bg-red-950/80 px-3 py-2 text-xs text-red-300">{err}</p>}
    </>
  )
  return { syncPct, run, element }
}
