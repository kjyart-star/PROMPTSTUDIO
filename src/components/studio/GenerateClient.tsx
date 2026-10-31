'use client'

import { LpDisc } from '@/components/player/LpDisc'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Music, Check, ArrowRight, Disc, User, Play, Pause, Heart, Globe, FolderPlus, Download, Wand2, ChevronDown, Trash2 } from 'lucide-react'
import { usePlayerStore } from '@/stores/playerStore'
import { AudioDuration } from './StudioAudioDuration'
import { parsePlaylistDescription } from '@/lib/utils'
import { GENRES } from '@/lib/constants'
import { withBase } from '@/lib/basePath'
import { resolveStudioAudioUrl } from '@/lib/studio/audioUrl'
import { historyItemToTrack, buildHistoryQueue, queueWithPlayable } from '@/lib/studio/playQueue'
import { downloadStudioTrack } from '@/lib/studio/downloadTrack'
import { useSuiteCredits } from '@/lib/credits/useSuiteCredits'
import { TrackDetailPanel } from './TrackDetailPanel'
import { groupSongsByDay } from './songDayGroups'
import LyricsHelper from './LyricsHelper'
import GenerateQueue from './GenerateQueue'
import { formatCredits, formatPriceCredits } from '@/lib/credits/format'
import { normalizeSunoModelVersion, SUNO_DEFAULT_MODEL_VERSION, SUNO_MODEL_VERSIONS } from '@/lib/suno/versions'

/** 스타일 칸 아래 빠른 추가 칩 — 영문 태그가 모델에 가장 잘 먹힌다 */
const STYLE_CHIPS = ['K-Pop', 'City Pop', 'R&B', 'Hip Hop', 'Ballad', 'Lo-fi', 'Acoustic', 'EDM', 'Rock', 'Jazz']

interface GenerateClientProps {
  user: any
  historyId?: string | null
  initialPrompt?: string
  initialStyle?: string
  initialTitle?: string
  initialNegativePrompt?: string
  /** 곡 ⋯ 메뉴(간단 마스터링·스템·앨범아트·휴지통 …) — 보관함 카드와 같은 메뉴를 StudioClient 가 만들어 준다 */
  renderTrackMenu?: (item: any, buttonClass: string, iconClass: string) => React.ReactNode
  /** 메뉴 동작으로 곡이 바뀌면 올라가는 번호 — 목록을 다시 읽는다 */
  historyVersion?: number
  /** 곡 목록 행의 휴지통 아이콘 */
  onTrashTrack?: (item: any) => void
}

