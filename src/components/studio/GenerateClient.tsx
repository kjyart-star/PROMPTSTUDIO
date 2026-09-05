'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Music, Check, ArrowRight, Disc, User, Play, Pause, Heart, Globe, FolderPlus, Download, Wand2 } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { parsePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'
import { withBase } from '@/lib/basePath'
import { useSuiteCredits } from '@/lib/credits/useSuiteCredits'
import { TrackDetailPanel } from './TrackDetailPanel'
import { StudioHero } from './StudioHero'
import { formatCredits } from '@/lib/credits/format'

interface GenerateClientProps {
  user: any
  historyId?: string | null
  initialPrompt?: string
  initialStyle?: string
  initialTitle?: string
  initialNegativePrompt?: string
}

const durationCache: Record<string, number> = {}

export function AudioDuration({ url, className = '' }: { url: string; className?: string }) {
  const [durationStr, setDurationStr] = useState<string>('-:-')

  useEffect(() => {
    if (!url) return

    if (durationCache[url] !== undefined) {
      const secs = durationCache[url]
      const mins = Math.floor(secs / 60)
      const remainingSecs = Math.floor(secs % 60)
      setDurationStr(`${mins}:${remainingSecs.toString().padStart(2, '0')}`)
      return
    }

    const audio = new Audio()
    audio.src = url
    audio.preload = 'metadata'

    const handleLoadedMetadata = () => {
      const secs = audio.duration
      if (!isNaN(secs) && isFinite(secs)) {
        durationCache[url] = secs
        const mins = Math.floor(secs / 60)
        const remainingSecs = Math.floor(secs % 60)
        setDurationStr(`${mins}:${remainingSecs.toString().padStart(2, '0')}`)
      }
    }

    audio.addEventListener('loadedmetadata', handleLoadedMetadata)
    audio.load()

    return () => {
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata)
      audio.src = ''
    }
  }, [url])

  return <span className={className}>{durationStr}</span>
}

