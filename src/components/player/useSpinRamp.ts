'use client';

import { useEffect, useRef, type RefObject } from 'react';

/**
 * 재생 중에는 목표 속도까지 서서히 가속하고, 멈추면 서서히 감속해 멈추는 회전(transform: rotate 만 사용).
 * dps = 초당 도(33⅓rpm ≈ 200°/s). reduced 이면 돌리지 않는다.
 */
export function useSpinRamp(refs: RefObject<HTMLElement | SVGElement | null>[], playing: boolean, dps: number, reduced: boolean, counter?: RefObject<HTMLElement | SVGElement | null>[]) {
  const st = useRef({ angle: 0, omega: 0, playing, raf: 0, last: 0 });
  st.current.playing = playing;
  useEffect(() => {
    const s = st.current;
    if (reduced) {
      [...refs, ...(counter ?? [])].forEach((r) => { if (r.current) r.current.style.transform = 'none'; });
      return;
    }
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - s.last) / 1000 || 0.016);
      s.last = now;
      const target = s.playing ? dps : 0;
      s.omega += (target - s.omega) * (1 - Math.exp(-dt * 1.7)); // 가속·감속 시정수 약 0.6초
      if (!s.playing && Math.abs(s.omega) < 0.4) s.omega = 0;
      s.angle = (s.angle + s.omega * dt) % 360;
      refs.forEach((r) => { if (r.current) r.current.style.transform = `rotate(${s.angle.toFixed(2)}deg)`; });
      counter?.forEach((r) => { if (r.current) r.current.style.transform = `rotate(${(-s.angle).toFixed(2)}deg)`; });
      s.raf = s.omega !== 0 || s.playing ? requestAnimationFrame(tick) : 0;
    };
    if (!s.raf && (playing || s.omega !== 0)) { s.last = performance.now(); s.raf = requestAnimationFrame(tick); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, reduced, dps]);
  useEffect(() => () => { if (st.current.raf) cancelAnimationFrame(st.current.raf); st.current.raf = 0; }, []);
}

export function usePrefersReducedMotionHook(): boolean {
  const ref = useRef(false);
  if (typeof window !== 'undefined' && window.matchMedia) ref.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return ref.current;
}
