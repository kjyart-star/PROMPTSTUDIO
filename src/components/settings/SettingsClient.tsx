'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Users, Check, Upload, ArrowLeft, Settings, Sliders, Pencil, Plus, Globe, Info, X, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { withBase } from '@/lib/basePath'

interface SettingsClientProps {
  user: any
}

export function SettingsClient({ user }: SettingsClientProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab & Section State
  const [activeSettingSection, setActiveSettingSection] = useState<'profile' | 'preferences'>('profile')
  
  // Data States
  const [profile, setProfile] = useState<{ 
    display_name?: string, 
    avatar_url?: string,
    banner_url?: string,
    bio?: string,
    tags?: string[],
    followers?: number,
    following?: number,
    plays?: number,
    likes?: number,
    handle?: string
  } | null>(null)
  const [uiLanguage, setUiLanguage] = useState<'KO' | 'EN' | 'JA'>('KO')
  const [audioQuality, setAudioQuality] = useState<'standard' | 'high'>('high')
  const [autoplay, setAutoplay] = useState<boolean>(true)

  // Profile Edit fields
  const [editName, setEditName] = useState('')
  const [editAvatar, setEditAvatar] = useState('')
  const [editBio, setEditBio] = useState('')
  const [editTags, setEditTags] = useState<string[]>([])
  const [editBanner, setEditBanner] = useState('')
  const [editHandle, setEditHandle] = useState('')
  const [editFollowers, setEditFollowers] = useState(0)
  const [editFollowing, setEditFollowing] = useState(0)
  const [editPlays, setEditPlays] = useState('0')
  const [editLikes, setEditLikes] = useState('0')



  // Toast notifications state
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' } | null>(null)
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false)

  const showToast = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast(null)
    }, 2500)
  }

  const fetchProfile = async () => {
    try {
      const res = await fetch('/api/profile')
      if (res.ok) {
        const data = await res.json()
        setProfile(data)
        setEditName(data.display_name || '')
        setEditAvatar(data.avatar_url || '')
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Load configuration and data on mount
  useEffect(() => {
    fetchProfile()

    // Query param tab activation (unknown/legacy sections fall back to profile)
    const section = searchParams.get('section')
    if (section === 'profile' || section === 'preferences') {
      setActiveSettingSection(section)
    }
  }, [searchParams])

  useEffect(() => {
    if (!user) return

    // Load extra fields from localStorage
    try {
      const hasDbValues = profile && (
        profile.banner_url !== undefined ||
        profile.bio !== undefined ||
        profile.handle !== undefined
      )

      if (hasDbValues) {
        if (profile.bio !== undefined && profile.bio !== null) setEditBio(profile.bio)
        if (profile.tags !== undefined && profile.tags !== null) setEditTags(profile.tags)
        if (profile.banner_url !== undefined && profile.banner_url !== null) setEditBanner(profile.banner_url)
        if (profile.followers !== undefined && profile.followers !== null) setEditFollowers(profile.followers)
        if (profile.following !== undefined && profile.following !== null) setEditFollowing(profile.following)
        if (profile.plays !== undefined && profile.plays !== null) setEditPlays(String(profile.plays))
        if (profile.likes !== undefined && profile.likes !== null) setEditLikes(String(profile.likes))
        if (profile.handle !== undefined && profile.handle !== null) {
          setEditHandle(profile.handle)
        } else {
          const defaultHandle = profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer'
          setEditHandle(defaultHandle)
        }
      } else {
        const extra = localStorage.getItem(`profile-extra-${user.id}`)
        if (extra) {
          const parsed = JSON.parse(extra)
          if (parsed.bio !== undefined) setEditBio(parsed.bio)
          if (parsed.tags !== undefined) setEditTags(parsed.tags)
          if (parsed.banner_url !== undefined) setEditBanner(parsed.banner_url)
          if (parsed.followers !== undefined) setEditFollowers(parsed.followers)
          if (parsed.following !== undefined) setEditFollowing(parsed.following)
          if (parsed.plays !== undefined) setEditPlays(String(parsed.plays))
          if (parsed.likes !== undefined) setEditLikes(String(parsed.likes))
          if (parsed.handle !== undefined) setEditHandle(parsed.handle)
        } else {
          const defaultHandle = profile?.display_name ? profile.display_name.toLowerCase().replace(/\s+/g, '') : 'ostdreamer'
          setEditHandle(defaultHandle)
        }
      }
    } catch (e) {
      console.error(e)
    }
  }, [user, profile])

  // Load Settings and Preferences
  useEffect(() => {
    const savedLanguage = localStorage.getItem('language')?.toUpperCase()
    if (savedLanguage === 'KO' || savedLanguage === 'EN' || savedLanguage === 'JA') {
      setUiLanguage(savedLanguage)
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      const lang = customEvent.detail?.toUpperCase()
      if (lang === 'KO' || lang === 'EN' || lang === 'JA') {
        setUiLanguage(lang as 'KO' | 'EN' | 'JA')
      }
    }
    window.addEventListener('languageChange', handleLanguageChange)

    const savedQuality = localStorage.getItem('pref-audio-quality') as 'standard' | 'high' | null
    if (savedQuality) setAudioQuality(savedQuality)
    
    const savedAutoplay = localStorage.getItem('pref-autoplay')
    if (savedAutoplay !== null) setAutoplay(savedAutoplay === 'true')

    return () => {
      window.removeEventListener('languageChange', handleLanguageChange)
    }
  }, [])

  const changeLanguage = (lang: 'KO' | 'EN') => {
    setUiLanguage(lang)
    localStorage.setItem('language', lang)
    window.dispatchEvent(new CustomEvent('languageChange', { detail: lang }))
    showToast(lang === 'KO' ? '언어가 한국어로 변경되었습니다.' : 'Language set to English.', 'success')
  }

  const handleQualityChange = (val: 'standard' | 'high') => {
    setAudioQuality(val)
    localStorage.setItem('pref-audio-quality', val)
    showToast(uiLanguage === 'KO' ? `스트리밍 음질: ${val === 'high' ? '고음질 (320kbps)' : '일반음질 (128kbps)'}` : uiLanguage === 'JA' ? `ストリーミング音質: ${val === 'high' ? '高音質 (320kbps)' : '標準音質 (128kbps)'}` : `Streaming Quality: ${val === 'high' ? 'High (320kbps)' : 'Standard (128kbps)'}`, 'success')
  }

  const handleAutoplayChange = (val: boolean) => {
    setAutoplay(val)
    localStorage.setItem('pref-autoplay', String(val))
    showToast(uiLanguage === 'KO' ? `자동 재생: ${val ? '켜짐' : '꺼짐'}` : uiLanguage === 'JA' ? `自動再生: ${val ? 'オン' : 'オフ'}` : `Autoplay: ${val ? 'ON' : 'OFF'}`, 'success')
  }

  const handleWithdraw = () => {
    setConfirmDeleteOpen(true)
  }

  const confirmWithdraw = async () => {
    const supabase = createClient()
    const { error } = await supabase.rpc('delete_user')
    if (error) {
      alert(`탈퇴 실패: ${error.message}`)
    } else {
      try {
        await fetch('/api/auth/signout', { method: 'POST' })
        await supabase.auth.signOut()
      } catch (err) {
        console.error('SignOut error:', err)
      }
      window.location.href = withBase('/')
    }
  }

  const saveProfile = async () => {
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          display_name: editName, 
          avatar_url: editAvatar,
          bio: editBio,
          tags: editTags,
          banner_url: editBanner,
          followers: editFollowers,
          following: editFollowing,
          plays: Number(editPlays) || 0,
          likes: Number(editLikes) || 0,
          handle: editHandle
        })
      })
      if (res.ok) {
        const data = await res.json()
        setProfile(data.profile)
        
        // Save extra fields to localStorage
        const extraData = {
          bio: editBio,
          tags: editTags,
          banner_url: editBanner,
          followers: editFollowers,
          following: editFollowing,
          plays: editPlays,
          likes: editLikes,
          handle: editHandle
        }
        localStorage.setItem(`profile-extra-${user.id}`, JSON.stringify(extraData))
        
        showToast(uiLanguage === 'KO' ? '프로필 설정이 저장되었습니다.' : uiLanguage === 'JA' ? 'プロフィール設定が正常に保存されました。' : 'Profile settings saved successfully.', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast(uiLanguage === 'KO' ? '프로필 저장 실패' : uiLanguage === 'JA' ? 'プロフィールの保存に失敗しました' : 'Failed to save profile', 'error')
    }
  }

  const handleProfileImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) return showToast('이미지 크기는 2MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-avatar-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditAvatar(data.publicUrl)
      showToast('아바타 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) {
      showToast('업로드 실패', 'error')
    }
  }

  const handleProfileBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 5 * 1024 * 1024) return showToast('배너 이미지 크기는 5MB 이내여야 합니다.', 'error')
    try {
      const supabase = createClient()
      const fileName = `${user.id}-banner-${Math.random().toString(36).substring(2)}.${file.name.split('.').pop()}`
      const { error } = await supabase.storage.from('avatars').upload(fileName, file)
      if (error) throw error
      const { data } = supabase.storage.from('avatars').getPublicUrl(fileName)
      setEditBanner(data.publicUrl)
      showToast('배너 이미지가 업로드되었습니다.', 'success')
    } catch (e: any) {
      showToast('업로드 실패', 'error')
    }
  }



  return (
    <div className="max-w-7xl mx-auto pl-[32px] pr-0 py-4">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2 border font-bold text-xs transition-all ${
          toast.type === 'success' 
            ? 'bg-primary/10 border-primary text-primary' 
            : toast.type === 'error' 
            ? 'bg-red-500/10 border-red-500/30 text-red-400' 
            : 'bg-zinc-800 border-zinc-700 text-zinc-300'
        }`}>
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header section */}
      <div className="flex items-center gap-4 border-b border-outline-variant/10 pb-6 mb-8 text-left">
        <button 
          onClick={() => router.push('/profile')}
          className="w-10 h-10 rounded-full bg-surface-container-high hover:bg-surface-container-highest flex items-center justify-center text-on-surface transition-all active:scale-95 cursor-pointer"
        >
          <ArrowLeft className="w-5 h-5 text-on-surface" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide">
            <Settings className="w-6 h-6 text-primary shrink-0" />
            {uiLanguage === 'KO' ? '설정 및 관리' : uiLanguage === 'JA' ? '設定と管理' : 'Settings & Management'}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {uiLanguage === 'KO' ? '계정 정보 및 환경설정을 관리합니다.' : uiLanguage === 'JA' ? 'アカウント情報と設定を管理します。' : 'Manage account information and preferences.'}
          </p>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Menu Section */}
        <div className="flex flex-col gap-1 md:col-span-1 text-left">
          <button 
            onClick={() => setActiveSettingSection('profile')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${activeSettingSection === 'profile' ? 'bg-primary text-[#050a06] font-extrabold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>{uiLanguage === 'KO' ? '프로필 관리' : uiLanguage === 'JA' ? 'プロフィール管理' : 'Profile Management'}</span>
          </button>

          <button 
            onClick={() => setActiveSettingSection('preferences')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left cursor-pointer ${activeSettingSection === 'preferences' ? 'bg-primary text-[#050a06] font-extrabold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>{uiLanguage === 'KO' ? '환경설정' : uiLanguage === 'JA' ? '環境設定' : 'Preferences'}</span>
          </button>
        </div>

        {/* Right Content Section */}
        <div className="md:col-span-3 bg-background border border-outline-variant/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl">
          {activeSettingSection === 'profile' && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '프로필 관리' : uiLanguage === 'JA' ? 'プロフィール管理' : 'Profile Management'}</h3>
                <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '내 아티스트 채널에 표시될 프로필 정보를 편집합니다.' : uiLanguage === 'JA' ? 'アーティストチャンネルに表示される情報を編集します。' : 'Edit display info visible on your artist channel.'}</p>
                {/* 계정 관리의 정본은 쿠키플레이 /account — 같은 profiles 테이블을 쓰므로 값은 어긋나지 않는다 */}
                <p className="text-[11px] text-zinc-500 mt-2 text-left">
                  {uiLanguage === 'KO' ? '사진·이름·비밀번호 같은 계정 정보는 ' : uiLanguage === 'JA' ? '写真・名前・パスワードなどのアカウント情報は ' : 'Account info like photo, name, and password lives in '}
                  <a href={withBase('/account')} className="text-primary font-bold hover:underline">
                    {uiLanguage === 'KO' ? '쿠키플레이 계정 설정' : uiLanguage === 'JA' ? 'クッキープレイ アカウント設定' : 'CookiePlay account settings'}
                  </a>
                  {uiLanguage === 'KO' ? '에서 전체 관리합니다.' : uiLanguage === 'JA' ? 'で一括管理します。' : '.'}
                </p>
              </div>

              {/* Banner Image Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 font-sans">
                  {uiLanguage === 'KO' ? '배너 이미지' : uiLanguage === 'JA' ? 'バナー画像' : 'Banner Image'}
                </label>
                <div 
                  className="relative w-full h-36 bg-surface-container border border-dashed border-outline-variant/30 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer group overflow-hidden transition-colors"
                  onClick={() => document.getElementById('settings-banner-file-input')?.click()}
                >
                  {editBanner ? (
                    <img src={editBanner} alt="Banner Preview" className="w-full h-full object-cover" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                      <span className="text-[11px] text-zinc-400 font-medium">Upload banner photo</span>
                    </>
                  )}
                  <div className="absolute bottom-2.5 right-2.5 w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <input 
                    id="settings-banner-file-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfileBannerUpload} 
                  />
                </div>
              </div>

              {/* Avatar Image Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 font-sans">
                  {uiLanguage === 'KO' ? '프로필 사진' : uiLanguage === 'JA' ? 'プロフィール写真' : 'Profile Picture'}
                </label>
                <div 
                  className="relative w-20 h-20 rounded-full cursor-pointer group overflow-visible shrink-0 self-start"
                  onClick={() => document.getElementById('settings-avatar-file-input')?.click()}
                >
                  {editAvatar ? (
                    <img src={editAvatar} alt="Avatar Preview" className="w-20 h-20 rounded-full object-cover border border-outline-variant/20 shadow-md" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-surface-container border border-outline-variant/20 flex items-center justify-center text-zinc-500 group-hover:text-primary transition-colors">
                      <User className="w-8 h-8" />
                    </div>
                  )}
                  <div className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-black/80 hover:bg-black text-white flex items-center justify-center border border-zinc-700/50 shadow-md transition-all">
                    <Pencil className="w-3.5 h-3.5" />
                  </div>
                  <input 
                    id="settings-avatar-file-input" 
                    type="file" 
                    accept="image/*" 
                    className="hidden" 
                    onChange={handleProfileImageUpload} 
                  />
                </div>
              </div>

              {/* Display Name */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '닉네임 (표시 이름)' : uiLanguage === 'JA' ? '表示名' : 'Display Name'}</label>
                <input 
                  type="text" 
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Nickname"
                  className="w-full bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              {/* Handle */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '핸들 네임' : uiLanguage === 'JA' ? 'ハンドルネーム' : 'Handle'}</label>
                <div className="relative flex items-center">
                  <span className="absolute left-3 text-sm font-medium text-zinc-500 font-mono">@</span>
                  <input 
                    type="text" 
                    value={editHandle}
                    onChange={(e) => setEditHandle(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                    placeholder="handle_name"
                    className="w-full bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-3 pl-7 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors font-mono"
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '소개글' : uiLanguage === 'JA' ? '自己紹介' : 'Bio'}</label>
                  <span className="text-[10px] font-medium text-zinc-500">{editBio.length}/1200</span>
                </div>
                <textarea 
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value.slice(0, 1200))}
                  placeholder="Bio description..."
                  className="w-full bg-surface-container-high/60 border border-outline-variant/15 rounded-xl p-3 text-sm text-white focus:outline-none focus:border-primary/50 transition-colors h-24 resize-none"
                />
              </div>

              <button 
                onClick={saveProfile}
                className="px-6 py-2.5 rounded-xl bg-primary text-black font-extrabold hover:bg-primary/90 transition-all text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm mt-2 self-start"
              >
                <Check className="w-4 h-4" /> {uiLanguage === 'KO' ? '프로필 저장' : uiLanguage === 'JA' ? '変更を保存' : 'Save Changes'}
              </button>
            </div>
          )}



          {activeSettingSection === 'preferences' && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '환경설정' : uiLanguage === 'JA' ? '環境設定' : 'Preferences'}</h3>
                <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '다양한 재생 옵션 및 기본 언어를 설정할 수 있습니다.' : uiLanguage === 'JA' ? '言語と再生の設定をします。' : 'Configure language and play preferences.'}</p>
              </div>

              {/* Language Toggler */}
              <div className="flex flex-col gap-2 border-b border-outline-variant/10 pb-5">
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '기본 언어' : uiLanguage === 'JA' ? '表示言語' : 'Display Language'}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => changeLanguage('KO')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${uiLanguage === 'KO' ? 'bg-primary text-black' : uiLanguage === 'JA' ? 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    한국어 (KO)
                  </button>
                  <button 
                    onClick={() => changeLanguage('EN')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${uiLanguage === 'EN' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    English (EN)
                  </button>
                </div>
              </div>

              {/* Audio Quality Selection */}
              <div className="flex flex-col gap-2 border-b border-outline-variant/10 pb-5">
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '스트리밍 음질' : uiLanguage === 'JA' ? 'ストリーミング音質' : 'Streaming Quality'}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleQualityChange('high')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${audioQuality === 'high' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    {uiLanguage === 'KO' ? '고음질 (320kbps)' : uiLanguage === 'JA' ? '高音質 (320kbps)' : 'High (320kbps)'}
                  </button>
                  <button 
                    onClick={() => handleQualityChange('standard')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${audioQuality === 'standard' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    {uiLanguage === 'KO' ? '일반음질 (128kbps)' : uiLanguage === 'JA' ? '標準音質 (128kbps)' : 'Standard (128kbps)'}
                  </button>
                </div>
              </div>

              {/* Autoplay Toggler */}
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '다음 곡 자동 재생' : uiLanguage === 'JA' ? '次の曲を自動再生' : 'Autoplay Next Track'}</span>
                  <span className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '곡이 끝나면 다음 곡을 자동으로 재생합니다.' : uiLanguage === 'JA' ? '現在の曲が終わったら次の曲を自動的に再生します。' : 'Automatically play the next song when current finishes.'}</span>
                </div>
                
                {/* Switch Toggle */}
                <button 
                  onClick={() => handleAutoplayChange(!autoplay)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoplay ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoplay ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Danger Zone */}
              <div className="flex flex-col gap-2 border-t border-outline-variant/10 pt-5 mt-4">
                <label className="text-xs font-bold text-red-500/80">{uiLanguage === 'KO' ? '위험 구역 (Danger Zone)' : uiLanguage === 'JA' ? '危険エリア' : 'Danger Zone'}</label>
                <div className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                  <div className="flex flex-col gap-1 text-left">
                    <span className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '계정 탈퇴' : uiLanguage === 'JA' ? 'アカウントを削除' : 'Delete Account'}</span>
                    <span className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '모든 데이터가 영구적으로 삭제되며 복구할 수 없습니다.' : uiLanguage === 'JA' ? 'アカウントとすべてのデータを完全に削除します。' : 'Permanently delete your account and all data.'}</span>
                  </div>
                  <button 
                    onClick={handleWithdraw}
                    className="px-4 py-2 text-xs font-extrabold rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-colors cursor-pointer"
                  >
                    {uiLanguage === 'KO' ? '탈퇴하기' : uiLanguage === 'JA' ? '削除する' : 'Delete'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* User Withdrawal Confirm Modal */}
      {confirmDeleteOpen && (
        <div 
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/75 backdrop-blur-sm p-4"
          onClick={() => setConfirmDeleteOpen(false)}
        >
          <div 
            className="w-full max-w-sm rounded-2xl border border-outline-variant/20 bg-surface-container shadow-2xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6">
              <h3 className="text-sm font-extrabold text-on-surface mb-2 tracking-tight text-left">
                {uiLanguage === 'KO' ? '계정 삭제' : uiLanguage === 'JA' ? 'アカウントを削除' : 'Delete Account'}
              </h3>
              <p className="text-on-surface-variant text-xs leading-relaxed text-left">
                {uiLanguage === 'KO' 
                  ? '정말 탈퇴하시겠습니까? 모든 정보가 삭제되며 복구할 수 없습니다.' 
                  : uiLanguage === 'JA' ? '本当にアカウントを削除しますか？すべてのデータは完全に消去されます。' : 'Are you sure you want to delete your account? All data will be permanently erased.'}
              </p>
            </div>
            <div className="flex items-center gap-3 p-4 bg-surface-container-lowest border-t border-outline-variant/10">
              <button 
                onClick={() => setConfirmDeleteOpen(false)}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-on-surface bg-white/[0.04] hover:bg-white/[0.08] transition-colors focus:outline-none cursor-pointer"
              >
                {uiLanguage === 'KO' ? '취소' : uiLanguage === 'JA' ? 'キャンセル' : 'Cancel'}
              </button>
              <button 
                onClick={confirmWithdraw}
                className="flex-1 px-4 py-2.5 rounded-xl font-bold text-xs text-white bg-red-500 hover:brightness-105 shadow-md transition-all focus:outline-none cursor-pointer"
              >
                {uiLanguage === 'KO' ? '확인' : uiLanguage === 'JA' ? '確認' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}


    </div>
  )
}
