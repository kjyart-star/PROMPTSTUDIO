'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Play, Pause, SkipBack, SkipForward,
  Volume2, VolumeX, Shuffle, Repeat, Mic, ListMusic, PictureInPicture2, Heart, PanelRight, Music
} from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { createClient } from '@/lib/supabase/client';
import { MiniPlayerPip } from './MiniPlayerPip';
import { withBase } from '@/lib/basePath'

export function PersistentPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekRef = useRef<HTMLInputElement>(null);

  const {
    currentTrack, isPlaying, progress, currentTime, duration,
    volume, isMuted, hasLoggedPlay, isNowPlayingOpen,
    isShuffle, repeatMode, seekTrigger,
    playTrack, togglePlay, next, prev, seek, setVolume, toggleMute, setNowPlayingOpen,
    toggleShuffle, toggleRepeatMode,
    _setIsPlaying, _setProgress, _markPlayLogged,
    _setGetFrequencyData,
  } = usePlayerStore();

  const [isLiked, setIsLiked] = useState(false);
  const [isPipOpen, setIsPipOpen] = useState(false);
  const [isQueueOpen, setIsQueueOpen] = useState(false);

  const queueRef = useRef<HTMLDivElement>(null);

  const [lang, setLang] = useState('KO');
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storedLang = localStorage.getItem('language') || 'KO';
    setLang(storedLang.toUpperCase());
    const handleLangChange = (e: any) => {
      setLang(e.detail.toUpperCase());
    };
    window.addEventListener('languageChange', handleLangChange);
    return () => window.removeEventListener('languageChange', handleLangChange);
  }, []);

  const getShuffleTooltip = () => {
    if (lang === 'KO') return isShuffle ? '셔플: 켬' : '셔플: 끔';
    if (lang === 'JA') return isShuffle ? 'シャッフル: オン' : 'シャッフル: オフ';
    return isShuffle ? 'Shuffle: On' : 'Shuffle: Off';
  };

  const getRepeatTooltip = () => {
    if (lang === 'KO') {
      return repeatMode === 'all' ? '전체 반복' : repeatMode === 'one' ? '한 곡 반복' : '반복 안함';
    }
    if (lang === 'JA') {
      return repeatMode === 'all' ? 'すべてリピート' : repeatMode === 'one' ? '1曲リピート' : 'リピートオフ';
    }
    return repeatMode === 'all' ? 'Repeat All' : repeatMode === 'one' ? 'Repeat One' : 'Repeat Off';
  };

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (queueRef.current && !queueRef.current.contains(event.target as Node)) {
        setIsQueueOpen(false);
      }
    }
    if (isQueueOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isQueueOpen]);

  // Sync liked state when current track changes
  useEffect(() => {
    if (!currentTrack || currentTrack.id === 'dummy-1') {
      setIsLiked(false);
      return;
    }
    
    setIsLiked(false);
    let isCurrent = true;
    const trackId = currentTrack.id;
    const checkLikedStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !isCurrent) return;

      const { data, error } = await supabase
        .from('song_history')
        .select('liked')
        .eq('id', trackId)
        .maybeSingle();

      // Ignore a stale response if the track changed while this was in flight.
      if (isCurrent && !error && data) {
        setIsLiked(!!data.liked);
      }
    };
    checkLikedStatus();
    return () => { isCurrent = false; };
  }, [currentTrack?.id]);

  // Listen to likeStateChanged custom events from other components
  useEffect(() => {
    const handleLikeChange = (e: any) => {
      if (currentTrack && e.detail.trackId === currentTrack.id) {
        setIsLiked(e.detail.liked);
      }
    };
    window.addEventListener('likeStateChanged', handleLikeChange);
    return () => window.removeEventListener('likeStateChanged', handleLikeChange);
  }, [currentTrack?.id]);

  const handleLikeClick = async () => {
    if (!currentTrack || currentTrack.id === 'dummy-1') return;

    try {
      const prevLiked = isLiked;
      setIsLiked(!prevLiked);

      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: currentTrack.id })
      });

      if (!res.ok) {
        setIsLiked(prevLiked);
      } else {
        const data = await res.json();
        setIsLiked(!!data.liked);
        // Dispatch custom event to notify other listeners (like NowPlayingPanel or lists)
        window.dispatchEvent(new CustomEvent('likeStateChanged', {
          detail: { trackId: currentTrack.id, liked: !!data.liked, likeCount: data.like_count }
        }));
      }
    } catch (e) {
      console.error('Error toggling like in player:', e);
    }
  };

  // 트랙 변경 시 src 변경 + 자동 재생
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return;
    
    let isCurrent = true;
    const loadAndPlay = async () => {
      let url = currentTrack.file_url;

      // If absolute HTTP/HTTPS URL, load and play synchronously
      // to bypass strict browser autoplay/async microtask block rules
      if (url && url.startsWith('http')) {
        if (isCurrent && audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.load();
          if (isPlaying) {
            audioRef.current.play().catch((err) => {
              console.error('Direct autoplay blocked:', err);
              _setIsPlaying(false);
            });
          }
        }
        return;
      }

      if (url) {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.storage
            .from('tracks')
            .createSignedUrl(url, 3600);
          if (error) throw error;
          if (data?.signedUrl) {
            url = data.signedUrl;
          }
        } catch (e) {
          console.error('Error signing URL in player:', e);
        }
      }
      
      if (isCurrent && audioRef.current) {
        audioRef.current.src = url;
        audioRef.current.load();
        if (isPlaying) {
          audioRef.current.play().catch((err) => {
            console.error('Autoplay after sign blocked:', err);
            _setIsPlaying(false);
          });
        }
      }
    };

    loadAndPlay();

    return () => {
      isCurrent = false;
    };
  }, [currentTrack?.id]);

  // 재생/일시정지 상태 동기화
  useEffect(() => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.play().catch(() => _setIsPlaying(false));
    } else {
      audioRef.current.pause();
    }
  }, [isPlaying]);

  // 볼륨 동기화
  useEffect(() => {
    if (!audioRef.current) return;
    audioRef.current.volume = isMuted ? 0 : volume;
  }, [volume, isMuted]);

  // 외부(예: 미니플레이어 PiP 또는 prev로 시간만 리셋할 때)에서 시킹한 타임 동기화
  useEffect(() => {
    if (seekTrigger !== null && audioRef.current) {
      audioRef.current.currentTime = currentTime;
    }
  }, [seekTrigger]);

  // 스페이스바 전역 단축키 (재생/정지 토글)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' ||
          tagName === 'textarea' ||
          tagName === 'select' ||
          activeEl.hasAttribute('contenteditable') ||
          activeEl.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const state = usePlayerStore.getState();
        if (!state.currentTrack) return;
        state.togglePlay();
      } else if (e.code === 'ArrowUp' || e.key === 'ArrowUp') {
        e.preventDefault();
        const state = usePlayerStore.getState();
        const newVol = Math.min(1.0, state.volume + 0.05);
        state.setVolume(newVol);
      } else if (e.code === 'ArrowDown' || e.key === 'ArrowDown') {
        e.preventDefault();
        const state = usePlayerStore.getState();
        const newVol = Math.max(0.0, state.volume - 0.05);
        state.setVolume(newVol);
      } else if (e.code === 'ArrowRight' || e.key === 'ArrowRight') {
        e.preventDefault();
        if (audioRef.current) {
          const newTime = Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + 5);
          audioRef.current.currentTime = newTime;
          const state = usePlayerStore.getState();
          state.seek(newTime);
        }
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        if (audioRef.current) {
          const newTime = Math.max(0, audioRef.current.currentTime - 5);
          audioRef.current.currentTime = newTime;
          const state = usePlayerStore.getState();
          state.seek(newTime);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 30초 이상 재생 시 /api/play 호출
  useEffect(() => {
    if (!currentTrack || hasLoggedPlay) return;
    if (currentTime >= 30) {
      fetch('/api/play', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          track_id: currentTrack.id,
          duration_played: Math.floor(currentTime),
        }),
      }).catch(() => {});
      _markPlayLogged();
    }
  }, [currentTime, currentTrack?.id, hasLoggedPlay]);

  // 시킹 핸들러
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!currentTrack) return;
    const newTime = parseFloat(e.target.value);
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
    }
    seek(newTime);
  };

  const displayTrack = currentTrack as any;
  const displayCurrentTime = currentTrack ? currentTime : 0;
  const displayDuration = currentTrack ? duration || displayTrack.duration_sec : 0;

  // 재생/일시정지 핸들러
  const handlePlayClick = () => {
    if (!currentTrack) return;
    togglePlay();
  };

  return (
    <>
      {/* 실제 audio element — 화면에 보이지 않음 */}
      <audio
        ref={audioRef}
        onPlay={() => _setIsPlaying(true)}
        onPause={() => _setIsPlaying(false)}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          _setProgress(el.currentTime, el.duration || 0);
        }}
        onEnded={() => {
          const { repeatMode, next, _setIsPlaying } = usePlayerStore.getState();
          if (repeatMode === 'one') {
            if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => _setIsPlaying(false));
            }
            usePlayerStore.setState({ progress: 0, currentTime: 0, playStartTime: Date.now(), hasLoggedPlay: false });
          } else {
            const autoplay = localStorage.getItem('pref-autoplay') !== 'false';
            if (autoplay) {
              next();
            } else {
              _setIsPlaying(false);
            }
          }
        }}
        preload="metadata"
      />

      {/* 하단 고정 플레이어 UI */}
      <footer className="fixed bottom-0 left-0 w-full z-50 flex items-center justify-between px-[32px] h-24 glass-panel border-t border-outline-variant/10">
        
        {/* 좌: 트랙 정보 */}
        <div className="flex items-center gap-[16px] w-1/4 min-w-0">
          {!currentTrack && (
            <>
              <div className="w-14 h-14 rounded-lg shrink-0 border border-outline-variant/10 bg-surface-container flex items-center justify-center">
                <Music className="w-5 h-5 text-on-surface-variant/50" />
              </div>
              <div className="hidden sm:block min-w-0">
                <p className="font-semibold text-[14px] leading-[20px] text-on-surface-variant truncate">
                  {lang === 'KO' ? '재생 중인 곡 없음' : lang === 'JA' ? '再生中の曲はありません' : 'Nothing playing'}
                </p>
                <p className="font-medium text-[12px] leading-[16px] text-on-surface-variant/60 truncate mt-0.5">
                  {lang === 'KO' ? '곡을 골라 주세요' : lang === 'JA' ? '曲を選んでください' : 'Pick a track'}
                </p>
              </div>
            </>
          )}
          {displayTrack?.album?.cover_url && (
            <div 
              onClick={() => setNowPlayingOpen(!isNowPlayingOpen)}
              className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 shadow-lg border border-outline-variant/10 cursor-pointer hover:opacity-85 active:scale-95 transition-all"
              title={isNowPlayingOpen ? "닫기" : "곡 정보 보기"}
            >
              <img
                src={displayTrack.album.cover_url}
                alt=""
                className="w-full h-full object-cover"
              />
            </div>
          )}
          {currentTrack && (
            <div className="hidden sm:block min-w-0">
              <button
                onClick={() => setNowPlayingOpen(!isNowPlayingOpen)}
                className="block font-semibold text-[14px] leading-[20px] text-on-surface hover:underline truncate text-left w-full focus:outline-none"
                title={isNowPlayingOpen ? "닫기" : "곡 정보 보기"}
              >
                {displayTrack.title}
              </button>
              <Link
                href={`/artists/${displayTrack.album?.artist?.slug ?? ''}`}
                className="block font-medium text-[12px] leading-[16px] text-on-surface-variant hover:underline truncate mt-0.5"
              >
                {displayTrack.album?.artist?.name ?? 'Unknown Artist'}
              </Link>
            </div>
          )}
          <button 
            onClick={handleLikeClick}
            disabled={!currentTrack}
            className={`transition-colors ml-[8px] cursor-pointer shrink-0 disabled:opacity-40 disabled:cursor-default ${
              isLiked ? 'text-primary' : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
          </button>
        </div>

        {/* 중: 컨트롤 + 진행바 */}
        <div className="flex flex-col items-center gap-[4px] flex-1 max-w-xl">
          <div className="flex items-center gap-[24px]">
            {/* 셔플 */}
            <div className="relative group flex items-center justify-center">
              <button 
                onClick={toggleShuffle}
                className={`hover:text-on-surface cursor-pointer flex items-center justify-center transition-colors ${
                  isShuffle ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                <Shuffle className="w-5 h-5" />
              </button>
              <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[11px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50 flex items-center gap-1.5">
                {getShuffleTooltip()}
              </div>
            </div>

            {/* 이전곡 */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={prev}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center justify-center"
              >
                <SkipBack className="w-5 h-5" />
              </button>
              <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[11px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50 flex items-center gap-1.5">
                {lang === 'KO' ? '이전 곡' : lang === 'JA' ? '前の曲' : 'Previous Song'}
              </div>
            </div>

            {/* 재생/일시정지 */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={handlePlayClick}
                className="w-10 h-10 rounded-full bg-on-surface text-surface flex items-center justify-center transition-transform active:scale-90 cursor-pointer"
              >
                {isPlaying && currentTrack ? (
                  <Pause className="w-5 h-5 text-surface fill-current" />
                ) : (
                  <Play className="w-5 h-5 text-surface fill-current ml-0.5" />
                )}
              </button>
              <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[11px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50 flex items-center gap-1.5">
                {isPlaying && currentTrack 
                  ? (lang === 'KO' ? '일시 정지' : lang === 'JA' ? '一時停止' : 'Pause') 
                  : (lang === 'KO' ? '재생' : lang === 'JA' ? '再生' : 'Play')}
              </div>
            </div>

            {/* 다음곡 */}
            <div className="relative group flex items-center justify-center">
              <button
                onClick={next}
                className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center justify-center"
              >
                <SkipForward className="w-5 h-5" />
              </button>
              <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[11px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50 flex items-center gap-1.5">
                {lang === 'KO' ? '다음 곡' : lang === 'JA' ? '다음 곡' : 'Next Song'}
              </div>
            </div>

            {/* 반복 */}
            <div className="relative group flex items-center justify-center">
              <button 
                onClick={toggleRepeatMode}
                className={`hover:text-on-surface cursor-pointer flex items-center justify-center transition-colors relative ${
                  repeatMode !== 'off' ? 'text-primary' : 'text-on-surface-variant'
                }`}
              >
                <Repeat className="w-5 h-5" />
                {repeatMode === 'one' && (
                  <span className="absolute -top-1 -right-1 text-[8px] bg-primary text-[#090909] font-black rounded-full w-3.5 h-3.5 flex items-center justify-center scale-75 border border-[#090909]">
                    1
                  </span>
                )}
              </button>
              <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[11px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50 flex items-center gap-1.5">
                {getRepeatTooltip()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-[8px] w-full">
            <span className="text-[10px] text-on-surface-variant font-mono w-10 text-right font-bold">
              {formatTime(displayCurrentTime)}
            </span>
            <input
              ref={seekRef}
              type="range"
              min={0}
              max={displayDuration || 0}
              value={displayCurrentTime}
              onChange={handleSeek}
              className="flex-1 h-1 bg-on-surface/10 accent-primary rounded-full cursor-pointer transition-all"
            />
            <span className="text-[10px] text-on-surface-variant font-mono w-10 font-bold">
              {formatTime(displayDuration)}
            </span>
          </div>
        </div>

        {/* 우: 볼륨 및 기능 */}
        <div className="flex items-center justify-end gap-[16px] w-1/4">
          <button
            onClick={() => setNowPlayingOpen(!isNowPlayingOpen)}
            aria-expanded={isNowPlayingOpen}
            aria-controls="now-playing-panel"
            className={`hover:text-on-surface cursor-pointer flex items-center justify-center transition-colors ${isNowPlayingOpen ? 'text-primary' : 'text-on-surface-variant'}`}
            title={isNowPlayingOpen
              ? (lang === 'KO' ? '지금 재생 중 닫기' : lang === 'JA' ? '再生中を閉じる' : 'Hide now playing')
              : (lang === 'KO' ? '지금 재생 중 열기' : lang === 'JA' ? '再生中を開く' : 'Show now playing')}
          >
            <PanelRight className="w-5 h-5" />
          </button>

          <div className="relative" ref={queueRef}>
            <button 
              onClick={() => setIsQueueOpen(!isQueueOpen)}
              className={`hover:text-on-surface cursor-pointer flex items-center justify-center transition-colors ${isQueueOpen ? 'text-primary' : 'text-on-surface-variant'}`}
              title="재생 목록"
            >
              <ListMusic className="w-5 h-5" />
            </button>
            
            {/* Queue Popup */}
            {isQueueOpen && (
              <div className="absolute bottom-12 right-0 w-[320px] max-h-[400px] bg-[#282828] border border-outline-variant/10 shadow-2xl rounded-xl z-50 flex flex-col overflow-hidden animate-fade-in">
                <div className="flex items-center justify-between p-4 border-b border-outline-variant/5 bg-[#18181b]">
                  <h3 className="text-sm font-bold text-on-surface">현재 재생 목록</h3>
                  <span className="text-[10px] font-bold text-on-surface-variant bg-on-surface-variant/10 px-2 py-0.5 rounded-full">
                    {usePlayerStore.getState().queue.length}곡
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1">
                  {usePlayerStore.getState().queue.map((track, idx) => {
                    const isCurrent = currentTrack?.id === track.id;
                    return (
                      <div 
                        key={`${track.id}-${idx}`}
                        onClick={() => {
                          playTrack(track, usePlayerStore.getState().queue);
                        }}
                        className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all ${
                          isCurrent 
                            ? 'bg-primary/10 border border-primary/20' 
                            : 'hover:bg-white/[0.04] border border-transparent'
                        }`}
                      >
                        <div className="w-10 h-10 rounded overflow-hidden bg-[#18181b] shrink-0">
                          <img src={track.album?.cover_url || track.image_url || withBase('/default-album.png')} alt="" className="w-full h-full object-cover" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-xs font-bold truncate ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>
                            {track.title}
                          </p>
                          <p className="text-[10px] text-on-surface-variant truncate">
                            {track.album?.artist?.name || 'Suno AI'}
                          </p>
                        </div>
                        {isCurrent && (
                          <div className="w-3 h-3 rounded-full bg-primary animate-pulse shrink-0" />
                        )}
                      </div>
                    );
                  })}
                  {usePlayerStore.getState().queue.length === 0 && (
                    <div className="p-4 text-center text-xs text-on-surface-variant">
                      대기열이 비어있습니다.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
          <div className="flex items-center gap-[8px] group">
            <button 
              onClick={toggleMute}
              className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center justify-center"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-5 h-5" />
              ) : (
                <Volume2 className="w-5 h-5" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={isMuted ? 0 : volume}
              onChange={(e) => setVolume(parseFloat(e.target.value))}
              className="w-24 h-1 bg-on-surface/10 accent-primary rounded-full cursor-pointer transition-all"
            />
          </div>
          <button 
            onClick={() => setIsPipOpen(true)} 
            className="text-on-surface-variant hover:text-on-surface cursor-pointer flex items-center justify-center"
            title={lang === 'KO' ? '미니 플레이어 열기' : lang === 'JA' ? 'ミニプレイヤーを開く' : 'Open Mini Player'}
          >
            <PictureInPicture2 className="w-5 h-5" />
          </button>
        </div>
      </footer>

      {/* Mini Player PiP Window */}
      <MiniPlayerPip isOpen={isPipOpen} onClose={() => setIsPipOpen(false)} />
    </>
  );
}

function formatTime(sec: number): string {
  if (!isFinite(sec) || sec < 0) return '0:00';
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}