export function GenerateClient({ 
  user, 
  renderTrackMenu,
  historyVersion = 0,
  onTrashTrack,
  historyId,
  initialPrompt = '',
  initialStyle = '',
  initialTitle = '',
  initialNegativePrompt = ''
}: GenerateClientProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(historyId || searchParams.get('historyId'))

  const currentTrack = usePlayerStore((s) => s.currentTrack)
  const isPlaying = usePlayerStore((s) => s.isPlaying)
  const playTrack = usePlayerStore((s) => s.playTrack)
  const togglePlay = usePlayerStore((s) => s.togglePlay)

  const [historyItem, setHistoryItem] = useState<any>(null)
  const [isMusicGenerating, setIsMusicGenerating] = useState(false)
  const [activeAudio, setActiveAudio] = useState<{ url: string, image: string, is_published?: boolean } | null>(null)
  const [generatedTracks, setGeneratedTracks] = useState<any[]>([])
  const [activeTasks, setActiveTasks] = useState<any[]>([])
  const promptAreaRef = useRef<HTMLTextAreaElement>(null)
  const pollInFlight = useRef(false)
  const generationInFlight = useRef(false)
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
  const { prices: creditPrices, setBalance: setCreditBalance } = useSuiteCredits(user)
  /* 버튼에 적는 차감액은 워커 단가표에서 온다 — 숫자를 화면 코드에 박아 두면 갈라진다.
     아직 못 읽었으면 괄호를 통째로 뺀다(틀린 숫자보다 낫다). */
  const musicCost = creditPrices['music.generate']
  const costSuffix =
    typeof musicCost !== 'number'
      ? ''
      : uiLanguage === 'KO'
        ? ` (${formatPriceCredits(musicCost)} 크레딧)`
        : uiLanguage === 'JA'
          ? ` (${formatPriceCredits(musicCost)}クレジット)`
          : ` (${formatPriceCredits(musicCost)} Credits)`
  const [profile, setProfile] = useState<any>(null)
  const [detailTrackId, setDetailTrackId] = useState<string | null>(null)
  const [detailCollapsed, setDetailCollapsed] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  const [generateForm, setGenerateForm] = useState({
    modelProvider: 'suno',
    modelVersion: SUNO_DEFAULT_MODEL_VERSION,
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
      await downloadStudioTrack(url, filename, imageUrl)
    } catch (e) {
      console.error(e)
      alert(e instanceof Error ? e.message : '다운로드에 실패했습니다.')
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

  useEffect(() => {
    if (historyVersion > 0) refreshHistoryList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [historyVersion])

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
      if (pollInFlight.current) return
      pollInFlight.current = true
      try {
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
        // Preserve a newly submitted task that was not in this poll's snapshot.
        setActiveTasks(current => current.map(task => updatedTasks.find(next => next.id === task.id) || task))
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
      } finally {
        pollInFlight.current = false
      }
    }, 4000)

    return () => clearInterval(interval)
  }, [activeTasks, currentHistoryId])

  const handleGenerate = async () => {
    if (generationInFlight.current) return
    const processingCount = activeTasks.filter(t => t.status === 'processing').length
    if (processingCount >= 6) {
      alert(uiLanguage === 'KO' ? '최대 6개까지 동시에 음악을 생성할 수 있습니다.' : uiLanguage === 'JA' ? '同時に最大6曲まで生成できます。' : 'You can generate up to 6 tracks concurrently.')
      return
    }

    generationInFlight.current = true
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
        generationInFlight.current = false
        return
      }
    } catch (err) {
      console.error('Error creating history item:', err)
      alert("임시 음원 정보 생성에 실패했습니다.")
      setIsMusicGenerating(false)
      generationInFlight.current = false
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
        if (activeHistoryId && [400, 401, 402, 403, 404].includes(res.status)) {
          await fetch(`/api/song-history?id=${activeHistoryId}&rollback=1`, { method: 'DELETE' }).catch(err => console.error('Failed to rollback history item:', err))
        }
      }
    } catch (e) {
      console.error(e)
      // A lost response does not mean the provider rejected the paid request.
      // Keep the history so refresh can recover a task accepted by the server.
      setStatus('접수 결과를 확인하지 못했습니다. 보관함을 확인한 뒤 다시 시도해 주세요.')
      await refreshHistoryList()
    } finally {
      setIsMusicGenerating(false)
      generationInFlight.current = false
    }
  }

  // 행 전체 클릭·원형 버튼이 함께 쓰는 재생 동작
  const playListTrack = async (track: any) => {
    if (!track?.audio_url) return
    setDetailTrackId(track.id)
    // 접어 둔 상세 패널(좁은 레일)도 곡을 누르면 펼쳐서 그 곡을 보여 준다
    if (detailCollapsed) {
      setDetailCollapsed(false)
      try { localStorage.setItem('studio-detail-collapsed', '0') } catch { /* private mode */ }
    }
    if (currentTrack?.id === track.id) {
      togglePlay()
      return
    }
    const qOpts = {
      artistName: profile?.display_name || user?.email?.split('@')[0] || 'AI Generator',
      slug: user?.email?.split('@')[0] || 'ai-generator',
      avatarUrl: profile?.avatar_url,
    }
    const playable = (await resolveStudioAudioUrl(track.audio_url)) || track.audio_url
    const trackToPlay = historyItemToTrack(track, qOpts, playable)
    // 보이는 목록 전체를 대기열로 — 누른 곡부터 재생, 나머지는 차례가 될 때 주소를 받는다
    const visible = dayGroups.flatMap((g: any) => g.items)
    playTrack(trackToPlay, queueWithPlayable(buildHistoryQueue(visible, qOpts), trackToPlay))
  }

  const handleSelectTrack = (track: any) => {
    setCurrentHistoryId(track.id)
    const url = new URL(window.location.href)
    url.searchParams.set('historyId', track.id)
    window.history.replaceState({}, '', url.toString())
    loadFormFrom(track)
  }

  /** 곡 기록의 생성 설정을 입력칸에 채운다(생성은 하지 않는다) */
  const loadFormFrom = (track: any) => {
    if (track.form) {
      setGenerateForm(prev => ({
        ...prev,
        modelVersion: normalizeSunoModelVersion(track.form.modelVersion),
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
  const failedRows = historyList
    .filter((item: any) => item.status === 'failed' && !item.audio_url && Date.now() - new Date(item.created_at || 0).getTime() < 3 * 86_400_000)
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 8)
  const dismissFailed = async (row: any) => {
    await fetch(`/api/song-history?id=${row.id}&rollback=1`, { method: 'DELETE' }).catch(() => {})
    refreshHistoryList()
  }
  const detailTrack = detailTrackId ? historyList.find((h: any) => h.id === detailTrackId) || null : null

  const L = (ko: string, ja: string, en: string) => (uiLanguage === 'KO' ? ko : uiLanguage === 'JA' ? ja : en)
  const dayGroups = groupSongsByDay(topCompletedSongs, uiLanguage)
  const styleChips = STYLE_CHIPS.filter(
    (chip) => !generateForm.style.toLowerCase().split(',').map((s) => s.trim()).includes(chip.toLowerCase()),
  )
  const addStyleChip = (chip: string) => {
    const cur = generateForm.style.trim().replace(/,\s*$/, '')
    updateFormData('style', cur ? `${cur}, ${chip}` : chip)
  }
  const fieldClass = 'w-full bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-3 py-2 text-[13px] text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-primary/60'
  const sectionLabel = 'text-[13px] font-semibold text-zinc-200'
  const switchBtn = (on: boolean, onClick: () => void, label: string) => (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`w-9 h-5 rounded-full transition-colors motion-reduce:transition-none flex items-center px-0.5 cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 ${on ? 'bg-primary' : 'bg-zinc-800'}`}
    >
      <span className={`w-4 h-4 rounded-full bg-black transition-transform motion-reduce:transition-none ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
  const slider = (key: 'styleWeight' | 'weirdness' | 'audioWeight', label: string, hint: string) => (
    <div className="space-y-1" title={hint}>
      <div className="flex justify-between text-[12px]">
        <label htmlFor={`gen-${key}`} className="text-zinc-300">{label}</label>
        <span className="font-mono text-primary">{generateForm[key]}</span>
      </div>
      <input
        id={`gen-${key}`}
        type="range" min="0" max="1" step="0.1"
        value={generateForm[key]}
        onChange={e => updateFormData(key, parseFloat(e.target.value))}
        className="w-full accent-primary cursor-pointer"
      />
    </div>
  )

  return (
    <div className="w-full pb-10 xl:pb-0 flex items-start gap-4 xl:flex-1 xl:min-h-0 xl:h-full">
      <div className="flex-1 min-w-0 space-y-3 xl:flex xl:flex-col xl:space-y-0 xl:gap-3 xl:h-full xl:min-h-0">
      {/* 큰 배너 대신 한 줄 제목 */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h1 className="text-lg font-bold text-white">{L('음악 만들기', '音楽を作る', 'Create music')}</h1>
        <span className="text-[12px] text-primary bg-primary/10 border border-primary/30 px-2.5 py-0.5 rounded-full font-semibold truncate max-w-[60%]">{status}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] min-[1440px]:grid-cols-[380px_minmax(0,1fr)] min-[2000px]:grid-cols-[420px_minmax(0,1fr)] gap-3 items-start xl:items-stretch xl:flex-1 xl:min-h-0">
        {/* 왼쪽: 입력 패널 */}
        <div data-testid="gen-input-panel" className="cm-panel-console bg-[#111111] rounded-xl border border-[#1e1e1e] flex flex-col lg:sticky lg:top-0 lg:max-h-[calc(100vh-10rem)] xl:static xl:max-h-none xl:min-h-0">
          {/* 간단/상세 + 모델 */}
          <div className="flex items-center justify-between gap-2 p-3 border-b border-[#1e1e1e] shrink-0">
            <div role="radiogroup" aria-label={L('입력 방식', '入力方式', 'Input mode')} className="flex p-0.5 rounded-lg bg-[#0a0a0a] border border-[#1f1f1f]">
              {[
                { on: false, label: L('간단', 'シンプル', 'Simple') },
                { on: true, label: L('상세', '詳細', 'Advanced') },
              ].map((m) => (
                <button
                  key={m.label}
                  type="button"
                  role="radio"
                  aria-checked={generateForm.customMode === m.on}
                  onClick={() => updateFormData('customMode', m.on)}
                  className={`px-3 py-1 rounded-md text-[12px] font-semibold transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 ${generateForm.customMode === m.on ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <select
              aria-label={L('모델 버전', 'モデルバージョン', 'Model version')}
              value={generateForm.modelVersion}
              onChange={e => updateFormData('modelVersion', e.target.value)}
              className="bg-[#0a0a0a] border border-[#1f1f1f] rounded-lg px-2 py-1 text-[12px] font-semibold text-zinc-200 focus:outline-none focus:border-primary/60 cursor-pointer"
            >
              {SUNO_MODEL_VERSIONS.map(v => (
                <option key={v.value} value={v.value}>{v.label.replace(/^Suno\s*/, '')}</option>
              ))}
            </select>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-3 space-y-4">
            {/* 가사(간단 모드에선 곡 설명) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="gen-prompt" className={`${sectionLabel} ${generateForm.instrumentalOnly ? 'text-zinc-600' : ''}`}>
                  {generateForm.customMode ? L('가사', '歌詞', 'Lyrics') : L('곡 설명', '曲の説明', 'Song description')}
                </label>
                <span className="flex items-center gap-2 text-[12px] text-zinc-400">
                  {L('연주곡', 'インスト', 'Instrumental')}
                  {switchBtn(generateForm.instrumentalOnly, () => updateFormData('instrumentalOnly', !generateForm.instrumentalOnly), L('연주곡만 만들기', 'インストのみ', 'Instrumental only'))}
                </span>
              </div>
              <textarea
                id="gen-prompt"
                ref={promptAreaRef}
                value={generateForm.instrumentalOnly ? '' : generateForm.prompt}
                onChange={e => updateFormData('prompt', e.target.value)}
                disabled={generateForm.instrumentalOnly}
                placeholder={generateForm.instrumentalOnly
                  ? L('연주곡은 가사 없이 만들어요.', 'インストは歌詞なしで作ります。', 'Instrumental tracks have no lyrics.')
                  : generateForm.customMode
                    ? L('직접 쓴 가사를 넣거나 비워 두세요.', '歌詞を入力してください。', 'Write your own lyrics.')
                    : L('어떤 곡을 원하는지 적어 주세요. 예: 비 오는 밤 드라이브에 어울리는 시티팝', 'どんな曲が欲しいか書いてください。', 'Describe the song you want.')}
                rows={6}
                className={`w-full rounded-lg px-3 py-2 text-[13px] leading-relaxed outline-none resize-y min-h-[8rem] max-h-[40rem] custom-scrollbar transition-colors font-mono ${
                  generateForm.instrumentalOnly
                    ? 'bg-[#0a0a0a]/50 border border-[#1f1f1f] text-zinc-600 cursor-not-allowed opacity-60'
                    : 'bg-[#0a0a0a] border border-[#1f1f1f] text-zinc-200 focus:border-primary/60'
                }`}
              />
              {!generateForm.instrumentalOnly && (
                <LyricsHelper
                  uiLanguage={uiLanguage === 'KO' ? 'KO' : uiLanguage === 'JA' ? 'JA' : 'EN'}
                  value={generateForm.prompt}
                  getCursor={() => promptAreaRef.current?.selectionStart ?? generateForm.prompt.length}
                  onChange={(next, pos) => {
                    updateFormData('prompt', next)
                    if (pos !== undefined) requestAnimationFrame(() => { promptAreaRef.current?.focus(); promptAreaRef.current?.setSelectionRange(pos, pos) })
                  }}
                />
              )}
            </div>

            {generateForm.customMode && (
              <div className="space-y-1.5">
                <label htmlFor="gen-style" className={sectionLabel}>{L('스타일', 'スタイル', 'Styles')}</label>
                <textarea
                  id="gen-style"
                  value={generateForm.style}
                  onChange={e => updateFormData('style', e.target.value)}
                  placeholder="80s City Pop, Groovy Slap Bass, Bright Synth"
                  rows={2}
                  className={`${fieldClass} resize-y min-h-[3.5rem]`}
                />
                {styleChips.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {styleChips.map((chip) => (
                      <button
                        key={chip}
                        type="button"
                        onClick={() => addStyleChip(chip)}
                        className="px-2.5 py-1 rounded-full bg-[#181818] border border-[#262626] text-[12px] text-zinc-300 hover:border-primary/50 hover:text-white transition-colors motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
                      >
                        + {chip}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {generateForm.customMode && (
              <div className="space-y-1.5">
                <label htmlFor="gen-title" className={sectionLabel}>{L('곡 제목', 'タイトル', 'Title')}</label>
                <input
                  id="gen-title"
                  type="text"
                  value={generateForm.title}
                  onChange={e => updateFormData('title', e.target.value)}
                  placeholder={L('예: 네온 시티', '例: Neon City Lights', 'e.g. Neon City Lights')}
                  className={`${fieldClass} font-semibold`}
                />
              </div>
            )}

            {/* 더 많은 설정 — 접어 둔다 */}
            <div className="border-t border-[#1e1e1e] pt-3">
              <button
                type="button"
                onClick={() => setMoreOpen(v => !v)}
                aria-expanded={moreOpen}
                className="w-full flex items-center justify-between text-[13px] font-semibold text-zinc-300 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60 rounded"
              >
                {L('더 많은 설정', 'その他の設定', 'More options')}
                <ChevronDown className={`w-4 h-4 transition-transform motion-reduce:transition-none ${moreOpen ? 'rotate-180' : ''}`} />
              </button>
              {moreOpen && (
                <div className="mt-3 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-zinc-300">{L('엔진', 'エンジン', 'Engine')}</span>
                    <button
                      type="button"
                      onClick={() => updateFormData('modelProvider', 'suno')}
                      className={`px-2.5 py-1 rounded-lg text-[12px] font-semibold ${
                        (!generateForm.modelProvider || generateForm.modelProvider === 'suno')
                          ? 'bg-primary text-black border border-primary'
                          : 'bg-[#0a0a0a] text-zinc-400 border border-[#1f1f1f] hover:border-zinc-700'
                      }`}
                    >
                      Suno (v4~v5.5)
                    </button>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[12px] text-zinc-300">{L('보컬', 'ボーカル', 'Vocal')}</span>
                    <div className="flex gap-1.5">
                      {(['Male', 'Female'] as const).map((g) => (
                        <button
                          key={g}
                          type="button"
                          onClick={() => updateFormData('vocalGender', g)}
                          aria-pressed={generateForm.vocalGender === g}
                          className={`px-3 py-1 rounded-lg text-[12px] font-semibold border transition-colors motion-reduce:transition-none cursor-pointer ${generateForm.vocalGender === g ? 'bg-primary text-black border-primary' : 'bg-[#0a0a0a] text-zinc-400 border-[#1f1f1f] hover:border-zinc-700'}`}
                        >
                          {g === 'Male' ? L('남성', '男性', 'Male') : L('여성', '女性', 'Female')}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label htmlFor="gen-negative" className="text-[12px] text-zinc-300">{L('빼고 싶은 스타일', '除外するスタイル', 'Exclude styles')}</label>
                    <input
                      id="gen-negative"
                      type="text"
                      value={generateForm.negativeTags}
                      onChange={e => updateFormData('negativeTags', e.target.value)}
                      placeholder={L('시끄러운, 헤비메탈, 스크리밍...', 'ノイジー、ヘビーメタル...', 'Noisy, heavy metal, screaming...')}
                      className={fieldClass}
                    />
                  </div>

                  {slider('styleWeight', L('스타일 강도', 'スタイルウェイト', 'Style influence'), L('높을수록 스타일을 엄격하게 따릅니다.', '高いほどスタイルに厳密に従います。', 'Higher follows the style more strictly.'))}
                  {slider('weirdness', L('독창성', '奇抜さ', 'Weirdness'), L('높을수록 실험적인 곡이 나옵니다.', '高いほど実験的になります。', 'Higher is more experimental.'))}
                  {slider('audioWeight', L('오디오 영향도', 'オーディオウェイト', 'Audio influence'), L('원본 오디오가 결과에 미치는 정도입니다.', '元の音声の影響度です。', 'How much the source audio counts.'))}
                </div>
              )}
            </div>
          </div>

          {/* 만들기 버튼 — 늘 보이게 아래 고정 */}
          <div className="flex gap-2 p-3 border-t border-[#1e1e1e] shrink-0">
            <button
              type="button"
              onClick={() => setGenerateForm({
                modelProvider: 'suno',
                modelVersion: SUNO_DEFAULT_MODEL_VERSION,
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
              className="px-3 py-2 bg-[#161616] hover:bg-[#1e1e1e] border border-[#232323] rounded-lg text-[13px] font-semibold text-zinc-300 transition-colors motion-reduce:transition-none cursor-pointer"
            >
              초기화
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isMusicGenerating}
              className="flex-1 px-4 py-2 bg-primary hover:opacity-90 active:scale-[0.99] text-black rounded-lg text-[13px] font-bold transition-all motion-reduce:transition-none disabled:opacity-50 cursor-pointer"
            >
              생성하기{costSuffix}
            </button>
          </div>
        </div>

        {/* 오른쪽: 진행 중 작업 + 날짜별 곡 목록 */}
        <div data-testid="gen-song-list" className="min-w-0 cm-panel-console bg-[#111111] rounded-xl border border-[#1e1e1e] flex flex-col xl:min-h-0 xl:overflow-y-auto custom-scrollbar">
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-[#1e1e1e] shrink-0">
            <h2 className="text-[14px] font-semibold text-zinc-200">
              {L('내 곡', 'マイトラック', 'My songs')}
              {topCompletedSongs.length > 0 && <span className="ml-1.5 text-zinc-500 font-normal">{topCompletedSongs.length}</span>}
            </h2>
            {topCompletedSongs.length > 0 && (
              <span className="text-[12px] text-zinc-500 hidden sm:inline">{L('누르면 재생 · 지팡이는 설정 불러오기', 'クリックで再生 · 杖で設定をロード', 'Click to play · wand loads settings')}</span>
            )}
          </div>

          <div className="px-2 pb-3 pt-2 space-y-2 flex-1 flex flex-col">
            <GenerateQueue
              uiLanguage={uiLanguage === 'KO' ? 'KO' : uiLanguage === 'JA' ? 'JA' : 'EN'}
              tasks={activeTasks}
              failedRows={failedRows}
              onRetry={(row) => { loadFormFrom(row); setStatus(uiLanguage === 'KO' ? '실패한 작업의 설정을 불러왔습니다. 확인 후 생성을 눌러 주세요.' : 'Loaded settings of the failed job. Press generate to retry.') }}
              onDismiss={dismissFailed}
            />

            {topCompletedSongs.length > 0 ? (
              dayGroups.map((group) => (
                <section key={group.key} aria-label={group.label}>
                  <h3 className="px-2 pt-2 pb-1 text-[12px] font-semibold text-zinc-500">{group.label}</h3>
                  <div>
                    {group.items.map((track: any) => {
                      const isSelected = currentHistoryId === track.id
                      const isDetail = detailTrackId === track.id
                      const isCurrentPlaying = currentTrack?.id === track.id && isPlaying
                      const styleText = track.prompt || track.form?.style || ''
                      const versionLabel = track.form?.modelVersion
                        ? (SUNO_MODEL_VERSIONS.find(v => v.value === normalizeSunoModelVersion(track.form.modelVersion))?.label || '').replace(/^Suno\s*/, '')
                        : ''
                      const iconBtn = 'w-7 h-7 rounded-md flex items-center justify-center hover:bg-white/[0.06] transition-colors motion-reduce:transition-none cursor-pointer shrink-0 focus-visible:ring-2 focus-visible:ring-primary/60'

                      return (
                        <div
                          key={track.id}
                          role="button"
                          tabIndex={0}
                          data-testid="gen-song-row"
                          onClick={() => playListTrack(track)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault()
                              // 전역 스페이스 단축키(PersistentPlayer)와 이중 토글되어 깜박이므로 여기서 끊는다
                              e.stopPropagation()
                              if (e.repeat) return
                              playListTrack(track)
                            }
                          }}
                          className={`flex items-center gap-3 px-2 py-2.5 rounded-lg transition-colors motion-reduce:transition-none cursor-pointer select-none group/item focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${
                            isSelected || isDetail ? 'bg-white/[0.06]' : 'hover:bg-white/[0.03]'
                          }`}
                        >
                          {/* 64px 썸네일 + 길이. 재생 중이면 이퀄라이저, 올려 두면 재생 표시 */}
                          <div className="relative isolate w-16 h-16 shrink-0">
                            {currentTrack?.id === track.id && <LpDisc playing={isPlaying} label={track.image_url} out={0.2} size={0.9} />}
                            {track.image_url ? (
                              <img src={track.image_url} alt="" className="w-16 h-16 rounded-md object-cover" />
                            ) : (
                              <div className="w-16 h-16 rounded-md bg-zinc-900 flex items-center justify-center border border-zinc-800">
                                <Music className="w-6 h-6 text-zinc-700" />
                              </div>
                            )}
                            {isCurrentPlaying ? (
                              <span aria-hidden className="absolute inset-0 rounded-md bg-black/60 flex items-end justify-center gap-[2.5px] pb-4">
                                <span className="w-[3px] h-4 bg-[#a0e813] rounded-sm animate-eq-1 motion-reduce:animate-none" />
                                <span className="w-[3px] h-4 bg-[#a0e813] rounded-sm animate-eq-2 motion-reduce:animate-none" />
                                <span className="w-[3px] h-4 bg-[#a0e813] rounded-sm animate-eq-3 motion-reduce:animate-none" />
                              </span>
                            ) : (
                              <span aria-hidden className="absolute inset-0 rounded-md bg-black/50 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-opacity motion-reduce:transition-none">
                                <Play className="w-5 h-5 text-white fill-current" />
                              </span>
                            )}
                            <span className="absolute right-1 bottom-1 px-1 rounded bg-black/75 text-[11px] leading-4 font-mono text-zinc-100">
                              <AudioDuration url={track.audio_url} />
                            </span>
                          </div>

                          <div className="min-w-0 flex-1 text-left">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <p className={`text-[14px] font-semibold truncate ${isSelected ? 'text-primary' : 'text-white'}`}>{track.title}</p>
                              {versionLabel && (
                                <span className="shrink-0 px-1.5 rounded border border-zinc-700 text-[11px] leading-4 font-semibold text-zinc-400">{versionLabel}</span>
                              )}
                            </div>
                            <p className="text-[12px] text-zinc-500 truncate mt-0.5">{styleText || L('스타일 없음', 'スタイルなし', 'No style')}</p>
                            {/* 작은 아이콘 줄 — 좋아요·불러오기·공개·폴더·내려받기 */}
                            <div className="flex items-center gap-0.5 mt-1 -ml-1.5" onClick={(e) => e.stopPropagation()}>
                              <button
                                aria-label={L('좋아요', 'いいね', 'Like')}
                                aria-pressed={!!track.liked}
                                onClick={() => handleLikeToggle(track)}
                                className={iconBtn}
                                title={L('좋아요', 'いいね', 'Like')}
                              >
                                <Heart className={`w-3.5 h-3.5 ${track.liked ? 'text-primary fill-current' : 'text-zinc-500 hover:text-primary'}`} />
                              </button>
                              <button
                                onClick={() => handleSelectTrack(track)}
                                className={iconBtn}
                                aria-label={L('옵션/가사 불러오기', 'オプション/歌詞をロード', 'Load options/lyrics')}
                                title={L('옵션/가사 불러오기', 'オプション/歌詞をロード', 'Load options/lyrics')}
                              >
                                <Wand2 className={`w-3.5 h-3.5 ${isSelected ? 'text-primary' : 'text-zinc-500 hover:text-primary'}`} />
                              </button>
                              <button
                                onClick={() => handlePublishToggle(track)}
                                className={iconBtn}
                                aria-label={track.is_published ? L('비공개로 설정', '非公開にする', 'Make Private') : L('공개로 설정', '公開する', 'Make Public')}
                                title={track.is_published ? L('비공개로 설정', '非公開にする', 'Make Private') : L('공개로 설정', '公開する', 'Make Public')}
                              >
                                <Globe className={`w-3.5 h-3.5 ${track.is_published ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'}`} />
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
                              <button
                                aria-label={L('다운로드', 'ダウンロード', 'Download')}
                                onClick={() => handleDownloadTrack(track.audio_url, track.title, track.image_url)}
                                className={iconBtn}
                                title={L('다운로드', 'ダウンロード', 'Download')}
                              >
                                <Download className="w-3.5 h-3.5 text-zinc-500 hover:text-primary" />
                              </button>
                              {/* 휴지통 — 다른 아이콘과 같은 크기. 공개 곡은 비활성, 누르면 확인 창 */}
                              {onTrashTrack && (
                                <button
                                  type="button"
                                  onClick={() => onTrashTrack(track)}
                                  disabled={!!track.is_published}
                                  aria-label={L('휴지통으로 이동', 'ゴミ箱へ移動', 'Move to trash')}
                                  title={track.is_published
                                    ? L('쿠키뮤직에 공개된 곡은 휴지통으로 보낼 수 없습니다', '公開中の曲はゴミ箱へ移動できません', 'Published tracks cannot be moved to trash')
                                    : L('휴지통으로 이동', 'ゴミ箱へ移動', 'Move to trash')}
                                  className={`${iconBtn} disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent`}
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-zinc-500 hover:text-red-400" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* 오른쪽 끝: 재생 · ⋯ */}
                          <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                            <button
                              aria-label={isCurrentPlaying ? L('일시정지', '一時停止', 'Pause') : L('재생', '再生', 'Play')}
                              onClick={() => playListTrack(track)}
                              className="h-8 w-8 rounded-full bg-primary text-black flex items-center justify-center shrink-0 hover:opacity-90 active:scale-95 transition-all motion-reduce:transition-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/60"
                            >
                              {isCurrentPlaying ? <Pause className="w-3.5 h-3.5 fill-current" /> : <Play className="w-3.5 h-3.5 fill-current ml-0.5" />}
                            </button>
                            {renderTrackMenu?.(track, 'w-8 h-8 rounded-full hover:bg-white/[0.06] flex items-center justify-center shrink-0 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60', 'w-4 h-4')}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </section>
              ))
            ) : (
              !isMusicGenerating && activeTasks.length === 0 && (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center gap-3 min-h-[280px]">
                  <Music className="w-8 h-8 text-zinc-600" />
                  <p className="text-[13px] text-zinc-400 max-w-xs leading-relaxed">
                    {L('왼쪽에 가사나 곡 설명을 넣고 만들면 여기에 곡이 쌓여요.', '左に歌詞や説明を入れて作成すると、ここに曲が並びます。', 'Fill in the left panel and create — your songs show up here.')}
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    disabled={isMusicGenerating}
                    className="px-5 py-2 bg-primary hover:opacity-90 active:scale-[0.99] text-black rounded-lg text-[13px] font-bold transition-all motion-reduce:transition-none cursor-pointer flex items-center gap-2"
                  >
                    <Disc className="w-4 h-4" />
                    {L('음악 만들기', '音楽を作る', 'Create music')}{costSuffix}
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
