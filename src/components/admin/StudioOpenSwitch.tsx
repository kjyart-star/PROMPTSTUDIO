'use client'

import { useEffect, useState } from 'react'

/** 관리자 대시보드의 「스튜디오 공개」 스위치 — 켜면 로그인한 사용자 누구나 유료 기능 포함 스튜디오를 쓴다 */
export default function StudioOpenSwitch() {
  const [open, setOpen] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    fetch('/api/admin/studio-open').then((r) => r.json()).then((d) => setOpen(typeof d.open === 'boolean' ? d.open : null)).catch(() => setOpen(null))
  }, [])

  const toggle = async () => {
    if (open === null || busy) return
    const next = !open
    if (next && !window.confirm('스튜디오를 모든 로그인 사용자에게 공개합니다. 생성·커버·스템·앨범아트 등 유료 기능도 크레딧으로 쓸 수 있게 됩니다. 켤까요?')) return
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/admin/studio-open', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ open: next }) })
      if (!res.ok) throw new Error()
      setOpen(next)
    } catch { setErr('바꾸지 못했어요. 다시 시도해 주세요.') }
    setBusy(false)
  }

  return (
    <div className="bg-[#161616] border border-[#232323] rounded-2xl p-5 flex flex-wrap items-center gap-4">
      <div className="flex-1 min-w-[14rem]">
        <h2 className="text-sm font-bold text-white">스튜디오 공개</h2>
        <p className="text-xs text-slate-400 mt-1">
          {open === null ? '상태를 불러오는 중…' : open ? '지금 로그인한 사용자 누구나 스튜디오(유료 기능 포함)를 쓸 수 있어요.' : '지금은 관리자만 쓸 수 있어요(오픈 전).'}
        </p>
        {err && <p role="alert" className="text-xs text-red-400 mt-1">{err}</p>}
      </div>
      <button type="button" role="switch" aria-checked={!!open} aria-label="스튜디오 공개" disabled={open === null || busy} onClick={toggle}
        className={`w-14 h-8 rounded-full transition-colors motion-reduce:transition-none flex items-center px-1 cursor-pointer disabled:opacity-50 ${open ? 'bg-primary' : 'bg-zinc-700'}`}>
        <span className={`w-6 h-6 rounded-full bg-black transition-transform motion-reduce:transition-none ${open ? 'translate-x-6' : 'translate-x-0'}`} />
      </button>
    </div>
  )
}
