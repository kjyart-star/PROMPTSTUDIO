'use client'

import { useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Music, Check, ArrowRight, Disc, User, Play, Pause, Heart, Globe, FolderPlus, Download } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { parsePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'

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
  const [status, setStatus] = useState('대기 중')
  const [uiLanguage, setUiLanguage] = useState('KO')
  const [userCredits, setUserCredits] = useState<number>(120)
  const [profile, setProfile] = useState<any>(null)

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
      
      const savedCredits = localStorage.getItem('user-credits')
      if (savedCredits !== null) {
        setUserCredits(parseFloat(savedCredits))
      } else {
        localStorage.setItem('user-credits', '120')
        setUserCredits(120)
      }
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

    const savedCredits = localStorage.getItem('user-credits')
    const currentCredits = savedCredits !== null ? parseFloat(savedCredits) : 120
    if (currentCredits < 10) {
      alert(uiLanguage === 'KO' ? '크레딧이 부족합니다. (필요: 10 크레딧)' : uiLanguage === 'JA' ? 'クレジットが不足しています。(10クレジット必要)' : 'Insufficient credits. (Requires 10 credits)')
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
      const res = await fetch('/api/music/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId: activeHistoryId, ...generateForm })
      })
      if (res.ok) {
        const data = await res.json()

        const nextCredits = Math.round(currentCredits - 10)
        localStorage.setItem('user-credits', String(nextCredits))
        setUserCredits(nextCredits)

        const savedTx = localStorage.getItem('user-transactions')
        let txList = []
        if (savedTx) {
          try {
            txList = JSON.parse(savedTx)
          } catch (e) {
            console.error(e)
          }
        }
        const newTx = {
          id: 'tx-' + Date.now(),
          date: new Date().toISOString().replace('T', ' ').slice(0, 16),
          type: 'use',
          desc: uiLanguage === 'KO' ? '음악 생성 (-10)' : uiLanguage === 'JA' ? '曲生成 (-10)' : 'Music Generation (-10)',
          amount: '-10',
          status: 'Completed'
        }
        localStorage.setItem('user-transactions', JSON.stringify([newTx, ...txList]))

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
        alert("음악 생성 요청 실패")
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
        title: track.title?.replace(/\\s\\(v\\d+\\)$/, '') || track.form.title || '',
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
      setPublishConfirmItem(track)
    }
  }

  const confirmPublish = async () => {
    if (!publishConfirmItem) return
    if (!selectedPublishGenre) return

    const track = publishConfirmItem
    try {
      const res = await fetch(`/api/song-history/${track.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_published: true, genre: selectedPublishGenre })
      })
      if (res.ok) {
        await refreshHistoryList()
      }
    } catch (err) {
      console.error(err)
    }

    setPublishConfirmItem(null)
    setSelectedPublishGenre('')
  }

  const completedSongs = historyList
    .filter((item: any) => item.status === 'completed' && item.audio_url)
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
  const topCompletedSongs = completedSongs.slice(0, 30)

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pt-6 md:pt-8">
      <h1 className="text-xl sm:text-2xl font-black text-on-surface flex items-center gap-2 uppercase tracking-wide mb-8">
        <Disc className="w-6 h-6 text-primary shrink-0" />
        {uiLanguage === 'KO' ? '음악 생성 인터페이스' : uiLanguage === 'JA' ? '음악 생성 인터페이스' : 'Music Generation Interface'}
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6 bg-surface p-6 rounded-2xl border border-outline-variant/10 shadow-lg">
          <div className="flex justify-between items-center border-b border-outline-variant/10 pb-3">
            <h2 className="text-sm font-bold text-on-surface">{uiLanguage === 'KO' ? '입력 설정 (Input)' : uiLanguage === 'JA' ? '入力設定' : 'Input Settings'}</h2>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2 pb-2 border-b border-outline-variant/10">
              <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? 'AI 엔진 선택 (AI Engine)' : uiLanguage === 'JA' ? 'AIエンジンを選択' : 'Select AI Engine'}</label>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => updateFormData('modelProvider', 'suno')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
                    (!generateForm.modelProvider || generateForm.modelProvider === 'suno')
                      ? 'bg-primary text-[#080d08] border border-primary'
                      : 'bg-surface-container-low text-on-surface border border-outline-variant/20 hover:border-primary/50'
                  }`}
                >
                  Suno (v4~v5)
                </button>
                <button
                  onClick={() => alert('Udio API 연동 대기 중입니다. 곧 지원될 예정입니다!')}
                  className="px-4 py-2 bg-surface-container-low text-on-surface-variant/40 border border-outline-variant/20 rounded-xl text-xs font-bold relative cursor-not-allowed"
                >
                  Udio (v1.5)
                  <span className="absolute -top-2 -right-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] px-1.5 py-0.5 rounded-md">{uiLanguage === 'KO' ? '예정' : uiLanguage === 'JA' ? '近日公開' : 'Coming'}</span>
                </button>
                <button
                  onClick={() => alert('Google MusicFX API 연동 대기 중입니다. 곧 지원될 예정입니다!')}
                  className="px-4 py-2 bg-surface-container-low text-on-surface-variant/40 border border-outline-variant/20 rounded-xl text-xs font-bold relative cursor-not-allowed"
                >
                  MusicFX
                  <span className="absolute -top-2 -right-2 bg-red-500/10 border border-red-500/30 text-red-400 text-[9px] px-1.5 py-0.5 rounded-md">{uiLanguage === 'KO' ? '예정' : uiLanguage === 'JA' ? '近日公開' : 'Coming'}</span>
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '모델 버전 (Model Version)' : uiLanguage === 'JA' ? 'モデルバージョン' : 'Model Version'}</label>
              <select 
                value={generateForm.modelVersion} 
                onChange={e => updateFormData('modelVersion', e.target.value)}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2 text-xs text-on-surface outline-none"
              >
                <option value="v5">Suno V5</option>
                <option value="v4">Suno V4</option>
              </select>
              <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? 'Suno 모델 버전입니다. V5가 최신 기본값입니다.' : uiLanguage === 'JA' ? 'Sunoモデルバージョン。V5が最新のデフォルトです。' : 'Suno model version. V5 is the latest default.'}</p>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <label className="text-xs font-bold text-on-surface block">{uiLanguage === 'KO' ? '커스텀 모드 (Custom Mode)' : uiLanguage === 'JA' ? 'カスタムモード' : 'Custom Mode'}</label>
                <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '커스텀 모드를 활성화합니다. 활성화 시 스타일과 제목을 직접 입력합니다.' : uiLanguage === 'JA' ? 'カスタムモードを有効にして、スタイルとタイトルを手動で入力します。' : 'Enable custom mode to enter style and title manually.'}</p>
              </div>
              <button 
                onClick={() => updateFormData('customMode', !generateForm.customMode)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${generateForm.customMode ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${generateForm.customMode ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="flex justify-between items-center py-2">
              <div>
                <label className="text-xs font-bold text-on-surface block">{uiLanguage === 'KO' ? '연주곡만 생성 (Inst Only)' : uiLanguage === 'JA' ? 'インストゥルメンタルのみ' : 'Instrumental Only'}</label>
                <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '보컬 없이 악기 연주만 있는 음악을 생성합니다.' : uiLanguage === 'JA' ? 'ボーカルなしのインストゥルメンタル音楽を生成します。' : 'Generate instrumental music without vocals.'}</p>
              </div>
              <button 
                onClick={() => updateFormData('instrumentalOnly', !generateForm.instrumentalOnly)}
                className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${generateForm.instrumentalOnly ? 'bg-primary' : 'bg-surface-container-high'}`}
              >
                <div className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${generateForm.instrumentalOnly ? 'translate-x-4' : 'translate-x-0'}`} />
              </button>
            </div>

            <div className="space-y-1">
              <label className={`text-xs font-bold ${generateForm.instrumentalOnly ? 'text-on-surface-variant/50' : 'text-on-surface'}`}>{uiLanguage === 'KO' ? '프롬프트 / 가사 (Prompt)' : uiLanguage === 'JA' ? 'プロンプト / 歌詞' : 'Prompt / Lyrics'}</label>
              <textarea 
                value={generateForm.instrumentalOnly ? '' : generateForm.prompt}
                onChange={e => updateFormData('prompt', e.target.value)}
                disabled={generateForm.instrumentalOnly}
                placeholder={generateForm.instrumentalOnly ? (uiLanguage === 'KO' ? '연주곡만 생성 옵션이 켜져있어 가사를 입력할 수 없습니다.' : uiLanguage === 'JA' ? 'インストゥルメンタルのみのオプションがオンのため、歌詞は入力できません。' : 'Disabled for Instrumental Only') : ''}
                rows={5}
                className={`w-full border rounded-lg p-3 text-xs outline-none resize-none custom-scrollbar transition-colors ${
                  generateForm.instrumentalOnly 
                    ? 'bg-surface-container/50 border-outline-variant/10 text-on-surface-variant/30 cursor-not-allowed opacity-60' 
                    : 'bg-surface-container-low border-outline-variant/20 text-on-surface'
                }`}
              />
              <p className={`text-[10px] ${generateForm.instrumentalOnly ? 'text-on-surface-variant/40' : 'text-on-surface-variant'}`}>{uiLanguage === 'KO' ? '생성하고자 하는 음악의 가사 또는 묘사입니다. 커스텀 모드가 꺼져있을 때 필수입니다.' : uiLanguage === 'JA' ? '生成したい音楽の歌詞または説明。カスタムモードがオフのときに必須です。' : 'Lyrics or description of the music you want to generate. Required when Custom Mode is off.'}</p>
            </div>

            {generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '스타일 (Style)' : uiLanguage === 'JA' ? 'スタイル' : 'Style'}</label>
                <input 
                  type="text"
                  value={generateForm.style}
                  onChange={e => updateFormData('style', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface outline-none"
                />
                <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '음악 스타일 및 장르입니다. 커스텀 모드가 켜져있을 때 필수입니다.' : uiLanguage === 'JA' ? '音楽のスタイルとジャンル。カスタムモードがオンのときに必須です。' : 'Music style and genre. Required when Custom Mode is on.'}</p>
              </div>
            )}

            {generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '곡 제목 (Title)' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</label>
                <input 
                  type="text"
                  value={generateForm.title}
                  onChange={e => updateFormData('title', e.target.value)}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface outline-none"
                />
                <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '음악의 제목입니다. 커스텀 모드가 켜져있을 때 필수입니다.' : uiLanguage === 'JA' ? '音楽のタイトル。カスタムモードがオンのときに必須です。' : 'Title of the music. Required when Custom Mode is on.'}</p>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '보컬 성별 (Vocal Gender)' : uiLanguage === 'JA' ? 'ボーカルの性別' : 'Vocal Gender'}</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => updateFormData('vocalGender', 'Male')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${generateForm.vocalGender === 'Male' ? 'bg-primary text-[#080d08] border-primary' : 'bg-transparent text-on-surface border-outline-variant/30 hover:border-outline-variant'}`}
                >
                  {uiLanguage === 'KO' ? '남성 보컬' : uiLanguage === 'JA' ? '男性' : 'Male'}
                </button>
                <button 
                  onClick={() => updateFormData('vocalGender', 'Female')}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${generateForm.vocalGender === 'Female' ? 'bg-primary text-[#080d08] border-primary' : 'bg-transparent text-on-surface border-outline-variant/30 hover:border-outline-variant'}`}
                >
                  {uiLanguage === 'KO' ? '여성 보컬' : uiLanguage === 'JA' ? '女性' : 'Female'}
                </button>
              </div>
              <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '생성할 보컬의 성별을 선택합니다.' : uiLanguage === 'JA' ? '生成するボーカルの性別を選択します。' : 'Select the gender of the vocal to generate.'}</p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">{uiLanguage === 'KO' ? '제외할 태그 (Negative Tags)' : uiLanguage === 'JA' ? 'ネガティブタグ' : 'Negative Tags'}</label>
              <input 
                type="text"
                value={generateForm.negativeTags}
                onChange={e => updateFormData('negativeTags', e.target.value)}
                placeholder={uiLanguage === 'KO' ? '시끄러운, 헤비메탈, 스크리밍...' : uiLanguage === 'JA' ? 'ノイジー、ヘビーメタル、スクリーミング...' : 'Noisy, heavy metal, screaming...'}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface outline-none placeholder:text-on-surface-variant/50"
              />
              <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '생성할 음악에서 제외하고 싶은 장르, 스타일 및 요소를 적습니다.' : uiLanguage === 'JA' ? '除外するジャンル、スタイル、要素。' : 'Genres, styles, and elements to exclude.'}</p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-on-surface">{uiLanguage === 'KO' ? '스타일 강도 (Style Weight)' : uiLanguage === 'JA' ? 'スタイルウェイト' : 'Style Weight'}</label>
                  <span className="font-bold">{generateForm.styleWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.styleWeight} 
                  onChange={e => updateFormData('styleWeight', parseFloat(e.target.value))}
                  className="w-full accent-primary"
                />
                <p className="text-[10px] text-on-surface-variant">{uiLanguage === 'KO' ? '스타일 지침 가중치입니다. 값이 높을수록 프롬프트 스타일을 엄격하게 따릅니다.' : uiLanguage === 'JA' ? 'スタイル指示の重み。値が高いほどプロンプトスタイルに厳密に従います。' : 'Weight for style instructions. Higher values strictly follow the prompt style.'}</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-on-surface">{uiLanguage === 'KO' ? '독창성 (Weirdness)' : uiLanguage === 'JA' ? '奇抜さ' : 'Weirdness'}</label>
                  <span className="font-bold">{generateForm.weirdness}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.weirdness} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, weirdness: parseFloat(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <p className="text-[10px] text-on-surface-variant">독창성과 실험적인 창의성 수준을 제어합니다.</p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-on-surface">오디오 영향도 (Audio Weight)</label>
                  <span className="font-bold">{generateForm.audioWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.audioWeight} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, audioWeight: parseFloat(e.target.value) }))}
                  className="w-full accent-primary"
                />
                <p className="text-[10px] text-on-surface-variant">음악 생성 시 원본 오디오 소스가 미치는 가중치 영향도입니다.</p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-3 pt-4 border-t border-outline-variant/10">
              <button className="px-4 py-2 border border-outline-variant/30 hover:border-outline-variant rounded-lg text-xs font-bold text-on-surface transition-colors">
                초기화
              </button>
              <button 
                onClick={handleGenerate}
                disabled={isMusicGenerating}
                className="px-6 py-2 bg-primary hover:bg-[#e3fe06] text-[#080d08] rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
              >
                생성하기 (10 크레딧)
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Generation & Output */}
        <div className="space-y-6 bg-surface-container p-6 rounded-2xl border border-primary/20 shadow-xl relative flex flex-col">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          
          <h2 className="text-sm font-bold text-on-surface border-b border-outline-variant/10 pb-3 flex justify-between items-center shrink-0">
            {uiLanguage === 'KO' ? '진행 상태 및 완료된 곡' : uiLanguage === 'JA' ? 'ステータス & 完了したトラック' : 'Status & Completed Tracks'}
            <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">{status}</span>
          </h2>

          <div className="flex-1 space-y-6">
            {/* Active Task Progress Cards List */}
            {activeTasks.length > 0 && (
              <div className="space-y-4 w-full border-b border-outline-variant/10 pb-6 shrink-0">
                <p className="text-[10px] font-black uppercase text-primary tracking-wider flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  {uiLanguage === 'KO' ? `생성 중인 음악 (${activeTasks.length * 2}곡 생성중)` : uiLanguage === 'JA' ? `アクティブな生成 (${activeTasks.length * 2}曲を生成中)` : `Active Generations (${activeTasks.length * 2} tracks generating)`}
                </p>
                <div className="space-y-3">
                  {activeTasks.map((task) => (
                    <div key={task.id} className="bg-black/30 p-4 rounded-xl border border-outline-variant/5 space-y-3 select-none">
                      <div className="flex justify-between items-center">
                        <div className="min-w-0 flex-1 pr-4">
                          <p className="text-xs font-bold text-white truncate">{task.title}</p>
                          <p className="text-[10px] text-zinc-500 mt-1 font-medium">
                            {task.status === 'completed' ? (
                              <span className="text-primary font-bold">{uiLanguage === 'KO' ? '완료' : uiLanguage === 'JA' ? '完了' : 'Completed'}</span>
                            ) : task.status === 'failed' ? (
                              <span className="text-red-400 font-bold">{uiLanguage === 'KO' ? '실패' : uiLanguage === 'JA' ? '失敗' : 'Failed'}</span>
                            ) : task.state === 'queuing' ? (
                              <span className="animate-pulse">{uiLanguage === 'KO' ? '대기 중...' : uiLanguage === 'JA' ? 'キューに入りました...' : 'Queued...'}</span>
                            ) : (
                              <span className="animate-pulse text-emerald-400">{uiLanguage === 'KO' ? '보컬 및 악기 합성 중...' : uiLanguage === 'JA' ? '音声と楽器を合成中...' : 'Synthesizing voice & instruments...'}</span>
                            )}
                          </p>
                        </div>
                        <span className="text-xs font-bold text-primary font-mono">{task.progress}%</span>
                      </div>

                      {/* Smooth Progress bar */}
                      <div className="w-full bg-zinc-900 h-1.5 rounded-full overflow-hidden border border-zinc-800">
                        <div 
                          className={`h-full transition-all duration-1000 ${
                            task.status === 'completed' 
                              ? 'bg-primary shadow-sm' 
                              : task.status === 'failed'
                                ? 'bg-red-500'
                                : 'bg-gradient-to-r from-[#c2d905] to-primary'
                          }`}
                          style={{ width: `${task.progress}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Is Generating Spinner (temporary API call loader) */}
            {isMusicGenerating && (
              <div className="flex flex-col items-center justify-start p-8 pt-12 bg-surface-container-lowest rounded-xl border border-primary/20 shrink-0">
                 <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-sm text-primary font-bold">{uiLanguage === 'KO' ? 'Suno 서버에 요청 전송 중...' : uiLanguage === 'JA' ? 'Sunoにリクエストを送信中...' : 'Sending request to Suno...'}</p>
              </div>
            )}

            {/* Completed Songs History List */}
            {topCompletedSongs.length > 0 ? (
              <div className="space-y-3">
                <p className="text-[10px] font-black uppercase text-zinc-400 tracking-wider flex justify-between items-center">
                  <span>{uiLanguage === 'KO' ? `🎵 생성 완료된 곡 목록 (최근 ${topCompletedSongs.length}곡)` : uiLanguage === 'JA' ? `🎵 完了した曲 (最近 ${topCompletedSongs.length}件)` : `🎵 Completed Songs (Recent ${topCompletedSongs.length})`}</span>
                  <span className="text-[9px] text-zinc-500 font-normal normal-case">{uiLanguage === 'KO' ? '* 클릭 시 옵션/가사 불러오기' : uiLanguage === 'JA' ? '* クリックしてオプション/歌詞をロード' : '* Click to load options/lyrics'}</span>
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
                        onClick={() => handleSelectTrack(track)}
                        className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 cursor-pointer select-none group/item ${
                          isSelected
                            ? 'bg-primary/10 border-primary/40 shadow-lg shadow-emerald-500/5'
                            : 'bg-black/25 border-zinc-800/40 hover:bg-white/[0.02] hover:border-zinc-700/50'
                        }`}
                      >
                        {track.image_url ? (
                          <img src={track.image_url} alt="Cover" className="w-11 h-11 rounded-lg object-cover shadow-md shrink-0" />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0">
                            <Music className="w-5 h-5 text-zinc-700" />
                          </div>
                        )}
                        
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
                                      <div className="px-2 py-1 text-[8px] font-black tracking-widest text-[#e3fe06] uppercase bg-white/[0.01] border-y border-white/[0.03] select-none my-1">
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
                            onClick={() => {
                              const trackToPlay = {
                                id: track.id,
                                title: track.title,
                                file_url: track.audio_url,
                                duration_sec: 180,
                                album_id: 'studio-generated',
                                image_url: track.image_url || '/default-album.png',
                                album: {
                                  id: 'studio-generated',
                                  title: 'Studio Generation',
                                  cover_url: track.image_url || '/default-album.png',
                                  artist: {
                                    name: profile?.display_name || user?.email?.split('@')[0] || 'AI Generator',
                                    slug: user?.email?.split('@')[0] || 'ai-generator',
                                    avatar_url: profile?.avatar_url || '/default-album.png',
                                    bio: 'AI Artist'
                                  }
                                }
                              }
                              if (currentTrack?.id === track.id) {
                                togglePlay()
                              } else {
                                playTrack(trackToPlay as any, [trackToPlay] as any[])
                              }
                            }}
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
                    className="w-full py-4 bg-primary hover:bg-[#e3fe06] text-[#080d08] font-extrabold text-sm rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-primary/10 hover:shadow-primary/20 hover:-translate-y-0.5 active:translate-y-0"
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

            <div className="flex gap-2.5 pt-2">
              <button 
                onClick={() => {
                  setPublishConfirmItem(null)
                  setSelectedPublishGenre('')
                }}
                className="flex-1 py-2 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 rounded-lg text-xs font-bold text-zinc-400 transition-colors cursor-pointer"
              >
                취소
              </button>
              <button 
                onClick={confirmPublish}
                disabled={!selectedPublishGenre}
                className="flex-1 py-2 bg-primary hover:bg-[#e3fe06] text-black disabled:opacity-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                퍼블리싱하기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
