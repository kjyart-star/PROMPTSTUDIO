'use client';

/**
 * 카세트 디자인 — 어두운 방의 나무 책상 위, 데크에 들어간 카세트.
 * 반투명 케이스·나사 4개·손글씨 라벨(곡마다 다른 종이 색)·테이프 창의 두 릴(재생 중 회전, 진행에 따라 왼쪽 릴은 줄고 오른쪽 릴은 늘어남).
 * 아래 기계식 버튼(되감기·재생·빨리감기·정지)은 눌리는 효과와 함께 실제 재생 상태에 연결되고, 카운터 창과 LED 스펙트럼이 있다.
 * 곡이 바뀌면 카세트가 빠지고 새 카세트가 들어간다. 회전·이동은 transform 만 쓴다. 상표는 가상 브랜드만 쓴다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Square, Rewind, FastForward } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { binSpectrum } from '@/lib/audio/spectrumTap';
import { useSpinRamp } from './useSpinRamp';
import { VolumeControl } from './VolumeControl';
import type { Track } from '@/types/music';

const PAPERS = [
  { paper: '#f1e7cb', stripe: '#c8553d', ink: '#2c2a26' },
  { paper: '#e6d2cf', stripe: '#3d6fa8', ink: '#2a2530' },
  { paper: '#d4e2d0', stripe: '#d99a2b', ink: '#22302a' },
  { paper: '#d2dfe9', stripe: '#b8423a', ink: '#1f2a36' },
  { paper: '#efdfa6', stripe: '#2f7d6d', ink: '#33291c' },
  { paper: '#e9cba3', stripe: '#6a4c93', ink: '#35261a' },
];
const hashOf = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const FONT = "'Nanum Pen Script','Gamja Flower','Hi Melody','Segoe Print','Bradley Hand','Comic Sans MS',cursive";
const R_MIN = 14, R_MAX = 26;
const LEDS = 14, SEGS = 7;

function Leds({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  const getFrequencyData = usePlayerStore((s) => s.getFrequencyData);
  const cols = useRef<(HTMLSpanElement | null)[]>([]);
  const level = useRef<number[]>(new Array(LEDS).fill(0));
  useEffect(() => {
    let raf = 0;
    const paint = (t: number) => {
      const data = playing ? getFrequencyData?.() : null;
      const bins = data ? binSpectrum(data, LEDS) : null;
      for (let i = 0; i < LEDS; i++) {
        const want = !playing ? 0 : bins ? bins[i] : reduced ? 0.3 : 0.25 + 0.2 * (1 + Math.sin(t / 240 + i * 0.8));
        level.current[i] += (want - level.current[i]) * (want > level.current[i] ? 0.6 : 0.15);
        const lit = Math.round(Math.min(1, level.current[i] * 1.2) * SEGS);
        const el = cols.current[i];
        if (el) el.style.setProperty('--lit', String(lit));
      }
      raf = requestAnimationFrame(paint);
    };
    paint(0);
    return () => cancelAnimationFrame(raf);
  }, [playing, getFrequencyData, reduced]);
  return (
    <div className="cs-leds" aria-hidden="true">
      {Array.from({ length: LEDS }, (_, i) => (
        <span key={i} ref={(el) => { cols.current[i] = el; }} className="cs-ledcol">
          {Array.from({ length: SEGS }, (_, k) => <i key={k} style={{ ['--k' as any]: k }} />)}
        </span>
      ))}
    </div>
  );
}

function Cassette({ track, progress, playing, reduced, phase }: { track: Track; progress: number; playing: boolean; reduced: boolean; phase: 'in' | 'out' | 'idle' }) {
  const left = useRef<SVGGElement>(null);
  const right = useRef<SVGGElement>(null);
  useSpinRamp([left, right], playing && phase !== 'out', 130, reduced);
  const pal = PAPERS[hashOf(track.id) % PAPERS.length];
  const p = Math.min(1, Math.max(0, progress));
  const rL = Math.sqrt(R_MIN ** 2 + (R_MAX ** 2 - R_MIN ** 2) * (1 - p));
  const rR = Math.sqrt(R_MIN ** 2 + (R_MAX ** 2 - R_MIN ** 2) * p);
  const artist = (track as any).album?.artist?.name ?? '';
  const spokes = [0, 60, 120, 180, 240, 300];
  const reel = (cx: number, ref: React.RefObject<SVGGElement | null>, r: number) => (
    <g>
      <circle cx={cx} cy={105} r={R_MAX} fill="#3b2517" style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${(r / R_MAX).toFixed(4)})`, transition: reduced ? 'none' : 'transform .6s linear' }} />
      <circle cx={cx} cy={105} r={R_MAX} fill="url(#cs-tape-sheen)" style={{ transformBox: 'fill-box', transformOrigin: 'center', transform: `scale(${(r / R_MAX).toFixed(4)})`, transition: reduced ? 'none' : 'transform .6s linear' }} />
      <g ref={ref} style={{ transformBox: 'fill-box', transformOrigin: 'center' }}>
        <circle cx={cx} cy={105} r={12} fill="#e9e6df" stroke="#9c988f" strokeWidth={0.8} />
        {spokes.map((a) => <rect key={a} x={cx - 1.6} y={105 - 12} width={3.2} height={5.2} fill="#55524b" transform={`rotate(${a} ${cx} 105)`} />)}
        <circle cx={cx} cy={105} r={6.2} fill="#24221e" />
      </g>
    </g>
  );
  return (
    <svg className={`cs-cassette cs-${phase}`} viewBox="0 0 400 250" role="img" aria-label={`${track.title} 카세트`}>
      <defs>
        <linearGradient id="cs-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(70,70,76,.78)" /><stop offset=".5" stopColor="rgba(38,38,42,.82)" /><stop offset="1" stopColor="rgba(22,22,25,.88)" />
        </linearGradient>
        <linearGradient id="cs-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.28)" /><stop offset=".35" stopColor="rgba(255,255,255,.04)" /><stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="cs-tape-sheen" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="rgba(255,235,210,.28)" /><stop offset="1" stopColor="rgba(0,0,0,.25)" /></radialGradient>
        <radialGradient id="cs-screw" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#d8d6d0" /><stop offset="1" stopColor="#6c6a64" /></radialGradient>
        <clipPath id="cs-win"><rect x="106" y="74" width="188" height="62" rx="12" /></clipPath>
      </defs>
      <rect x="2" y="2" width="396" height="246" rx="16" fill="url(#cs-body)" stroke="rgba(255,255,255,.28)" strokeWidth="1.5" />
      <rect x="10" y="10" width="380" height="230" rx="11" fill="none" stroke="rgba(255,255,255,.08)" />
      {/* 라벨지 */}
      <rect x="26" y="22" width="348" height="150" rx="7" fill={pal.paper} />
      <rect x="26" y="22" width="348" height="150" rx="7" fill="url(#cs-glass)" opacity=".35" />
      <rect x="26" y="22" width="348" height="14" rx="7" fill={pal.stripe} />
      <rect x="26" y="29" width="348" height="7" fill={pal.stripe} />
      <g stroke="rgba(0,0,0,.12)" strokeWidth=".8">
        <line x1="40" y1="64" x2="360" y2="64" /><line x1="40" y1="146" x2="360" y2="146" /><line x1="40" y1="160" x2="360" y2="160" />
      </g>
      <foreignObject x="40" y="38" width="318" height="34">
        <div style={{ font: `400 25px/1.05 ${FONT}`, color: pal.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', transform: 'rotate(-0.8deg)' }}>{track.title}</div>
      </foreignObject>
      <foreignObject x="40" y="140" width="250" height="24">
        <div style={{ font: `400 18px/1 ${FONT}`, color: pal.ink, opacity: .85, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{artist}</div>
      </foreignObject>
      <circle cx="338" cy="150" r="13" fill="none" stroke={pal.ink} strokeWidth="1.6" opacity=".8" />
      <text x="338" y="156" textAnchor="middle" fontFamily={FONT} fontSize="19" fill={pal.ink} opacity=".9">A</text>
      <text x="300" y="155" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="8.5" letterSpacing="1.5" fill={pal.ink} opacity=".55">COOKIE TAPE · 90</text>
      {/* 테이프 창 */}
      <rect x="106" y="74" width="188" height="62" rx="12" fill="#0b0908" />
      <g clipPath="url(#cs-win)">
        {reel(150, left, rL)}
        {reel(250, right, rR)}
        <rect x="106" y="126" width="188" height="1.6" fill="#2a1a10" />
      </g>
      <rect x="106" y="74" width="188" height="62" rx="12" fill="url(#cs-glass)" />
      <rect x="106" y="74" width="188" height="62" rx="12" fill="none" stroke="rgba(0,0,0,.55)" strokeWidth="2" />
      {/* 아랫부분 — 헤드 구멍 */}
      <path d="M70 250 L96 184 H304 L330 250 Z" fill="rgba(10,10,12,.55)" stroke="rgba(255,255,255,.12)" />
      <rect x="170" y="196" width="60" height="16" rx="3" fill="rgba(0,0,0,.55)" />
      <circle cx="132" cy="205" r="6" fill="rgba(0,0,0,.65)" /><circle cx="268" cy="205" r="6" fill="rgba(0,0,0,.65)" />
      {[[16, 16], [384, 16], [16, 234], [384, 234]].map(([x, y]) => (
        <g key={`${x}${y}`}><circle cx={x} cy={y} r="6.2" fill="url(#cs-screw)" stroke="rgba(0,0,0,.4)" /><line x1={x - 3.6} y1={y + 1.2} x2={x + 3.6} y2={y - 1.2} stroke="#3c3a35" strokeWidth="1.4" /></g>
      ))}
      <rect x="2" y="2" width="396" height="246" rx="16" fill="url(#cs-glass)" opacity=".5" />
    </svg>
  );
}

export function CassettePlayer({ reduced }: { reduced: boolean }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);

  // 곡이 바뀌면 카세트가 빠지고(out) 새 카세트가 들어온다(in)
  const [shown, setShown] = useState<Track | null>(currentTrack);
  const [phase, setPhase] = useState<'in' | 'out' | 'idle'>('idle');
  useEffect(() => {
    if (!currentTrack) return;
    if (!shown || shown.id === currentTrack.id) { if (!shown) setShown(currentTrack); return; }
    if (reduced) { setShown(currentTrack); return; }
    setPhase('out');
    const a = setTimeout(() => { setShown(currentTrack); setPhase('in'); }, 300);
    const b = setTimeout(() => setPhase('idle'), 300 + 560);
    return () => { clearTimeout(a); clearTimeout(b); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTrack?.id, reduced]);

  useEffect(() => { // 손글씨 글꼴(없으면 시스템 필기체로 대체)
    if (document.getElementById('cs-font')) return;
    const l = document.createElement('link');
    l.id = 'cs-font'; l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=Nanum+Pen+Script&display=swap';
    document.head.appendChild(l);
  }, []);

  const dur = duration || currentTrack?.duration_sec || 0;
  const progress = dur ? currentTime / dur : 0;
  const counter = String(Math.min(999, Math.floor(currentTime))).padStart(3, '0');

  const [pressed, setPressed] = useState<'rew' | 'ff' | null>(null);
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval> }>({});
  const jump = (d: number) => {
    const s = usePlayerStore.getState();
    const total = s.duration || dur || Infinity;
    seek(Math.max(0, Math.min(total, s.currentTime + d)));
  };
  const stopHold = () => { clearTimeout(hold.current.t); clearInterval(hold.current.i); setPressed(null); };
  useEffect(() => stopHold, []);
  const startHold = (d: number, key: 'rew' | 'ff') => (e: React.PointerEvent) => {
    e.preventDefault();
    setPressed(key); jump(d);
    hold.current.t = setTimeout(() => { hold.current.i = setInterval(() => jump(d * 0.6), 140); }, 320);
  };
  const keyClick = (d: number, key: 'rew' | 'ff') => (e: React.MouseEvent) => {
    if (e.detail !== 0) return; // 마우스는 pointerdown 에서 처리, 키보드 활성화만 여기서
    jump(d * 2); setPressed(key); setTimeout(() => setPressed(null), 160);
  };
  // 실제 데크처럼: 두 번째 버튼은 재생/일시정지 토글, 눌림은 재생 중일 때만. 정지는 처음으로 돌아가 멈춘다.
  const playPause = () => togglePlay();
  const stop = () => { if (usePlayerStore.getState().isPlaying) togglePlay(); seek(0); };

  if (!shown) return null;
  return (
    <main className="cs-wrap" data-testid="cassette-player">
      <div className="cs-deck">
        <div className="cs-bay">
          <Cassette track={shown} progress={progress} playing={isPlaying} reduced={reduced} phase={phase} />
          <div className="cs-lid" aria-hidden="true" />
        </div>
        <div className="cs-panel">
          <div className="cs-counter" aria-label="카운터"><span className="cs-cnt">{counter}</span></div>
          <Leds playing={isPlaying} reduced={reduced} />
          <div className="cs-vol"><VolumeControl variant="deck" /></div>
          <div className="cs-keys" role="group" aria-label="카세트 버튼">
            <button type="button" className={`cs-key${pressed === 'rew' ? ' is-down' : ''}`} aria-label="되감기" onPointerDown={startHold(-5, 'rew')} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyClick(-5, 'rew')}><Rewind size={16} /></button>
            <button type="button" className={`cs-key${isPlaying ? ' is-down' : ''}`} aria-label={isPlaying ? '일시정지' : '재생'} aria-pressed={isPlaying} onClick={playPause}>{isPlaying ? <Pause size={16} /> : <Play size={16} />}</button>
            <button type="button" className={`cs-key${pressed === 'ff' ? ' is-down' : ''}`} aria-label="빨리감기" onPointerDown={startHold(5, 'ff')} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyClick(5, 'ff')}><FastForward size={16} /></button>
            <button type="button" className="cs-key" aria-label="정지" onClick={stop}><Square size={15} /></button>
          </div>
        </div>
      </div>
    </main>
  );
}

