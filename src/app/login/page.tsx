'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { AlertCircle, CheckCircle2, Sparkles, ArrowRight, MailCheck } from 'lucide-react'
import Image from 'next/image'
import { readRedirectParam } from '@/lib/auth/redirectTarget'

function LoginContent() {
  const searchParams = useSearchParams()
  // 허브는 `redirect`, 앱 안의 가드는 `next` 를 쓴다. 허용 목록 밖이면 기본 동선으로 떨어진다.
  const nextPath = readRedirectParam(searchParams)
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
        window.location.href = nextPath
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '로그인에 실패했습니다.')
      }

      window.location.href = nextPath
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password, next: nextPath }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || '가입에 실패했습니다.')
      }

      // 이메일 확인이 켜져 있어(mailer_autoconfirm: false) 대개 세션 없이 돌아온다.
      // 그 사실을 말해 주지 않으면 사용자는 왜 못 들어가는지 모른다.
      if (data.needsConfirmation) {
        setNotice(`${email} 로 확인 메일을 보냈습니다. 메일의 링크를 눌러야 로그인할 수 있습니다.`)
        setPassword('')
      } else {
        window.location.href = nextPath
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
          redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(nextPath)}`,
        },
      })
      if (oauthError) throw oauthError
    } catch (err: any) {
      setError(err.message || '구글 로그인 연동에 실패했습니다.')
    }
  }

  return (
    <div className="min-h-screen bg-[#0e0e0e] flex font-sans selection:bg-[#e3fe06] selection:text-black">
      
      {/* Left Side - Brand & Features with Music Background */}
      <div className="hidden lg:flex flex-col w-1/2 p-12 lg:p-20 justify-between relative overflow-hidden">
        
        {/* Background Image with Dark Overlay */}
        <div className="absolute inset-0 z-0">
          <Image 
            src="/images/login-bg-cookie.webp"
            alt="쿠키뮤직 로그인 화면 배경"
            fill
            className="object-cover object-center opacity-100"
            priority
            unoptimized={true}
          />
          {/* Gradient overlay for text readability */}
          <div className="absolute inset-0 bg-gradient-to-b from-black/90 via-black/50 to-black/30"></div>
        </div>
        
        {/* Background glow effect (Subtle neon yellow) */}
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#e3fe06]/15 blur-[120px] rounded-full pointer-events-none z-0" />
        
        <div className="relative z-10">
          <div className="mb-16">
            {/* 전용 로고 이미지가 없어 워드마크는 타이포로 둔다 */}
            <div className="flex flex-col gap-1 select-none">
              <span className="text-[34px] font-black tracking-tight leading-none text-[#e3fe06] drop-shadow-md">쿠키뮤직</span>
              <span className="text-[10px] font-bold tracking-[0.3em] leading-none text-white/60">COOKIEMUSIC</span>
            </div>
          </div>
          
          <h1 className="text-4xl lg:text-5xl font-black text-white leading-tight mb-6 tracking-tight drop-shadow-lg">
            나만의 AI<br/>
            <span className="text-[#e3fe06]">음악 스튜디오</span>
          </h1>
          
          <p className="text-gray-300 text-sm leading-relaxed max-w-md drop-shadow-md font-medium">
            프롬프트 하나로 당신만의 트랙을 완성하고, 글로벌 차트에 도전하여 전 세계 크리에이터들과 당신의 음악을 공유해 보세요.
          </p>
        </div>

        <div className="space-y-8 relative z-10">
          {/* Check list */}
          <div className="space-y-4 bg-black/20 p-5 rounded-2xl backdrop-blur-sm border border-white/5">
            <div className="flex items-center gap-3 text-sm text-gray-200 font-medium drop-shadow-md">
              <CheckCircle2 className="text-[#e3fe06] w-5 h-5 shrink-0 drop-shadow-[0_0_5px_rgba(227,254,6,0.5)]"/> 
              클래식부터 EDM까지, 모든 장르의 AI 음악 생성
            </div>
            <div className="flex items-center gap-3 text-sm text-gray-200 font-medium drop-shadow-md">
              <CheckCircle2 className="text-[#e3fe06] w-5 h-5 shrink-0 drop-shadow-[0_0_5px_rgba(227,254,6,0.5)]"/> 
              트렌디한 AI 트랙을 감상하고 교류하는 글로벌 플레이리스트
            </div>
          </div>

          {/* Feature box */}
          <div className="border border-[#e3fe06]/30 bg-gradient-to-br from-[#121401]/90 to-[#0a0c01]/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl relative overflow-hidden">
            {/* Inner glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[#e3fe06]/10 blur-[40px] rounded-full pointer-events-none"></div>

            <div className="flex items-center gap-2 mb-5 relative z-10">
              <Sparkles className="text-[#e3fe06] w-5 h-5"/>
              <span className="text-[#e3fe06] font-bold tracking-widest text-sm drop-shadow-md">쿠키뮤직으로 할 수 있는 것</span>
            </div>
            <ul className="space-y-4 relative z-10">
              <li className="flex gap-3 text-xs text-gray-300 items-center font-medium">
                <div className="w-5 h-5 rounded-full bg-[#e3fe06]/20 border border-[#e3fe06]/40 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(227,254,6,0.2)]">
                  <CheckCircle2 className="w-3 h-3 text-[#e3fe06]"/>
                </div>
                <span>나만의 가사와 프롬프트로 <span className="text-[#e3fe06] font-bold">완벽한 고음질 곡 제작</span></span>
              </li>
              <li className="flex gap-3 text-xs text-gray-300 items-center font-medium">
                <div className="w-5 h-5 rounded-full bg-[#e3fe06]/20 border border-[#e3fe06]/40 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(227,254,6,0.2)]">
                  <CheckCircle2 className="w-3 h-3 text-[#e3fe06]"/>
                </div>
                <span>월 구독료 없이 <span className="text-[#e3fe06] font-bold">쓴 만큼만 내는 크레딧 요금제</span></span>
              </li>
              <li className="flex gap-3 text-xs text-gray-300 items-center font-medium">
                <div className="w-5 h-5 rounded-full bg-[#e3fe06]/20 border border-[#e3fe06]/40 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(227,254,6,0.2)]">
                  <CheckCircle2 className="w-3 h-3 text-[#e3fe06]"/>
                </div>
                생성된 모든 트랙의 상업적 이용 및 소유권 제공
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form (Centered) */}
      <div className="w-full lg:w-1/2 flex flex-col items-center justify-center p-8 bg-[#0e0e0e] relative z-10 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        
        {/* Mobile Logo */}
        <div className="absolute top-0 right-0 p-6 flex lg:hidden">
          <div className="flex items-center">
            <span className="text-[18px] font-black tracking-tight leading-none text-[#e3fe06] drop-shadow-md select-none">쿠키뮤직</span>
          </div>
        </div>

        {/* Centered Login Container */}
        <div className="w-full max-w-[360px] flex flex-col justify-center items-center h-full">
          
          <div className="mb-10 text-center w-full">
            <h2 className="text-2xl font-extrabold text-white mb-2">
              {mode === 'signup' ? '쿠키뮤직 가입하기' : '환영합니다'}
            </h2>
            <p className="text-gray-400 text-xs font-medium">
              {mode === 'signup'
                ? '이메일만 있으면 바로 시작할 수 있습니다'
                : '나만의 AI 스튜디오에 접속하세요'}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full p-3 mb-6 rounded-xl bg-red-950/30 border border-red-500/20 text-red-200 text-xs flex items-center justify-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* 확인 메일 안내 */}
          {notice && (
            <div className="w-full p-3 mb-6 rounded-xl bg-[#121401] border border-[#e3fe06]/30 text-[#e3fe06] text-xs flex items-start gap-2 text-left">
              <MailCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{notice}</span>
            </div>
          )}

          {/* Google Login */}
          <button
            id="btn-google-login"
            onClick={handleGoogleLogin}
            type="button"
            className="w-full py-3.5 px-4 rounded-xl bg-white text-black font-extrabold hover:bg-gray-100 transition-all flex items-center justify-center gap-3 text-sm shadow-[0_4px_15px_rgba(255,255,255,0.1)] cursor-pointer"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
              <g transform="matrix(1, 0, 0, 1, 0, 0)">
                <path d="M21.35,11.1H12v2.7h5.38C17.15,15.11,15.42,16.5,12,16.5c-3.59,0-6.5-2.91-6.5-6.5S8.41,3.5,12,3.5c1.72,0,3.28,0.67,4.45,1.75l2.02-2.02C16.65,1.55,14.48,0.8,12,0.8C6.92,0.8,2.8,4.92,2.8,10s4.12,9.2,9.2,9.2c5.3,0,9.23-3.72,9.23-9.2C21.23,11.75,21.31,11.1,21.35,11.1z" fill="currentColor" />
              </g>
            </svg>
            {mode === 'signup' ? 'Google로 가입' : 'Google로 로그인'}
          </button>

          <div className="relative flex py-6 items-center w-full">
            <div className="flex-grow border-t border-white/5"></div>
            <span className="flex-shrink mx-4 text-white/30 text-[10px] font-medium tracking-wide">또는 이메일로 계속하기</span>
            <div className="flex-grow border-t border-white/5"></div>
          </div>

          {/* Credentials Form */}
          <form onSubmit={mode === 'signup' ? handleSignup : handleLogin} className="space-y-4 w-full">
            <div className="w-full">
              <label htmlFor="email-input" className="block text-[11px] font-semibold text-gray-400 mb-1.5 ml-1 text-left">
                이메일
              </label>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-[#141414] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#e3fe06] focus:bg-[#1a1a1a] focus:ring-1 focus:ring-[#e3fe06]/50 transition-all text-sm font-medium"
                placeholder="name@example.com"
              />
            </div>

            <div className="w-full">
              <label htmlFor="password-input" className="block text-[11px] font-semibold text-gray-400 mb-1.5 ml-1 text-left">
                비밀번호
              </label>
              <input
                id="password-input"
                type="password"
                required
                minLength={mode === 'signup' ? 6 : undefined}
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 rounded-xl bg-[#141414] border border-white/10 text-white placeholder-gray-600 focus:outline-none focus:border-[#e3fe06] focus:bg-[#1a1a1a] focus:ring-1 focus:ring-[#e3fe06]/50 transition-all text-sm font-medium"
                placeholder={mode === 'signup' ? '6자 이상' : '••••••••'}
              />
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-3.5 px-4 mt-4 rounded-xl bg-[#e3fe06] hover:bg-[#cbe304] text-black font-extrabold transition-all disabled:opacity-50 text-sm flex items-center justify-center gap-2 group shadow-[0_0_15px_rgba(227,254,6,0.3)] hover:shadow-[0_0_20px_rgba(227,254,6,0.5)] cursor-pointer disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'signup' ? '가입 중...' : '로그인 중...'
                : mode === 'signup' ? '가입하기' : '로그인'}
              {!loading && <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="text-center mt-6 w-full">
            {mode === 'signup' ? (
              <p className="text-gray-500 text-xs font-medium">
                이미 계정이 있으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className="text-white font-bold hover:text-[#e3fe06] hover:underline transition-colors cursor-pointer"
                >
                  로그인하기
                </button>
              </p>
            ) : (
              <p className="text-gray-500 text-xs font-medium">
                계정이 없으신가요?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className="text-white font-bold hover:text-[#e3fe06] hover:underline transition-colors cursor-pointer"
                >
                  무료 가입하기
                </button>
              </p>
            )}
          </div>

          <div className="mt-12 w-full flex justify-center">
            <p className="text-center text-[#555555] text-[10px] leading-relaxed font-medium">
              계속 진행 시 다음 내용에 동의하게 됩니다.<br/>
              <a href="#" className="underline hover:text-gray-300 transition-colors">이용약관</a> 및 <a href="#" className="underline hover:text-gray-300 transition-colors">개인정보처리방침</a>
            </p>
          </div>

          {/* 쿠키플레이 소속 표기 */}
          <div className="mt-6 w-full flex flex-col items-center gap-1">
            <a
              href="https://cookieplay.app"
              target="_blank"
              rel="noreferrer noopener"
              className="text-[11px] font-semibold text-[#777] hover:text-[#e3fe06] transition-colors"
            >
              🍪 CookiePlay
            </a>
            <span className="text-[10px] text-[#555555]">© 2026 APPLESEED</span>
          </div>
        </div>
      </div>
      
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0e0e0e] flex items-center justify-center"><div className="w-8 h-8 border-4 border-[#e3fe06] border-t-transparent rounded-full animate-spin"></div></div>}>
      <LoginContent />
    </Suspense>
  )
}
