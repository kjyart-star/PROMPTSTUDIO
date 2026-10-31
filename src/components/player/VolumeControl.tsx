'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume1, Volume2, VolumeX } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';

export function VolumeIcon({ volume, muted, size = 18 }: { volume: number; muted: boolean; size?: number }) {
  if (muted || volume === 0) return <VolumeX size={size} />;
  return volume < 0.5 ? <Volume1 size={size} /> : <Volume2 size={size} />;
}

/**
 * 스피커 아이콘(누르면 음소거) + 슬라이더. 하단 플레이어와 같은 볼륨 상태를 쓴다.
 * 휠은 이 영역 위에서만 볼륨을 바꾼다(커버플로 휠 넘김과 겹치지 않게 stopPropagation).
 */
export function VolumeControl({ variant = 'bar' }: { variant?: 'bar' | 'deck' }) {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const setVolume = usePlayerStore((s) => s.setVolume);
  const toggleMute = usePlayerStore((s) => s.toggleMute);
  const box = useRef<HTMLDivElement>(null);
  const shown = isMuted ? 0 : volume;
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      const st = usePlayerStore.getState();
      const v = Math.round(((st.isMuted ? 0 : st.volume) + (e.deltaY < 0 ? 0.05 : -0.05)) * 100) / 100;
      st.setVolume(Math.min(1, Math.max(0, v)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  return (
    <div ref={box} className={`vol-ctl vol-${variant}`} data-testid="volume-control">
      <button type="button" onClick={toggleMute} aria-label={isMuted || volume === 0 ? '음소거 해제' : '음소거'} title={isMuted || volume === 0 ? '음소거 해제 (M)' : '음소거 (M)'}>
        <VolumeIcon volume={volume} muted={isMuted} />
      </button>
      <input
        type="range" min={0} max={100} step={1} value={Math.round(shown * 100)}
        onChange={(e) => setVolume(Number(e.target.value) / 100)}
        aria-label="볼륨"
        style={{ ['--p' as any]: `${shown * 100}%` }}
      />
    </div>
  );
}

/** 키보드(↑/↓·M)로 볼륨을 바꿀 때 화면 가운데 위쪽에 1.2초 떠 있는 표시 */
export function VolumeHud() {
  const tick = usePlayerStore((s) => s.volumeHudTick);
  const volume = usePlayerStore((s) => s.volume);
  const muted = usePlayerStore((s) => s.isMuted);
  const [on, setOn] = useState(false);
  useEffect(() => {
    if (!tick) return;
    setOn(true);
    const id = setTimeout(() => setOn(false), 1200);
    return () => clearTimeout(id);
  }, [tick]);
  if (!on) return null;
  const pct = Math.round((muted ? 0 : volume) * 100);
  return (
    <div className="vol-hud" role="status" aria-live="polite" data-testid="volume-hud">
      <style>{VOL_CSS}</style>
      <VolumeIcon volume={volume} muted={muted} size={22} />
      <span className="vol-hud-bar"><i style={{ transform: `scaleX(${pct / 100})` }} /></span>
      <b>{pct}%</b>
    </div>
  );
}

export const VOL_CSS = `
.vol-hud{position:fixed;top:clamp(56px,9vh,96px);left:50%;transform:translateX(-50%);z-index:140;display:flex;align-items:center;gap:12px;padding:10px 16px;border-radius:999px;background:rgba(18,18,20,.82);backdrop-filter:blur(14px);color:#fff;box-shadow:0 10px 30px rgba(0,0,0,.45);pointer-events:none;animation:vol-pop .18s ease-out both}
.vol-hud b{min-width:3ch;font:700 13px/1 inherit;font-variant-numeric:tabular-nums;text-align:right}
.vol-hud-bar{display:block;width:140px;height:5px;border-radius:3px;background:rgba(255,255,255,.22);overflow:hidden}
.vol-hud-bar i{display:block;height:100%;background:#fff;transform-origin:left center;transition:transform .12s ease-out}
@keyframes vol-pop{from{opacity:0;transform:translate(-50%,-6px)}to{opacity:1;transform:translateX(-50%)}}
@media (prefers-reduced-motion:reduce){.vol-hud{animation:none}.vol-hud-bar i{transition:none}}
`;

export const VOL_CTL_CSS = `
.vol-ctl{display:flex;align-items:center;gap:8px;color:#fff}
.vol-ctl button{width:36px;height:36px;border-radius:50%;display:grid;place-items:center;cursor:pointer;color:inherit}
.vol-ctl button:hover{background:rgba(255,255,255,.14)}
.vol-bar input{width:96px;height:4px;-webkit-appearance:none;appearance:none;border-radius:2px;cursor:pointer;background:linear-gradient(90deg,#fff var(--p,0%),rgba(255,255,255,.22) var(--p,0%))}
.vol-bar input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff}
.vol-bar input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
.vol-deck{padding:4px 10px;border-radius:6px;background:#0b0c0a;box-shadow:inset 0 2px 5px rgba(0,0,0,.9),0 1px 0 rgba(255,255,255,.12)}
.vol-deck button{width:28px;height:28px;color:#d9cfae}
.vol-deck input{width:110px;height:6px;-webkit-appearance:none;appearance:none;border-radius:3px;cursor:pointer;background:linear-gradient(90deg,#e4b34a var(--p,0%),#2a2b27 var(--p,0%));box-shadow:inset 0 1px 2px rgba(0,0,0,.8)}
.vol-deck input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:22px;border-radius:3px;background:repeating-linear-gradient(90deg,#cfcbc2 0 2px,#8f8b82 2px 3px);box-shadow:0 2px 4px rgba(0,0,0,.7)}
.vol-deck input::-moz-range-thumb{width:14px;height:22px;border:0;border-radius:3px;background:repeating-linear-gradient(90deg,#cfcbc2 0 2px,#8f8b82 2px 3px)}
`;
