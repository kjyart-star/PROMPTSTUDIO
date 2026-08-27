'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Camera, Check, AlertCircle, LogOut, ArrowLeft } from 'lucide-react'

/**
 * 쿠키플레이 계정 설정 — 실제로 동작하는 것만 놓는다.
 *
 * - 프로필 사진: Supabase Storage `avatars` 버킷(기존 업로드 경로 재사용) → profiles.avatar_url
 * - 표시 이름: PUT /api/profile → profiles.display_name
 * - 이메일: 읽기 전용 표시
 * - 비밀번호: supabase.auth.updateUser
 * - 로그아웃: 기존 /api/auth/signout 라우트
 *
 * 결제·구독 같은 없는 기능은 자리도 만들지 않는다.
 * fetch('/api/...') 는 BasePathFetch 가 /music 을 붙여 준다.
 */

interface Props {
  user: { id: string; email?: string | null; app_metadata?: { providers?: string[] } }
}

type Status = { type: 'success' | 'error'; message: string } | null

function StatusLine({ status }: { status: Status }) {
  if (!status) return null
  return status.type === 'success' ? (
    <p className="flex items-center gap-1.5 text-[11px] text-[#b6cc14] mt-2">
      <Check className="w-3.5 h-3.5 shrink-0" strokeWidth={3} />
      {status.message}
    </p>
  ) : (
    <p className="flex items-center gap-1.5 text-[11px] text-[#fca5a5] mt-2">
      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
      {status.message}
    </p>
  )
}

const inputCls =
  'w-full px-4 py-3 rounded-[8px] bg-[#0d0d0d] border border-[#292929] text-white placeholder-[#5a5a5a] focus:outline-none focus:border-[#8251f6] focus:ring-1 focus:ring-[#8251f6]/50 transition-colors text-sm'
const buttonCls =
  'py-2.5 px-5 rounded-[8px] bg-[#8251f6] hover:bg-[#7042e0] text-white font-bold transition-colors disabled:opacity-50 text-sm cursor-pointer disabled:cursor-not-allowed'

