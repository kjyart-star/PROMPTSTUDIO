'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, Check, ArrowRight, MailCheck } from 'lucide-react'
import Image from 'next/image'
import { readRedirectParam } from '@/lib/auth/redirectTarget'
import { withBase } from '@/lib/basePath'

/**
 * 쿠키플레이 통합 로그인 관문.
 *
 * 이 화면은 물리적으로 쿠키뮤직 앱 안에 살지만 **쿠키뮤직의 로그인이 아니다.**
 * 쿠키플레이 계정 하나로 허브와 모든 서비스에 들어가는 문이라, 브랜드는 쿠키플레이로
 * 쓴다. 뮤직 앱의 다른 화면들은 쿠키뮤직 브랜드 그대로다 — 여기만 예외다.
 */
function LoginContent() {
  const searchParams = useSearchParams()
  // 허브는 `redirect`, 앱 안의 가드는 `next` 를 쓴다. 허용 목록 밖이면 기본 동선으로 떨어진다.
  // 기본 동선은 **쿠키플레이 홈**이다(대표 2026-08-28: "로그인하면 쿠키플레이 화면"). 이 앱은
  // basePath /music 위에 살아서 '/' 를 그대로 두면 뮤직 홈으로 떨어진다 — 관문은 쿠키플레이
  // 관문이므로, 목적지를 따로 실어 오지 않은 로그인은 허브 루트(현재 오리진의 /)로 보낸다.
  // 뮤직 앱 내부 가드는 언제나 `next` 를 명시하므로 이 기본값에 걸리지 않는다.
  const nextPath = readRedirectParam(
    searchParams,
    typeof window === 'undefined' ? '/' : `${window.location.origin}/`
  )
  // `?switch=1` 은 "세션이 있어도 폼을 보여달라" — 계정을 바꾸려는 사람의 길이다.
  const forceForm = searchParams.get('switch') === '1'

  const [mode, setMode] = useState<'login' | 'signup'>(
    searchParams.get('mode') === 'signup' ? 'signup' : 'login'
  )
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 로그인 세션이 이미 존재하면 리다이렉트
  useEffect(() => {
    if (forceForm) return
    const supabase = createClient()
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // 목적지가 다른 오리진(쿠키플레이 허브)일 수 있어 router.push 로는 못 간다.
        window.location.href = withBase(nextPath)
      }
    }
    checkUser()
  }, [router, nextPath, forceForm])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '로그인에 실패했습니다.')

      window.location.href = withBase(nextPath)
    } catch (err: any) {
      setError(err.message || '로그인에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setNotice(null)

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, next: nextPath }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '가입에 실패했습니다.')

      // 이메일 확인이 켜져 있어(mailer_autoconfirm: false) 대개 세션 없이 돌아온다.
      // 그 사실을 말해 주지 않으면 사용자는 왜 못 들어가는지 모른다.
      if (data.needsConfirmation) {
        setNotice(`${email} 로 확인 메일을 보냈습니다. 메일의 링크를 눌러야 로그인할 수 있습니다.`)
        setPassword('')
      } else {
        window.location.href = withBase(nextPath)
      }
    } catch (err: any) {
      setError(err.message || '가입에 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = (next: 'login' | 'signup') => {
    setMode(next)
    setError(null)
    setNotice(null)
  }

  const handleGoogleLogin = async () => {
    setError(null)
    try {
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}${withBase('/api/auth/callback')}?next=${encodeURIComponent(nextPath)}`,
        },
      })
      if (oauthError) throw oauthError
    } catch (err: any) {
      setError(err.message || '구글 로그인 연동에 실패했습니다.')
    }
  }

  const isSignup = mode === 'signup'

  return (
    <div className="min-h-screen bg-[#0d0d0d] flex font-sans selection:bg-[#8251f6] selection:text-white">

      {/* 왼쪽 — 쿠키플레이 브랜드 패널 */}
      <div className="hidden lg:flex flex-col w-1/2 p-12 lg:p-16 justify-between relative overflow-hidden">

        <div className="absolute inset-0 z-0">
          <Image
            src={withBase('/images/auth-cookie-dj.webp')}
            alt=""
            aria-hidden="true"
            fill
            className="object-cover object-center"
            priority
            unoptimized={true}
          />
          {/* 위아래를 눌러 글자가 읽히게 한다 — 캐릭터가 있는 가운데는 살린다 */}
          <div className="absolute inset-0 bg-gradient-to-b from-[#0d0d0d] via-[#0d0d0d]/25 to-[#0d0d0d]" />
        </div>

        <div className="relative z-10">
          <Wordmark className="mb-14" />

          <h1 className="text-4xl xl:text-5xl font-black text-white leading-[1.15] mb-5 tracking-tight">
            쿠키플레이 계정 하나로<br />
            <span className="text-[#b6cc14]">만들고, 올리고, 즐깁니다</span>
          </h1>

          <p className="text-[#dedede] text-sm leading-relaxed max-w-md">
            하나의 계정으로 쿠키컷 영상 편집부터 쿠키픽스·쿠키일러스트·쿠키뮤직까지
            전부 잇습니다. 편집 도구는 계정 없이도 무료입니다.
          </p>
        </div>

        <ul className="relative z-10 space-y-3">
          {[
            '쿠키컷 — 영상 편집, 설치 없이 무료',
            '쿠키픽스 · 쿠키일러스트 — 사진 보정과 벡터 드로잉',
            '쿠키뮤직 — 업로드 · 내 채널 · 좋아요 · 플레이리스트',
            '쿠키플레이 서비스 어디서나 같은 계정',
          ].map((item) => (
            <li key={item} className="flex items-center gap-3 text-sm text-[#dedede]">
              <span className="w-5 h-5 rounded-full bg-[#8251f6] flex items-center justify-center shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* 오른쪽 — 폼 */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-[#0d0d0d] relative z-10 lg:border-l lg:border-[#292929]">

        {/* 모바일에서는 왼쪽 패널이 없으니 워드마크를 여기 둔다 */}
        <div className="absolute top-0 left-0 p-6 flex lg:hidden">
          <Wordmark compact />
        </div>

        <div className="w-full max-w-[360px] flex flex-col items-center">

          <div className="mb-8 text-center w-full">
            <h2 className="text-2xl font-extrabold text-white mb-2">
              {isSignup ? '쿠키플레이 계정 만들기' : '쿠키플레이 계정으로 로그인'}
            </h2>
            <p className="text-[#a1a1a1] text-xs">
              {isSignup
                ? '이메일만 있으면 바로 시작할 수 있습니다'
                : '계정 하나로 쿠키플레이의 모든 서비스를 씁니다'}
            </p>
          </div>

          {error && (
            <div className="w-full p-3 mb-5 rounded-[8px] bg-[#2a1416] border border-[#7f1d1d] text-[#fca5a5] text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {notice && (
            <div className="w-full p-3 mb-5 rounded-[8px] bg-[#181233] border border-[#8251f6]/50 text-[#c4b5fd] text-xs flex items-start gap-2 text-left">
              <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{notice}</span>
            </div>
          )}

          {/* 구글 버튼은 흰 배경 유지 — 구글 브랜드 관례다 */}
          <button
            id="btn-google-login"
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3.5 px-4 rounded-[8px] bg-white text-[#1f2328] font-bold hover:bg-[#f1f1f1] transition-colors flex items-center justify-center gap-3 text-sm cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <path d="M21.35,11.1H12v2.7h5.38C17.15,15.11,15.42,16.5,12,16.5c-3.59,0-6.5-2.91-6.5-6.5S8.41,3.5,12,3.5c1.72,0,3.28,0.67,4.45,1.75l2.02-2.02C16.65,1.55,14.48,0.8,12,0.8C6.92,0.8,2.8,4.92,2.8,10s4.12,9.2,9.2,9.2c5.3,0,9.23-3.72,9.23-9.2C21.23,11.75,21.31,11.1,21.35,11.1z" fill="currentColor" />
            </svg>
            {isSignup ? 'Google로 가입' : 'Google로 로그인'}
          </button>

          <div className="relative flex py-5 items-center w-full">
            <div className="flex-grow border-t border-[#292929]" />
            <span className="flex-shrink mx-4 text-[#a1a1a1] text-[10px] tracking-wide">또는 이메일로 계속하기</span>
            <div className="flex-grow border-t border-[#292929]" />
          </div>

          <form onSubmit={isSignup ? handleSignup : handleLogin} className="space-y-4 w-full">
            <div className="w-full">
              <label htmlFor="email-input" className="block text-[11px] font-semibold text-[#a1a1a1] mb-1.5 ml-1 text-left">
                이메일
              </label>
              <input
                id="email-input"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-[8px] bg-[#0d0d0d] border border-[#292929] text-white placeholder-[#5a5a5a] focus:outline-none focus:border-[#8251f6] focus:ring-1 focus:ring-[#8251f6]/50 transition-colors text-sm"
                placeholder="name@example.com"
              />
            </div>

            <div className="w-full">
              <label htmlFor="password-input" className="block text-[11px] font-semibold text-[#a1a1a1] mb-1.5 ml-1 text-left">
                비밀번호
              </label>
              <input
                id="password-input"
                type="password"
                required
                minLength={isSignup ? 6 : undefined}
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-[8px] bg-[#0d0d0d] border border-[#292929] text-white placeholder-[#5a5a5a] focus:outline-none focus:border-[#8251f6] focus:ring-1 focus:ring-[#8251f6]/50 transition-colors text-sm"
                placeholder={isSignup ? '6자 이상' : '••••••••'}
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-4 rounded-[8px] bg-[#8251f6] hover:bg-[#7042e0] text-white font-bold transition-colors disabled:opacity-50 text-sm flex items-center justify-center gap-2 group cursor-pointer disabled:cursor-not-allowed"
            >
              {loading
                ? isSignup ? '가입 중...' : '로그인 중...'
                : isSignup ? '가입하기' : '로그인'}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="text-center mt-6 w-full">
            {isSignup ? (
              <p className="text-[#a1a1a1] text-xs">
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-white font-bold hover:text-[#b6cc14] hover:underline transition-colors cursor-pointer"
                >
                  로그인하기
                </button>
              </p>
            ) : (
              <p className="text-[#a1a1a1] text-xs">
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-white font-bold hover:text-[#b6cc14] hover:underline transition-colors cursor-pointer"
                >
                  무료 가입하기
                </button>
              </p>
            )}
          </div>

          <div className="mt-10 w-full flex justify-center">
            <p className="text-center text-[#5a5a5a] text-[10px] leading-relaxed">
              계속 진행 시 다음 내용에 동의하게 됩니다.<br />
              <a href="#" className="underline hover:text-[#a1a1a1] transition-colors">이용약관</a> 및{' '}
              <a href="#" className="underline hover:text-[#a1a1a1] transition-colors">개인정보처리방침</a>
            </p>
          </div>

          <div className="mt-6 w-full flex flex-col items-center gap-1">
            <a
              href="https://cookieplay.app"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] font-semibold text-[#a1a1a1] hover:text-[#b6cc14] transition-colors"
            >
              🍪 CookiePlay
            </a>
            <span className="text-[10px] text-[#5a5a5a]">© 2026 APPLESEED</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 허브 헤더와 같은 락업 — COOKIE 는 라임, PLAY 는 흰색. */
function Wordmark({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  // 로고를 누르면 쿠키플레이 메인으로 — 대표 확정 동선. 일반 <a href="/"> 는
  // basePath 가 붙지 않아 window.location.origin + '/' (쿠키플레이 홈)로 간다.
  return (
    <a href="/" className={`flex items-center gap-2 select-none w-fit ${className}`}>
      <span className={compact ? 'text-[18px]' : 'text-[26px]'} aria-hidden="true">🍪</span>
      <span className={`${compact ? 'text-[16px]' : 'text-[24px]'} font-black tracking-tight leading-none`}>
        <span className="text-[#b6cc14]">COOKIE</span>
        <span className="text-white">PLAY</span>
      </span>
    </a>
  )
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0d0d0d] flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-[#8251f6] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  )
}
