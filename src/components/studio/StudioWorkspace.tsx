'use client'

import { useState, useEffect, useRef } from 'react'
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Maximize2, 
  RotateCcw, Undo2, Redo2, Scissors, Trash2, Plus, Magnet, 
  ZoomIn, ZoomOut, MousePointer2, Music, Wand2, Image as ImageIcon, 
  Sliders, FolderOpen, Settings, Layers, Sparkles, Download, Check,
  Share2, RefreshCw, Disc, Eye, Tag, FileText, Split
} from 'lucide-react'

interface StudioWorkspaceProps {
  currentTab: string
  setCurrentTab: (tab: 'studio' | 'library' | 'cover' | 'suno' | 'mastering') => void
  uiLanguage: string
  userCredits?: number
  user?: any
  currentTrack?: any
  history?: any[]
  childrenLeft?: React.ReactNode
}

export function StudioWorkspace({
  currentTab,
  setCurrentTab,
  uiLanguage,
  userCredits = 0,
  user = null,
  currentTrack = null,
  history = [],
  childrenLeft
}: StudioWorkspaceProps) {
  // Playback & Timeline State
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(14.5)
  const [duration, setDuration] = useState(180)
  const [volume, setVolume] = useState(0.8)
  const [zoomLevel, setZoomLevel] = useState(50)
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '1:1' | '9:16'>('16:9')
  const [selectedTrack, setSelectedTrack] = useState<any>(currentTrack || history[0] || null)

  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    if (currentTrack) {
      setSelectedTrack(currentTrack)
    } else if (history.length > 0 && !selectedTrack) {
      setSelectedTrack(history[0])
    }
  }, [currentTrack, history])

  const formatTimecode = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const frames = Math.floor((secs % 1) * 30)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
  }

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
        setIsPlaying(false)
      } else {
        audioRef.current.play().catch(() => {})
        setIsPlaying(true)
      }
    } else {
      setIsPlaying(!isPlaying)
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] w-full bg-[#0a0a0e] text-zinc-300 select-none overflow-hidden font-sans">
      {/* Audio element for real playback if track has url */}
      {selectedTrack?.audio_url && (
        <audio
          ref={audioRef}
          src={selectedTrack.audio_url}
          onTimeUpdate={() => {
            if (audioRef.current) {
              setCurrentTime(audioRef.current.currentTime)
              setDuration(audioRef.current.duration || 180)
            }
          }}
          onEnded={() => setIsPlaying(false)}
        />
      )}

      {/* Main Top Area: Left Rail + Left Tool Pane + Center Preview Canvas + Right Inspector */}
      <div className="flex flex-1 min-h-0 border-b border-[#1f1f2a]">
        
        {/* 1. Left Vertical Icon + Text Sidebar */}
        <aside className="w-48 bg-[#0a0a0a] border-r border-[#1a1a1a] flex flex-col p-3 gap-1.5 shrink-0 z-10 select-none">
          {/* 1. 음악 프롬프트 */}
          <button
            type="button"
            onClick={() => setCurrentTab('studio')}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'studio' 
                ? 'bg-primary text-black shadow-md shadow-yellow-950/40' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151515]'
            }`}
          >
            <Wand2 className="w-4 h-4 shrink-0" />
            <span className="truncate">음악 프롬프트</span>
          </button>

          {/* 2. 음악 생성 */}
          <button
            type="button"
            onClick={() => setCurrentTab('suno')}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'suno' 
                ? 'bg-primary text-black shadow-md shadow-yellow-950/40' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151515]'
            }`}
          >
            <Music className="w-4 h-4 shrink-0" />
            <span className="truncate">음악 생성</span>
          </button>

          {/* 3. 보관함 */}
          <button
            type="button"
            onClick={() => setCurrentTab('library')}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'library' 
                ? 'bg-primary text-black shadow-md shadow-yellow-950/40' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151515]'
            }`}
          >
            <FolderOpen className="w-4 h-4 shrink-0" />
            <span className="truncate">보관함</span>
          </button>

          {/* 4. AI 커버 스튜디오 */}
          <button
            type="button"
            onClick={() => setCurrentTab('cover')}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'cover' 
                ? 'bg-primary text-black shadow-md shadow-yellow-950/40' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151515]'
            }`}
          >
            <ImageIcon className="w-4 h-4 shrink-0" />
            <span className="truncate">AI 커버 스튜디오</span>
          </button>

          {/* 5. 마스터링 */}
          <button
            type="button"
            onClick={() => setCurrentTab('mastering')}
            className={`w-full px-3 py-2.5 rounded-xl flex items-center gap-2.5 text-xs font-extrabold transition-all cursor-pointer ${
              currentTab === 'mastering' 
                ? 'bg-primary text-black shadow-md shadow-yellow-950/40' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#151515]'
            }`}
          >
            <Sliders className="w-4 h-4 shrink-0" />
            <span className="truncate">마스터링</span>
          </button>
        </aside>

        {/* 2. Main Workspace Content Pane (프롬프트 / Suno 생성 / AI 커버 / 마스터링 / 보관함 폼이 전체 화면을 넓게 사용) */}
        <main className="flex-1 bg-[#0a0a0e] flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          {childrenLeft}
        </main>
      </div>
    </div>
  )
}