export default function AccountClient({ user }: Props) {
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [displayName, setDisplayName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [profileLoadError, setProfileLoadError] = useState(false)

  const [nameStatus, setNameStatus] = useState<Status>(null)
  const [avatarStatus, setAvatarStatus] = useState<Status>(null)
  const [passwordStatus, setPasswordStatus] = useState<Status>(null)

  const [savingName, setSavingName] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [signingOut, setSigningOut] = useState(false)

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // 구글로만 로그인한 계정은 "변경"이 아니라 "설정"이다 — 문구를 정직하게 맞춘다.
  const hasEmailProvider = (user.app_metadata?.providers ?? []).includes('email')

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/api/profile')
        if (!res.ok) throw new Error('load failed')
        const data = await res.json()
        if (cancelled) return
        setDisplayName(data.display_name || '')
        setAvatarUrl(data.avatar_url || '')
      } catch {
        if (!cancelled) setProfileLoadError(true)
      } finally {
        if (!cancelled) setLoadingProfile(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  const saveDisplayName = async () => {
    setSavingName(true)
    setNameStatus(null)
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ display_name: displayName.trim() }),
      })
      if (!res.ok) throw new Error()
      setNameStatus({ type: 'success', message: '표시 이름을 저장했습니다.' })
    } catch {
      setNameStatus({ type: 'error', message: '저장하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setSavingName(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setAvatarStatus({ type: 'error', message: '이미지는 2MB 이내여야 합니다.' })
      return
    }
    setUploadingAvatar(true)
    setAvatarStatus(null)
    try {
      // 뮤직 설정과 같은 avatars 버킷·같은 이름 규칙 — 저장소를 하나로 유지한다.
      const fileName = `${user.id}-avatar-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(fileName, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar_url: data.publicUrl }),
      })
      if (!res.ok) throw new Error()
      setAvatarUrl(data.publicUrl)
      setAvatarStatus({ type: 'success', message: '프로필 사진을 바꿨습니다.' })
    } catch {
      setAvatarStatus({ type: 'error', message: '업로드하지 못했습니다. 잠시 후 다시 시도해 주세요.' })
    } finally {
      setUploadingAvatar(false)
    }
  }

  const savePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordStatus(null)
    if (newPassword.length < 6) {
      setPasswordStatus({ type: 'error', message: '비밀번호는 6자 이상이어야 합니다.' })
      return
    }
    if (newPassword !== confirmPassword) {
      setPasswordStatus({ type: 'error', message: '두 비밀번호가 서로 다릅니다.' })
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      setConfirmPassword('')
      setPasswordStatus({ type: 'success', message: hasEmailProvider ? '비밀번호를 바꿨습니다.' : '비밀번호를 설정했습니다. 이제 이메일로도 로그인할 수 있습니다.' })
    } catch (err: any) {
      setPasswordStatus({ type: 'error', message: err?.message || '비밀번호를 바꾸지 못했습니다.' })
    } finally {
      setSavingPassword(false)
    }
  }

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/auth/signout', { method: 'POST' })
    } finally {
      // 계정에서 나가면 쿠키플레이 메인으로.
      window.location.replace(window.location.origin + '/')
    }
  }

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-white font-sans selection:bg-[#8251f6] selection:text-white">
      {/* 상단 — 쿠키플레이 워드마크. 클릭하면 쿠키플레이 메인(origin 루트). */}
      <header className="border-b border-[#292929]">
        <div className="max-w-[560px] mx-auto px-6 py-5 flex items-center justify-between">
          <a href="/" className="flex items-center gap-2 select-none w-fit">
            <span className="text-[20px]" aria-hidden="true">🍪</span>
            <span className="text-[18px] font-black tracking-tight leading-none">
              <span className="text-[#b6cc14]">COOKIE</span>
              <span className="text-white">PLAY</span>
            </span>
          </a>
          <a href="/" className="flex items-center gap-1.5 text-[11px] font-semibold text-[#a1a1a1] hover:text-[#b6cc14] transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" />
            쿠키플레이 홈
          </a>
        </div>
      </header>

      <main className="max-w-[560px] mx-auto px-6 py-10">
        <div className="mb-10">
          <h1 className="text-2xl font-extrabold mb-2">쿠키플레이 계정</h1>
          <p className="text-[#a1a1a1] text-xs leading-relaxed">
            계정 하나로 쿠키플레이의 모든 서비스를 씁니다. 여기서 바꾸면 어디서나 같이 바뀝니다.
          </p>
        </div>

        {profileLoadError && (
          <div className="w-full p-3 mb-6 rounded-[8px] bg-[#2a1416] border border-[#7f1d1d] text-[#fca5a5] text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>프로필 정보를 불러오지 못했습니다. 새로고침해 주세요.</span>
          </div>
        )}

        {/* 프로필 사진 */}
        <section className="py-6 border-b border-[#292929]">
          <h2 className="text-sm font-bold mb-4">프로필 사진</h2>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar || loadingProfile}
              className="relative w-20 h-20 rounded-full overflow-hidden bg-[#181818] border border-[#292929] hover:border-[#8251f6] transition-colors group shrink-0 cursor-pointer disabled:cursor-not-allowed"
              aria-label="프로필 사진 변경"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="w-full h-full flex items-center justify-center text-2xl font-black text-[#5a5a5a]">
                  {(user.email || 'U')[0].toUpperCase()}
                </span>
              )}
              <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </span>
            </button>
            <div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar || loadingProfile}
                className="py-2 px-4 rounded-[8px] border border-[#292929] hover:border-[#8251f6] text-xs font-bold text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {uploadingAvatar ? '올리는 중...' : '사진 바꾸기'}
              </button>
              <p className="text-[10px] text-[#5a5a5a] mt-2">2MB 이내 이미지</p>
              <StatusLine status={avatarStatus} />
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
          </div>
        </section>

        {/* 표시 이름 */}
        <section className="py-6 border-b border-[#292929]">
          <h2 className="text-sm font-bold mb-1">표시 이름</h2>
          <p className="text-[11px] text-[#a1a1a1] mb-4">쿠키플레이 서비스 어디서나 이 이름으로 보입니다.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              disabled={loadingProfile}
              maxLength={40}
              placeholder={loadingProfile ? '불러오는 중...' : '표시 이름'}
              className={inputCls}
            />
            <button
              type="button"
              onClick={saveDisplayName}
              disabled={savingName || loadingProfile}
              className={`${buttonCls} shrink-0`}
            >
              {savingName ? '저장 중...' : '저장'}
            </button>
          </div>
          <StatusLine status={nameStatus} />
        </section>

        {/* 이메일 — 읽기 전용 */}
        <section className="py-6 border-b border-[#292929]">
          <h2 className="text-sm font-bold mb-1">이메일</h2>
          <p className="text-[11px] text-[#a1a1a1] mb-4">로그인에 쓰는 주소입니다. 여기서는 바꿀 수 없습니다.</p>
          <input
            type="email"
            value={user.email || ''}
            readOnly
            disabled
            className={`${inputCls} opacity-60 cursor-not-allowed`}
          />
        </section>

        {/* 비밀번호 */}
        <section className="py-6 border-b border-[#292929]">
          <h2 className="text-sm font-bold mb-1">{hasEmailProvider ? '비밀번호 변경' : '비밀번호 설정'}</h2>
          <p className="text-[11px] text-[#a1a1a1] mb-4">
            {hasEmailProvider
              ? '새 비밀번호를 입력하면 바로 바뀝니다.'
              : '구글로 가입한 계정입니다. 비밀번호를 설정하면 이메일로도 로그인할 수 있습니다.'}
          </p>
          <form onSubmit={savePassword} className="space-y-3">
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="새 비밀번호 (6자 이상)"
              className={inputCls}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              placeholder="새 비밀번호 확인"
              className={inputCls}
            />
            <button type="submit" disabled={savingPassword} className={buttonCls}>
              {savingPassword ? '저장 중...' : hasEmailProvider ? '비밀번호 바꾸기' : '비밀번호 설정하기'}
            </button>
          </form>
          <StatusLine status={passwordStatus} />
        </section>

        {/* 로그아웃 */}
        <section className="py-6">
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex items-center gap-2 py-2.5 px-5 rounded-[8px] border border-[#292929] hover:border-[#7f1d1d] hover:text-[#fca5a5] text-sm font-bold text-[#a1a1a1] transition-colors cursor-pointer disabled:opacity-50"
          >
            <LogOut className="w-4 h-4" />
            {signingOut ? '로그아웃 중...' : '로그아웃'}
          </button>
        </section>

        <p className="text-center text-[10px] text-[#5a5a5a] mt-8">© 2026 APPLESEED</p>
      </main>
    </div>
  )
}
