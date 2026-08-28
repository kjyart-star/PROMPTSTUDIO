'use client'

import React, { useEffect, useState } from 'react'
import { ShieldAlert, Loader2, Key } from 'lucide-react'

export function AdminAuthGuard({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null)
  const [idInput, setIdInput] = useState('')
  const [pwInput, setPwInput] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    // 탭을 닫으면 지워지는 sessionStorage를 이용해 보안성 강화
    const auth = sessionStorage.getItem('admin_authenticated')
    if (auth === 'true') {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
  }, [])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMsg('')
    setIsSubmitting(true)

    // 자격 증명은 서버에서 검증 (비밀번호가 클라이언트 번들에 노출되지 않도록)
    try {
      const res = await fetch('/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: idInput, password: pwInput }),
      })
      if (res.ok) {
        sessionStorage.setItem('admin_authenticated', 'true')
        setIsAuthenticated(true)
      } else {
        setErrorMsg('아이디 또는 비밀번호가 올바르지 않습니다.')
        setPwInput('')
      }
    } catch {
      setErrorMsg('인증 요청에 실패했습니다. 다시 시도해 주세요.')
    } finally {
      setIsSubmitting(false)
    }
  }

  // 인증 상태 로딩 중
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-[#0d0d0d] text-[#e4e4e4] flex items-center justify-center font-sans">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    )
  }

  // 인증이 완료되었으면 실제 어드민 화면 렌더링
  if (isAuthenticated) {
    return <>{children}</>
  }

  // 인증 폼 렌더링 (브랜드 테마: #0d0d0d 배경 & #ff2d8f 핵심 포인트 색상)
  return (
    <div className="min-h-screen bg-[#0d0d0d] text-[#e4e4e4] flex items-center justify-center p-4 font-sans selection:bg-primary/30">
      <div className="w-full max-w-md bg-[#161616] border border-[#232323] rounded-2xl shadow-2xl p-8 space-y-6 animate-in fade-in zoom-in-95 duration-250">
        
        {/* 심볼 및 타이틀 */}
        <div className="flex flex-col items-center text-center space-y-2">
          <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Key className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black tracking-wide text-white">어드민 2차 보안 인증</h2>
          <p className="text-xs text-slate-400">
            관리자 보호를 위해 2차 계정 정보 인증이 필요합니다.
          </p>
        </div>

        {/* 폼 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              관리자 아이디
            </label>
            <input
              type="text"
              required
              value={idInput}
              onChange={(e) => setIdInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#232323] text-slate-200 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="ID 입력"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              비밀번호
            </label>
            <input
              type="password"
              required
              value={pwInput}
              onChange={(e) => setPwInput(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-[#0a0a0a] border border-[#232323] text-slate-200 focus:outline-none focus:border-primary transition-colors text-sm"
              placeholder="비밀번호 입력"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-950/20 border border-red-900/30 text-red-400 text-xs rounded-xl flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full flex items-center justify-center gap-1.5 py-3 rounded-xl bg-primary text-black font-bold text-sm hover:bg-[#e51d75] active:scale-[0.98] transition-all disabled:opacity-50 mt-6 shadow-lg shadow-primary/10"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              '로그인'
            )}
          </button>
        </form>

      </div>
    </div>
  )
}
