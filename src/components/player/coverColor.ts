'use client';

import { useEffect, useState } from 'react';

/** 커버 이미지의 대표색(평균에서 채도를 살짝 올린 값). CORS 로 못 읽으면 null — 호출자는 기본 색을 쓴다. */
export function useCoverColor(url?: string | null): [number, number, number] | null {
  const [c, setC] = useState<[number, number, number] | null>(null);
  useEffect(() => {
    setC(null);
    if (!url || typeof Image === 'undefined') return;
    let dead = false;
    const img = new Image();
    if (!url.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const cv = document.createElement('canvas');
        cv.width = cv.height = 8;
        const g = cv.getContext('2d', { willReadFrequently: true });
        if (!g) return;
        g.drawImage(img, 0, 0, 8, 8);
        const d = g.getImageData(0, 0, 8, 8).data;
        let r = 0, gg = 0, b = 0, n = 0, wsum = 0;
        for (let i = 0; i < d.length; i += 4) {
          const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]);
          const w = 0.2 + (mx - mn) / 255; // 채도 높은 픽셀에 가중
          r += d[i] * w; gg += d[i + 1] * w; b += d[i + 2] * w; wsum += w; n++;
        }
        if (!n || !wsum) return;
        r /= wsum; gg /= wsum; b /= wsum;
        const avg = (r + gg + b) / 3, k = 1.25; // 채도 보정
        const f = (v: number) => Math.max(40, Math.min(255, Math.round(avg + (v - avg) * k)));
        if (!dead) setC([f(r), f(gg), f(b)]);
      } catch { /* 캔버스 오염(CORS) — 기본 색 사용 */ }
    };
    img.onerror = () => { /* 무시 */ };
    img.src = url;
    return () => { dead = true; };
  }, [url]);
  return c;
}

export const rgba = (c: [number, number, number] | null, a: number, fb = '255,255,255') => `rgba(${c ? c.join(',') : fb},${a})`;
