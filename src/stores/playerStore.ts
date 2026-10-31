'use client';

import { create } from 'zustand';
import type { Track } from '@/types/music';

const VOLUME_KEY = 'cm.volume';
function saveVolume(v: number, m: boolean) {
  try { localStorage.setItem(VOLUME_KEY, JSON.stringify({ v, m })); } catch { /* private mode */ }
}
/** 저장된 볼륨을 읽어 적용한다(마운트 때 한 번). 표시(HUD)는 띄우지 않는다. */
export function hydrateVolume() {
  try {
    const raw = JSON.parse(localStorage.getItem(VOLUME_KEY) || 'null');
    if (raw && typeof raw.v === 'number') usePlayerStore.setState({ volume: Math.min(1, Math.max(0, raw.v)), isMuted: !!raw.m });
  } catch { /* ignore */ }
}

const MODE_KEY = 'cm.playmode';
function saveMode(shuffle: boolean, repeat: string) {
  try { localStorage.setItem(MODE_KEY, JSON.stringify({ s: shuffle, r: repeat })); } catch { /* private mode */ }
}
/** 현재 곡을 맨 앞에 두고 나머지만 섞는다 */
export function shuffledWithCurrent(queue: Track[], current: Track | null): Track[] {
  const rest = queue.filter((t) => t.id !== current?.id);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return current && queue.some((t) => t.id === current.id) ? [current, ...rest] : rest;
}
/** 저장된 셔플·반복 상태를 읽는다(마운트 때 한 번) */
export function hydratePlayMode() {
  try {
    const raw = JSON.parse(localStorage.getItem(MODE_KEY) || 'null');
    if (raw) usePlayerStore.setState({ isShuffle: !!raw.s, repeatMode: raw.r === 'all' || raw.r === 'one' ? raw.r : 'off' });
  } catch { /* ignore */ }
}

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
  /** 전체 화면 「지금 재생」 */
  isImmersiveOpen: boolean;
  isShortcutHelpOpen: boolean;
  setShortcutHelpOpen: (open: boolean) => void;
  setImmersiveOpen: (open: boolean) => void;

  // Shuffle & Repeat state
  isShuffle: boolean;
  /** 셔플을 켜기 전의 원래 순서 — 끄면 이 순서로 돌아간다 */
  originalQueue: Track[] | null;
  /** 셔플·반복 상태가 바뀔 때 화면 가운데에 잠깐 띄우는 알림 */
  modeNote: { n: number; text: string } | null;
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
  /** 볼륨 표시(HUD)를 다시 띄우라는 신호 — 키보드 조작에서만 올린다 */
  volumeHudTick: number;
  bumpVolumeHud: () => void;
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
  isImmersiveOpen: false,
  isShortcutHelpOpen: false,
  setShortcutHelpOpen: (open) => set({ isShortcutHelpOpen: open }),
  setImmersiveOpen: (open) => set({ isImmersiveOpen: open }),
  isShuffle: false,
  originalQueue: null,
  modeNote: null,
  repeatMode: 'off',
  seekTrigger: null,
  getFrequencyData: null,
  _setGetFrequencyData: (fn) => set({ getFrequencyData: fn }),

  playTrack: (track, queue) => {
    const st = get();
    let newQueue = queue ?? [track];
    let original: Track[] | null = st.originalQueue;
    // 셔플 중에 새 목록을 틀면 그 목록을 섞는다(고른 곡이 맨 앞). 지금 대기열을 그대로 넘기면(커버플로 클릭 등) 순서를 유지한다.
    if (st.isShuffle && newQueue !== st.queue && newQueue.length > 1) {
      original = newQueue;
      newQueue = shuffledWithCurrent(newQueue, track);
    } else if (!st.isShuffle) original = null;
    const newIndex = newQueue.findIndex((t) => t.id === track.id);
    set({
      currentTrack: track,
      queue: newQueue,
      originalQueue: original,
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
    const { queue, queueIndex, repeatMode } = get();
    if (queue.length === 0) return;

    // 셔플은 대기열 자체가 섞인 순서라 앞으로만 가면 된다. 끝에서: 전체 반복이면 처음으로, 아니면 정지
    let nextIndex = -1;
    if (queueIndex < queue.length - 1) nextIndex = queueIndex + 1;
    else if (repeatMode === 'all') nextIndex = 0;

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
    const { queue, queueIndex, currentTime, repeatMode } = get();
    if (queue.length === 0) return;

    if (currentTime > 3) {
      set({ progress: 0, currentTime: 0, seekTrigger: Date.now() });
      return;
    }

    let prevIndex = -1;
    if (queueIndex > 0) prevIndex = queueIndex - 1;
    else if (repeatMode === 'all') prevIndex = queue.length - 1;

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

  volumeHudTick: 0,
  bumpVolumeHud: () => set((s) => ({ volumeHudTick: s.volumeHudTick + 1 })),
  setVolume: (volume) => {
    set({ volume, isMuted: volume === 0 });
    saveVolume(volume, volume === 0);
  },
  toggleMute: () => {
    set((s) => ({ isMuted: !s.isMuted }));
    const s = get(); saveVolume(s.volume, s.isMuted);
  },
  setNowPlayingOpen: (open, persist = true) => {
    if (persist && typeof window !== 'undefined') {
      try { localStorage.setItem(NOW_PLAYING_KEY, open ? '1' : '0'); } catch { /* private mode */ }
    }
    set({ isNowPlayingOpen: open });
  },

  toggleShuffle: () => {
    const st = get();
    const on = !st.isShuffle;
    const cur = st.currentTrack;
    let patch: Partial<PlayerState> = { isShuffle: on, modeNote: { n: (st.modeNote?.n ?? 0) + 1, text: on ? '셔플 켬' : '셔플 끔' } };
    if (on && st.queue.length > 1) {
      const q = shuffledWithCurrent(st.queue, cur);
      patch = { ...patch, originalQueue: st.queue, queue: q, queueIndex: Math.max(0, q.findIndex((t) => t.id === cur?.id)) };
    } else if (!on && st.originalQueue) {
      const q = st.originalQueue;
      patch = { ...patch, originalQueue: null, queue: q, queueIndex: Math.max(0, q.findIndex((t) => t.id === cur?.id)) };
    }
    set(patch);
    saveMode(on, st.repeatMode);
  },
  toggleRepeatMode: () => {
    const st = get();
    const next = ({ off: 'all', all: 'one', one: 'off' } as const)[st.repeatMode];
    set({ repeatMode: next, modeNote: { n: (st.modeNote?.n ?? 0) + 1, text: next === 'all' ? '전체 반복' : next === 'one' ? '한 곡 반복' : '반복 끔' } });
    saveMode(st.isShuffle, next);
  },

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
