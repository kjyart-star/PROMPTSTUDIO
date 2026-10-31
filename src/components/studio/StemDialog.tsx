'use client'

import { useEffect, useRef, useState } from 'react'
import { PaidConfirm, PriceBadge } from './PaidConfirm'

type Phase = 'idle' | 'processing' | 'done' | 'failed'

export default function StemDialog({
  song, priceMilli, onClose, onChanged, onBalance,
}: {
  song: any
  priceMilli: number | null | undefined
  onClose: () => void
  /** 상태가 바뀌면(시작·완료·실패) 보관함을 다시 읽게 한다 */
  onChanged: () => void
  onBalance?: (milli: number) => void
}) {
  const initial = song.form?.stems?.status
  const [phase, setPhase] = useState<Phase>(initial === 'processing' ? 'processing' : initial === 'done' ? 'done' : 'idle')
  const [confirming, setConfirming] = useState(false)
  const [urls, setUrls] = useState<{ vocals: string; instrumental: string } | null>(null)
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dead = useRef(false)

  const poll = (n = 0) => {
    timer.current = setTimeout(async () => {
      if (dead.current) return
      try {
        const d = await (await fetch(`/api/suno/stem?historyId=${song.id}`)).json()
        if (d.status === 'done') { setUrls({ vocals: d.vocalsUrl, instrumental: d.instrumentalUrl }); setPhase('done'); onChanged(); return }
        if (d.status === 'failed') { setPhase('failed'); setMsg(d.refunded ? '나누지 못했어요. 크레딧은 돌려드렸어요.' : '나누지 못했어요. 크레딧 환불을 처리 중이에요.'); onChanged(); return }
      } catch { /* 다음 확인에서 다시 */ }
      if (n > 90) { setMsg('시간이 오래 걸리고 있어요. 잠시 뒤 다시 열어 확인해 주세요.'); return }
      poll(n + 1)
    }, n === 0 ? 1500 : 4000)
  }

  useEffect(() => {
    dead.current = false
    if (phase === 'processing' || phase === 'done') poll()
    return () => { dead.current = true; if (timer.current) clearTimeout(timer.current) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const start = async () => {
    setConfirming(false); setMsg('')
    try {
      const res = await fetch('/api/suno/stem', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ historyId: song.id }) })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPhase('failed')
        setMsg(res.status === 402 ? '크레딧이 모자라요. 충전한 뒤 다시 시도해 주세요.' : `${d.error || '시작하지 못했어요.'}${d.refunded ? ' 크레딧은 돌려드렸어요.' : ' 크레딧은 빠지지 않았어요.'}`)
        return
      }
      if (typeof d.balance === 'number') onBalance?.(d.balance)
      setPhase('processing'); onChanged(); poll()
    } catch {
      setPhase('failed'); setMsg('연결이 끊겼어요. 크레딧이 빠졌다면 자동으로 돌려드려요.')
    }
  }

  const part = (label: string, url: string, name: string) => (
    <div className="rounded-xl border border-[#232323] bg-[#0f0f0f] p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold text-white">{label}</span>
        <a href={url} download={`${song.title || 'track'} - ${name}.mp3`} className="ml-auto text-[11px] font-bold text-primary hover:underline">내려받기</a>
      </div>
      <audio src={url} controls preload="none" className="w-full h-9" />
    </div>
  )

  return (
    <div role="dialog" aria-modal="true" aria-label="스템 분리" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#232323] bg-[#141414] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white truncate">스템 분리 · {song.title || '제목 없음'}</h3>
        {phase === 'idle' && !confirming && (
          <>
            <p className="text-xs text-zinc-400">곡을 보컬과 반주(악기) 두 파일로 나눕니다. 20~60초쯤 걸리고, 결과는 보관함에 남아 언제든 다시 들을 수 있어요.</p>
            <button type="button" onClick={() => setConfirming(true)} className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-extrabold cursor-pointer">
              보컬 / 악기로 나누기 <PriceBadge milli={priceMilli} className="ml-1 !bg-black/20 !text-black" />
            </button>
          </>
        )}
        {phase === 'idle' && confirming && <PaidConfirm milli={priceMilli} what="스템 분리(보컬/악기 2트랙)" onYes={start} onNo={() => setConfirming(false)} />}
        {phase === 'processing' && <p role="status" className="text-xs text-zinc-300">나누는 중이에요… 창을 닫아도 계속 진행됩니다.</p>}
        {phase === 'done' && (urls
          ? <div className="space-y-2">{part('보컬', urls.vocals, '보컬')}{part('악기', urls.instrumental, '악기')}</div>
          : <p className="text-xs text-zinc-400">결과를 불러오는 중…</p>)}
        {phase === 'failed' && (
          <button type="button" onClick={() => { setPhase('idle'); setMsg('') }} className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-bold text-zinc-300 cursor-pointer">다시 시도</button>
        )}
        {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
        <div className="flex justify-end"><button type="button" onClick={onClose} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer">닫기</button></div>
      </div>
    </div>
  )
}