export function GenerateClient({ 
  user, 
  historyId,
  initialPrompt = '',
  initialStyle = '',
  initialTitle = '',
  initialNegativePrompt = ''
}: GenerateClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(historyId || searchParams.get('historyId'))

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  const [historyItem, setHistoryItem] = useState<any>(null)
  const [isMusicGenerating, setIsMusicGenerating] = useState(false)
  const [activeAudio, setActiveAudio] = useState<{ url: string, image: string, is_published?: boolean } | null>(null)
  const [generatedTracks, setGeneratedTracks] = useState<any[]>([])
  const [activeTasks, setActiveTasks] = useState<any[]>([])
  const [historyList, setHistoryList] = useState<any[]>([])
  const [playlists, setPlaylists] = useState<any[]>([])
  const [activePlaylistMenuId, setActivePlaylistMenuId] = useState<string | null>(null)
  const [publishConfirmItem, setPublishConfirmItem] = useState<any | null>(null)
  const [selectedPublishGenre, setSelectedPublishGenre] = useState<string>('')
  const [myChannels, setMyChannels] = useState<any[]>([])
  const [selectedPublishChannelId, setSelectedPublishChannelId] = useState<string>('')
  const [publishError, setPublishError] = useState<string>('')
  const [publishedLink, setPublishedLink] = useState<{ title: string; href: string } | null>(null)
  const [status, setStatus] = useState('대기 중')
  const [uiLanguage, setUiLanguage] = useState('KO')
  /* 크레딧은 스위트 공용 지갑(워커 원장)에만 있다 — 브라우저는 읽기만 한다 */
  const { setBalance: setCreditBalance } = useSuiteCredits(user)
  const [profile, setProfile] = useState<any>(null)
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null)
  const [detailCollapsed, setDetailCollapsed] = useState(false)

  const [generateForm, setGenerateForm] = useState({
    modelProvider: 'suno',
    modelVersion: 'v5',
    customMode: true,
    instrumentalOnly: false,
    prompt: initialPrompt || '',
    style: initialStyle || '',
    title: initialTitle || '',
    vocalGender: 'Female',
    negativeTags: initialNegativePrompt || '',
    styleWeight: 0.5,
    weirdness: 0.3,
    audioWeight: 0.5
  })

  const updateFormData = (key: string, value: any) => {
    setGenerateForm(prev => ({ ...prev, [key]: value }))
  }


  const handleDownloadTrack = async (url: string, filename: string, imageUrl?: string) => {
    if (!url) return
    try {
      let proxyUrl = `/api/download?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(filename)}`
      if (imageUrl) {
        proxyUrl += `&image=${encodeURIComponent(imageUrl)}`
      }
      const a = document.createElement('a')
      a.href = proxyUrl
      a.download = `${filename}.mp3`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch (e) {
      console.error(e)
      window.open(url, '_blank')
    }
  }

  useEffect(() => {
    if (!user) return
    const fetchProfile = async () => {
      try {
        const res = await fetch('/api/profile')
        if (res.ok) {
          const data = await res.json()
          setProfile(data)
        }
      } catch (e) {
        console.error('Error fetching profile in GenerateClient:', e)
      }
    }
    fetchProfile()
  }, [user])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('language')
      if (storedLang) {
        setUiLanguage(storedLang.toUpperCase())
      } else {
        const browserLang = navigator.language || ''
        const defaultLang = browserLang.toLowerCase().startsWith('ko') ? 'KO' : browserLang.toLowerCase().startsWith('ja') ? 'JA' : 'EN'
        setUiLanguage(defaultLang)
        localStorage.setItem('language', defaultLang)
      }

      const handleLangChange = (e: any) => {
        setUiLanguage(e.detail.toUpperCase())
      }
      window.addEventListener('languageChange', handleLangChange)

      return () => window.removeEventListener('languageChange', handleLangChange)
    }
  }, [])

  // Sync state if URL query param or prop changes
  useEffect(() => {
    const qId = historyId || searchParams.get('historyId')
    if (qId !== currentHistoryId) {
      setCurrentHistoryId(qId)
    }
  }, [searchParams, historyId])

  // Watch for initial props changes to update the form immediately
  useEffect(() => {
    setGenerateForm(prev => ({
      ...prev,
      prompt: initialPrompt || prev.prompt,
      style: initialStyle || prev.style,
      title: initialTitle || prev.title,
      negativeTags: initialNegativePrompt || prev.negativeTags
    }))
  }, [initialPrompt, initialStyle, initialTitle, initialNegativePrompt])

  // Load and refresh history list from database
  const refreshHistoryList = async () => {
    try {
      const res = await fetch('/api/song-history')
      if (res.ok) {
        const data = await res.json()
        setHistoryList(data || [])
        
        // Update currently selected history item
        if (currentHistoryId) {
          const item = data.find((d: any) => d.id === currentHistoryId)
          if (item) {
            setHistoryItem(item)
            if (item.status === 'completed' && item.audio_url) {
              const variations = data.filter((d: any) => d.suno_task_id === item.suno_task_id && d.suno_task_id)
              if (variations.length > 0) {
                variations.sort((a: any, b: any) => {
                  if (a.id === item.id) return -1
                  if (b.id === item.id) return 1
                  return a.title.localeCompare(b.title)
                })
                const mappedTracks = variations.map((v: any) => ({
                  id: v.id,
                  url: v.audio_url,
                  image: v.image_url,
                  title: v.title
                }))
                setGeneratedTracks(mappedTracks)
              } else {
                setGeneratedTracks([{
                  id: item.id,
                  url: item.audio_url,
                  image: item.image_url,
                  title: item.title
                }])
              }
              setActiveAudio({ url: item.audio_url, image: item.image_url, is_published: item.is_published })
            }
          }
        }

        // Sync active tasks with 'processing' status from database
        const dbProcessing = data.filter((d: any) => d.status === 'processing' && d.suno_task_id)
        setActiveTasks(prev => {
          const graceTasks = prev.filter(t => t.status !== 'processing')
          const active = dbProcessing.map((dbTask: any) => {
            const existing = prev.find(t => t.id === dbTask.id)
            return {
              id: dbTask.id,
              taskId: dbTask.suno_task_id,
              title: dbTask.title,
              status: 'processing',
              state: existing?.state || 'queuing',
              progress: existing?.progress || 10
            }
          })
          const combined = [...graceTasks]
          active.forEach((a: any) => {
            if (!combined.some((c: any) => c.id === a.id)) {
              combined.push(a)
            }
          })
          return combined
        })
      }
    } catch (e) {
      console.error('Error refreshing history list:', e)
    }
  }

  // Initial load and sync on currentHistoryId changes
  useEffect(() => {
    if (!currentHistoryId) {
      setHistoryItem(null)
      setActiveAudio(null)
      setGeneratedTracks([])
      setStatus('대기 중')
      refreshHistoryList()
      return
    }

    const fetchSelectedAndSync = async () => {
      await refreshHistoryList()
    }
    fetchSelectedAndSync()
  }, [currentHistoryId])

  // Consolidated polling loop for all active processing tasks
  useEffect(() => {
    if (activeTasks.length === 0) return

    const interval = setInterval(async () => {
      let hasChanges = false
      let completedOrFailedCount = 0

      const updatedTasks = await Promise.all(
        activeTasks.map(async (task) => {
          if (task.status !== 'processing') return task

          try {
            const res = await fetch(`/api/suno/status?taskId=${task.taskId}&historyId=${task.id}`)
            if (res.ok) {
              const data = await res.json()
              if (data.status === 'completed') {
                hasChanges = true
                completedOrFailedCount++
                return { ...task, status: 'completed', progress: 100 }
              } else if (data.status === 'failed') {
                hasChanges = true
                completedOrFailedCount++
                return { ...task, status: 'failed' }
              } else if (data.status === 'processing') {
                const nextState = data.state || task.state || 'queuing'
                let nextProgress = task.progress
                if (nextState === 'generating' && nextProgress < 20) {
                  nextProgress = 25
                }
                
                if (nextState === 'queuing') {
                  nextProgress = Math.min(20, nextProgress + Math.random() * 2 + 0.5)
                } else {
                  nextProgress = Math.min(85, nextProgress + Math.random() * 3 + 1.2)
                }
                const progressInt = Math.floor(nextProgress)
                if (progressInt !== task.progress || nextState !== task.state) {
                  hasChanges = true
                }
                return { ...task, state: nextState, progress: progressInt }
              }
            }
          } catch (e) {
            console.error('Error polling status for task:', task.id, e)
          }
          return task
        })
      )

      if (hasChanges) {
        setActiveTasks(updatedTasks)
      }

      if (completedOrFailedCount > 0) {
        const newlyCompleted = updatedTasks.find(t => t.status === 'completed')
        if (newlyCompleted) {
          setCurrentHistoryId(newlyCompleted.id)
          const url = new URL(window.location.href)
          url.searchParams.set('historyId', newlyCompleted.id)
          window.history.replaceState({}, '', url.toString())
        }

        await refreshHistoryList()
        setTimeout(() => {
          setActiveTasks(prev => prev.filter(t => t.status === 'processing'))
        }, 3000)
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [activeTasks, currentHistoryId])

  const handleGenerate = async () => {
    const processingCount = activeTasks.filter(t => t.status === 'processing').length
    if (processingCount >= 6) {
      alert(uiLanguage === 'KO' ? '최대 6개까지 동시에 음악을 생성할 수 있습니다.' : uiLanguage === 'JA' ? '同時に最大6曲まで生成できます。' : 'You can generate up to 6 tracks concurrently.')
      return
    }

    setIsMusicGenerating(true)
    setStatus('Suno 서버로 생성 요청을 전송했습니다.')

    let activeHistoryId = null

    try {
      const createRes = await fetch('/api/song-history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: generateForm.title || 'Untitled Suno Track',
          prompt: generateForm.style || '',
          lyrics: generateForm.prompt || '',
          notes: '',
          negative_prompt: generateForm.negativeTags || '',
          form: generateForm
        })
      })
      if (createRes.ok) {
        const newHistoryItem = await createRes.json()
        activeHistoryId = newHistoryItem.id
      } else {
        alert("음원 히스토리 생성에 실패했습니다.")
        setIsMusicGenerating(false)
        return
      }
    } catch (err) {
      console.error('Error creating history item:', err)
      alert("임시 음원 정보 생성에 실패했습니다.")
      setIsMusicGenerating(false)
      return
    }

    try {
      const res = await fetch(withBase('/api/music/generate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeHistoryId, requestId: crypto.randomUUID(), ...generateForm })
      })
      if (res.ok) {
        const data = await res.json()
        if (typeof data.balance === 'number') setCreditBalance(data.balance)

        const newTask = {
          id: activeHistoryId,
          taskId: data.taskId,
          title: generateForm.title || 'Untitled Suno Track',
          status: 'processing',
          state: 'queuing',
          progress: 5
        }
        setActiveTasks(prev => [...prev, newTask])
        setCurrentHistoryId(activeHistoryId)
        const url = new URL(window.location.href)
        url.searchParams.set('historyId', activeHistoryId)
        window.history.replaceState({}, '', url.toString())
      } else {
        const errorData = await res.json().catch(() => ({}))
        if (res.status === 401) {
          alert(uiLanguage === 'KO' ? '로그인이 필요합니다.' : uiLanguage === 'JA' ? 'ログインが必要です。' : 'Please sign in.')
        } else if (res.status === 402) {
          const have = Number(errorData.balance ?? 0)
          const need = Number(errorData.required ?? 0)
          /* 서버가 주는 수는 밀리크레딧이다 — 사람에게는 크레딧으로 보여 준다 */
          const short = formatCredits(need - have)
          alert(uiLanguage === 'KO' ? `크레딧이 ${short}크레딧 부족합니다 (보유 ${formatCredits(have)} · 필요 ${formatCredits(need)})` : uiLanguage === 'JA' ? `クレジットが ${short} 不足しています (保有 ${formatCredits(have)} ・ 必要 ${formatCredits(need)})` : `You need ${short} more credits (balance ${formatCredits(have)} · required ${formatCredits(need)})`)
        } else {
          alert("음악 생성 요청 실패")
        }
        if (activeHistoryId) {
          await fetch(`/api/song-history?id=${activeHistoryId}`, { method: 'DELETE' }).catch(err => console.error('Failed to rollback history item:', err))
        }
      }
    } catch (e) {
      console.error(e)
      if (activeHistoryId) {
        await fetch(`/api/song-history?id=${activeHistoryId}`, { method: 'DELETE' }).catch(err => console.error('Failed to rollback history item:', err))
      }
    } finally {
      setIsMusicGenerating(false)
    }
  }

  // 행 전체 클릭·원형 버튼이 함께 쓰는 재생 동작
  const playListTrack = (track: any) => {
    if (!track?.audio_url) return
    setDetailTrackId(track.id)
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }
    const trackToPlay = {
      id: track.id,
      title: track.title,
      file_url: track.audio_url,
      duration_sec: 180,
      album_id: 'studio-generated',
      image_url: track.image_url || withBase('/default-album.png'),
      album: {
        id: 'studio-generated',
        title: 'Studio Generation',
        cover_url: track.image_url || withBase('/default-album.png'),
        artist: {
          name: profile?.display_name || user?.email?.split('@')[0] || 'AI Generator',
          slug: user?.email?.split('@')[0] || 'ai-generator',
          avatar_url: profile?.avatar_url || withBase('/default-album.png'),
          bio: 'AI Artist'
        }
      }
    }
    playTrack(trackToPlay as any, [trackToPlay] as any[])
  }

  const handleSelectTrack = (track: any) => {
    setCurrentHistoryId(track.id)
    const url = new URL(window.location.href)
    url.searchParams.set('historyId', track.id)
    window.history.replaceState({}, '', url.toString())
    
    if (track.form) {
      setGenerateForm(prev => ({
        ...prev,
        modelVersion: track.form.modelVersion || 'v5',
        customMode: track.form.customMode !== undefined ? track.form.customMode : true,
        instrumentalOnly: track.form.instrumentalOnly || false,
        prompt: track.lyrics || track.form.prompt || '',
        style: track.prompt || track.form.style || '',
        title: track.title?.replace(/\s\(v\d+\)$/, '') || track.form.title || '',
        vocalGender: track.form.vocalGender || 'Female',
        negativeTags: track.form.negativePrompt || track.form.negativeTags || '',
        styleWeight: track.form.styleWeight !== undefined ? track.form.styleWeight : 0.5,
        weirdness: track.form.weirdness !== undefined ? track.form.weirdness : 0.3,
        audioWeight: track.form.audioWeight !== undefined ? track.form.audioWeight : 0.5
      }))
    } else {
      setGenerateForm(prev => ({
        ...prev,
        prompt: track.lyrics || '',
        style: track.prompt || '',
        title: track.title?.replace(/\s\(v\d+\)$/, '') || ''
      }))
    }
  }

  // 상세 패널 접힘 상태는 브라우저에 남겨 둔다.
  useEffect(() => {
    try {
      if (localStorage.getItem('studio-detail-collapsed') === '1') {
        setDetailCollapsed(true)
      }
    } catch (e) {
      console.error('Failed to read detail panel state:', e)
    }
  }, [])

  const toggleDetailCollapsed = () => {
    setDetailCollapsed(prev => {
      const next = !prev
      try {
        localStorage.setItem('studio-detail-collapsed', next ? '1' : '0')
      } catch (e) {
        console.error('Failed to save detail panel state:', e)
      }
      return next
    })
  }

  useEffect(() => {
    const fetchPlaylists = async () => {
      if (!user) return
      try {
        const res = await fetch('/api/playlists')
        if (res.ok) {
          const data = await res.json()
          setPlaylists(data || [])
        }
      } catch (err) {
        console.error('Failed to fetch playlists:', err)
      }
    }
    fetchPlaylists()
  }, [user])

  useEffect(() => {
    const fetchChannels = async () => {
      if (!user) return
      try {
        const res = await fetch('/api/channels')
        if (res.ok) {
          const data = await res.json()
          setMyChannels(data?.channels || [])
        }
      } catch (err) {
        console.error('Failed to fetch channels:', err)
      }
    }
    fetchChannels()
  }, [user])

  const handleLikeToggle = async (track: any) => {
    const nextLiked = !track.liked
    try {
      const res = await fetch(`/api/song-history/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ liked: nextLiked })
      })
      if (res.ok) {
        await refreshHistoryList()
      }
    } catch (err) {
      console.error('Error toggling like:', err)
    }
  }

  const handlePublishToggle = async (track: any) => {
    if (track.is_published) {
      try {
        const res = await fetch(`/api/song-history/${track.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_published: false })
        })
        if (res.ok) {
          await refreshHistoryList()
        }
      } catch (err) {
        console.error(err)
      }
    } else {
      setSelectedPublishGenre(track.genre || '')
      // 내 채널이 하나뿐이면 기본 선택해 둔다(아무것도 안 골라도 되게).
      setSelectedPublishChannelId(track.channel_id || (myChannels.length === 1 ? myChannels[0].id : ''))
      setPublishError('')
      setPublishedLink(null)
      setPublishConfirmItem(track)
    }
  }

  const confirmPublish = async () => {
    if (!publishConfirmItem) return
    if (!selectedPublishGenre) return

    const track = publishConfirmItem
    setPublishError('')
    try {
      const payload: any = { is_published: true, genre: selectedPublishGenre }
      if (selectedPublishChannelId) payload.channel_id = selectedPublishChannelId

      const res = await fetch(`/api/song-history/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
      if (res.ok) {
        await refreshHistoryList()
        const channel = myChannels.find((c: any) => c.id === selectedPublishChannelId)
        setPublishedLink({
          title: track.title || 'Untitled',
          href: withBase(channel?.slug ? `/artists/${channel.slug}` : '/')
        })
        setPublishConfirmItem(null)
        setSelectedPublishGenre('')
        setSelectedPublishChannelId('')
      } else {
        const data = await res.json().catch(() => ({}))
        setPublishError(
          res.status === 401
            ? (uiLanguage === 'KO' ? '로그인이 필요합니다. 로그인 후 다시 시도해 주세요.' : uiLanguage === 'JA' ? 'ログインが必要です。' : 'You need to be signed in to publish.')
            : (data?.error || (uiLanguage === 'KO' ? `퍼블리싱에 실패했습니다 (${res.status}).` : `Publishing failed (${res.status}).`))
        )
      }
    } catch (err) {
      console.error(err)
      setPublishError(uiLanguage === 'KO' ? '네트워크 오류로 퍼블리싱에 실패했습니다.' : 'Publishing failed due to a network error.')
    }
  }

  const completedSongs = historyList
    .filter((item: any) => item.status === 'completed' && item.audio_url && item.form?.source !== 'upload')
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  const topCompletedSongs = completedSongs.slice(0, 30)
  const detailTrack = detailTrackId ? historyList.find((h: any) => h.id === detailTrackId) || null : null

  return (
    <div className="w-full pb-10 flex items-start gap-4">
      <div className="flex-1 min-w-0 space-y-6">
      <StudioHero
        badge={
          <>
            <Disc className="w-3.5 h-3.5" />
            <span>Suno V4 / V5 Engine</span>
          </>
        }
        title={
          uiLanguage === 'KO' ? (
            <>음악 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">생성 인터페이스</span></>
          ) : uiLanguage === 'JA' ? (
            <>音楽 <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">生成インターフェース</span></>
          ) : (
            <>MUSIC <span className="text-primary drop-shadow-[0_0_15px_rgba(var(--cm-brand-rgb),0.4)]">GENERATION</span></>
          )
        }
        desc={
          uiLanguage === 'KO'
            ? '가사와 스타일 프롬프트를 넣고 Suno 모델 버전·인스트루멘탈 여부를 골라 음원을 만듭니다.'
            : uiLanguage === 'JA'
            ? '歌詞とスタイルプロンプトを入力し、Sunoのモデルバージョンやインストゥルメンタル設定を選んで音源を生成します。'
            : 'Feed lyrics and a style prompt, pick the Suno model version and instrumental mode, then render the track.'
        }
        bg="/studio/hero-gen.webp"
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Settings (5칸 또는 6칸) */}
        <div className="lg:col-span-6 space-y-5 cm-panel-console bg-[#111111] p-6 rounded-2xl border border-[#1e1e1e] shadow-xl">
          <div className="flex justify-between items-center border-b border-[#1e1e1e] pb-3">
            <h2 className="text-sm font-bold text-zinc-200">{uiLanguage === 'KO' ? '입력 설정 (Input)' : uiLanguage === 'JA' ? '入力設定' : 'Input Settings'}</h2>
          </div>
          
          <div className="space-y-4">
            {/* AI Engine Selection */}
            <div className="space-y-2 pb-2 border-b border-[#1e1e1e]">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? 'AI 엔진 선택 (AI Engine)' : uiLanguage === 'JA' ? 'AIエンジンを選択' : 'Select AI Engine'}</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateFormData('modelProvider', 'suno')}
                  className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-sm ${
                    (!generateForm.modelProvider || generateForm.modelProvider === 'suno')
                      ? 'bg-primary text-black border border-primary'
                      : 'bg-[#0a0a0a] text-zinc-400 border border-[#1a1a1a] hover:border-zinc-700'
                  }`}
                >
                  Suno (v4~v5)
                </button>
                <button
                  onClick={() => alert('Udio API 연동 대기 중입니다. 곧 지원될 예정입니다!')}
                  className="px-4 py-2 bg-[#0a0a0a] text-zinc-500 border border-[#1a1a1a] rounded-xl text-xs font-semibold relative cursor-not-allowed flex items-center gap-1.5"
                >
                  <span>Udio (v1.5)</span>
                  <span className="bg-red-950/80 border border-red-800/40 text-red-400 text-[8px] px-1.5 py-0.5 rounded">{uiLanguage === 'KO' ? '예정' : uiLanguage === 'JA' ? '近日公開' : 'Coming'}</span>
                </button>
                <button
                  onClick={() => alert('Google MusicFX API 연동 대기 중입니다. 곧 지원될 예정입니다!')}
                  className="px-4 py-2 bg-[#0a0a0a] text-zinc-500 border border-[#1a1a1a] rounded-xl text-xs font-semibold relative cursor-not-allowed flex items-center gap-1.5"
                >
                  <span>MusicFX</span>
                  <span className="bg-red-950/80 border border-red-800/40 text-red-400 text-[8px] px-1.5 py-0.5 rounded">{uiLanguage === 'KO' ? '예정' : uiLanguage === 'JA' ? '近日公開' : 'Coming'}</span>
                </button>
              </div>
            </div>

            {/* Model Version */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '모델 버전 (Model Version)' : uiLanguage === 'JA' ? 'モデルバージョン' : 'Model Version'}</label>
              <select 
                value={generateForm.modelVersion} 
                onChange={e => updateFormData('modelVersion', e.target.value)}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
              >
                <option value="v5">Suno V5</option>
                <option value="v4">Suno V4</option>
              </select>
              <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? 'Suno 모델 버전입니다. V5가 최신 기본값입니다.' : uiLanguage === 'JA' ? 'Sunoモデルバージョン。V5が最新のデフォルトです。' : 'Suno model version. V5 is the latest default.'}</p>
            </div>

            {/* Custom Mode Toggle */}
            <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">{uiLanguage === 'KO' ? '커스텀 모드 (Custom Mode)' : uiLanguage === 'JA' ? 'カスタムモード' : 'Custom Mode'}</label>
                <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '커스텀 모드를 활성화합니다. 활성화 시 스타일과 제목을 직접 입력합니다.' : uiLanguage === 'JA' ? 'カスタムモードを有効にして、スタイルとタイトルを手動で入力します。' : 'Enable custom mode to enter style and title manually.'}</p>
              </div>
              <button 
                type="button"
                onClick={() => updateFormData('customMode', !generateForm.customMode)}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${generateForm.customMode ? 'bg-primary' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-black transition-transform ${generateForm.customMode ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Instrumental Only Toggle */}
            <div className="flex justify-between items-center py-2 border-b border-[#1a1a1a]">
              <div>
                <label className="text-xs font-bold text-zinc-200 block">{uiLanguage === 'KO' ? '연주곡만 생성 (Inst Only)' : uiLanguage === 'JA' ? 'インストゥルメンタルのみ' : 'Instrumental Only'}</label>
                <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '보컬 없이 악기 연주만 있는 음악을 생성합니다.' : uiLanguage === 'JA' ? 'ボーカルなしのインストゥルメンタル音楽を生成します。' : 'Generate instrumental music without vocals.'}</p>
              </div>
              <button 
                type="button"
                onClick={() => updateFormData('instrumentalOnly', !generateForm.instrumentalOnly)}
                className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${generateForm.instrumentalOnly ? 'bg-primary' : 'bg-zinc-800'}`}
              >
                <div className={`w-4 h-4 rounded-full bg-black transition-transform ${generateForm.instrumentalOnly ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {/* Prompt / Lyrics */}
            <div className="space-y-1">
              <label className={`text-xs font-bold ${generateForm.instrumentalOnly ? 'text-zinc-600' : 'text-zinc-300'}`}>{uiLanguage === 'KO' ? '프롬프트 / 가사 (Prompt)' : uiLanguage === 'JA' ? 'プロンプト / 歌詞' : 'Prompt / Lyrics'}</label>
              <textarea 
                value={generateForm.instrumentalOnly ? '' : generateForm.prompt}
                onChange={e => updateFormData('prompt', e.target.value)}
                disabled={generateForm.instrumentalOnly}
                placeholder={generateForm.instrumentalOnly ? (uiLanguage === 'KO' ? '연주곡만 생성 옵션이 켜져있어 가사를 입력할 수 없습니다.' : uiLanguage === 'JA' ? 'インストゥルメンタルのみのオプションがオンのため、歌詞は入力できません。' : 'Disabled for Instrumental Only') : ''}
                rows={5}
                className={`w-full rounded-xl p-3 text-xs outline-none resize-none custom-scrollbar transition-colors font-mono ${
                  generateForm.instrumentalOnly 
                    ? 'bg-[#0a0a0a]/50 border border-[#1a1a1a] text-zinc-600 cursor-not-allowed opacity-60' 
                    : 'bg-[#0a0a0a] border border-[#1a1a1a] text-zinc-200 focus:border-primary/60'
                }`}
              />
              <p className={`text-[10px] ${generateForm.instrumentalOnly ? 'text-zinc-600' : 'text-zinc-500'}`}>{uiLanguage === 'KO' ? '생성하고자 하는 음악의 가사 또는 묘사입니다. 커스텀 모드가 꺼져있을 때 필수입니다.' : uiLanguage === 'JA' ? '生成したい音楽の歌詞または説明。カスタムモードがオフのときに必須です。' : 'Lyrics or description of the music you want to generate. Required when Custom Mode is off.'}</p>
            </div>

            {generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '스타일 (Style)' : uiLanguage === 'JA' ? 'スタイル' : 'Style'}</label>
                <input 
                  type="text"
                  value={generateForm.style}
                  onChange={e => updateFormData('style', e.target.value)}
                  placeholder="예: 80s City Pop, Groovy Slap Bass, Bright Synth"
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60"
                />
                <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '음악 스타일 및 장르입니다. 커스텀 모드가 켜져있을 때 필수입니다.' : uiLanguage === 'JA' ? '音楽のスタイルとジャンル。カスタムモードがオンのときに必須です。' : 'Music style and genre. Required when Custom Mode is on.'}</p>
              </div>
            )}

            {generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '곡 제목 (Title)' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</label>
                <input 
                  type="text"
                  value={generateForm.title}
                  onChange={e => updateFormData('title', e.target.value)}
                  placeholder="예: Neon City Lights"
                  className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-primary/60"
                />
                <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '음악의 제목입니다. 커스텀 모드가 켜져있을 때 필수입니다.' : uiLanguage === 'JA' ? '音楽のタイトル。カスタムモードがオンのときに必須です。' : 'Title of the music. Required when Custom Mode is on.'}</p>
              </div>
            )}

            {/* Vocal Gender */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '보컬 성별 (Vocal Gender)' : uiLanguage === 'JA' ? 'ボーカルの性別' : 'Vocal Gender'}</label>
              <div className="flex gap-2">
                <button 
                  type="button"
                  onClick={() => updateFormData('vocalGender', 'Male')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${generateForm.vocalGender === 'Male' ? 'bg-primary text-black border-primary' : 'bg-[#0a0a0a] text-zinc-400 border-[#1a1a1a] hover:border-zinc-700'}`}
                >
                  {uiLanguage === 'KO' ? '남성 보컬' : uiLanguage === 'JA' ? '男性' : 'Male'}
                </button>
                <button 
                  type="button"
                  onClick={() => updateFormData('vocalGender', 'Female')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${generateForm.vocalGender === 'Female' ? 'bg-primary text-black border-primary' : 'bg-[#0a0a0a] text-zinc-400 border-[#1a1a1a] hover:border-zinc-700'}`}
                >
                  {uiLanguage === 'KO' ? '여성 보컬' : uiLanguage === 'JA' ? '女性' : 'Female'}
                </button>
              </div>
              <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '생성할 보컬의 성별을 선택합니다.' : uiLanguage === 'JA' ? '生成するボーカルの性別を選択します。' : 'Select the gender of the vocal to generate.'}</p>
            </div>

            {/* Negative Tags */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '제외할 태그 (Negative Tags)' : uiLanguage === 'JA' ? 'ネガティブタグ' : 'Negative Tags'}</label>
              <input 
                type="text"
                value={generateForm.negativeTags}
                onChange={e => updateFormData('negativeTags', e.target.value)}
                placeholder={uiLanguage === 'KO' ? '시끄러운, 헤비메탈, 스크리밍...' : uiLanguage === 'JA' ? 'ノイジー、ヘビーメタル、スクリーミング...' : 'Noisy, heavy metal, screaming...'}
                className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-primary/60 placeholder-zinc-700"
              />
              <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '생성할 음악에서 제외하고 싶은 장르, 스타일 및 요소를 적습니다.' : uiLanguage === 'JA' ? '除外するジャンル、スタイル、要素。' : 'Genres, styles, and elements to exclude.'}</p>
            </div>

            {/* Weights Sliders */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5 bg-[#0a0a0a] p-3 rounded-xl border border-[#1a1a1a]">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-zinc-300">{uiLanguage === 'KO' ? '스타일 강도 (Style Weight)' : uiLanguage === 'JA' ? 'スタイルウェイト' : 'Style Weight'}</label>
                  <span className="font-mono font-bold text-primary">{generateForm.styleWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.styleWeight} 
                  onChange={e => updateFormData('styleWeight', parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500">{uiLanguage === 'KO' ? '스타일 지침 가중치입니다. 값이 높을수록 프롬프트 스타일을 엄격하게 따릅니다.' : uiLanguage === 'JA' ? 'スタイル指示の重み。値が高いほどプロンプトスタイルに厳密に従います。' : 'Weight for style instructions. Higher values strictly follow the prompt style.'}</p>
              </div>

              <div className="space-y-1.5 bg-[#0a0a0a] p-3 rounded-xl border border-[#1a1a1a]">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-zinc-300">{uiLanguage === 'KO' ? '독창성 (Weirdness)' : uiLanguage === 'JA' ? '奇抜さ' : 'Weirdness'}</label>
                  <span className="font-mono font-bold text-primary">{generateForm.weirdness}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.weirdness} 
                  onChange={e => updateFormData('weirdness', parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500">독창성과 실험적인 창의성 수준을 제어합니다.</p>
              </div>

              <div className="space-y-1.5 bg-[#0a0a0a] p-3 rounded-xl border border-[#1a1a1a]">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-zinc-300">오디오 영향도 (Audio Weight)</label>
                  <span className="font-mono font-bold text-primary">{generateForm.audioWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.audioWeight} 
                  onChange={e => updateFormData('audioWeight', parseFloat(e.target.value))}
                  className="w-full accent-primary cursor-pointer"
                />
                <p className="text-[10px] text-zinc-500">음악 생성 시 원본 오디오 소스가 미치는 가중치 영향도입니다.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-[#1e1e1e]">
              <button 
                type="button"
                onClick={() => setGenerateForm({
                  modelProvider: 'suno',
                  modelVersion: 'v5',
                  customMode: true,
                  instrumentalOnly: false,
                  prompt: '',
                  style: '',
                  title: '',
                  vocalGender: 'Female',
                  negativeTags: '',
                  styleWeight: 0.5,
                  weirdness: 0.3,
                  audioWeight: 0.5
                })}
                className="px-4 py-2.5 bg-[#161616] hover:bg-[#1e1e1e] border border-[#232323] rounded-xl text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
              >
                초기화
              </button>
              <button 
                type="button"
                onClick={handleGenerate}
                disabled={isMusicGenerating}
                className="px-6 py-2.5 bg-primary hover:bg-[#f5237f] active:scale-[0.99] text-black rounded-xl text-xs font-extrabold transition-all disabled:opacity-50 shadow-md shadow-yellow-950/40 cursor-pointer"
              >
                생성하기 (10 크레딧)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Generation & Output (6칸) */}
        <div className="lg:col-span-6 space-y-6 cm-panel-console bg-[#111111] p-6 rounded-2xl border border-[#1e1e1e] shadow-xl relative flex flex-col justify-between">
          <div className="space-y-6 flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-zinc-200 border-b border-[#1e1e1e] pb-3 flex justify-between items-center shrink-0">
              <span>{uiLanguage === 'KO' ? '진행 상태 및 완료된 곡' : uiLanguage === 'JA' ? 'ステータス & 完了したトラック' : 'Status & Completed Tracks'}</span>
              <span className="text-xs text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full font-bold">{status}</span>
            </h2>

            {/* Empty standby banner (참고 이미지 스타일) */}
            {activeTasks.length === 0 && !isMusicGenerating && topCompletedSongs.length === 0 && (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4 min-h-[300px]">
                <div className="w-16 h-16 rounded-full bg-[#0a0a0a] border border-[#1a1a1a] flex items-center justify-center shadow-lg">
                  <Music className="w-7 h-7 text-zinc-500" />
                </div>
                <p className="text-xs text-zinc-400 max-w-xs leading-relaxed">
                  좌측의 입력 정보를 바탕으로 실제 오디오 생성을 시작합니다.
                </p>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={isMusicGenerating}
                  className="px-6 py-3 bg-primary hover:bg-[#f5237f] active:scale-[0.99] text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-lg shadow-yellow-950/40 cursor-pointer flex items-center gap-2"
                >
                  <Disc className="w-4 h-4 fill-current text-black animate-spin-slow" />
                  <span>Suno 음악 생성 시작하기 (10 크레딧)</span>
                </button>
              </div>
            )}

            {/* Completed Songs History List */}
            {topCompletedSongs.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex justify-between items-center">
                  <span>{uiLanguage === 'KO' ? `🎵 생성 완료된 곡 목록 (최근 ${topCompletedSongs.length}곡)` : uiLanguage === 'JA' ? `🎵 完了した曲 (最近 ${topCompletedSongs.length}件)` : `🎵 Completed Songs (Recent ${topCompletedSongs.length})`}</span>
                  <span className="text-[9px] text-zinc-500 font-normal normal-case">{uiLanguage === 'KO' ? '* 클릭 시 재생 · 지팡이 아이콘으로 옵션/가사 불러오기' : uiLanguage === 'JA' ? '* クリックで再生 · ワンドアイコンでオプション/歌詞をロード' : '* Click to play · wand icon loads options/lyrics'}</span>
                </p>
                
                <div className="space-y-2">
                  {topCompletedSongs.map((track) => {
                    const isSelected = currentHistoryId === track.id
                    const isCurrentPlaying = currentTrack?.id === track.id && isPlaying
                    const styleSnippet = track.prompt || track.form?.style || ''
                    const displayStyle = styleSnippet.length > 35 ? styleSnippet.slice(0, 32) + '...' : styleSnippet
                    
                    return (
                      <div 
                        key={track.id}
                        role="button"
                        tabIndex={0}
                        onClick={() => playListTrack(track)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            playListTrack(track)
                          }
                        }}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-black/25 border-zinc-800/40 hover:bg-white/[0.02] hover:border-zinc-700/50'
                        }`}
                      >
                        {/* 재생 중이면 썸네일 위에 이퀄라이저가 뜬다 — 홈 카드와 같은 표시(대표 지시 2026-09-05) */}
                        <div className="relative w-11 h-11 shrink-0">
                          {track.image_url ? (
                            <img src={track.image_url} alt="Cover" className="w-11 h-11 rounded-lg object-cover shadow-md" />
                          ) : (
                            <div className="w-11 h-11 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800">
                              <Music className="w-5 h-5 text-zinc-700" />
                            </div>
                          )}
                          {isCurrentPlaying && (
                            <span
                              aria-hidden
                              className="absolute inset-0 rounded-lg bg-black/60 flex items-end justify-center gap-[2.5px] pb-3"
                            >
                              <span className="w-[3px] h-4 bg-primary rounded-sm animate-eq-1 motion-reduce:animate-none" />
                              <span className="w-[3px] h-4 bg-primary rounded-sm animate-eq-2 motion-reduce:animate-none" />
                              <span className="w-[3px] h-4 bg-primary rounded-sm animate-eq-3 motion-reduce:animate-none" />
                            </span>
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1 text-left">
                          <p className={`text-xs font-bold truncate group-hover/item:text-primary transition-colors ${
                            isSelected ? 'text-primary font-black' : 'text-white'
                          }`}>{track.title}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-zinc-400 font-mono font-bold shrink-0">
                              <AudioDuration url={track.audio_url} />
                            </span>
                            <span className="text-zinc-700 text-[10px] shrink-0">•</span>
                            <p className="text-[10px] text-zinc-500 truncate flex-1">{displayStyle || 'Suno Generated'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                          {/* 옵션/가사 불러오기 */}
                          <button
                            onClick={() => handleSelectTrack(track)}
                            className="p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
                            title={uiLanguage === 'KO' ? '옵션/가사 불러오기' : uiLanguage === 'JA' ? 'オプション/歌詞をロード' : 'Load options/lyrics'}
                          >
                            <Wand2 className={`w-3.5 h-3.5 transition-colors ${isSelected ? 'text-primary' : 'text-zinc-500 hover:text-primary'}`} />
                          </button>

                          {/* 공개 여부 설정 */}
                          <button
                            onClick={() => handlePublishToggle(track)}
                            className="p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
                            title={track.is_published ? (uiLanguage === 'KO' ? '비공개로 설정' : uiLanguage === 'JA' ? '非公開にする' : 'Make Private') : (uiLanguage === 'KO' ? '공개로 설정' : uiLanguage === 'JA' ? '公開する' : 'Make Public')}
                          >
                            <Globe 
                              className={`w-3.5 h-3.5 ${
                                track.is_published 
                                  ? 'text-emerald-400' 
                                  : 'text-zinc-500 hover:text-zinc-300'
                              }`} 
                            />
                          </button>

                          {/* 플레이리스트 등록 */}
                          <div className="relative">
                            <button
                              onClick={() => setActivePlaylistMenuId(activePlaylistMenuId === track.id ? null : track.id)}
                              className={`p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0 ${
                                track.playlist_id ? 'text-primary' : 'text-zinc-500 hover:text-zinc-300'
                              }`}
                              title={uiLanguage === 'KO' ? '플레이리스트 지정' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlist'}
                            >
                              <FolderPlus className="w-3.5 h-3.5" />
                            </button>

                            {/* 드롭다운 메뉴 */}
                            {activePlaylistMenuId === track.id && (
                              <>
                                <div className="fixed inset-0 z-40" onClick={() => setActivePlaylistMenuId(null)} />
                                <div className="absolute right-0 mt-2 w-48 bg-[#18181c] border border-zinc-800 rounded-xl shadow-2xl p-2 z-50 text-left">
                                  <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-wider px-2 py-1 border-b border-zinc-900">
                                    {uiLanguage === 'KO' ? '플레이리스트 선택' : uiLanguage === 'JA' ? 'プレイリストを選択' : 'Select Playlist'}
                                  </p>
                                  <div className="max-h-40 overflow-y-auto py-1 space-y-0.5 custom-scrollbar">
                                    <button
                                      onClick={async () => {
                                        setActivePlaylistMenuId(null)
                                        try {
                                          const res = await fetch(`/api/song-history/${track.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({ playlist_id: null })
                                          })
                                          if (res.ok) {
                                            await refreshHistoryList()
                                          }
                                        } catch (err) {
                                          console.error(err)
                                        }
                                      }}
                                      className="w-full text-left px-2 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[10px] font-bold cursor-pointer"
                                    >
                                      <span>{uiLanguage === 'KO' ? '플레이리스트 해제' : uiLanguage === 'JA' ? 'プレイリストから削除' : 'Remove from Playlist'}</span>
                                      {!track.playlist_id && <Check className="w-3 h-3 text-primary" />}
                                    </button>

                                    {/* Albums Section */}
                                    {playlists.filter(p => parsePlaylistDescription(p.description).type === 'album').length > 0 && (
                                      <div className="px-2 py-1 text-[8px] font-black tracking-widest text-primary uppercase bg-white/[0.01] border-y border-white/[0.03] select-none my-1">
                                        {uiLanguage === 'KO' ? '내 앨범' : uiLanguage === 'JA' ? 'アルバム' : 'Albums'}
                                      </div>
                                    )}
                                    {playlists.filter(p => parsePlaylistDescription(p.description).type === 'album').map((playlist) => {
                                      const isSelected = track.playlist_id === playlist.id
                                      return (
                                        <button
                                          key={playlist.id}
                                          onClick={async () => {
                                            setActivePlaylistMenuId(null)
                                            try {
                                              const res = await fetch(`/api/song-history/${track.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ playlist_id: playlist.id })
                                              })
                                              if (res.ok) {
                                                await refreshHistoryList()
                                              }
                                            } catch (err) {
                                              console.error(err)
                                            }
                                          }}
                                          className="w-full text-left px-2 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[10px] font-bold cursor-pointer"
                                        >
                                          <span className="truncate">{playlist.title}</span>
                                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                                        </button>
                                      )
                                    })}

                                    {/* Playlists Section */}
                                    {playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist').length > 0 && (
                                      <div className="px-2 py-1 text-[8px] font-black tracking-widest text-zinc-400 uppercase bg-white/[0.01] border-y border-white/[0.03] select-none my-1">
                                        {uiLanguage === 'KO' ? '나만의 플레이리스트' : uiLanguage === 'JA' ? 'プレイリスト' : 'Playlists'}
                                      </div>
                                    )}
                                    {playlists.filter(p => parsePlaylistDescription(p.description).type === 'playlist').map((playlist) => {
                                      const isSelected = track.playlist_id === playlist.id
                                      return (
                                        <button
                                          key={playlist.id}
                                          onClick={async () => {
                                            setActivePlaylistMenuId(null)
                                            try {
                                              const res = await fetch(`/api/song-history/${track.id}`, {
                                                method: 'PUT',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ playlist_id: playlist.id })
                                              })
                                              if (res.ok) {
                                                await refreshHistoryList()
                                              }
                                            } catch (err) {
                                              console.error(err)
                                            }
                                          }}
                                          className="w-full text-left px-2 py-1.5 hover:bg-white/[0.03] text-zinc-400 hover:text-white rounded-lg transition-colors flex items-center justify-between text-[10px] font-bold cursor-pointer"
                                        >
                                          <span className="truncate">{playlist.title}</span>
                                          {isSelected && <Check className="w-3 h-3 text-primary" />}
                                        </button>
                                      )
                                    })}
                                  </div>
                                </div>
                              </>
                            )}
                          </div>

                          {/* 좋아요 버튼 */}
                          <button
                            onClick={() => handleLikeToggle(track)}
                            className="p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer group/heart shrink-0"
                            title={uiLanguage === 'KO' ? '좋아요' : uiLanguage === 'JA' ? 'いいね' : 'Like'}
                          >
                            <Heart 
                              className={`w-3.5 h-3.5 transition-all duration-200 active:scale-125 ${
                                track.liked 
                                  ? 'text-primary fill-current' 
                                  : 'text-zinc-500 hover:text-primary group-hover/heart:scale-105'
                              }`} 
                            />
                          </button>

                          {/* 다운로드 버튼 */}
                          <button
                            onClick={() => handleDownloadTrack(track.audio_url, track.title, track.image_url)}
                            className="p-1.5 rounded hover:bg-white/[0.05] transition-colors cursor-pointer shrink-0"
                            title={uiLanguage === 'KO' ? '다운로드' : uiLanguage === 'JA' ? 'ダウンロード' : 'Download'}
                          >
                            <Download className="w-3.5 h-3.5 text-zinc-500 hover:text-primary transition-colors" />
                          </button>

                          {/* 재생 버튼 */}
                          <button
                            onClick={() => playListTrack(track)}
                            className="h-8 w-8 rounded-full bg-primary text-black flex items-center justify-center shrink-0 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                          >
                            {isCurrentPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ) : (
              !isMusicGenerating && activeTasks.length === 0 && (
                <div className="flex flex-col items-center justify-start pt-12 pb-6 space-y-4">
                  <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-2">
                    <Music className="w-8 h-8 text-on-surface-variant" />
                  </div>
                  <p className="text-sm text-on-surface text-center">{uiLanguage === 'KO' ? '좌측의 입력 정보를 바탕으로\n실제 오디오 생성을 시작합니다.' : uiLanguage === 'JA' ? '左側の入力オプションに\n基づいて音声を生成します。' : 'Based on the input information on the left,\nactual audio generation will start.'}</p>
                  <button 
                    onClick={handleGenerate}
                    disabled={isMusicGenerating}
                    className="w-full py-4 bg-primary hover:bg-primary text-[#090909] font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Disc className="w-5 h-5" />
                    {uiLanguage === 'KO' ? 'Suno 음악 생성 시작하기 (10 크레딧)' : uiLanguage === 'JA' ? 'Suno音楽生成を開始 (10クレジット)' : 'Start Suno Music Generation (10 Credits)'}
                  </button>
                </div>
              )
            )}
          </div>
        </div>
      </div>
      </div>

      <TrackDetailPanel
        track={detailTrack}
        collapsed={detailCollapsed}
        onToggleCollapse={toggleDetailCollapsed}
        onClose={() => setDetailTrackId(null)}
        uiLanguage={uiLanguage}
        isPlaying={!!detailTrack && currentTrack?.id === detailTrack.id && isPlaying}
        onPlayToggle={() => detailTrack && playListTrack(detailTrack)}
        onLikeToggle={() => detailTrack && handleLikeToggle(detailTrack)}
        onDownload={() => detailTrack && handleDownloadTrack(detailTrack.audio_url, detailTrack.title, detailTrack.image_url)}
        onLoadIntoForm={() => detailTrack && handleSelectTrack(detailTrack)}
        durationSlot={detailTrack?.audio_url ? <AudioDuration url={detailTrack.audio_url} /> : null}
      />

      {publishConfirmItem && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#18181c] border border-zinc-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-primary" />
              {uiLanguage === 'KO' ? '음원 퍼블리싱 (공개)' : uiLanguage === 'JA' ? 'トラックを公開' : 'Publish Track (Public)'}
            </h3>
            
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              {uiLanguage === 'KO' 
                ? `'${publishConfirmItem.title || 'Untitled'}' 곡을 퍼블리싱하여 내 채널에 공개하시겠습니까?`
                : uiLanguage === 'JA' ? `本当に公開しますか: ` : `Are you sure you want to publish '${publishConfirmItem.title || 'Untitled'}'?`}
            </p>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">장르 카테고리</label>
              <select
                value={selectedPublishGenre}
                onChange={(e) => setSelectedPublishGenre(e.target.value)}
                className="w-full bg-[#242429] border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none"
              >
                <option value="">-- 장르 선택 --</option>
                {GENRES.map(g => (
                  <option key={g.name} value={g.name}>
                    {g.name} {uiLanguage === 'KO' && g.korean ? `(${g.korean})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">공개할 채널</label>
              {myChannels.length > 0 ? (
                <select
                  value={selectedPublishChannelId}
                  onChange={(e) => setSelectedPublishChannelId(e.target.value)}
                  className="w-full bg-[#242429] border border-zinc-800 rounded-lg p-2.5 text-xs text-white outline-none"
                >
                  <option value="">-- 채널 없이 공개 --</option>
                  {myChannels.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <p className="text-[11px] text-zinc-500 leading-relaxed">
                  {uiLanguage === 'KO'
                    ? '내 채널이 없습니다. 채널 없이 공개하면 쿠키뮤직 메인·차트에는 뜨지만 채널 페이지에는 모이지 않습니다.'
                    : 'You have no channel yet. The track will appear on CookieMusic home and charts, but not on a channel page.'}
                  {' '}
                  <a href={withBase('/profile')} className="text-primary underline underline-offset-2">
                    {uiLanguage === 'KO' ? '채널 만들기' : 'Create a channel'}
                  </a>
                </p>
              )}
            </div>

            {publishError && (
              <p className="text-[11px] text-red-400 leading-relaxed bg-red-950/30 border border-red-900/40 rounded-lg p-2.5">
                {publishError}
              </p>
            )}

            <div className="flex gap-2.5 pt-2">
              <button
                onClick={() => {
                  setPublishConfirmItem(null)
                  setSelectedPublishGenre('')
                  setSelectedPublishChannelId('')
                  setPublishError('')
                }}
                className="flex-1 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-400 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={confirmPublish}
                disabled={!selectedPublishGenre}
                className="flex-1 py-2 bg-primary hover:bg-primary text-black disabled:opacity-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                퍼블리싱하기
              </button>
            </div>
          </div>
        </div>
      )}

      {publishedLink && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 bg-[#18181c] border border-primary/40 rounded-xl shadow-2xl px-4 py-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="w-4 h-4 text-primary shrink-0" />
          <span className="text-xs text-zinc-200">
            {uiLanguage === 'KO' ? `'${publishedLink.title}' 퍼블리싱 완료` : `Published '${publishedLink.title}'`}
          </span>
          <a
            href={publishedLink.href}
            className="text-xs font-bold text-primary underline underline-offset-2 shrink-0"
          >
            {uiLanguage === 'KO' ? '쿠키뮤직에서 보기' : 'View on CookieMusic'}
          </a>
          <button
            onClick={() => setPublishedLink(null)}
            className="text-zinc-500 hover:text-zinc-300 text-xs cursor-pointer shrink-0"
            aria-label="close"
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}
