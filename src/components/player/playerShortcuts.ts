import type { RefObject } from 'react';
import { usePlayerStore } from '@/stores/playerStore';

/** 마스터링·가사 시간 찍기처럼 자체 단축키가 있는 화면은 루트에 data-own-shortcuts 를 달면 그 화면이 우선한다. */
export const OWN_SHORTCUTS_ATTR = 'data-own-shortcuts';

export const SHORTCUT_GROUPS: { title: string; items: { keys: string; label: string }[] }[] = [
  { title: '재생', items: [
    { keys: 'Space / K', label: '재생 · 일시정지' },
    { keys: '← / →', label: '5초 뒤로 · 앞으로' },
    { keys: 'J / L', label: '10초 뒤로 · 앞으로' },
    { keys: '0 – 9', label: '0% – 90% 위치로 이동' },
  ] },
  { title: '곡 이동', items: [
    { keys: 'Shift + ← / →', label: '이전 · 다음 곡' },
    { keys: 'Shift + P / N', label: '이전 · 다음 곡' },
  ] },
  { title: '소리·모드', items: [
    { keys: '↑ / ↓', label: '볼륨 ±5%' },
    { keys: 'M', label: '음소거' },
    { keys: 'S', label: '셔플' },
    { keys: 'R', label: '반복 (끔 → 전체 → 한 곡)' },
  ] },
  { title: '화면', items: [
    { keys: 'F', label: '지금 재생 전체 화면 열기 · 닫기' },
    { keys: 'Esc', label: '닫기' },
    { keys: '?', label: '이 단축키 안내' },
  ] },
];

function isEditable(el: Element | null): boolean {
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true;
  const h = el as HTMLElement;
  return !!h.isContentEditable || el.getAttribute('contenteditable') === 'true' || el.hasAttribute('contenteditable') && el.getAttribute('contenteditable') !== 'false';
}

/** 전역 키 처리. 처리했으면 true. */
export function handlePlayerShortcut(e: KeyboardEvent, audioRef: RefObject<HTMLAudioElement | null>): boolean {
  if (e.isComposing || e.keyCode === 229) return false; // 한글 등 IME 조합 중
  if (e.metaKey || e.ctrlKey || e.altKey) return false; // 브라우저·OS 단축키(Cmd+R, Ctrl+F …) 보존
  if (isEditable(e.target as Element | null) || isEditable(document.activeElement)) return false;
  if (document.querySelector(`[${OWN_SHORTCUTS_ATTR}]`)) return false;

  const st = usePlayerStore.getState();
  const key = e.key;
  const lower = key.length === 1 ? key.toLowerCase() : key;
  const blurButton = () => {
    const ae = document.activeElement as HTMLElement | null;
    if (ae && (ae.tagName === 'BUTTON' || ae.getAttribute('role') === 'button')) ae.blur();
  };

  if (key === '?') { e.preventDefault(); st.setShortcutHelpOpen(!st.isShortcutHelpOpen); return true; }
  if (st.isShortcutHelpOpen) return false;
  if (!st.currentTrack) return false;

  const audio = audioRef.current;
  const jump = (delta: number) => {
    const dur = (audio && isFinite(audio.duration) && audio.duration) || st.duration || 0;
    const base = audio ? audio.currentTime : st.currentTime;
    const t = Math.max(0, Math.min(dur || Infinity, base + delta));
    if (audio) audio.currentTime = t;
    st.seek(t);
  };
  // 커버플로 보기는 ←/→ 로 곡을 넘기므로 그 화면이 열려 있으면 맨 방향키는 양보한다
  const coverflow = !!document.querySelector('[data-testid="playlist-coverflow"]');

  if (key === ' ' || e.code === 'Space' || lower === 'k') {
    e.preventDefault();
    if (e.repeat) return true;
    st.togglePlay(); blurButton(); return true;
  }
  if (key === 'ArrowLeft' || key === 'ArrowRight') {
    const fwd = key === 'ArrowRight';
    if (e.shiftKey) { e.preventDefault(); if (!e.repeat) (fwd ? st.next : st.prev)(); return true; }
    if (coverflow) return false;
    e.preventDefault(); jump(fwd ? 5 : -5); return true;
  }
  if (e.shiftKey && (lower === 'n' || lower === 'p')) { e.preventDefault(); if (!e.repeat) (lower === 'n' ? st.next : st.prev)(); return true; }
  if (e.shiftKey) return false;
  if (lower === 'j') { e.preventDefault(); jump(-10); return true; }
  if (lower === 'l') { e.preventDefault(); jump(10); return true; }
  if (key === 'ArrowUp' || key === 'ArrowDown') {
    e.preventDefault();
    const v = Math.round((st.volume + (key === 'ArrowUp' ? 0.05 : -0.05)) * 100) / 100;
    st.setVolume(Math.min(1, Math.max(0, v))); st.bumpVolumeHud(); return true;
  }
  if (lower === 'm') { e.preventDefault(); st.toggleMute(); st.bumpVolumeHud(); return true; }
  if (lower === 's') { e.preventDefault(); st.toggleShuffle(); return true; }
  if (lower === 'r') { e.preventDefault(); st.toggleRepeatMode(); return true; }
  if (lower === 'f') { e.preventDefault(); st.setImmersiveOpen(!st.isImmersiveOpen); blurButton(); return true; }
  if (/^[0-9]$/.test(key)) {
    e.preventDefault();
    const dur = (audio && isFinite(audio.duration) && audio.duration) || st.duration || 0;
    if (dur) { const t = dur * Number(key) / 10; if (audio) audio.currentTime = t; st.seek(t); }
    return true;
  }
  return false;
}
