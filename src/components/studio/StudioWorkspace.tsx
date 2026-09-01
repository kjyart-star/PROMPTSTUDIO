'use client'

import { useState } from 'react'
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

  const formatTimecode = (secs: number) => {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    const frames = Math.floor((secs % 1) * 30)
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
  }

  const togglePlayPause = () => {
    setIsPlaying(!isPlaying)
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 w-full text-zinc-300 select-none overflow-hidden font-sans">
      {/* 오디오 엘리먼트는 여기에 두지 않는다 — 스튜디오의 곡 재생은 레이아웃의
          PersistentPlayer 하나가 전담한다. 예전엔 history[0].audio_url 을 물고 있는
          숨은 <audio> 가 여기 있었는데, 재생 버튼이 붙어 있지 않아 소리는 안 나면서
          같은 파일만 한 번 더 받아 갔고 이중 재생 소지로 남아 있었다. */}

      {/* Main Top Area: Left Rail + Left Tool Pane + Center Preview Canvas + Right Inspector */}
      {/* 아래 108px 은 화면에 고정된 PersistentPlayer(h-24=96px) + 판 간격 12px 이다 —
          스트리밍의 md:mb-[108px] 과 같은 값이라 두 화면의 바닥선이 맞는다. */}
      <div className="flex flex-1 min-h-0 gap-3 p-3 pb-[108px]">

        {/* 1. Left Vertical Icon + Text Sidebar */}
        <aside className="w-48 rounded-lg border border-outline-variant bg-surface-container-low flex flex-col p-3 gap-1.5 shrink-0 z-10 select-none overflow-y-auto custom-scrollbar">
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
        <main className="flex-1 rounded-lg border border-outline-variant bg-surface flex flex-col min-w-0 overflow-y-auto custom-scrollbar">
          {childrenLeft}
        </main>
      </div>
    </div>
  )
}
