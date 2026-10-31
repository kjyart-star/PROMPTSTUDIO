'use client';

import { useEffect, useRef, useState } from 'react';
import { useSpinRamp, usePrefersReducedMotionHook } from './useSpinRamp';

/**
 * 커버 뒤에서 반쯤 미끄러져 나오는 LP 판. 부모는 position:relative + isolation:isolate 여야 한다(판은 z-index:-1).
 * 재생 중 33⅓rpm(1.8초에 한 바퀴)으로 돌고, 멈추면 서서히 감속한다. 홈 무늬는 돌고 반사광은 고정이라 입체감이 난다.
 * out = 커버 오른쪽 끝 밖으로 나온 비율(판 지름 기준). 회전은 transform 만 쓴다.
 */
export function LpDisc({ playing, label, out = 0.45, size = 0.96 }: { playing: boolean; label?: string | null; out?: number; size?: number }) {
  const spin = useRef<HTMLSpanElement>(null);
  const reduced = usePrefersReducedMotionHook();
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (reduced) { setShown(true); return; }
    const id = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);
  useSpinRamp([spin], playing, 200, reduced);
  const pct = 100 * size;
  return (
    <span
      aria-hidden
      data-testid="lp-disc"
      style={{
        position: 'absolute', top: '50%', right: 0, width: `${pct}%`, aspectRatio: '1', zIndex: -1, pointerEvents: 'none',
        transform: `translate(${shown ? out * 100 : 0}%,-50%)`,
        transition: reduced ? 'none' : 'transform 1s cubic-bezier(.2,.9,.25,1)', willChange: 'transform',
      }}
    >
      <span ref={spin} style={{ position: 'absolute', inset: 0, borderRadius: '50%', willChange: 'transform',
        background: 'repeating-radial-gradient(circle at 50% 50%, #151517 0 1.2%, #0b0b0c 1.2% 2.1%)',
        boxShadow: '0 6px 18px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.08)' }}>
        <span style={{ position: 'absolute', inset: '33%', borderRadius: '50%', overflow: 'hidden', background: '#2b2b30', boxShadow: '0 0 0 2px rgba(0,0,0,.6)' }}>
          {label && <span style={{ position: 'absolute', inset: 0, backgroundImage: `url("${label}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />}
        </span>
        <span style={{ position: 'absolute', left: '48.5%', top: '48.5%', width: '3%', height: '3%', borderRadius: '50%', background: '#050505' }} />
      </span>
      {/* 고정 반사광 — 판은 돌지만 빛은 제자리에 있다 */}
      <span style={{ position: 'absolute', inset: 0, borderRadius: '50%',
        background: 'conic-gradient(from 20deg, transparent 0deg 22deg, rgba(255,255,255,.2) 40deg, transparent 62deg 200deg, rgba(255,255,255,.14) 220deg, transparent 242deg 360deg)',
        mixBlendMode: 'screen' }} />
    </span>
  );
}
