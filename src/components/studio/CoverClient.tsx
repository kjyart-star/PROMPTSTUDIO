'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Music, Disc, Upload, Play, Pause, User } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { usePlayerStore } from '@/stores/playerStore'
import { withBase } from '@/lib/basePath'

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
        cover_url: withBase('/default-album.png'),
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
        cover_url: audio.image_url || withBase('/default-album.png'),
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
            setStatus(uiLanguage === 'KO' ? "커버 곡 생성이 완료되었습니다!" : uiLanguage === 'JA' ? "カバー生成完了！" : "Cover generation complete!")
          } else if (data.status === 'failed') {
            clearInterval(interval)
            setPollingTaskId(null)
            setIsMusicGenerating(false)
            alert(`커버 곡 생성 실패: ${data.message || '알 수 없는 오류'}`)
            setStatus(uiLanguage === 'KO' ? "생성 실패" : uiLanguage === 'JA' ? "生成に失敗しました" : "Generation failed")
          }
        }
      } catch (e) {
        console.error(e)
      }
    }, 5000)

    return () => clearInterval(interval)
  }, [pollingTaskId, uiLanguage])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 50 * 1024 * 1024) {
      alert("파일 크기는 50MB 이하여야 합니다.")
      return
    }

    setIsUploading(true)
    setStatus(uiLanguage === 'KO' ? '오디오 업로드 중...' : uiLanguage === 'JA' ? '音声をアップロード中...' : 'Uploading audio...')
    
    try {
      const fileExt = file.name.split('.').pop()
      const fileName = `${Math.random()}.${fileExt}`
      const userId = user?.id || 'guest'
      const filePath = `${userId}/${fileName}`

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
      setStatus(uiLanguage === 'KO' ? '오디오 업로드 완료' : uiLanguage === 'JA' ? 'アップロード完了' : 'Upload complete')
    } catch (err) {
      console.error(err)
      alert("업로드 실패. Supabase 'audio_uploads' 버킷이 존재하는지 확인하세요.")
      setStatus(uiLanguage === 'KO' ? '업로드 실패' : uiLanguage === 'JA' ? 'アップロード失敗' : 'Upload failed')
    } finally {
      setIsUploading(false)
    }
  }

  const handleGenerate = async () => {
    if (!uploadedFileUrl) {
      alert(uiLanguage === 'KO' ? "원본 오디오 파일을 먼저 업로드해주세요." : uiLanguage === 'JA' ? "先にソース音声ファイルをアップロードしてください。" : "Please upload a source audio file first.")
      return
    }

    // Check credits (10 credits)
    const savedCredits = localStorage.getItem('user-credits')
    const currentCredits = savedCredits !== null ? parseFloat(savedCredits) : 120
    if (currentCredits < 10) {
      alert(uiLanguage === 'KO' ? '크레딧이 부족합니다. (필요: 10 크레딧)' : uiLanguage === 'JA' ? 'クレジットが不足しています。(10クレジット必要)' : 'Insufficient credits. (Requires 10 credits)')
      return
    }
    
    setIsMusicGenerating(true)
    setStatus(uiLanguage === 'KO' ? 'Apipass 서버로 커버 생성 요청을 전송했습니다.' : uiLanguage === 'JA' ? 'Apipassにカバー生成リクエストを送信しました。' : 'Sent cover generation request to Apipass.')
    
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
          desc: uiLanguage === 'KO' ? 'AI 커버 생성 (-10)' : uiLanguage === 'JA' ? 'AIカバー生成 (-10)' : 'AI Cover Generation (-10)',
          amount: '-10',
          status: 'Completed'
        }
        localStorage.setItem('user-transactions', JSON.stringify([newTx, ...txList]))
      } else {
        alert(`요청 실패: ${data.error || '알 수 없는 오류'}`)
        setIsMusicGenerating(false)
        setStatus(uiLanguage === 'KO' ? '요청 실패' : uiLanguage === 'JA' ? 'リクエスト失敗' : 'Request failed')
      }
    } catch (e) {
      console.error(e)
      setIsMusicGenerating(false)
      setStatus(uiLanguage === 'KO' ? '오류 발생' : uiLanguage === 'JA' ? 'エラーが発生しました' : 'Error occurred')
    }
  }

  return (
    <div className="w-full pb-10 space-y-6">
      <h1 className="text-xl sm:text-2xl font-black text-zinc-100 flex items-center gap-2.5 uppercase tracking-wide">
        <Music className="w-6 h-6 text-[#e6ff00] shrink-0" />
        {uiLanguage === 'KO' ? 'AI 커버 스튜디오' : uiLanguage === 'JA' ? 'AIカバースタジオ' : 'AI Cover Studio'}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Data (6칸) */}
        <div className="lg:col-span-6 space-y-5 bg-[#121612] p-6 rounded-2xl border border-[#1e261f] shadow-xl">
          <div className="space-y-4">
            {/* Audio Upload */}
            <div className="space-y-2 relative">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '원본 오디오 (Source Audio)' : uiLanguage === 'JA' ? 'ソース音声' : 'Source Audio'}</label>
              <div 
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer transition-colors ${uploadedFileUrl ? 'border-[#e6ff00] bg-[#e6ff00]/5' : 'border-[#1e261f] hover:border-[#e6ff00]/50 hover:bg-[#090d0a]'}`}
              >
                <input 
                  type="file" 
                  accept="audio/*" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
                {isUploading ? (
                  <div className="w-8 h-8 border-4 border-[#e6ff00] border-t-transparent rounded-full animate-spin"></div>
                ) : uploadedFileUrl ? (
                  <>
                    <Music className="w-8 h-8 text-[#e6ff00] mb-2" />
                    <p className="text-sm font-bold text-[#e6ff00]">오디오 준비 완료</p>
                     <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlaySourceAudio();
                      }}
                      className="mt-4 px-4 py-2 bg-[#090d0a] border border-[#1a231b] hover:border-[#e6ff00]/50 text-zinc-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow"
                     >
                       {isPlaying && currentTrack?.id === 'source-audio' ? (
                         <>
                           <Pause className="w-3.5 h-3.5 fill-current text-[#e6ff00]" />
                           <span>{uiLanguage === 'KO' ? '재생 일시정지' : uiLanguage === 'JA' ? '一時停止' : 'Pause'}</span>
                         </>
                       ) : (
                         <>
                           <Play className="w-3.5 h-3.5 fill-current text-[#e6ff00]" />
                           <span>{uiLanguage === 'KO' ? '미리듣기' : uiLanguage === 'JA' ? 'プレビュー' : 'Preview'}</span>
                         </>
                       )}
                     </button>
                  </>
                ) : (
                  <>
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <h3 className="text-xs font-bold text-zinc-200 mb-1">{uiLanguage === 'KO' ? '클릭하여 파일 업로드' : uiLanguage === 'JA' ? 'クリックしてアップロード' : 'Click to Upload'}</h3>
                    <p className="text-[10px] text-zinc-500">MP3, WAV {uiLanguage === 'KO' ? '등 (최대 50MB)' : uiLanguage === 'JA' ? 'など (最大50MB)' : 'etc. (Max 50MB)'}</p>
                  </>
                )}
              </div>
            </div>

            {/* Model Version */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '모델 버전 (Model Version)' : uiLanguage === 'JA' ? 'モデルバージョン' : 'Model Version'}</label>
              <select 
                value={generateForm.modelVersion} 
                onChange={e => setGenerateForm(prev => ({ ...prev, modelVersion: e.target.value }))}
                className="w-full bg-[#090d0a] border border-[#1a231b] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-[#e6ff00]/60"
              >
                <option value="V5">Suno V5</option>
                <option value="V4_5PLUS">V4.5 Plus</option>
                <option value="V4_5ALL">V4.5 All</option>
                <option value="V4">Suno V4</option>
              </select>
            </div>

            {/* Custom Mode & Instrumental */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090d0a] border border-[#1a231b]">
                <label className="text-xs font-bold text-zinc-200">{uiLanguage === 'KO' ? '커스텀 모드' : uiLanguage === 'JA' ? 'カスタムモード' : 'Custom Mode'}</label>
                <button 
                  type="button"
                  onClick={() => setGenerateForm(prev => ({ ...prev, customMode: !prev.customMode }))}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${generateForm.customMode ? 'bg-[#e6ff00]' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${generateForm.customMode ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-[#090d0a] border border-[#1a231b]">
                <label className="text-xs font-bold text-zinc-200">{uiLanguage === 'KO' ? '연주곡만 생성' : uiLanguage === 'JA' ? 'インストゥルメンタルのみ' : 'Instrumental Only'}</label>
                <button 
                  type="button"
                  onClick={() => setGenerateForm(prev => ({ ...prev, instrumental: !prev.instrumental }))}
                  className={`w-11 h-6 rounded-full transition-colors flex items-center px-1 cursor-pointer ${generateForm.instrumental ? 'bg-[#e6ff00]' : 'bg-zinc-800'}`}
                >
                  <div className={`w-4 h-4 rounded-full bg-black transition-transform ${generateForm.instrumental ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            {/* Prompt */}
            {!generateForm.customMode && (
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '대상 스타일 프롬프트 (Target Style Prompt)' : uiLanguage === 'JA' ? 'ターゲットスタイルプロンプト' : 'Target Style Prompt'}</label>
                <textarea 
                  value={generateForm.prompt}
                  onChange={e => setGenerateForm(prev => ({ ...prev, prompt: e.target.value }))}
                  placeholder={uiLanguage === 'KO' ? "장르나 분위기 입력 (예: 피아노와 색소폰이 어우러진 부드러운 재즈로 변환)" : uiLanguage === 'JA' ? "ジャンルやムードを入力（例：ピアノとサックスのソフトジャズ）" : "Enter genre or mood (e.g., Soft jazz with piano and saxophone)"}
                  rows={3}
                  className="w-full h-24 bg-[#090d0a] border border-[#1a231b] rounded-xl p-3 text-xs text-zinc-200 resize-none focus:outline-none focus:border-[#e6ff00]/60 transition-colors custom-scrollbar"
                />
              </div>
            )}

            {/* Title & Style (Custom Mode) */}
            {generateForm.customMode && (
              <>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '스타일 (Style)' : uiLanguage === 'JA' ? 'スタイル' : 'Style'}</label>
                  <input 
                    type="text"
                    value={generateForm.style}
                    onChange={e => setGenerateForm(prev => ({ ...prev, style: e.target.value }))}
                    placeholder="예: 재즈, 스무스, 라운지"
                    className="w-full bg-[#090d0a] border border-[#1a231b] rounded-xl p-2.5 text-xs text-zinc-200 focus:outline-none focus:border-[#e6ff00]/60"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '곡 제목 (Title)' : uiLanguage === 'JA' ? 'タイトル' : 'Title'}</label>
                  <input 
                    type="text"
                    value={generateForm.title}
                    onChange={e => setGenerateForm(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="예: 나의 첫 커버곡 (재즈 버전)"
                    className="w-full bg-[#090d0a] border border-[#1a231b] rounded-xl p-2.5 text-xs text-zinc-200 font-bold focus:outline-none focus:border-[#e6ff00]/60"
                  />
                </div>
              </>
            )}

            {/* Vocal Gender */}
            {!generateForm.instrumental && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-zinc-300">{uiLanguage === 'KO' ? '보컬 성별 (Vocal Gender)' : uiLanguage === 'JA' ? 'ボーカルの性別' : 'Vocal Gender'}</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setGenerateForm(prev => ({ ...prev, vocalGender: 'm' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${generateForm.vocalGender === 'm' ? 'bg-[#e6ff00] text-black border-[#e6ff00]' : 'bg-[#090d0a] text-zinc-400 border-[#1a231b] hover:border-zinc-700'}`}
                  >
                    {uiLanguage === 'KO' ? '남성 보컬' : uiLanguage === 'JA' ? '男性' : 'Male'}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setGenerateForm(prev => ({ ...prev, vocalGender: 'f' }))}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-colors ${generateForm.vocalGender === 'f' ? 'bg-[#e6ff00] text-black border-[#e6ff00]' : 'bg-[#090d0a] text-zinc-400 border-[#1a231b] hover:border-zinc-700'}`}
                  >
                    {uiLanguage === 'KO' ? '여성 보컬' : uiLanguage === 'JA' ? '女性' : 'Female'}
                  </button>
                </div>
              </div>
            )}

            {/* Sliders */}
            <div className="space-y-4 pt-2">
              <div className="space-y-1.5 bg-[#090d0a] p-3 rounded-xl border border-[#1a231b]">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-zinc-300">{uiLanguage === 'KO' ? '스타일 강도 (Style Weight)' : uiLanguage === 'JA' ? 'スタイルウェイト' : 'Style Weight'}</label>
                  <span className="font-mono font-bold text-[#e6ff00]">{generateForm.styleWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.styleWeight} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, styleWeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#e6ff00] cursor-pointer"
                />
              </div>

              <div className="space-y-1.5 bg-[#090d0a] p-3 rounded-xl border border-[#1a231b]">
                <div className="flex justify-between items-center text-xs">
                  <label className="font-bold text-zinc-300">{uiLanguage === 'KO' ? '오디오 보존율 (Audio Weight)' : uiLanguage === 'JA' ? 'オーディオウェイト' : 'Audio Weight'}</label>
                  <span className="font-mono font-bold text-[#e6ff00]">{generateForm.audioWeight}</span>
                </div>
                <input 
                  type="range" min="0" max="1" step="0.1" 
                  value={generateForm.audioWeight} 
                  onChange={e => setGenerateForm(prev => ({ ...prev, audioWeight: parseFloat(e.target.value) }))}
                  className="w-full accent-[#e6ff00] cursor-pointer"
                />
              </div>
            </div>

            {/* Action Button */}
            <div className="flex justify-end pt-4 border-t border-[#1e261f]">
              <button 
                type="button"
                onClick={handleGenerate}
                disabled={isMusicGenerating || !uploadedFileUrl}
                className="w-full py-3 bg-[#e6ff00] hover:bg-[#d4f900] active:scale-[0.99] text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all disabled:opacity-50 shadow-md shadow-yellow-950/40 cursor-pointer"
              >
                {uiLanguage === 'KO' ? '커버 음악 생성하기 (10 크레딧)' : uiLanguage === 'JA' ? 'カバー音楽を生成 (10クレジット)' : 'Generate Cover Music (10 Credits)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Generation & Output (6칸) */}
        <div className="lg:col-span-6 space-y-6 bg-[#121612] p-6 rounded-2xl border border-[#1e261f] shadow-xl relative flex flex-col justify-between">
          <div className="space-y-6 flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-zinc-200 border-b border-[#1e261f] pb-3 flex justify-between items-center shrink-0">
              <span>{uiLanguage === 'KO' ? '진행 상태' : uiLanguage === 'JA' ? 'ステータス' : 'Status'}</span>
              <span className="text-xs text-[#e6ff00] bg-[#e6ff00]/10 border border-[#e6ff00]/30 px-2.5 py-0.5 rounded-full font-bold">{status}</span>
            </h2>

            <div className="flex flex-col h-full justify-center space-y-6 min-h-[300px] flex-1">
              {activeAudioList.length > 0 ? (
                <div className="flex flex-col gap-4">
                  <p className="text-sm font-bold text-zinc-200 text-center mb-2">🎵 {uiLanguage === 'KO' ? '커버 곡이 생성되었습니다!' : uiLanguage === 'JA' ? 'カバーが生成されました！' : 'Covers generated!'}</p>
                  {activeAudioList.map((audio: any, idx: number) => (
                    <div key={idx} className="flex items-center justify-between gap-4 p-4 bg-[#090d0a] rounded-xl border border-[#1a231b] w-full">
                      <div className="flex items-center gap-4">
                        {audio.image_url ? (
                          <img src={audio.image_url} alt="Cover" className="w-16 h-16 rounded-lg object-cover" />
                        ) : (
                          <div className="w-16 h-16 bg-[#161c16] rounded-lg flex items-center justify-center border border-[#232d24] text-zinc-500">
                            <Music className="w-6 h-6 text-zinc-500" />
                          </div>
                        )}
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-zinc-100">
                            {audio.title || `Cover Track #${idx + 1}`}
                          </span>
                          <span className="text-xs text-zinc-500">AI Cover Track</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handlePlayCoverAudio(audio, idx)}
                        className="px-4 py-2 bg-[#161c16] border border-[#232d24] hover:border-[#e6ff00]/50 text-zinc-200 hover:text-white text-xs font-bold rounded-xl transition-all flex items-center gap-2 cursor-pointer shadow"
                      >
                        {isPlaying && currentTrack?.id === `cover-audio-${idx}` ? (
                          <>
                            <Pause className="w-3.5 h-3.5 fill-current text-[#e6ff00]" />
                            <span>{uiLanguage === 'KO' ? '일시정지' : uiLanguage === 'JA' ? '一時停止' : 'Pause'}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-3.5 h-3.5 fill-current text-[#e6ff00]" />
                            <span>{uiLanguage === 'KO' ? '재생' : uiLanguage === 'JA' ? '再生' : 'Play'}</span>
                          </>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              ) : isMusicGenerating ? (
                <div className="flex flex-col items-center justify-center p-8 bg-[#090d0a] rounded-xl border border-[#1a231b] h-full">
                  <div className="w-12 h-12 border-4 border-[#e6ff00] border-t-transparent rounded-full animate-spin mb-4"></div>
                  <p className="text-sm text-[#e6ff00] font-bold">{uiLanguage === 'KO' ? '커버 음원을 생성 중입니다...' : uiLanguage === 'JA' ? 'カバーを生成中...' : 'Generating covers...'}</p>
                  <p className="text-xs text-zinc-500 mt-2 text-center">{uiLanguage === 'KO' ? '실제 1~2분이 소요될 수 있습니다.' : uiLanguage === 'JA' ? '1〜2分かかる場合があります。' : 'May take 1-2 minutes.'}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-70 relative z-10 py-12">
                  <div className="w-16 h-16 rounded-full bg-[#090d0a] border border-[#1a231b] flex items-center justify-center mb-2 shadow-lg">
                    <Disc className="w-6 h-6 text-zinc-500" />
                  </div>
                  <p className="text-sm text-zinc-400 text-center leading-relaxed">
                    {uiLanguage === 'KO' ? (
                      <>오디오를 업로드하고 설정을 마친 뒤,<br/>생성 버튼을 눌러주세요.</>
                    ) : (
                      <>Upload audio and finish settings,<br/>then click Generate.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
