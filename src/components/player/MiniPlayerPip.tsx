'use client';

import { useEffect, useState, useRef, useCallback, useId } from 'react';
import { createPortal } from 'react-dom';
import { Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Volume2, VolumeX, Heart, Disc3, FileText, ListMusic } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { createClient } from '@/lib/supabase/client';
import { withBase } from '@/lib/basePath'

/* ------------------------------------------------------------- useRafLoop */

function useRafLoop(cb: (now: number, dt: number) => void) {
  const cbRef = useRef(cb);
  cbRef.current = cb;
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      cbRef.current(now, dt);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
}

/* -------------------------------------------------- useTransitionSound */

function useTransitionSound() {
  const ctxRef = useRef<AudioContext | null>(null);
  useEffect(() => {
    return () => {
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, []);
  return useCallback((bassEnergy = 0.5) => {
    try {
      if (!ctxRef.current) {
        const Ctor = window.AudioContext || (window as any).webkitAudioContext;
        if (!Ctor) return;
        ctxRef.current = new Ctor();
      }
      const ctx = ctxRef.current;
      if (ctx.state === 'suspended') ctx.resume();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const startFreq = 440 + bassEnergy * 440;
      const endFreq = startFreq * (2 / 3);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(startFreq, now);
      osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.09);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.18);
    } catch {
      /* Web Audio unavailable */
    }
  }, []);
}

/* --------------------------------------------------------- ScalesMixer */

const COLS = 10;
const ROWS = 10;
const BAND_RANGES: [number, number][] = [
  [0, 1], [1, 3], [3, 6], [6, 10], [10, 16],
  [16, 24], [24, 36], [36, 52], [52, 74], [74, 100],
];
const sineOut = (x: number) => Math.sin((x * Math.PI) / 2);
const sineIn = (x: number) => 1 - Math.cos((x * Math.PI) / 2);
const sineInOut = (x: number) => -(Math.cos(Math.PI * x) - 1) / 2;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const PART_A_DUR = 1.5;
const PART_A_TO = 11;
const PART_A_STEP = 3 / (COLS - 1);
const PART_B_DUR = 1;
const SCALE_FROM = 0.133;
const SCALE_TO = 0.8;

function partAColumnY(time: number, col: number): number {
  const local = time - col * PART_A_STEP;
  const period = PART_A_DUR * 2;
  const cyc = ((local % period) + period) % period;
  if (cyc < PART_A_DUR) return PART_A_TO * sineInOut(cyc / PART_A_DUR);
  return PART_A_TO * sineInOut(1 - (cyc - PART_A_DUR) / PART_A_DUR);
}
function partBCircle(
  time: number,
  col: number,
  row: number
): [number, number] {
  const frac = row / ROWS;
  const yFrom = lerp(77, -77, frac);
  const yTo = lerp(col, -col, frac);
  const local = time - col / COLS;
  const period = PART_B_DUR * 2;
  const cyc = ((local % period) + period) % period;
  let e: number;
  if (cyc < PART_B_DUR) e = sineOut(cyc / PART_B_DUR);
  else e = sineIn(1 - (cyc - PART_B_DUR) / PART_B_DUR);
  return [lerp(yFrom, yTo, e), lerp(SCALE_FROM, SCALE_TO, e)];
}

