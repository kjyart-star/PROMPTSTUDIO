'use client'
/**
 * 04 가사 확인 — 가사 원문은 그대로 두고 줄마다 시작 시간만 맞춘다.
 * 무료 브라우저 경로: ① 가사에 시간표가 있으면 그대로 ② 소리 구간에 맞춰 자동 보정(근사) ③ 재생하며 줄마다 탭 ④ 길이 비례 추정(폴백).
 * 맞지 않아 보이는 줄은 표시하고 시간을 직접 고칠 수 있다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Wand2, Hand, RotateCcw, Play, Square, Pencil } from 'lucide-react'
import { initialLyrics, plainLines, autoAlign, suspectLines, type CinemaLyrics, type LyricsMode } from '@/lib/cinema/lyrics'
import { energyEnvelope } from '@/lib/cinema/spectrum'
import { decodeToChannels } from '@/lib/cinema/render'
import { loadAudioBlob, type CTrack } from './model'

const MODE_LABEL: Record<LyricsMode, string> = {
  exact: '가사 시간표 있음', estimated: '가사 시간 추정', auto: '소리에 맞춰 보정(근사)', manual: '직접 맞춤', none: '가사 없음',
}

function fmt(t: number): string {
  const m = Math.floor(t / 60), s = t - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}
function parse(v: string): number | null {
  const m = v.trim().match(/^(\d+):(\d{1,2}(?:\.\d+)?)$/)
  if (m) return Number(m[1]) * 60 + Number(m[2])
  const n = Number(v.trim()); return isFinite(n) && v.trim() !== '' ? n : null
}

export function LyricsStep({ tracks, active, onActive, onChange, onSeek }: {
  tracks: CTrack[]; active: number; onActive: (i: number) => void
  onChange: (id: string, patch: Partial<CTrack>) => void
  onSeek: (index: number, t: number) => void
}) {
  const tr = tracks[active]
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const [tap, setTap] = useState<{ ptr: number; times: number[] } | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const urlRef = useRef<string | null>(null)

  const lyrics = tr?.lyrics
  const bad = useMemo(() => (tr && lyrics ? suspectLines(lyrics.lines, tr.duration) : new Set<number>()), [tr, lyrics])

  const stopTap = () => { audioRef.current?.pause(); setTap(null) }
  useEffect(() => { stopTap(); setEditing(false); setNotice('') /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [tr?.id])
  useEffect(() => () => { audioRef.current?.pause(); if (urlRef.current) URL.revokeObjectURL(urlRef.current) }, [])

  if (!tr) return <p className="text-sm text-zinc-500">곡을 먼저 골라 주세요.</p>

  const set = (l: CinemaLyrics) => onChange(tr.id, { lyrics: l })
  const texts = lyrics!.lines.map(l => l.text)

  const doAuto = async () => {
    setBusy('소리를 분석하는 중…'); setNotice('')
    try {
      const ch = await decodeToChannels(await loadAudioBlob(tr))
      const env = energyEnvelope(ch, 48000, 0.1)
      const src = texts.length ? texts : plainLines(tr.lyricsRaw)
      set({ lines: autoAlign(src, env, 0.1, tr.duration), mode: 'auto' })
      setNotice('소리가 있는 구간에 맞춰 줄 시간을 옮겼어요. 정확한 음성 인식이 아니라 근사값이라, 어긋난 줄은 아래에서 고쳐 주세요.')
    } catch { setNotice('소리를 분석하지 못했어요. 다시 시도해 주세요.') } finally { setBusy('') }
  }
  const doReset = () => { set(initialLyrics(tr.lyricsRaw, tr.duration)); setNotice('길이에 비례한 추정 시간으로 되돌렸어요.') }
  const setTime = (i: number, v: number) => {
    const lines = lyrics!.lines.map((l, k) => (k === i ? { ...l, start: Math.max(0, Math.round(v * 100) / 100) } : l))
    set({ lines, mode: lyrics!.mode === 'exact' ? 'exact' : 'manual' })
  }
  const applyDraft = () => {
    const lines = plainLines(draft)
    onChange(tr.id, { lyricsRaw: draft, lyrics: lines.length ? initialLyrics(draft, tr.duration) : { lines: [], mode: 'none' } })
    setEditing(false)
    setNotice(lines.length ? '가사를 바꿨어요. 줄 시간은 길이 비례 추정으로 다시 잡았어요.' : '')
  }

  const startTap = async () => {
    if (!texts.length) return
    const blob = await loadAudioBlob(tr)
    if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    urlRef.current = URL.createObjectURL(blob)
    const a = audioRef.current ?? (audioRef.current = new Audio())
    a.src = urlRef.current; a.currentTime = 0
    await a.play().catch(() => {})
    setTap({ ptr: 0, times: [] })
  }
  const stamp = () => {
    if (!tap || !audioRef.current) return
    const t = audioRef.current.currentTime
    const times = [...tap.times, t]
    if (times.length >= texts.length) {
      set({ lines: texts.map((x, i) => ({ text: x, start: Math.round(times[i] * 100) / 100 })), mode: 'manual' })
      stopTap(); setNotice('탭으로 맞춘 시간을 적용했어요.')
    } else setTap({ ptr: tap.ptr + 1, times })
  }
  useEffect(() => {
    if (!tap) return
    const h = (e: KeyboardEvent) => { if (e.code === 'Space' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); stamp() } }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  return (
    <div className="space-y-3" {...(tap ? { 'data-own-shortcuts': '' } : {})}>
      <p className="text-xs text-zinc-400">가사 원문은 그대로 두고, 노래에 맞춰 줄마다 시작 시간을 찾습니다. 맞지 않는 줄은 표시되고, 시간을 직접 고칠 수 있어요.</p>
      <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="곡 선택">
        {tracks.map((t, i) => (
          <button key={t.id} role="tab" aria-selected={i === active} type="button" onClick={() => onActive(i)}
            className={`px-2.5 py-1 rounded-md text-xs border ${i === active ? 'bg-white/15 border-white/30 text-white' : 'border-white/10 text-zinc-400 hover:text-white'}`}>
            {String(i + 1).padStart(2, '0')} {t.title}
            {t.lyrics.lines.length > 0 && suspectLines(t.lyrics.lines, t.duration).size > 0 && <AlertTriangle className="inline w-3 h-3 ml-1 text-amber-400" />}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className={`text-[11px] px-2 py-0.5 rounded-full border ${lyrics!.mode === 'exact' || lyrics!.mode === 'manual' ? 'border-emerald-400/40 text-emerald-300' : 'border-amber-400/40 text-amber-300'}`}>{MODE_LABEL[lyrics!.mode]}</span>
        {bad.size > 0 && <span className="text-[11px] text-amber-300">맞지 않아 보이는 줄 {bad.size}개</span>}
        <div className="ml-auto flex flex-wrap gap-1.5">
          <button type="button" disabled={!texts.length || !!busy || !!tap} onClick={doAuto} className="btn-cin"><Wand2 className="w-3.5 h-3.5" />소리에 맞춰 자동 보정</button>
          {tap
            ? <button type="button" onClick={stopTap} className="btn-cin"><Square className="w-3.5 h-3.5" />탭 멈추기</button>
            : <button type="button" disabled={!texts.length || !!busy} onClick={startTap} className="btn-cin"><Hand className="w-3.5 h-3.5" />재생하며 탭으로 맞추기</button>}
          <button type="button" disabled={!tr.lyricsRaw || !!tap} onClick={doReset} className="btn-cin"><RotateCcw className="w-3.5 h-3.5" />길이 비례로 되돌리기</button>
          <button type="button" disabled={!!tap} onClick={() => { setDraft(tr.lyricsRaw); setEditing(v => !v) }} className="btn-cin"><Pencil className="w-3.5 h-3.5" />가사 편집</button>
        </div>
      </div>
      {busy && <p className="text-xs text-zinc-400">{busy}</p>}
      {notice && <p className="text-xs text-emerald-300/90">{notice}</p>}

      {tap && (
        <div className="rounded-lg border border-emerald-400/30 bg-emerald-400/5 p-3">
          <p className="text-xs text-zinc-300 mb-2">노래를 들으며 해당 줄이 시작되는 순간에 버튼(또는 스페이스바)을 누르세요. ({tap.ptr + 1}/{texts.length})</p>
          <p className="text-lg font-bold text-white mb-2">{texts[tap.ptr]}</p>
          <button type="button" onClick={stamp} className="px-4 py-2 rounded-lg bg-emerald-500 text-black font-bold text-sm">지금 이 줄 시작</button>
        </div>
      )}

      {editing && (
        <div className="space-y-2">
          <textarea value={draft} onChange={e => setDraft(e.target.value)} rows={8} className="w-full rounded-lg bg-black/40 border border-white/15 p-2 text-sm text-white" placeholder="가사를 붙여 넣으세요. [Verse] 같은 구간 표지는 자동으로 빼요." />
          <div className="flex gap-2"><button type="button" onClick={applyDraft} className="btn-cin">적용</button><button type="button" onClick={() => setEditing(false)} className="btn-cin">닫기</button></div>
        </div>
      )}

      {!texts.length && !editing && <p className="text-sm text-amber-300">이 곡에는 가사가 없어요. 「가사 편집」으로 붙여 넣거나, 영상 종류를 「경음악 영상」으로 바꿔 주세요.</p>}

      {texts.length > 0 && (
        <ul className="max-h-[360px] overflow-y-auto rounded-lg border border-white/10 divide-y divide-white/5" data-testid="lyric-rows">
          {lyrics!.lines.map((l, i) => (
            <li key={i} className={`flex items-center gap-2 px-2 py-1.5 text-sm ${bad.has(i) ? 'bg-amber-400/10' : ''} ${tap && tap.ptr === i ? 'bg-emerald-400/10' : ''}`}>
              <input defaultValue={fmt(l.start)} key={`${tr.id}-${i}-${l.start}`}
                onBlur={e => { const v = parse(e.target.value); if (v !== null && v !== l.start) setTime(i, v); else e.target.value = fmt(l.start) }}
                className="w-16 rounded bg-black/40 border border-white/10 px-1.5 py-0.5 text-xs tabular-nums text-zinc-200" aria-label={`${i + 1}번째 줄 시작 시간`} />
              <button type="button" onClick={() => onSeek(active, Math.max(0, l.start - 0.3))} className="p-1 rounded hover:bg-white/10" aria-label="이 줄부터 듣기"><Play className="w-3 h-3" /></button>
              <span className="flex-1 min-w-0 truncate text-zinc-100">{l.text}</span>
              {bad.has(i) && <span className="text-[11px] text-amber-300 flex items-center gap-1 shrink-0"><AlertTriangle className="w-3 h-3" />맞지 않아 보여요</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
