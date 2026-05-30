'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { User, Check, Upload, ArrowLeft, Clock, Settings, CreditCard, Sliders, Pencil } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface SettingsClientProps {
  user: any
}

export function SettingsClient({ user }: SettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Tab & Section State
  const [activeSettingSection, setActiveSettingSection] = useState<'credits' | 'profile' | 'preferences'>('credits')
  
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
  const [userCredits, setUserCredits] = useState<number>(120)
  const [transactions, setTransactions] = useState<any[]>([])
  const [uiLanguage, setUiLanguage] = useState<'KO' | 'EN'>('KO')
  const [audioQuality, setAudioQuality] = useState<'standard' | 'high'>('high')
  const [autoplay, setAutoplay] = useState<boolean>(true)
  const [userPlan, setUserPlan] = useState<string>('free')
  const [billingCycle, setBillingCycle] = useState<string>('monthly')
  const [planRenewalDate, setPlanRenewalDate] = useState<string>('')

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
        if (data.credits !== undefined && data.credits !== null) {
          setUserCredits(data.credits)
          localStorage.setItem('user-credits', String(data.credits))
        }
      }
    } catch (e) {
      console.error(e)
    }
  }

  // Load configuration and data on mount
  useEffect(() => {
    fetchProfile()

    // Query param tab activation
    const section = searchParams.get('section')
    if (section === 'profile' || section === 'preferences' || section === 'credits') {
      setActiveSettingSection(section as any)
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
    const savedPlan = localStorage.getItem('user-plan')
    if (savedPlan) {
      setUserPlan(savedPlan)
    } else {
      localStorage.setItem('user-plan', 'free')
    }

    const savedBilling = localStorage.getItem('user-plan-billing')
    if (savedBilling) {
      setBillingCycle(savedBilling)
    }

    const savedRenewal = localStorage.getItem('user-plan-renewal')
    if (savedRenewal) {
      setPlanRenewalDate(savedRenewal)
    }

    const savedCredits = localStorage.getItem('user-credits')
    if (savedCredits !== null) {
      setUserCredits(parseFloat(savedCredits))
    }

    const savedTx = localStorage.getItem('user-transactions')
    if (savedTx) {
      try {
        setTransactions(JSON.parse(savedTx))
      } catch (e) {
        console.error(e)
      }
    } else {
      const defaultTx = [
        { id: 'tx-1', date: '2026-05-28 10:15', type: 'charge', desc: 'Credit Top-up (+100)', amount: '+100', status: 'Completed' },
        { id: 'tx-2', date: '2026-05-27 15:40', type: 'use', desc: 'Song Generation (-10)', amount: '-10', status: 'Completed' },
        { id: 'tx-3', date: '2026-05-26 11:22', type: 'use', desc: 'Stem Extraction (-5)', amount: '-5', status: 'Completed' },
      ]
      setTransactions(defaultTx)
      localStorage.setItem('user-transactions', JSON.stringify(defaultTx))
    }

    const savedLanguage = localStorage.getItem('language') as 'KO' | 'EN' | null
    if (savedLanguage === 'KO' || savedLanguage === 'EN') {
      setUiLanguage(savedLanguage)
    }

    const handleLanguageChange = (e: Event) => {
      const customEvent = e as CustomEvent<string>
      if (customEvent.detail === 'KO' || customEvent.detail === 'EN') {
        setUiLanguage(customEvent.detail as 'KO' | 'EN')
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
    showToast(uiLanguage === 'KO' ? `스트리밍 음질: ${val === 'high' ? '고음질 (320kbps)' : '일반음질 (128kbps)'}` : `Streaming Quality: ${val === 'high' ? 'High (320kbps)' : 'Standard (128kbps)'}`, 'success')
  }

  const handleAutoplayChange = (val: boolean) => {
    setAutoplay(val)
    localStorage.setItem('pref-autoplay', String(val))
    showToast(uiLanguage === 'KO' ? `자동 재생: ${val ? '켜짐' : '꺼짐'}` : `Autoplay: ${val ? 'ON' : 'OFF'}`, 'success')
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
        
        showToast(uiLanguage === 'KO' ? '프로필 설정이 저장되었습니다.' : 'Profile settings saved successfully.', 'success')
      }
    } catch (e) {
      console.error(e)
      showToast(uiLanguage === 'KO' ? '프로필 저장 실패' : 'Failed to save profile', 'error')
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
          <h1 className="text-2xl font-black text-on-surface tracking-tight">
            {uiLanguage === 'KO' ? '설정 및 관리' : 'Settings & Management'}
          </h1>
          <p className="text-xs text-on-surface-variant mt-0.5">
            {uiLanguage === 'KO' ? '계정 정보, 크레딧 사용 내역 및 환경설정을 관리합니다.' : 'Manage account information, credit usage, and preferences.'}
          </p>
        </div>
      </div>

      {/* Grid Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
        {/* Left Menu Section */}
        <div className="flex flex-col gap-1 md:col-span-1 text-left">
          <button 
            onClick={() => setActiveSettingSection('credits')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${activeSettingSection === 'credits' ? 'bg-primary text-[#050a06] font-extrabold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <CreditCard className="w-4 h-4 shrink-0" />
            <span>{uiLanguage === 'KO' ? '크레딧 관리' : 'Credit Management'}</span>
          </button>
          <button 
            onClick={() => setActiveSettingSection('profile')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${activeSettingSection === 'profile' ? 'bg-primary text-[#050a06] font-extrabold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <User className="w-4 h-4 shrink-0" />
            <span>{uiLanguage === 'KO' ? '프로필 관리' : 'Profile Management'}</span>
          </button>
          <button 
            onClick={() => setActiveSettingSection('preferences')}
            className={`flex items-center gap-3 w-full px-4 py-3 rounded-2xl text-sm font-bold transition-all text-left ${activeSettingSection === 'preferences' ? 'bg-primary text-[#050a06] font-extrabold' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface'}`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span>{uiLanguage === 'KO' ? '환경설정' : 'Preferences'}</span>
          </button>
        </div>

        {/* Right Content Section */}
        <div className="md:col-span-3 bg-background border border-outline-variant/10 p-6 md:p-8 rounded-3xl backdrop-blur-sm shadow-xl">
          {activeSettingSection === 'credits' && (
            <div className="flex flex-col gap-8 text-left">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '크레딧 관리' : 'Credit Management'}</h3>
                <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '요금제 확인 및 크레딧 충전을 관리할 수 있습니다.' : 'Check plan details and manage credit top-ups.'}</p>
              </div>

              {/* Balance Card */}
              {(() => {
                let planLabel = uiLanguage === 'KO' ? '무료 요금제' : 'Basic Plan';
                let maxCredits = 50;
                let cardBg = 'from-[#121214] to-[#0d0d0f]';
                let borderHighlight = 'border-outline-variant/20';

                if (userPlan === 'pro') {
                  planLabel = uiLanguage === 'KO' ? '프로 플랜' : 'Pro Plan';
                  maxCredits = 2500;
                  cardBg = 'from-[#121408] via-[#0d0f05] to-[#070708]';
                  borderHighlight = 'border-primary/20';
                } else if (userPlan === 'premier') {
                  planLabel = uiLanguage === 'KO' ? '프리미어 플랜' : 'Premier Plan';
                  maxCredits = 10000;
                  cardBg = 'from-[#0a150e] via-[#050a06] to-[#070708]';
                  borderHighlight = 'border-primary/20';
                }

                const percentage = Math.min(100, Math.max(0, (userCredits / maxCredits) * 100));

                return (
                  <div className={`relative overflow-hidden rounded-3xl border ${borderHighlight} bg-gradient-to-br ${cardBg} p-6 shadow-xl flex flex-col gap-6`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex flex-col gap-1.5 text-left">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-black px-2.5 py-0.5 rounded-full tracking-wide uppercase ${
                            userPlan === 'pro' 
                              ? 'bg-primary/10 text-primary border border-primary/20' 
                              : userPlan === 'premier' 
                              ? 'bg-primary/10 text-primary border border-primary/20' 
                              : 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          }`}>
                            {planLabel}
                          </span>
                          {userPlan !== 'free' && (
                            <span className="text-[10px] text-zinc-400 font-bold">
                              {billingCycle === 'yearly' 
                                ? (uiLanguage === 'KO' ? '연간 결제' : 'Billed Annually')
                                : (uiLanguage === 'KO' ? '월간 결제' : 'Billed Monthly')}
                            </span>
                          )}
                        </div>
                        
                        <span className="text-3xl font-black text-white tracking-tight mt-1">{userCredits} Credits</span>
                      </div>

                      <button 
                        onClick={() => router.push('/pricing')}
                        className="px-5 py-3 rounded-2xl bg-white hover:bg-zinc-100 text-black font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md self-start md:self-auto"
                      >
                        {uiLanguage === 'KO' ? '요금제 변경 및 크레딧 충전' : 'Manage Plans & Recharge'}
                      </button>
                    </div>

                    {/* Progress bar */}
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between text-[11px] font-bold text-zinc-400">
                        <span>{uiLanguage === 'KO' ? '사용 가능한 크레딧' : 'Available Credits'}</span>
                        <span>{userCredits.toLocaleString()} / {maxCredits.toLocaleString()}</span>
                      </div>
                      <div className="w-full h-2 bg-zinc-800/80 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${
                            userPlan === 'pro' 
                              ? 'bg-gradient-to-r from-primary to-[#b8cd05]' 
                              : userPlan === 'premier' 
                              ? 'bg-gradient-to-r from-primary to-[#49be67]' 
                              : 'bg-zinc-500'
                          }`}
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>

                    {/* Renewal details */}
                    {userPlan !== 'free' && planRenewalDate && (
                      <div className="text-[11px] font-semibold text-zinc-400 mt-1 border-t border-zinc-800/40 pt-3">
                        {uiLanguage === 'KO' 
                          ? `다음 갱신 및 충전 예정일: ${planRenewalDate}` 
                          : `Next renewal & credit refill date: ${planRenewalDate}`}
                      </div>
                    )}
                    {userPlan === 'free' && (
                      <div className="text-[11px] font-semibold text-zinc-500 mt-1 border-t border-zinc-800/40 pt-3">
                        {uiLanguage === 'KO'
                          ? '구독 시 고성능 모델 액세스, 상업적 권한 획득 및 최대 10,000 크레딧을 매달 받을 수 있습니다.'
                          : 'Subscribe to get access to advanced models, commercial rights, and up to 10,000 monthly credits.'}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Transaction History */}
              <div>
                <h4 className="text-sm font-bold text-on-surface mb-3 flex items-center gap-1.5 text-left">
                  <Clock className="w-4 h-4 text-zinc-400" />
                  <span>{uiLanguage === 'KO' ? '최근 거래 내역' : 'Recent Transactions'}</span>
                </h4>
                <div className="overflow-x-auto rounded-2xl border border-outline-variant/10">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-surface-container/40 text-on-surface-variant font-bold border-b border-outline-variant/10">
                        <th className="p-3">{uiLanguage === 'KO' ? '거래 일시' : 'Date'}</th>
                        <th className="p-3">{uiLanguage === 'KO' ? '상세 내용' : 'Description'}</th>
                        <th className="p-3 text-right">{uiLanguage === 'KO' ? '금액' : 'Amount'}</th>
                        <th className="p-3 text-center">{uiLanguage === 'KO' ? '상태' : 'Status'}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface">
                      {transactions.map((tx) => (
                        <tr key={tx.id} className="hover:bg-surface-container/20">
                          <td className="p-3 text-zinc-400 font-mono">{tx.date}</td>
                          <td className="p-3 font-semibold">{tx.desc}</td>
                          <td className={`p-3 text-right font-extrabold font-mono ${tx.type === 'charge' ? 'text-[#e3fe06]' : 'text-zinc-400'}`}>
                            {tx.amount}
                          </td>
                          <td className="p-3 text-center">
                            <span className="inline-flex px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-[#e3fe06]/10 border border-[#e3fe06]/25 text-[#e3fe06]">
                              {uiLanguage === 'KO' ? '완료됨' : 'Completed'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeSettingSection === 'profile' && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '프로필 관리' : 'Profile Management'}</h3>
                <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '내 아티스트 채널에 표시될 프로필 정보를 편집합니다.' : 'Edit display info visible on your artist channel.'}</p>
              </div>

              {/* Banner Image Upload */}
              <div className="flex flex-col gap-2">
                <label className="text-xs font-bold text-zinc-400 font-sans">
                  {uiLanguage === 'KO' ? '배너 이미지' : 'Banner Image'}
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
                  {uiLanguage === 'KO' ? '프로필 사진' : 'Profile Picture'}
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
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '닉네임 (표시 이름)' : 'Display Name'}</label>
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
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '핸들 네임' : 'Handle'}</label>
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
                  <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '소개글' : 'Bio'}</label>
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
                <Check className="w-4 h-4" /> {uiLanguage === 'KO' ? '프로필 저장' : 'Save Changes'}
              </button>
            </div>
          )}

          {activeSettingSection === 'preferences' && (
            <div className="flex flex-col gap-6 text-left">
              <div>
                <h3 className="text-lg font-bold text-on-surface tracking-tight mb-1 text-left">{uiLanguage === 'KO' ? '환경설정' : 'Preferences'}</h3>
                <p className="text-xs text-on-surface-variant text-left">{uiLanguage === 'KO' ? '다양한 재생 옵션 및 기본 언어를 설정할 수 있습니다.' : 'Configure language and play preferences.'}</p>
              </div>

              {/* Language Toggler */}
              <div className="flex flex-col gap-2 border-b border-outline-variant/10 pb-5">
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '기본 언어' : 'Display Language'}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => changeLanguage('KO')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${uiLanguage === 'KO' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
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
                <label className="text-xs font-bold text-zinc-400">{uiLanguage === 'KO' ? '스트리밍 음질' : 'Streaming Quality'}</label>
                <div className="flex gap-2">
                  <button 
                    onClick={() => handleQualityChange('high')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${audioQuality === 'high' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    {uiLanguage === 'KO' ? '고음질 (320kbps)' : 'High (320kbps)'}
                  </button>
                  <button 
                    onClick={() => handleQualityChange('standard')}
                    className={`px-4 py-2 text-xs font-extrabold rounded-xl transition-all cursor-pointer ${audioQuality === 'standard' ? 'bg-primary text-black' : 'bg-surface-container hover:bg-surface-container-high text-on-surface-variant'}`}
                  >
                    {uiLanguage === 'KO' ? '일반음질 (128kbps)' : 'Standard (128kbps)'}
                  </button>
                </div>
              </div>

              {/* Autoplay Toggler */}
              <div className="flex items-center justify-between py-2">
                <div className="flex flex-col gap-1 text-left">
                  <span className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '다음 곡 자동 재생' : 'Autoplay Next Track'}</span>
                  <span className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '곡이 끝나면 다음 곡을 자동으로 재생합니다.' : 'Automatically play the next song when current finishes.'}</span>
                </div>
                
                {/* Switch Toggle */}
                <button 
                  onClick={() => handleAutoplayChange(!autoplay)}
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${autoplay ? 'bg-primary' : 'bg-surface-container-highest'}`}
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${autoplay ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