function ScalesMixer({
  isPlaying,
  getFrequencyData,
}: {
  isPlaying: boolean;
  getFrequencyData?: (() => Uint8Array | null) | null;
}) {
  const maskId = useId().replace(/:/g, '_');
  const colRefs = useRef<(SVGGElement | null)[]>([]);
  const circleRefs = useRef<(SVGCircleElement | null)[][]>(
    Array.from({ length: COLS }, () => [])
  );
  const tRef = useRef(50);

  useRafLoop((_, dt) => {
    if (isPlaying) tRef.current += dt / 1000;
    const time = tRef.current;
    const freqData = getFrequencyData?.();
    
    // Generate beautiful mock frequency data if real data is not available
    let mockFreqs: number[] = [];
    if (freqData) {
      for (let c = 0; c < COLS; c++) {
        const [binStart, binEnd] = BAND_RANGES[c];
        let sum = 0;
        for (let b = binStart; b < binEnd; b++) sum += freqData[b] ?? 0;
        mockFreqs.push(Math.sqrt(sum / (binEnd - binStart) / 255));
      }
    } else {
      for (let c = 0; c < COLS; c++) {
        if (isPlaying) {
          // Bouncing wave effect
          const baseVal = Math.sin(time * 3.5 + c * 0.8) * 0.45 + 0.55;
          const noise = Math.sin(time * 18 + c * 2.3) * 0.12;
          mockFreqs.push(Math.max(0.1, Math.min(1.0, baseVal + noise)));
        } else {
          // Flat/calm state when paused
          mockFreqs.push(0);
        }
      }
    }

    for (let c = 0; c < COLS; c++) {
      const energy = mockFreqs[c];
      const bobGain = isPlaying ? 0.4 + energy : 0.3;
      const scaleGain = isPlaying ? 0.5 + energy : 0.4;
      
      const colEl = colRefs.current[c];
      if (colEl) {
        const ay = partAColumnY(time, c) * bobGain;
        colEl.style.transform = `translate(${c * 10}px, ${ay}px)`;
      }
      for (let r = 0; r < ROWS; r++) {
        const circle = circleRefs.current[c]?.[r];
        if (!circle) continue;
        const [ty, s] = partBCircle(time, c, r);
        circle.style.transform = `translateY(${ty}px) scale(${
          s * scaleGain
        })`;
      }
    }
  });

  return (
    <svg className="pip-visualizer-svg" viewBox="0 0 98 108" aria-hidden="true">
      <mask id={maskId}>
        <rect width="10" height="10" fill="#fff" />
      </mask>
      {Array.from({ length: COLS }, (_, c) => (
        <g
          key={c}
          ref={(el) => {
            colRefs.current[c] = el;
          }}
          style={{ transform: `translate(${c * 10}px, 0px)` }}
        >
          {Array.from({ length: ROWS }, (_, r) => (
            <g
              key={r}
              mask={`url(#${maskId})`}
              transform={`translate(0 ${r * 10})`}
            >
              <circle
                ref={(el) => {
                  if (circleRefs.current[c]) {
                    circleRefs.current[c][r] = el;
                  }
                }}
                cx="5"
                cy="5"
                r="5"
                style={{
                  transformBox: 'fill-box',
                  transformOrigin: 'center',
                }}
              />
            </g>
          ))}
        </g>
      ))}
    </svg>
  );
}

/* ------------------------------------------------------- Disc + layers */

const SPIN_MAX = 0.8;
const BURST_DURATION = 620;

interface Layer {
  id: number;
  track: any;
  dir: 'next' | 'prev' | null;
}

