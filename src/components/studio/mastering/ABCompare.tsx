'use client'

/**
 * 결과 직후 전후 비교 재생 — 원곡(A) ↔ 마스터링본(B)을 같은 위치에서 바꿔 듣는다.
 * 「음량 맞춰 비교」(기본 켜짐)는 큰 쪽을 작은 쪽 크기로 줄여, 소리가 커서 좋게 들리는 착각 없이 비교하게 한다.
 * 파일은 이 브라우저 안의 것(받아 둔 원곡·방금 만든 MP3)만 쓴다.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Play, Pause } from 'lucide-react'

/** 음량 맞춤 볼륨 — 큰 쪽만 줄인다(HTMLMediaElement.volume 은 1 을 넘지 못한다) */
export function matchedVolumes(srcLufs: number, outLufs: number, on: boolean): { a: number; b: number } {
  if (!on || !Number.isFinite(srcLufs) || !Number.isFinite(outLufs)) return { a: 1, b: 1 }
  const d = outLufs - srcLufs
  const v = Math.min(1, Math.pow(10, -Math.abs(d) / 20))
  return d > 0 ? { a: 1, b: v } : { a: v, b: 1 }
}

export function ABCompare({ srcBlob, outBlob, srcLufs, outLufs }: { srcBlob: Blob; outBlob: Blob; srcLufs: number; outLufs: number }) {
  const aUrl = useMemo(() => URL.createObjectURL(srcBlob), [srcBlob])
  const bUrl = useMemo(() => URL.createObjectURL(outBlob), [outBlob])
  useEffect(() => () => { URL.revokeObjectURL(aUrl); URL.revokeObjectURL(bUrl) }, [aUrl, bUrl])
  const aRef = useRef<HTMLAudioElement>(null)
  const bRef = useRef<HTMLAudioElement>(null)
  const [side, setSide] = useState<'a' | 'b'>('b')
  const [playing, setPlaying] = useState(false)
  const [match, setMatch] = useState(true)
  const vol = matchedVolumes(srcLufs, outLufs, match)

  useEffect(() => {
    if (aRef.current) aRef.current.volume = vol.a
    if (bRef.current) bRef.current.volume = vol.b
  }, [vol.a, vol.b])
  useEffect(() => () => { aRef.current?.pause(); bRef.current?.pause() }, [])

  const cur = () => (side === 'a' ? aRef.current : bRef.current)
  const toggle = async () => {
    const el = cur()
    if (!el) return
    if (playing) { el.pause(); setPlaying(false); return }
    try { await el.play(); setPlaying(true) } catch { setPlaying(false) }
  }
  const pick = async (s: 'a' | 'b') => {
    if (s === side) return
    const from = cur(), to = s === 'a' ? aRef.current : bRef.current
    setSide(s)
    if (!from || !to) return
    to.currentTime = from.currentTime
    if (playing) { from.pause(); try { await to.play() } catch { setPlaying(false) } }
  }
  const diff = Number.isFinite(srcLufs) && Number.isFinite(outLufs) ? outLufs - srcLufs : NaN

  return (
    <div className="rounded-xl border border-[#262626] bg-[#111] p-3 space-y-2" aria-label="전후 비교 듣기">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} aria-label={playing ? '일시정지' : '재생'} className="w-8 h-8 rounded-full bg-primary text-black inline-flex items-center justify-center cursor-pointer">
          {playing ? <Pause className="w-4 h-4" fill="currentColor" /> : <Play className="w-4 h-4" fill="currentColor" />}
        </button>
        <div role="group" aria-label="비교 듣기" className="inline-flex rounded-lg border border-[#262626] overflow-hidden">
          <button type="button" aria-pressed={side === 'a'} onClick={() => pick('a')} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${side === 'a' ? 'bg-primary/15 text-primary' : 'text-zinc-400'}`}>원곡</button>
          <button type="button" aria-pressed={side === 'b'} onClick={() => pick('b')} className={`px-3 py-1.5 text-xs font-bold cursor-pointer ${side === 'b' ? 'bg-primary/15 text-primary' : 'text-zinc-400'}`}>마스터링</button>
        </div>
        <label className="inline-flex items-center gap-1.5 text-[11px] text-zinc-300 cursor-pointer">
          <input type="checkbox" checked={match} onChange={e => setMatch(e.target.checked)} className="accent-[#2ed48a]" /> 음량 맞춰 비교
        </label>
      </div>
      <p className="text-[10px] text-zinc-500">
        {Number.isFinite(diff) ? `마스터링본이 ${Math.abs(diff).toFixed(1)}dB ${diff >= 0 ? '커요' : '작아요'}. ` : ''}
        {match ? '지금은 크기를 맞춰 들려줘요 — 소리 결만 비교하세요.' : '실제 크기 그대로 들려줘요.'}
      </p>
      <audio ref={aRef} src={aUrl} preload="auto" onEnded={() => setPlaying(false)} hidden />
      <audio ref={bRef} src={bUrl} preload="auto" onEnded={() => setPlaying(false)} hidden />
    </div>
  )
}
