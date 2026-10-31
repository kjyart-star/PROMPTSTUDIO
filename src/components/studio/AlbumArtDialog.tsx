'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { PaidConfirm, PriceBadge } from './PaidConfirm'
import { suiteHref } from '@/lib/basePath'

const MAX_UPLOAD = 5 * 1024 * 1024

/** 기본 그림 설명 — 곡의 제목·스타일에서 만든다(영문, 글자 없이) */
export function defaultArtPrompt(song: { title?: string | null; prompt?: string | null; genre?: string | null }) {
  const bits = [song.genre, song.prompt].filter(Boolean).join(', ').slice(0, 200)
  return `Square album cover art for a song titled "${song.title || 'Untitled'}". Mood and style: ${bits || 'modern, cinematic'}. No text, no lettering, no logos.`
}

export default function AlbumArtDialog({
  song, userId, onClose, onApply, onBalance,
}: {
  song: any
  userId: string | null
  onClose: () => void
  /** 고른 이미지 주소를 곡에 적용한다 */
  onApply: (imageUrl: string) => Promise<void> | void
  onBalance?: (milli: number) => void
}) {
  const [prompt, setPrompt] = useState(() => defaultArtPrompt(song))
  const [quote, setQuote] = useState<number | null | undefined>(undefined)
  const [confirming, setConfirming] = useState(false)
  const [phase, setPhase] = useState<'idle' | 'running' | 'done' | 'failed'>('idle')
  const [result, setResult] = useState('')
  const [msg, setMsg] = useState('')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dead = useRef(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    dead.current = false
    fetch('/api/studio/album-art?quote=1').then((r) => r.json()).then((d) => setQuote(typeof d?.creditsMilli === 'number' ? d.creditsMilli : null)).catch(() => setQuote(null))
    return () => { dead.current = true; if (timer.current) clearTimeout(timer.current) }
  }, [])

  const poll = (taskId: string, n = 0) => {
    timer.current = setTimeout(async () => {
      if (dead.current) return
      try {
        const d = await (await fetch(`/api/studio/album-art?taskId=${encodeURIComponent(taskId)}`)).json()
        if (d.status === 'done') { setResult(d.imageUrl); setPhase('done'); return }
        if (d.status === 'failed') {
          setPhase('failed')
          setMsg(`${d.error || '만들지 못했어요.'} ${d.refunded ? '크레딧은 돌려드렸어요.' : d.refundPending ? '크레딧 환불을 처리 중이에요.' : ''}`.trim())
          return
        }
      } catch { /* 다음 확인에서 다시 */ }
      if (n > 80) { setPhase('failed'); setMsg('시간이 오래 걸리고 있어요. 잠시 뒤 보관함을 새로고침해 확인해 주세요.'); return }
      poll(taskId, n + 1)
    }, n === 0 ? 2500 : 3000)
  }

  const start = async () => {
    setConfirming(false); setPhase('running'); setMsg('')
    try {
      const res = await fetch('/api/studio/album-art', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, requestId: crypto.randomUUID(), maxCreditsMilli: quote }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPhase('failed')
        setMsg(res.status === 402 ? '크레딧이 모자라요. 충전한 뒤 다시 시도해 주세요.' : `${d.error || '시작하지 못했어요.'} 크레딧은 빠지지 않았어요.`)
        return
      }
      if (typeof d.balanceMilli === 'number') onBalance?.(d.balanceMilli)
      poll(d.taskId)
    } catch {
      setPhase('failed'); setMsg('연결이 끊겼어요. 크레딧이 빠졌다면 자동으로 돌려드려요.')
    }
  }

  const upload = async (file: File) => {
    setMsg('')
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) { setMsg('PNG · JPG · WEBP 이미지만 올릴 수 있어요.'); return }
    if (file.size > MAX_UPLOAD) { setMsg('5MB 이하 이미지만 올릴 수 있어요.'); return }
    if (!userId) { setMsg('로그인이 필요해요.'); return }
    const ext = file.type.includes('png') ? 'png' : file.type.includes('webp') ? 'webp' : 'jpg'
    const supabase = createClient()
    const path = `album_art/${userId}/upload-${crypto.randomUUID()}.${ext}`
    const { error } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type })
    if (error) { setMsg('올리지 못했어요. 잠시 뒤 다시 시도해 주세요.'); return }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path)
    setResult(data.publicUrl); setPhase('done')
  }

  const running = phase === 'running'
  return (
    <div role="dialog" aria-modal="true" aria-label="앨범아트" className="fixed inset-0 z-[120] flex items-center justify-center bg-black/85 p-4" onClick={() => !running && onClose()}>
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl border border-[#232323] bg-[#141414] p-5 space-y-3" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold text-white truncate">앨범아트 · {song.title || '제목 없음'}</h3>

        {phase === 'done' && result ? (
          <div className="space-y-3">
            <img src={result} alt="새 앨범아트" className="w-full aspect-square object-cover rounded-xl" />
            <div className="flex gap-2">
              <button type="button" className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-extrabold cursor-pointer"
                onClick={async () => { await onApply(result); onClose() }}>이 이미지로 적용</button>
              <button type="button" className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-bold text-zinc-300 cursor-pointer"
                onClick={() => { setPhase('idle'); setResult('') }}>다시 만들기 / 다른 이미지</button>
            </div>
          </div>
        ) : (
          <>
            <label className="block text-xs font-bold text-zinc-300">그림 설명
              <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4} disabled={running}
                className="mt-1 w-full rounded-xl bg-[#0a0a0a] border border-[#1a1a1a] p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60" />
            </label>
            <p className="text-[11px] text-zinc-500">정사각 1024×1024 · AI 로 한 장을 만들어요 <PriceBadge milli={quote} className="ml-1" /></p>
            {confirming ? (
              <PaidConfirm milli={quote} what="앨범아트 한 장 만들기" onYes={start} onNo={() => setConfirming(false)} />
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={running || !prompt.trim()} onClick={() => setConfirming(true)}
                  className="px-4 py-2 rounded-xl bg-primary text-black text-xs font-extrabold cursor-pointer disabled:opacity-40">
                  {running ? '만드는 중…' : <>AI 로 만들기 {typeof quote === 'number' && <span>✦{Math.ceil(quote / 1000)}</span>}</>}
                </button>
                <button type="button" disabled={running} onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 rounded-xl border border-[#262626] text-xs font-bold text-zinc-300 cursor-pointer disabled:opacity-40">내 이미지 올리기 <span className="text-emerald-400">무료</span></button>
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) upload(f) }} />
              </div>
            )}
          </>
        )}
        {running && <p role="status" className="text-xs text-zinc-400">그림을 만들고 있어요. 보통 10~30초 걸립니다.</p>}
        {msg && <p role="alert" className="text-xs text-red-400">{msg}</p>}
        {msg.includes('크레딧이 모자라요') && (
          <a href={suiteHref('/pricing')} className="inline-block text-xs font-bold text-primary hover:underline">크레딧 충전하러 가기 →</a>
        )}
        <div className="flex justify-end pt-1">
          <button type="button" onClick={onClose} disabled={running} className="px-4 py-2 text-xs font-bold text-zinc-300 rounded-xl border border-[#262626] cursor-pointer disabled:opacity-40">닫기</button>
        </div>
      </div>
    </div>
  )
}
