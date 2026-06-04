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
  setNowPlayingOpen: (open: boolean) => void;
  
  // Shuffle & Repeat actions
  toggleShuffle: () => void;
  toggleRepeatMode: () => void;
  
  _setIsPlaying: (v: boolean) => void;
  _setProgress: (currentTime: number, duration: number) => void;
  _markPlayLogged: () => void;
  _resetPlayLog: () => void;
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
  setNowPlayingOpen: (open) => set({ isNowPlayingOpen: open }),

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
