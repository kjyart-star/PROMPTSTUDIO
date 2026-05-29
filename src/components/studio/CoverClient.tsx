'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Disc, Upload, Play, Pause, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlayerStore } from '@/stores/playerStore'

interface CoverClientProps {
  user: any
}

export function CoverClient({ user }: CoverClientProps) {
  const router = useRouter()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { currentTrack, isPlaying, playTrack, togglePlay } = usePlayerStore()

  const [isMusicGenerating, setIsMusicGenerating] = useState(false)
  const [pollingTaskId, setPollingTaskId] = useState<string | null>(null)
  const [activeAudioList, setActiveAudioList] = useState<any[]>([])
  const [status, setStatus] = useState('대기 중')
  const [userCredits, setUserCredits] = useState<number>(120)
  const [uiLanguage, setUiLanguage] = useState<string>('KO')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedLang = localStorage.getItem('ui-language')
      if (storedLang) {
        setUiLanguage(storedLang.toUpperCase())
      }
      const savedCredits = localStorage.getItem('user-credits')
      if (savedCredits !== null) {
        setUserCredits(parseFloat(savedCredits))
      } else {
        localStorage.setItem('user-credits', '120')
        setUserCredits(120)
      }
    }
  }, [])

  const handlePlaySourceAudio = () => {
    if (!uploadedFileUrl) return
    const trackId = 'source-audio'
    const trackToPlay = {
      id: trackId,
      title: 'Source Audio Preview',
      file_url: uploadedFileUrl,
      duration_sec: 180,
      album_id: 'source-audio-album',
      album: {
        id: 'source-audio-album',
        title: 'Uploaded Audio Source',
        cover_url: '/default-album.png',
        artist: {
          name: 'Source Audio',
          slug: 'source-audio'
        }
      }
    }
    if (currentTrack?.id === trackId) {
      togglePlay()
    } else {
      playTrack(trackToPlay as any, [trackToPlay] as any[])
    }
  }

  const handlePlayCoverAudio = (audio: any, idx: number) => {
    if (!audio.audio_url) return
    const trackId = `cover-audio-${idx}`
    const trackToPlay = {
      id: trackId,
      title: audio.title || `Cover Track #${idx + 1}`,
      file_url: audio.audio_url,
      duration_sec: 180,
      album_id: 'cover-audio-album',
      album: {
        id: 'cover-audio-album',
        title: 'Cover Generation',
        cover_url: audio.image_url || '/default-album.png',
        artist: {
          name: 'AI Cover',
          slug: 'ai-cover'
        }
      }
    }
    if (currentTrack?.id === trackId) {
      togglePlay()
    } else {
      playTrack(trackToPlay as any, [trackToPlay] as any[])
    }
  }
  
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedFileUrl, setUploadedFileUrl] = useState<string | null>(null)

  const [generateForm, setGenerateForm] = useState({
    modelVersion: 'V5',
    customMode: false,
    instrumental: false,
    prompt: '',
    style: '',
    title: '',
    vocalGender: 'f',
    negativeTags: '',
    styleWeight: 0.5,
    weirdness: 0.3,
    audioWeight: 0.5,
    continueAt: 0
  })

  // Polling logic
  useEffect(() => {
    if (!pollingTaskId) return

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/suno/cover/status?taskId=${pollingTaskId}`)
        if (res.ok) {
          const data = await res.json()
          if (data.status === 'completed') {
            clearInterval(interval)
            setPollingTaskId(null)
            setIsMusicGenerating(false)
            setActiveAudioList(data.results || [])
            setStatus("커버 곡 생성이 완료되었습니다!")
          } else if (data.status === 'failed') {
            clearInterval(interval)
            setPollingTaskId(null)
            setIsMusicGenerating(false)
            alert(`커버 곡 생성 실패: ${data.message || '알 수 없는 오류'}`)
            setStatus("생성 실패")
          }
        }
      } catch (e) {
        console.error(e)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pollingTaskId])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      alert("파일 크기는 50MB 이하여야 합니다.")
      return
    }

    setIsUploading(true)
    setStatus('오디오 업로드 중...')
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const filePath = `${user.id}/${fileName}`

      const { error: uploadError } = await supabase.storage
        .from('audio_uploads')
        .upload(filePath, file)

      if (uploadError) {
        throw uploadError
      }

      const { data: { publicUrl } } = supabase.storage
        .from('audio_uploads')
        .getPublicUrl(filePath)

      setUploadedFileUrl(publicUrl)
      setStatus('오디오 업로드 완료')
    } catch (err) {
      console.error(err)
      alert("업로드 실패. Supabase 'audio_uploads' 버킷이 존재하는지 확인하세요.")
      setStatus('업로드 실패')
    } finally {
      setIsUploading(false)
    }
  }

  const handleGenerate = async () => {
    if (!uploadedFileUrl) {
      alert("원본 오디오 파일을 먼저 업로드해주세요.")
      return
    }

    // Check credits (10 credits)
    const savedCredits = localStorage.getItem('user-credits')
    const currentCredits = savedCredits !== null ? parseFloat(savedCredits) : 120
    if (currentCredits < 10) {
      alert(uiLanguage === 'KO' ? '크레딧이 부족합니다. (필요: 10 크레딧)' : 'Insufficient credits. (Requires 10 credits)')
      return
    }
    
    setIsMusicGenerating(true)
    setStatus('Apipass 서버로 커버 생성 요청을 전송했습니다.')
    
    try {
      const res = await fetch('/api/suno/cover/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          audioUrl: uploadedFileUrl,
          ...generateForm 
        })
      })
      
      const data = await res.json()
      
      if (res.ok && data.taskId) {
        setPollingTaskId(data.taskId)

        // Deduct credits and save transaction!
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
          desc: uiLanguage === 'KO' ? 'AI 커버 생성 (-10)' : 'AI Cover Generation (-10)',
          amount: '-10',
          status: 'Completed'
        }
        localStorage.setItem('user-transactions', JSON.stringify([newTx, ...txList]))
      } else {
        alert(`요청 실패: ${data.error || '알 수 없는 오류'}`)
        setIsMusicGenerating(false)
        setStatus('요청 실패')
      }
    } catch (e) {
      console.error(e)
      setIsMusicGenerating(false)
      setStatus('오류 발생')
    }
  }

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 pt-6 md:pt-8">
      <h1 className="text-2xl font-bold text-on-background mb-8 flex items-center gap-3">
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg>
        AI 커버 스튜디오
      </h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column: Input Data */}
        <div className="space-y-6 bg-surface p-6 rounded-2xl border border-outline-variant/10 shadow-lg custom-scrollbar max-h-[80vh] overflow-y-auto">
          
          <div className="space-y-4">
            {/* Audio Upload */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface">원본 오디오 (Source Audio)</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploadedFileUrl ? 'border-primary bg-primary/5' : 'border-outline-variant/30 hover:border-primary/50 hover:bg-surface-container-high'}`}
              >
                <input 
                  type="file" 
                  accept="audio/*" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                {isUploading ? (
                  <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                ) : uploadedFileUrl ? (
                  <>
                    <Music className="w-8 h-8 text-primary mb-2" />
                    <p className="text-sm font-bold text-primary">오디오 준비 완료</p>
                     <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySourceAudio();
                      }}
                      className="mt-4 px-4 py-2 bg-[#141415] border border-outline-variant/20 hover:border-primary/50 text-on-surface hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow"
                     >
                       {isPlaying && currentTrack?.id === 'source-audio' ? (
                         <>
                           <Pause className="w-3.5 h-3.5 fill-current text-primary" />
                           <span>재생 일시정지 (하단 플레이어)</span>
                         </>
                       ) : (
                         <>
                           <Play className="w-3.5 h-3.5 fill-current text-primary" />
                           <span>하단 플레이어에서 들어보기</span>
                         </>
                       )}
                     </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-on-surface-variant mb-2" />
                    <p className="text-sm font-bold text-on-surface">클릭하여 파일 업로드</p>
                    <p className="text-[10px] text-on-surface-variant mt-1">MP3, WAV 등 (최대 50MB)</p>
                  </>
                )}
              </div>
            </div>

            {/* Model Version */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-on-surface">모델 버전 (Model Version)</label>
              <select 
                value={generateForm.modelVersion} 
                onChange={e => setGenerateForm(prev => ({ ...prev, modelVersion: e.target.value }))}
                className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2 text-xs text-on-surface outline-none"
              >
                <option value="V5">Suno V5</option>
                <option value="V4_5PLUS">V4.5 Plus</option>
                <option value="V4_5ALL">V4.5 All</option>
                <option value="V4">Suno V4</option>
              </select>
            </div>

            {/* Custom Mode & Instrumental */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant/10">
                <label className="text-xs font-bold text-on-surface">커스텀 모드</label>
                <button 
                  onClick={() => setGenerateForm(prev => ({ ...prev, customMode: !prev.customMode }))}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${generateForm.customMode ? 'bg-primary' : 'bg-surface-container-high'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${generateForm.customMode ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex justify-between items-center bg-surface-container-low p-3 rounded-lg border border-outline-variant/10">
                <label className="text-xs font-bold text-on-surface">연주곡만 생성</label>
                <button 
                  onClick={() => setGenerateForm(prev => ({ ...prev, instrumental: !prev.instrumental }))}
                  className={`w-10 h-5 rounded-full transition-colors flex items-center px-1 ${generateForm.instrumental ? 'bg-primary' : 'bg-surface-container-high'}`}
                >
                  <div className={`w-3.5 h-3.5 rounded-full bg-black transition-transform ${generateForm.instrumental ? 'translate-x-4' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Prompt */}
            {!generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-on-surface">대상 스타일 프롬프트 (Target Style Prompt)</label>
                <textarea 
                  value={generateForm.prompt}
                  onChange={e => setGenerateForm(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder="장르나 분위기 입력 (예: 피아노와 색소폰이 어우러진 부드러운 재즈로 변환)"
                  rows={3}
                  className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-3 text-xs text-on-surface outline-none resize-none custom-scrollbar"
                />
              </div>
            )}

            {/* Title & Style (Custom Mode) */}
            {generateForm.customMode && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface">스타일 (Style)</label>
                  <input 
                    type="text"
                    value={generateForm.style}
                    onChange={e => setGenerateForm(prev => ({ ...prev, style: e.target.value }))}
                    placeholder="예: 재즈, 스무스, 라운지"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface outline-none"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-on-surface">곡 제목 (Title)</label>
                  <input 
                    type="text"
                    value={generateForm.title}
                    onChange={e => setGenerateForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 나의 첫 커버곡 (재즈 버전)"
                    className="w-full bg-surface-container-low border border-outline-variant/20 rounded-lg p-2.5 text-xs text-on-surface outline-none"
                  />
                </div>
              </>
            )}

            {/* Vocal Gender */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-on-surface">보컬 성별 (Vocal Gender)</label>
              <div className="flex gap-2">
                <button 
                  onClick={() => setGenerateForm(prev => ({ ...prev, vocalGender: 'm' }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${generateForm.vocalGender === 'm' ? 'bg-primary text-[#080d08] border-primary' : 'bg-transparent text-on-surface border-outline-variant/30 hover:border-outline-variant'}`}
                >
                  남성 보컬
                </button>
                <button 
                  onClick={() => setGenerateForm(prev => ({ ...prev, vocalGender: 'f' }))}
                  className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${generateForm.vocalGender === 'f' ? 'bg-primary text-[#080d08] border-primary' : 'bg-transparent text-on-surface border-outline-variant/30 hover:border-outline-variant'}`}
                >
                  여성 보컬
                </button>
              </div>
            </div>

            {/* Sliders */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-on-surface">스타일 강도 (Style Weight)</label>
                  <span className="font-bold">{generateForm.styleWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.styleWeight} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, styleWeight: parseFloat(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <label className="font-bold text-on-surface">오디오 보존율 (Audio Weight)</label>
                  <span className="font-bold">{generateForm.audioWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.audioWeight} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, audioWeight: parseFloat(e.target.value) }))}
                  className="w-full accent-primary"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end pt-4 border-t border-outline-variant/10">
              <button 
                onClick={handleGenerate}
                disabled={isMusicGenerating || !uploadedFileUrl}
                className="w-full py-3 bg-primary hover:bg-[#e3fe06] text-[#080d08] rounded-xl text-sm font-extrabold transition-colors disabled:opacity-50"
              >
                {uiLanguage === 'KO' ? '커버 음악 생성하기 (API 실행) (10 크레딧)' : 'Generate Cover Music (API) (10 Credits)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Generation & Output */}
        <div className="space-y-6 bg-surface-container p-6 rounded-2xl border border-primary/20 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50"></div>
          
          <h2 className="text-sm font-bold text-on-surface border-b border-outline-variant/10 pb-3 flex justify-between items-center">
            진행 상태
            <span className="text-xs text-primary bg-primary/10 px-2 py-1 rounded">{status}</span>
          </h2>

          <div className="flex flex-col h-full justify-center space-y-6 min-h-[300px]">
            {activeAudioList.length > 0 ? (
               <div className="flex flex-col gap-4">
                 <p className="text-sm font-bold text-on-surface text-center mb-2">🎵 커버 2곡이 생성되었습니다!</p>
                  {activeAudioList.map((audio: any, idx: number) => (
                     <div key={idx} className="flex items-center justify-between gap-4 p-4 bg-surface-container-low rounded-xl border border-outline-variant/20 w-full">
                       <div className="flex items-center gap-4">
                         {audio.image_url ? (
                           <img src={audio.image_url} alt="Cover" className="w-16 h-16 rounded-lg object-cover" />
                         ) : (
                           <div className="w-16 h-16 bg-[#18181b] rounded-lg flex items-center justify-center border border-outline-variant/10 text-on-surface-variant">
                             <Music className="w-6 h-6 text-on-surface-variant" />
                           </div>
                         )}
                         <div className="flex flex-col">
                           <span className="text-sm font-bold text-on-surface">
                             {audio.title || `Cover Track #${idx + 1}`}
                           </span>
                           <span className="text-xs text-on-surface-variant">AI Cover Track</span>
                         </div>
                       </div>

                       <button
                         onClick={() => handlePlayCoverAudio(audio, idx)}
                         className="px-4 py-2 bg-[#141415] border border-outline-variant/20 hover:border-primary/50 text-on-surface hover:text-white text-xs font-bold rounded-lg transition-all flex items-center gap-2 cursor-pointer shadow"
                       >
                         {isPlaying && currentTrack?.id === `cover-audio-${idx}` ? (
                           <>
                             <Pause className="w-3.5 h-3.5 fill-current text-primary" />
                             <span>일시정지</span>
                           </>
                         ) : (
                           <>
                             <Play className="w-3.5 h-3.5 fill-current text-primary" />
                             <span>재생</span>
                           </>
                         )}
                       </button>
                     </div>
                  ))}
                 
                 <button 
                   onClick={() => router.push('/profile')}
                   className="mt-4 w-full py-3 bg-surface-container-highest hover:bg-white/10 text-on-surface font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2"
                 >
                   <User className="w-4 h-4" />
                   프로필 보관함 확인
                 </button>
               </div>
            ) : isMusicGenerating ? (
              <div className="flex flex-col items-center justify-center p-8 bg-surface-container-lowest rounded-xl border border-primary/20 h-full">
                 <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4"></div>
                 <p className="text-sm text-primary font-bold">Apipass에서 커버를 생성 중입니다...</p>
                 <p className="text-xs text-on-surface-variant mt-2 text-center">API 연동으로 실제 1~2분이 소요될 수 있습니다.</p>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full space-y-4">
                 <div className="w-16 h-16 bg-surface-container-high rounded-full flex items-center justify-center mb-2">
                   <Disc className="w-8 h-8 text-on-surface-variant" />
                 </div>
                 <p className="text-sm text-on-surface text-center">오디오를 업로드하고 설정을 마친 뒤,<br/>생성 버튼을 눌러주세요.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
