'use client';

import { useEffect, useRef } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { binSpectrum } from '@/lib/audio/spectrumTap';

export type SpectrumMode = 'thin' | 'line' | 'mirror';

const N = 96;

/**
 * 전체 화면 하단 스펙트럼 — canvas 하나로 그린다(DPR 반영).
 * 막대 2~3px·둥근 끝·피크 점이 천천히 떨어짐. 주파수 축은 로그(저음이 화면을 다 차지하지 않음),
 * 어택은 빠르고 릴리즈는 느리게 스무딩, 조용하면 거의 평평한 숨결. 색은 커버 색 세로 그라디언트 + 끝 페이드.
 * 화면이 안 보이면(탭 숨김·화면 밖) 그리지 않는다.
 */
export function SpectrumCanvas({ mode, playing, reduced, color, glow = 0.5 }: { mode: SpectrumMode; playing: boolean; reduced: boolean; color: [number, number, number] | null; glow?: number }) {
  const getFrequencyData = usePlayerStore((s) => s.getFrequencyData);
  const ref = useRef<HTMLCanvasElement>(null);
  const live = useRef({ playing, reduced, color, mode, glow, getFrequencyData });
  live.current = { playing, reduced, color, mode, glow, getFrequencyData };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;
    const lv = new Array<number>(N).fill(0);
    const pk = new Array<number>(N).fill(0);
    const hold = new Array<number>(N).fill(0);
    const bins = new Array<number>(N).fill(0);
    let w = 0, h = 0, dpr = 1, raf = 0, visible = true, last = 0;
    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = Math.max(1, Math.round(w * dpr)); cv.height = Math.max(1, Math.round(h * dpr));
    };
    resize();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    ro?.observe(cv);
    const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }) : null;
    io?.observe(cv);

    const rr = (x: number, y: number, bw: number, bh: number) => {
      const r = Math.min(bw / 2, bh / 2);
      g.beginPath();
      if ((g as any).roundRect) (g as any).roundRect(x, y, bw, bh, r); else g.rect(x, y, bw, bh);
      g.fill();
    };

    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (document.hidden || !visible || w < 2) return;
      const dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
      const L = live.current;
      const data = L.playing ? L.getFrequencyData?.() : null;
      if (data) binSpectrum(data, N, bins);
      for (let i = 0; i < N; i++) {
        // 조용할 때는 거의 평평한 숨결
        const breath = L.reduced ? 0.03 : 0.03 + 0.018 * (1 + Math.sin(t / 700 + i * 0.28));
        let want = breath;
        if (data) want = Math.max(breath, Math.pow(bins[i], 1.15) * (0.55 + 0.9 * (i / N) * 0.35));
        else if (L.playing && !L.reduced) want = Math.max(breath, 0.18 + 0.22 * (0.5 + 0.5 * Math.sin(t / 260 + i * 0.5) * Math.cos(t / 610 + i * 0.21)));
        const k = want > lv[i] ? 1 - Math.exp(-dt * 38) : 1 - Math.exp(-dt * 5.5); // 어택 빠르게·릴리즈 느리게
        lv[i] += (want - lv[i]) * k;
        if (lv[i] >= pk[i]) { pk[i] = lv[i]; hold[i] = 0.35; }
        else if (hold[i] > 0) hold[i] -= dt;
        else pk[i] = Math.max(lv[i], pk[i] - dt * 0.28);
      }
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const c = L.color ?? [236, 230, 255];
      const hi = c.map((v) => Math.round(v + (255 - v) * 0.5)).join(',');
      const base = L.mode === 'mirror' ? h * 0.64 : h; // 반사 막대는 기준선을 위로 올린다
      const maxH = base - 4;
      const grad = g.createLinearGradient(0, base - maxH, 0, base);
      grad.addColorStop(0, `rgba(${hi},1)`); grad.addColorStop(0.5, `rgba(${c.join(',')},.9)`); grad.addColorStop(1, `rgba(${c.join(',')},.42)`);
      const step = w / N, bw = Math.max(2, Math.min(3, step * 0.5));
      g.shadowColor = `rgba(${c.join(',')},.8)`;
      g.shadowBlur = 8 * L.glow;
      if (L.mode === 'line') {
        g.beginPath();
        for (let i = 0; i < N; i++) {
          const x = (i + 0.5) * step, y = base - Math.max(1.5, lv[i] * maxH);
          if (i === 0) g.moveTo(x, y); else { const px = (i - 0.5) * step, py = base - Math.max(1.5, lv[i - 1] * maxH); g.quadraticCurveTo(px, py, (px + x) / 2, (py + y) / 2); }
        }
        g.strokeStyle = `rgba(${hi},.95)`; g.lineWidth = 1.6; g.stroke();
        g.shadowBlur = 0;
        g.lineTo(w, base); g.lineTo(0, base); g.closePath();
        const fg = g.createLinearGradient(0, base - maxH, 0, base);
        fg.addColorStop(0, `rgba(${c.join(',')},.35)`); fg.addColorStop(1, `rgba(${c.join(',')},0)`);
        g.fillStyle = fg; g.fill();
        return;
      }
      g.fillStyle = grad;
      for (let i = 0; i < N; i++) {
        const bh = Math.max(bw, lv[i] * maxH);
        rr(i * step + (step - bw) / 2, base - bh, bw, bh);
      }
      g.shadowBlur = 0;
      if (L.mode === 'mirror') { // 바닥에 비친 반사 — 아래로 갈수록 흐려진다
        const rg = g.createLinearGradient(0, base, 0, h);
        rg.addColorStop(0, `rgba(${c.join(',')},.3)`); rg.addColorStop(1, `rgba(${c.join(',')},0)`);
        g.fillStyle = rg;
        for (let i = 0; i < N; i++) {
          const bh = Math.min(h - base - 1, Math.max(bw, lv[i] * maxH) * 0.55);
          rr(i * step + (step - bw) / 2, base + 2, bw, bh);
        }
      }
      // 피크 홀드 점
      g.fillStyle = `rgba(${hi},.9)`;
      for (let i = 0; i < N; i++) {
        if (pk[i] < 0.08) continue;
        g.beginPath(); g.arc(i * step + step / 2, base - pk[i] * maxH - 4, 1.3, 0, Math.PI * 2); g.fill();
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); ro?.disconnect(); io?.disconnect(); };
  }, []);

  return <canvas ref={ref} className={`imm-spec imm-spec-${mode}`} aria-hidden="true" data-testid="spectrum-canvas" />;
}

export const SPEC_CSS = `
.imm-spec{display:block;width:100%;height:64px;margin-bottom:8px}
.imm-spec-mirror{height:92px}
.imm-cassette .imm-spec{display:none}
@media (max-width:820px){.imm-spec{height:44px}.imm-spec-mirror{height:64px}}
`;