export const CS_CSS = `
.imm-cassette .imm-veil{background:radial-gradient(ellipse at 30% 0%,rgba(255,196,120,.16),transparent 55%),radial-gradient(ellipse at 50% 55%,transparent 30%,rgba(0,0,0,.72) 100%)}
.cs-woodbg{position:absolute;inset:0;pointer-events:none;background:
 repeating-linear-gradient(92deg,rgba(0,0,0,0) 0 7px,rgba(20,10,4,.34) 7px 9px,rgba(0,0,0,0) 8px 21px,rgba(255,200,140,.05) 21px 23px),
 repeating-linear-gradient(88deg,rgba(0,0,0,0) 0 41px,rgba(10,5,2,.36) 41px 44px),
 linear-gradient(180deg,rgba(74,45,24,.9),rgba(42,25,13,.94));opacity:.86;mix-blend-mode:multiply}
.cs-wrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 16px;perspective:1200px}
.cs-deck{--cw:min(88vw,540px,calc(44vh * 1.6));width:var(--cw);display:flex;flex-direction:column;gap:0;filter:drop-shadow(0 30px 40px rgba(0,0,0,.6))}
.cs-bay{position:relative;padding:3.2% 3.2% 2.6%;border-radius:14px 14px 4px 4px;background:linear-gradient(180deg,#2c2c30,#17171a);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 2px 8px rgba(0,0,0,.8),inset 0 -1px 0 rgba(255,255,255,.06);overflow:hidden}
.cs-cassette{display:block;width:100%;height:auto;will-change:transform,opacity;filter:drop-shadow(0 8px 10px rgba(0,0,0,.55))}
.cs-lid{position:absolute;inset:0;border-radius:inherit;pointer-events:none;background:linear-gradient(115deg,rgba(255,255,255,.14),rgba(255,255,255,.02) 38%,rgba(255,255,255,0) 60%,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.cs-out{animation:cs-eject .3s cubic-bezier(.5,0,.9,.6) forwards}
.cs-in{animation:cs-insert .56s cubic-bezier(.2,.8,.2,1) both}
@keyframes cs-eject{to{transform:translateY(-34%) rotateX(18deg);opacity:0}}
@keyframes cs-insert{0%{transform:translateY(-38%) rotateX(18deg);opacity:0}55%{opacity:1}78%{transform:translateY(3%)}100%{transform:none;opacity:1}}
.cs-panel{display:grid;grid-template-columns:auto 1fr;grid-template-rows:auto auto;gap:10px 14px;align-items:center;padding:12px 14px 14px;border-radius:4px 4px 14px 14px;background:linear-gradient(180deg,#3a3a3f,#232326 40%,#1a1a1d);border:1px solid rgba(255,255,255,.12);border-top:none;box-shadow:inset 0 1px 0 rgba(255,255,255,.1)}
.cs-counter{padding:5px 8px;border-radius:5px;background:#0b0c0a;box-shadow:inset 0 2px 5px rgba(0,0,0,.9),0 1px 0 rgba(255,255,255,.12)}
.cs-cnt{font:700 22px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.14em;color:#e8dfc4;text-shadow:0 0 6px rgba(232,223,196,.35)}
.cs-leds{display:flex;gap:3px;justify-content:flex-end;height:36px;align-items:flex-end}
.cs-ledcol{--lit:0;display:flex;flex-direction:column-reverse;gap:2px;width:100%;max-width:14px;height:100%}
.cs-ledcol i{position:relative;flex:1;border-radius:1px;background:#262826}
.cs-ledcol i::before{content:'';position:absolute;inset:0;border-radius:1px;background:var(--c);box-shadow:0 0 5px var(--c);opacity:clamp(0,calc((var(--lit) - var(--k)) * 1000),1)}
.cs-ledcol i:nth-child(1){--c:#3fd36b}.cs-ledcol i:nth-child(2){--c:#3fd36b}.cs-ledcol i:nth-child(3){--c:#3fd36b}.cs-ledcol i:nth-child(4){--c:#9bd93a}.cs-ledcol i:nth-child(5){--c:#e4d234}.cs-ledcol i:nth-child(6){--c:#ef8a2c}.cs-ledcol i:nth-child(7){--c:#e5412f}
.cs-vol{grid-column:1/-1;justify-self:end}
.cs-keys{grid-column:1/-1;display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.cs-key{height:46px;border-radius:5px 5px 3px 3px;display:grid;place-items:center;color:#222;cursor:pointer;background:linear-gradient(180deg,#d9d6cf,#aaa69d 55%,#8f8b82);box-shadow:0 5px 0 #4a4843,0 7px 8px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.7);transition:transform .08s ease-out,box-shadow .08s ease-out;will-change:transform}
.cs-key.is-down{transform:translateY(4px);box-shadow:0 1px 0 #4a4843,0 2px 3px rgba(0,0,0,.6),inset 0 2px 4px rgba(0,0,0,.35);background:linear-gradient(180deg,#b9b5ac,#9a968d)}
.cs-key:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (prefers-reduced-motion:reduce){.cs-in,.cs-out{animation:none}.cs-key{transition:none}}
`;
