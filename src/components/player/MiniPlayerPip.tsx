'use client';

import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward, Maximize2, Shuffle, Repeat, Volume2, VolumeX, Heart } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';

interface MiniPlayerPipProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MiniPlayerPip({ isOpen, onClose }: MiniPlayerPipProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);

  const {
    currentTrack, isPlaying, togglePlay, next, prev,
    currentTime, duration, seek, volume, setVolume
  } = usePlayerStore();

  useEffect(() => {
    let activeWindow: Window | null = null;

    const openPip = async () => {
      if (!('documentPictureInPicture' in window)) {
        alert('현재 브라우저에서는 미니 플레이어(새창) 기능을 지원하지 않습니다. (최신 Chrome 브라우저 권장)');
        onClose();
        return;
      }

      try {
        const dpip = (window as any).documentPictureInPicture;
        const newPipWindow = await dpip.requestWindow({
          width: 380,
          height: 680,
        });

        activeWindow = newPipWindow;

        // Copy styles
        [...document.styleSheets].forEach((styleSheet) => {
          try {
            const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join('');
            const style = document.createElement('style');
            style.textContent = cssRules;
            newPipWindow.document.head.appendChild(style);
          } catch (e) {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.type = styleSheet.type;
            link.media = styleSheet.media.mediaText;
            if (styleSheet.href) {
              link.href = styleSheet.href;
              newPipWindow.document.head.appendChild(link);
            }
          }
        });

        // Add tailwind base script if necessary or just let it use compiled css
        newPipWindow.document.documentElement.style.height = '100%';
        newPipWindow.document.documentElement.style.overflow = 'hidden';
        newPipWindow.document.body.style.backgroundColor = '#080d08';
        newPipWindow.document.body.style.color = '#ffffff';
        newPipWindow.document.body.style.margin = '0';
        newPipWindow.document.body.style.padding = '0';
        newPipWindow.document.body.style.height = '100%';
        newPipWindow.document.body.style.overflow = 'hidden';

        const container = document.createElement('div');
        container.id = 'pip-root';
        container.style.width = '100%';
        container.style.height = '100%';
        container.style.overflow = 'hidden';
        newPipWindow.document.body.appendChild(container);
        
        pipContainerRef.current = container;
        setPipWindow(newPipWindow);

        newPipWindow.addEventListener('pagehide', () => {
          setPipWindow(null);
          onClose();
        });
      } catch (error) {
        console.error('Failed to open PiP window:', error);
        onClose();
      }
    };

    if (isOpen && !pipWindow) {
      openPip();
    } else if (!isOpen && pipWindow) {
      pipWindow.close();
      setPipWindow(null);
    }

    return () => {
      if (activeWindow) {
        activeWindow.close();
      }
    };
  }, [isOpen]);

  if (!isOpen || !pipWindow || !pipContainerRef.current) return null;

  const displayTrack = currentTrack || {
    title: 'No Track',
    album: { cover_url: '/default-album.png', artist: { name: 'Unknown' } }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    seek(parseFloat(e.target.value));
  };

  const formatTime = (sec: number) => {
    if (!isFinite(sec) || sec < 0) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const pipContent = (
    <div className="flex flex-col h-full w-full bg-black relative">
      {/* Background Blur Image */}
      <div className="absolute inset-0 z-0">
        <img 
          src={displayTrack.album?.cover_url || '/default-album.png'} 
          alt="" 
          className="w-full h-full object-cover opacity-50 blur-3xl scale-125"
        />
        {/* Dark overlay to ensure contrast */}
        <div className="absolute inset-0 bg-black/20"></div>
      </div>

      <div className="relative z-10 flex flex-col h-full p-6">
        
        {/* Album Art (Top Half) */}
        <div className="flex-1 w-full flex items-center justify-center min-h-0 mb-6">
          <div className="w-full h-full max-w-[320px] max-h-[320px] aspect-square rounded-[32px] overflow-hidden shadow-2xl">
            <img 
              src={displayTrack.album?.cover_url || '/default-album.png'} 
              alt="cover" 
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* iOS-Style Glass Card (Bottom Half) */}
        <div className="w-full bg-black/20 backdrop-blur-3xl rounded-[32px] p-6 flex flex-col border border-white/10 shadow-2xl">
          
          {/* Track Info */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex flex-col flex-1 min-w-0 pr-4">
              <h2 className="text-[22px] leading-tight font-extrabold text-white truncate">{displayTrack.title}</h2>
              <p className="text-[15px] font-medium text-white/70 truncate mt-1">
                {displayTrack.album?.artist?.name || 'Unknown Artist'}
              </p>
            </div>
            <button className="text-white/60 hover:text-primary transition-colors shrink-0 cursor-pointer">
              <Heart className="w-6 h-6" />
            </button>
          </div>

          {/* Progress Bar */}
          <div className="flex flex-col gap-2 mb-6 mt-2">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1.5 bg-white/20 accent-white rounded-full cursor-pointer hover:accent-primary transition-all"
            />
            <div className="flex justify-between text-[11px] font-medium text-white/50 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>-{formatTime(Math.max(0, (duration || 0) - currentTime))}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center justify-between mb-8 px-2">
            <button className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <Shuffle className="w-5 h-5" />
            </button>
            <button onClick={prev} className="text-white hover:text-primary transition-colors cursor-pointer">
              <SkipBack className="w-10 h-10 fill-current" />
            </button>
            <button 
              onClick={togglePlay}
              className="w-[56px] h-[56px] rounded-full bg-primary text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-primary/20 cursor-pointer"
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 fill-current" />
              ) : (
                <Play className="w-7 h-7 fill-current ml-1" />
              )}
            </button>
            <button onClick={next} className="text-white hover:text-primary transition-colors cursor-pointer">
              <SkipForward className="w-10 h-10 fill-current" />
            </button>
            <button className="text-white/60 hover:text-white transition-colors cursor-pointer">
              <Repeat className="w-5 h-5" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-4 px-2">
            <button className="text-white/60 hover:text-white transition-colors cursor-pointer" onClick={() => setVolume(volume === 0 ? 1 : 0)}>
              {volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1.5 bg-white/20 accent-white rounded-full cursor-pointer hover:accent-primary transition-all"
            />
          </div>
          
        </div>
      </div>
    </div>
  );

  return createPortal(pipContent, pipContainerRef.current);
}