function Disc({
  layers,
  isPlaying,
  isZoomed,
  trackKey,
  direction,
  onZoomToggle,
  defaultCover,
}: {
  layers: Layer[];
  isPlaying: boolean;
  isZoomed: boolean;
  trackKey: number;
  direction: 'next' | 'prev' | null;
  onZoomToggle: () => void;
  defaultCover: string;
}) {
  const spinRef = useRef<HTMLDivElement>(null);
  const rotRef = useRef(0);
  const velRef = useRef(0);
  const burstRef = useRef({ from: 0, start: 0, active: false, pending: false });
  const lastKey = useRef(trackKey);

  useEffect(() => {
    if (trackKey !== lastKey.current) {
      lastKey.current = trackKey;
      if (direction) {
        burstRef.current.from = direction === 'prev' ? 360 : -360;
        burstRef.current.pending = true;
      }
    }
  }, [trackKey, direction]);

  useRafLoop((now) => {
    const el = spinRef.current;
    if (!el) return;
    if (isPlaying) velRef.current += (SPIN_MAX - velRef.current) * 0.2;
    else {
      velRef.current *= 0.96;
      if (velRef.current < 0.001) velRef.current = 0;
    }
    if (isZoomed) {
      const target = Math.round(rotRef.current / 360) * 360;
      const nx = rotRef.current + (target - rotRef.current) * 0.08;
      rotRef.current = Math.abs(target - nx) < 0.1 ? target : nx;
    } else {
      rotRef.current += velRef.current;
    }
    const burst = burstRef.current;
    if (burst.pending) {
      burst.start = now;
      burst.pending = false;
      burst.active = true;
    }
    let b = 0;
    if (burst.active) {
      const t = (now - burst.start) / BURST_DURATION;
      if (t >= 1) burst.active = false;
      else b = burst.from * (1 - (1 - Math.pow(1 - t, 3)));
    }
    el.style.transform = `scale(1.01) rotate(${rotRef.current + b}deg)`;
  });

  return (
    <div
      className={`pip-disc-mask ${isZoomed ? 'is-zoomed' : ''}`}
    >
      <div className="pip-disc-spin" ref={spinRef}>
        {layers.map((l, i) => {
          const isNewest = i === layers.length - 1;
          const cls = isNewest
            ? l.dir
              ? 'pip-disc-cover pip-disc-cover-enter'
              : 'pip-disc-cover'
            : 'pip-disc-cover pip-disc-cover-exit';
          const coverUrl = l.track.album?.cover_url || l.track.image_url || defaultCover;
          return (
            <img
              key={l.id}
              src={coverUrl}
              alt={l.track.title}
              className={cls}
              draggable={false}
            />
          );
        })}
      </div>
      <div className="pip-disc-hole">
        <div className="pip-disc-hole-inner" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ TrackInfo */

function TrackInfo({ layers }: { layers: Layer[] }) {
  return (
    <div className="pip-track-info">
      {layers.map((l, i) => {
        const isNewest = i === layers.length - 1;
        const dx = l.dir === 'next' ? 14 : l.dir === 'prev' ? -14 : 0;
        const exitDx = -dx;
        const state = isNewest ? (l.dir ? 'pip-ti-enter' : '') : 'pip-ti-exit';
        const style = {
          ['--dx' as string]: `${isNewest ? dx : exitDx}px`,
        } as React.CSSProperties;
        
        return (
          <div
            key={l.id}
            className={`pip-ti-layer ${isNewest ? '' : 'pip-ti-abs'}`}
          >
            <p className={`pip-artist ${state}`} style={style}>
              {l.track.album?.artist?.name || 'Suno AI'}
            </p>
            <h2 className={`pip-track ${state}`} style={style}>
              {l.track.title}
            </h2>
          </div>
        );
      })}
    </div>
  );
}

/* ----------------------------------------------------------- ProgressBar */

function fmt(s: number): string {
  if (!isFinite(s) || s < 0) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

function ProgressBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek: (pct: number) => void;
}) {
  const pct = duration ? (currentTime / duration) * 100 : 0;
  return (
    <div className="pip-progress-container">
      <div
        className="pip-progress-bar"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek(
            Math.max(
              0,
              Math.min(1, (e.clientX - rect.left) / rect.width)
            )
          );
        }}
      >
        <div className="pip-progress-bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="pip-time">
        <span className="current">{fmt(currentTime)}</span>
        <span className="total">-{fmt(Math.max(0, duration - currentTime))}</span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ MiniPlayerPip */

interface MiniPlayerPipProps {
  isOpen: boolean;
  onClose: () => void;
}

const DEFAULT_TRACK = {
  id: 'dummy-1',
  title: 'Electric Dreams',
  file_url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
  duration_sec: 222,
  like_count: 342109002,
  album_id: 'dummy-album-1',
  lyrics: 'Neon lights reflecting on the glass\nSpeeding through the future, moving fast\nDigital dreams and electric hearts\nThis is where the real life starts',
  album: {
    id: 'dummy-album-1',
    slug: 'neonecho',
    title: 'Electric Dreams',
    cover_url: withBase('/images/vanguard_cover.png'),
    release_type: 'lp',
    status: 'published',
    created_at: '',
    artist_id: 'neonecho',
    artist: {
      name: 'Neon Echo',
      slug: 'neonecho'
    }
  }
};

export function MiniPlayerPip({ isOpen, onClose }: MiniPlayerPipProps) {
  const [pipWindow, setPipWindow] = useState<Window | null>(null);
  const pipContainerRef = useRef<HTMLDivElement | null>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);

  const {
    currentTrack, isPlaying, togglePlay, next, prev,
    currentTime, duration, seek, volume, setVolume,
    isShuffle, repeatMode, toggleShuffle, toggleRepeatMode,
    getFrequencyData, queue, playTrack
  } = usePlayerStore();

  const [isLiked, setIsLiked] = useState(false);
  const [lang, setLang] = useState('KO');

  const [layers, setLayers] = useState<Layer[]>(() => [
    { id: 0, track: currentTrack || DEFAULT_TRACK, dir: null },
  ]);
  const lastIndex = useRef(-1);
  const lastTrackId = useRef<string | null>(null);
  const idRef = useRef(1);
  const [direction, setDirection] = useState<'next' | 'prev' | null>(null);

  const playTransitionSound = useTransitionSound();

  // Sync language
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

  // Sync like state
  useEffect(() => {
    if (!currentTrack || currentTrack.id === 'dummy-1') {
      setIsLiked(false);
      return;
    }
    
    setIsLiked(false);
    const checkLikedStatus = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('song_history')
        .select('liked')
        .eq('id', currentTrack.id)
        .maybeSingle();

      if (!error && data) {
        setIsLiked(!!data.liked);
      }
    };
    checkLikedStatus();
  }, [currentTrack?.id]);

  // Sync layers & trigger sound
  useEffect(() => {
    const activeTrack = currentTrack || DEFAULT_TRACK;
    
    if (activeTrack.id === lastTrackId.current) return;

    // Reset lyrics view when song changes
    setShowLyrics(false);

    let dir: 'next' | 'prev' | null = null;
    if (lastTrackId.current !== null && lastTrackId.current !== 'dummy-1') {
      const store = usePlayerStore.getState();
      const currIndex = store.queueIndex;
      if (lastIndex.current !== -1) {
        dir = currIndex > lastIndex.current ? 'next' : 'prev';
      }
      lastIndex.current = currIndex;
    } else {
      const store = usePlayerStore.getState();
      lastIndex.current = store.queueIndex;
    }
    
    setDirection(dir);
    lastTrackId.current = activeTrack.id;

    // Transition sound (triangle bass)
    // playTransitionSound(0.55);

    const id = idRef.current++;
    setLayers((prevLayers) => [
      ...prevLayers,
      { id, track: activeTrack, dir },
    ]);
    const t = setTimeout(() => {
      // Keep only the newest layer and reset the transition direction (dir = null)
      // to remove enter/exit classes (opacity: 0) and restore visibility
      setLayers((prevLayers) =>
        prevLayers.filter((l) => l.id === id).map((l) => ({ ...l, dir: null }))
      );
    }, 760);
    return () => clearTimeout(t);
  }, [currentTrack?.id]);

  // Handle click outside to unzoom
  useEffect(() => {
    const handlePipClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.pip-disc-mask')) {
        setIsZoomed(false);
      }
    };
    if (pipWindow) {
      pipWindow.document.addEventListener('click', handlePipClick);
    }
    return () => {
      if (pipWindow) {
        pipWindow.document.removeEventListener('click', handlePipClick);
      }
    };
  }, [pipWindow]);

  // Handle keyboard shortcuts in PiP window
  useEffect(() => {
    if (!pipWindow) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = pipWindow.document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toLowerCase();
        if (
          tagName === 'input' || 
          tagName === 'textarea' || 
          activeEl.hasAttribute('contenteditable') ||
          activeEl.getAttribute('contenteditable') === 'true'
        ) {
          return;
        }
      }

      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        const state = usePlayerStore.getState();
        if (!state.currentTrack) {
          state.playTrack(DEFAULT_TRACK as any, [DEFAULT_TRACK] as any);
        } else {
          state.togglePlay();
        }
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
        const state = usePlayerStore.getState();
        const duration = state.duration || (state.currentTrack?.duration_sec ?? 0);
        const newTime = Math.min(duration, state.currentTime + 5);
        state.seek(newTime);
      } else if (e.code === 'ArrowLeft' || e.key === 'ArrowLeft') {
        e.preventDefault();
        const state = usePlayerStore.getState();
        const newTime = Math.max(0, state.currentTime - 5);
        state.seek(newTime);
      }
    };

    pipWindow.addEventListener('keydown', handleKeyDown);
    return () => {
      pipWindow.removeEventListener('keydown', handleKeyDown);
    };
  }, [pipWindow]);

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
          disallowReturnToOpener: true,
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

        newPipWindow.document.documentElement.style.height = '100%';
        newPipWindow.document.documentElement.style.overflow = 'hidden';
        newPipWindow.document.body.style.backgroundColor = '#0a0f0a';
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

  const handleLikeClick = async () => {
    const activeTrack = currentTrack || DEFAULT_TRACK;
    if (!activeTrack.id || activeTrack.id === 'dummy-1') return;

    try {
      const prevLiked = isLiked;
      setIsLiked(!prevLiked);

      const res = await fetch('/api/likes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ track_id: activeTrack.id })
      });

      if (!res.ok) {
        setIsLiked(prevLiked);
      } else {
        const data = await res.json();
        setIsLiked(!!data.liked);
        window.dispatchEvent(new CustomEvent('likeStateChanged', {
          detail: { trackId: activeTrack.id, liked: !!data.liked, likeCount: data.like_count }
        }));
      }
    } catch (e) {
      console.error('Error toggling like in PiP player:', e);
    }
  };

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

  if (!isOpen || !pipWindow || !pipContainerRef.current) return null;

  const activeTrack = currentTrack || DEFAULT_TRACK;
  const coverUrl = (activeTrack as any).album?.cover_url || (activeTrack as any).image_url || withBase('/images/vanguard_cover.png');

  const pipContent = (
    <div className="pip-player relative">
      {/* Background Ambient Blur */}
      <img 
        src={coverUrl} 
        alt="" 
        className="pip-player-bg"
      />

      <div className={`pip-player-card ${isZoomed ? 'is-zoomed' : ''}`}>
        
        {/* Disc section, Lyrics board, or Queue board */}
        {showQueue ? (
          <div 
            className={`w-[320px] h-[240px] rounded-2xl bg-white/[0.03] border border-outline-variant/10 backdrop-blur-xl flex flex-col p-4 text-left shadow-2xl relative transition-all duration-300 overflow-hidden ${
              isZoomed ? 'scale-105 mt-[40px]' : 'mt-[10px]'
            }`}
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-white/[0.06] shrink-0">
              <span className="text-xs font-bold text-zinc-300">현재 재생 목록</span>
              <span className="text-[10px] font-bold text-[#e3fe06] bg-[#e3fe06]/10 px-2.5 py-0.5 rounded-full border border-[#e3fe06]/20">
                {queue.length}곡
              </span>
            </div>
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-1.5 custom-scrollbar scroll-smooth">
              {queue.map((track, idx) => {
                const isCurrent = activeTrack.id === track.id;
                const cover = track.album?.cover_url || track.image_url || withBase('/default-album.png');
                return (
                  <div
                    key={`${track.id}-${idx}`}
                    onClick={() => {
                      playTrack(track, queue);
                    }}
                    className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all border shrink-0 ${
                      isCurrent
                        ? 'bg-[#e3fe06]/10 border-[#e3fe06]/20 text-white font-bold'
                        : 'bg-transparent border-transparent hover:bg-white/[0.03] text-zinc-300 hover:text-white'
                    }`}
                  >
                    <div className="w-10 h-10 rounded overflow-hidden bg-zinc-950 shrink-0 border border-zinc-800">
                      <img src={cover} alt="" className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-[11px] truncate ${isCurrent ? 'text-[#e3fe06]' : ''}`}>
                        {track.title}
                      </p>
                      <p className="text-[9px] text-zinc-500 truncate mt-0.5">
                        {track.album?.artist?.name || 'Suno AI'}
                      </p>
                    </div>
                    {isCurrent && (
                      <div className="w-2 h-2 rounded-full bg-[#e3fe06] shadow-[0_0_8px_rgba(227,254,6,0.8)] shrink-0 animate-pulse" />
                    )}
                  </div>
                );
              })}
              {queue.length === 0 && (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs italic">
                  대기열이 비어있습니다.
                </div>
              )}
            </div>
          </div>
        ) : showLyrics ? (
          <div 
            className={`w-[320px] h-[240px] rounded-2xl bg-white/[0.03] border border-outline-variant/10 backdrop-blur-xl flex flex-col p-6 text-center shadow-2xl relative transition-all duration-300 overflow-hidden ${
              isZoomed ? 'scale-105 mt-[40px]' : 'mt-[10px]'
            }`}
          >
            <div className="w-full flex-1 min-h-0 overflow-y-auto pr-2 flex flex-col gap-2.5 justify-start scroll-smooth select-text custom-scrollbar">
              {activeTrack.lyrics ? (
                activeTrack.lyrics.split('\n').map((line: string, idx: number) => (
                  <p key={idx} className="text-zinc-200 text-[12px] font-bold leading-relaxed my-0.5 hover:text-primary transition-colors">
                    {line}
                  </p>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center text-zinc-500 text-xs italic">
                  등록된 가사가 없습니다.
                </div>
              )}
            </div>
          </div>
        ) : (
          <Disc
            layers={layers}
            isPlaying={isPlaying}
            isZoomed={isZoomed}
            trackKey={activeTrack.id === 'dummy-1' ? 0 : layers[layers.length - 1]?.id || 0}
            direction={direction}
            onZoomToggle={() => setIsZoomed((z) => !z)}
            defaultCover={withBase("/images/vanguard_cover.png")}
          />
        )}

        {/* Info & controls area */}
        <div className="pip-info-area flex-1 w-full flex flex-col justify-between">
          
          <div className="flex flex-col items-center w-full">
            {/* Visualizer (Scales) */}
            {!showQueue && !showLyrics && (
              <ScalesMixer
                isPlaying={isPlaying}
                getFrequencyData={getFrequencyData}
              />
            )}

            {/* Track metadata with sliding effect */}
            <div className="w-full px-4 relative flex flex-col items-center gap-3">
              <TrackInfo layers={layers} />
              
              {/* Icons container - placed below the title */}
              <div className="flex items-center justify-center gap-4 z-40 mt-1">
                <button 
                  onClick={() => {
                    setShowQueue(!showQueue);
                    setShowLyrics(false);
                  }}
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer ${
                    showQueue ? 'text-primary' : 'text-white/60 hover:text-white'
                  }`}
                  title={showQueue ? '재생 목록 닫기' : '재생 목록 보기'}
                >
                  <ListMusic className="w-5 h-5" />
                </button>
                <button 
                  onClick={() => {
                    setShowLyrics(!showLyrics);
                    setShowQueue(false);
                  }}
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer ${
                    showLyrics ? 'text-primary' : 'text-white/60 hover:text-white'
                  }`}
                  title={showLyrics ? '가사 닫기' : '가사 보기'}
                >
                  <FileText className="w-5 h-5" />
                </button>
                <button 
                  onClick={handleLikeClick}
                  className={`transition-colors p-2 rounded-full hover:bg-white/5 cursor-pointer ${
                    isLiked ? 'text-primary' : 'text-white/60 hover:text-white'
                  }`}
                  title={isLiked ? '좋아요 취소' : '좋아요'}
                >
                  <Heart className={`w-5 h-5 ${isLiked ? 'fill-current' : ''}`} />
                </button>
              </div>
            </div>
          </div>

          <div className="w-full flex flex-col items-center pb-2">
            {/* Timeline progress line */}
            <ProgressBar
              currentTime={currentTime}
              duration={duration || (activeTrack.duration_sec ?? 0)}
              onSeek={seek}
            />

            {/* Control buttons */}
            <div className="pip-controls">
              {/* Shuffle */}
              <div className="relative group flex items-center justify-center">
                <button 
                  onClick={toggleShuffle}
                  className={`pip-ctrl pip-ctrl-toggle ${isShuffle ? 'is-active' : ''}`}
                >
                  <Shuffle className="w-4.5 h-4.5" />
                </button>
                <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[10px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50">
                  {getShuffleTooltip()}
                </div>
              </div>

              {/* Prev */}
              <div className="relative group flex items-center justify-center">
                <button onClick={prev} className="pip-ctrl">
                  <SkipBack className="w-5 h-5 fill-current" />
                </button>
                <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[10px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50">
                  {lang === 'KO' ? '이전 곡' : lang === 'JA' ? '前の曲' : 'Previous Song'}
                </div>
              </div>

              {/* Play/Pause */}
              <div className="relative group flex items-center justify-center">
                <button 
                  onClick={togglePlay}
                  className="pip-ctrl pip-ctrl-play"
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-current" />
                  ) : (
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  )}
                </button>
                <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[10px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50">
                  {isPlaying 
                    ? (lang === 'KO' ? '일시 정지' : lang === 'JA' ? '一時停止' : 'Pause') 
                    : (lang === 'KO' ? '재생' : lang === 'JA' ? '再生' : 'Play')}
                </div>
              </div>

              {/* Next */}
              <div className="relative group flex items-center justify-center">
                <button onClick={next} className="pip-ctrl">
                  <SkipForward className="w-5 h-5 fill-current" />
                </button>
                <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[10px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50">
                  {lang === 'KO' ? '다음 곡' : lang === 'JA' ? '次の曲' : 'Next Song'}
                </div>
              </div>

              {/* Repeat */}
              <div className="relative group flex items-center justify-center">
                <button 
                  onClick={toggleRepeatMode}
                  className={`pip-ctrl pip-ctrl-toggle pip-ctrl-loop ${repeatMode !== 'off' ? 'is-active' : ''} ${repeatMode === 'one' ? 'mode-one' : ''}`}
                >
                  <Repeat className="w-4.5 h-4.5" />
                  {repeatMode === 'one' && (
                    <span className="pip-loop-one">1</span>
                  )}
                </button>
                <div className="absolute bottom-full mb-2.5 px-2.5 py-1.5 bg-[#18181b] border border-outline-variant/10 text-on-surface text-[10px] font-black rounded-lg shadow-xl whitespace-nowrap opacity-0 group-hover:opacity-100 scale-95 group-hover:scale-100 transition-all duration-150 pointer-events-none z-50">
                  {getRepeatTooltip()}
                </div>
              </div>
            </div>

            {/* Slim Volume Control */}
            <div className="flex items-center gap-3 px-4 w-full mt-4 opacity-40 hover:opacity-85 transition-opacity">
              <button 
                onClick={() => setVolume(volume === 0 ? 1 : 0)}
                className="text-white/60 hover:text-white transition-colors cursor-pointer"
              >
                {volume === 0 ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.01}
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-1 bg-white/20 accent-primary rounded-full cursor-pointer transition-all"
              />
            </div>

          </div>

        </div>

      </div>
    </div>
  );

  return createPortal(pipContent, pipContainerRef.current);
}
