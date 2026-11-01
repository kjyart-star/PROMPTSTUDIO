'use client'

import { useEffect, useRef, useState } from 'react'
import { fetchSongBlob } from './mastering/actions'
import { lrcPickOf } from '@/lib/studio/lyricsOf'
import { formatClock, linesFromLyrics, parseClock, toLrc, type TimedLine } from './lrc'

/** 가사 시간 편집기 — 재생하면서 줄마다 시간을 찍고, 숫자로 고치고, 한 줄씩 확인한다. 전부 브라우저(무료). */
export default function LyricTimingEditor({
  song, onSave, onClose, title = '가사 시간 편집', hint, saveLabel = '저장',
}: {
  song: any
  onSave: (lines: TimedLine[]) => Promise<void> | void
  onClose: () => void
  /** 공개 단계의 「가사 싱크 확인」처럼 같은 편집기를 다른 목적으로 열 때 */
  title?: string
  hint?: string
  saveLabel?: string
}) {
  const [lines, setLines] = useState<TimedLine[]>(() =>
    lrcPickOf(song)?.lines ?? linesFromLyrics(song.lyrics || ''))
  const [raw, setRaw] = useState<Record<number, string>>({})
  const [cur, setCur] = useState(0)
  const [src, setSrc] = useState('')
  const [err, setErr] = useState('')
  const [now, setNow] = useState(0)
  const audio = useRef<HTMLAudioElement>(null)
  const stopAt = useRef<number | null>(null)

  useEffect(() => {
    let url = ''
    let dead = false
    fetchSongBlob(song).then((b) => { if (!dead) { url = URL.createObjectURL(b); setSrc(url) } }).catch(() => setErr('음원을 불러오지 못했어요.'))
    return () => { dead = true; if (url) URL.revokeObjectURL(url) }
  }, [song])

  const setTime = (i: number, t: number) => setLines((ls) => ls.map((l, k) => (k === i ? { ...l, t } : l)))
  const stamp = () => {
    if (!audio.current || cur >= lines.length) return
    setTime(cur, Math.round(audio.current.currentTime * 100) / 100)
    setCur(Math.min(lines.length - 1, cur + 1))
  }
  const playLine = (i: number, only: boolean) => {
    const a = audio.current
    if (!a || lines[i].t < 0) return
    a.currentTime = lines[i].t
    const next = lines.slice(i + 1).find((l) => l.t > lines[i].t)
    stopAt.current = only && next ? next.t : null
    a.play().catch(() => {})
  }
  const unset = lines.filter((l) => l.t < 0).length
  // 재생 중인 줄(미리 듣기 강조) — 시작이 지금 이전인 마지막 줄
  let playing = -1
  for (let i = 0; i < lines.length; i++) if (lines[i].t >= 0 && lines[i].t <= now + 0.05) playing = i
  const sorted = lines.every((l, i) => i === 0 || l.t < 0 || lines[i - 1].t < 0 || l.t >= lines[i - 1].t)

  return (
    <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl border border-[#232323] bg-[#141414]" onClick={(e) => e.stopPropagation()}>
        <div className="p-4 border-b border-[#1e1e1e]">
          <h3 className="text-sm font-bold text-white truncate">{title} · {song.title || '제목 없음'}</h3>
          <p className="mt-1 text-[11px] text-zinc-500">{hint ?? '재생하면서 「지금 찍기」를 누르면 현재 줄에 시간이 들어가고 다음 줄로 넘어갑니다. 숫자는 직접 고칠 수 있어요.'}</p>
          {src ? (
            <audio
              ref={audio} src={src} controls className="mt-2 w-full h-9"
              onTimeUpdate={(e) => {
                const t = e.currentTarget.currentTime
                setNow(t)
                if (stopAt.current !== null && t >= stopAt.current) { e.currentTarget.pause(); stopAt.current = null }
              }}
            />
          ) : <p className="mt-2 text-xs text-zinc-500">{err || '음원을 불러오는 중…'}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={stamp} disabled={!src || !lines.length} className="px-3 py-1.5 rounded-lg bg-primary text-black text-xs font-extrabold cursor-pointer disabled:opacity-40">
              지금 찍기 ({formatClock(now)})
            </button>
            <span className="text-[11px] text-zinc-500">{lines.length - unset}/{lines.length}줄 완료</span>
            {!sorted && <span className="text-[11px] text-amber-400">시간 순서가 뒤섞인 줄이 있어요</span>}
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto divide-y divide-[#1a1a1a]">
          {lines.length === 0 && <li className="p-6 text-xs text-zinc-500">가사가 없습니다. 먼저 「제목 · 가사 수정」에서 가사를 넣거나 LRC/SRT 파일을 올려 주세요.</li>}
          {lines.map((l, i) => (
            <li key={i} data-playing={i === playing ? 'true' : undefined} className={`flex items-center gap-2 px-4 py-1.5 ${i === cur ? 'bg-primary/10' : ''}`}>
              <button type="button" onClick={() => setCur(i)} aria-label={`${i + 1}번 줄 선택`} className="w-6 text-[10px] text-zinc-500 cursor-pointer">{i + 1}</button>
              <input
                aria-label={`${i + 1}번 줄 시간`}
                value={raw[i] ?? (l.t >= 0 ? formatClock(l.t) : '')}
                placeholder="m:ss.xx"
                onChange={(e) => setRaw((r) => ({ ...r, [i]: e.target.value }))}
                onBlur={() => {
                  const v = raw[i]
                  if (v === undefined) return
                  if (v.trim() === '') setTime(i, -1)
                  else { const t = parseClock(v); if (t !== null) setTime(i, t) }
                  setRaw((r) => { const { [i]: _, ...rest } = r; return rest })
                }}
                className="w-24 rounded-lg bg-[#0a0a0a] border border-[#1a1a1a] px-2 py-1 text-xs font-mono text-zinc-200 focus:outline-none focus:border-primary/60"
              />
              <span className={`flex-1 min-w-0 truncate text-xs ${i === playing ? 'font-bold text-primary' : 'text-zinc-200'}`}>{l.text}</span>
              <button type="button" onClick={() => playLine(i, true)} disabled={l.t < 0 || !src} className="px-2 py-1 text-[11px] font-bold text-zinc-400 hover:text-primary cursor-pointer disabled:opacity-30">이 줄 듣기</button>
              <button type="button" onClick={() => playLine(i, false)} disabled={l.t < 0 || !src} className="px-2 py-1 text-[11px] font-bold text-zinc-400 hover:text-primary cursor-pointer disabled:opacity-30">여기부터</button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-center gap-3 p-4 border-t border-[#1e1e1e]">
          <button type="button" onClick={() => {
            const done = lines.filter((l) => l.t >= 0)
            const url = URL.createObjectURL(new Blob([toLrc(done)], { type: 'text/plain;charset=utf-8' }))
            const a = document.createElement('a'); a.href = url; a.download = `${(song.title || 'lyrics').replace(/[\\/:*?"<>|]/g, '_')}.lrc`; a.click()
            setTimeout(() => URL.revokeObjectURL(url), 1000)
          }} disabled={lines.length === unset} className="text-xs font-bold text-zinc-400 hover:text-white cursor-pointer disabled:opacity-40">LRC 내보내기</button>
          <div className="ml-auto flex gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer">닫기</button>
            <button type="button" disabled={lines.length === unset}
              onClick={async () => {
                const done = lines.filter((l) => l.t >= 0).sort((a, b) => a.t - b.t)
                await onSave(done)
                onClose()
              }}
              className="px-5 py-2 text-xs font-extrabold text-black bg-primary rounded-xl cursor-pointer disabled:opacity-40">{saveLabel}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
