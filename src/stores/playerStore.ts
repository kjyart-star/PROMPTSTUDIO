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

  playTrack: (track: Track, queue?: Track[]) => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setNowPlayingOpen: (open: boolean) => void;
  
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
    const { queue, queueIndex } = get();
    if (queueIndex < 0 || queueIndex >= queue.length - 1) return;
    const nextTrack = queue[queueIndex + 1];
    set({
      currentTrack: nextTrack,
      queueIndex: queueIndex + 1,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
  },

  prev: () => {
    const { queue, queueIndex, currentTime } = get();
    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0 });
      return;
    }
    if (queueIndex <= 0) return;
    const prevTrack = queue[queueIndex - 1];
    set({
      currentTrack: prevTrack,
      queueIndex: queueIndex - 1,
      isPlaying: true,
      progress: 0,
      currentTime: 0,
      playStartTime: Date.now(),
      hasLoggedPlay: false,
    });
  },

  seek: (time) => {
    set({ currentTime: time });
  },

  setVolume: (volume) => set({ volume, isMuted: volume === 0 }),
  toggleMute: () => set((s) => ({ isMuted: !s.isMuted })),
  setNowPlayingOpen: (open) => set({ isNowPlayingOpen: open }),

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
