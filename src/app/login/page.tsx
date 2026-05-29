'use client'

import { useState, use, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Music, AlertCircle } from 'lucide-react'

interface PageProps {
  searchParams: Promise<{
    next?: string
  }>
}

export default function LoginPage({ searchParams }: PageProps) {
  const params = use(searchParams)
  const nextPath = params.next || '/'
  
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // 로그인 세션이 이미 존재하면 리다이렉트
  useEffect(() => {
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        router.push(nextPath)
      }
    }
    checkUser()
  }, [supabase, router, nextPath])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md space-y-8 bg-surface-container-lowest/80 p-8 rounded-2xl border border-outline-variant backdrop-blur-sm shadow-2xl">
        
        {/* Logo Section */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-primary/10 text-primary border border-primary/20 mb-2">
            <Music className="w-6 h-6 animate-bounce" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            AI Music Admin Portal
          </h2>
          <p className="text-sm text-on-surface-variant">
            관리자 계정으로 로그인하여 플랫폼을 관리하세요
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 rounded-xl bg-red-950/30 border border-red-500/20 text-red-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Credentials Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email-input" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              이메일 주소
            </label>
            <input
              id="email-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-foreground placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
              placeholder="admin@example.com"
            />
          </div>

          <div>
            <label htmlFor="password-input" className="block text-xs font-semibold text-on-surface-variant uppercase tracking-wider mb-2">
              비밀번호
            </label>
            <input
              id="password-input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-surface-container border border-outline-variant text-foreground placeholder-on-surface-variant/40 focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all text-sm"
              placeholder="••••••••"
            />
          </div>

          <button
            id="btn-login-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-primary hover:bg-[#d2eb05] text-[#080d08] font-black shadow-lg shadow-primary/10 transition-all disabled:opacity-50 text-sm cursor-pointer"
          >
            {loading ? '로그인 중...' : '이메일로 로그인'}
          </button>
        </form>

        <div className="relative flex py-2 items-center">
          <div className="flex-grow border-t border-outline-variant"></div>
          <span className="flex-shrink mx-4 text-on-surface-variant/60 text-xs font-semibold uppercase tracking-wider">or</span>
          <div className="flex-grow border-t border-outline-variant"></div>
        </div>

        {/* Social Login */}
        <button
          id="btn-google-login"
          onClick={handleGoogleLogin}
          type="button"
          className="w-full py-3 px-4 rounded-xl bg-surface-container hover:bg-surface-container-high border border-outline-variant text-foreground font-semibold transition-all flex items-center justify-center gap-2 text-sm cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
            <g transform="matrix(1, 0, 0, 1, 0, 0)">
              <path d="M21.35,11.1H12v2.7h5.38C17.15,15.11,15.42,16.5,12,16.5c-3.59,0-6.5-2.91-6.5-6.5S8.41,3.5,12,3.5c1.72,0,3.28,0.67,4.45,1.75l2.02-2.02C16.65,1.55,14.48,0.8,12,0.8C6.92,0.8,2.8,4.92,2.8,10s4.12,9.2,9.2,9.2c5.3,0,9.23-3.72,9.23-9.2C21.23,11.75,21.31,11.1,21.35,11.1z" fill="currentColor" />
            </g>
          </svg>
          Google 계정으로 로그인
        </button>

      </div>
    </div>
  )
}
