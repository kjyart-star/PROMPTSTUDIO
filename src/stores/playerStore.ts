'use client';

import { create } from 'zustand';
import type { Track } from '@/types/music';

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playStartTime: number | null;
  hasLoggedPlay: boolean;
  isNowPlayingOpen: boolean;

  // Shuffle & Repeat state
  isShuffle: boolean;
  repeatMode: 'off' | 'all' | 'one';
  seekTrigger: number | null;

  // Audio Analyser support
  getFrequencyData: (() => Uint8Array | null) | null;
  _setGetFrequencyData: (fn: (() => Uint8Array | null) | null) => void;

  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  /** persist=false 는 화면 폭 때문에 접는 경우 — 사용자의 선택을 덮어쓰지 않는다 */
  setNowPlayingOpen: (open: boolean, persist?: boolean) => void;
  
  // Shuffle & Repeat actions
  toggleShuffle: () => void;
  toggleRepeatMode: () => void;
  
  _setIsPlaying: (v: boolean) => void;
  _setProgress: (currentTime: number, duration: number) => void;
  _markPlayLogged: () => void;
  _resetPlayLog: () => void;
}

/** 우측 「지금 재생 중」 패널의 여닫힌 상태 기억용 키 */
export const NOW_PLAYING_KEY = 'cm.now-playing-open';

/* 최근 재생 — 서버에 사용자별 이력 API 가 없어서(play_events 는 집계 전용 쓰기)
   실제로 재생한 곡만 브라우저에 남긴다. 새 큐 시스템을 만들지 않는다. */
const RECENT_KEY = 'cm.recent-tracks';
const RECENT_LIMIT = 20;

export function readRecentTracks(): Track[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function pushRecentTrack(track: Track) {
  if (typeof window === 'undefined' || !track?.id) return;
  try {
    const next = [track, ...readRecentTracks().filter((t) => t.id !== track.id)].slice(0, RECENT_LIMIT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* quota / private mode */ }
}

export const usePlayerStore = create<PlayerState>((set, get) => ({
  currentTrack: null,
  queue: [],
  queueIndex: -1,
  isPlaying: false,
  progress: 0,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isMuted: false,
  playStartTime: null,
  hasLoggedPlay: false,
  isNowPlayingOpen: false,
  isShuffle: false,
  repeatMode: 'off',
  seekTrigger: null,
  getFrequencyData: null,
  _setGetFrequencyData: (fn) => set({ getFrequencyData: fn }),

  playTrack: (track, queue) => {
    const newQueue = queue ?? [track];
    const newIndex = newQueue.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: newQueue,
      queueIndex: newIndex >= 0 ? newIndex : 0,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
    pushRecentTrack(track);
  },

  togglePlay: () => {
    const { currentTrack, isPlaying } = get();
    if (!currentTrack) return;
    set({ isPlaying: !isPlaying });
  },

  next: () => {
    const { queue, queueIndex, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    let nextIndex = -1;
    if (isShuffle && queue.length > 1) {
      nextIndex = queueIndex;
      while (nextIndex === queueIndex) {
        nextIndex = Math.floor(Math.random() * queue.length);
      }
    } else {
      if (queueIndex < queue.length - 1) {
        nextIndex = queueIndex + 1;
      } else if (repeatMode === 'all') {
        nextIndex = 0;
      }
    }

    if (nextIndex >= 0) {
      const nextTrack = queue[nextIndex];
      set({
        currentTrack: nextTrack,
        queueIndex: nextIndex,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        playStartTime: Date.now(),
        hasLoggedPlay: false,
      });
    } else {
      set({ isPlaying: false });
    }
  },

  prev: () => {
    const { queue, queueIndex, currentTime, isShuffle, repeatMode } = get();
    if (queue.length === 0) return;

    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0, seekTrigger: Date.now() });
      return;
    }

    let prevIndex = -1;
    if (isShuffle && queue.length > 1) {
      prevIndex = queueIndex;
      while (prevIndex === queueIndex) {
        prevIndex = Math.floor(Math.random() * queue.length);
      }
    } else {
      if (queueIndex > 0) {
        prevIndex = queueIndex - 1;
      } else if (repeatMode === 'all') {
        prevIndex = queue.length - 1;
      }
    }

    if (prevIndex >= 0) {
      const prevTrack = queue[prevIndex];
      set({
        currentTrack: prevTrack,
        queueIndex: prevIndex,
        isPlaying: true,
        progress: 0,
        currentTime: 0,
        playStartTime: Date.now(),
        hasLoggedPlay: false,
      });
    }
  },

  seek: (time) => {
    set({ currentTime: time, seekTrigger: Date.now() });
  },

  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setNowPlayingOpen: (open, persist = true) => {
    if (persist && typeof window !== 'undefined') {
      try { localStorage.setItem(NOW_PLAYING_KEY, open ? '1' : '0'); } catch { /* private mode */ }
    }
    set({ isNowPlayingOpen: open });
  },

  toggleShuffle: () => set((s) => ({ isShuffle: !s.isShuffle })),
  toggleRepeatMode: () => set((s) => {
    const nextModeMap: Record<'off' | 'all' | 'one', 'off' | 'all' | 'one'> = {
      'off': 'all',
      'all': 'one',
      'one': 'off',
    };
    return { repeatMode: nextModeMap[s.repeatMode] };
  }),

  _setIsPlaying: (v) => set({ isPlaying: v }),
  _setProgress: (currentTime, duration) =>
    set({
      currentTime,
      duration,
      progress: duration > 0 ? currentTime / duration : 0,
    }),
  _markPlayLogged: () => set({ hasLoggedPlay: true }),
  _resetPlayLog: () =>
    set({ playStartTime: Date.now(), hasLoggedPlay: false }),
}));
