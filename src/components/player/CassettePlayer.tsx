'use client';

/**
 * 카세트 디자인 — 어두운 방의 나무 책상 위, 데크에 들어간 카세트.
 * 반투명 케이스·나사 4개·손글씨 라벨(곡마다 다른 종이 색)·테이프 창의 두 릴(재생 중 회전, 진행에 따라 왼쪽 릴은 줄고 오른쪽 릴은 늘어남).
 * 아래 기계식 버튼(되감기·재생·빨리감기·정지)은 눌리는 효과와 함께 실제 재생 상태에 연결되고, 카운터 창과 LED 스펙트럼이 있다.
 * 곡이 바뀌면 카세트가 빠지고 새 카세트가 들어간다. 회전·이동은 transform 만 쓴다. 상표는 가상 브랜드만 쓴다.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, Square, SkipBack, SkipForward, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { binSpectrum } from '@/lib/audio/spectrumTap';
import { useSpinRamp } from './useSpinRamp';
import { VolumeControl } from './VolumeControl';
import { useCoverColor, rgba } from './coverColor';
import { withBase } from '@/lib/basePath';
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
const SEGS = 20;
const SCALE = [['-40', 4], ['-20', 28], ['-10', 52], ['-6', 66], ['-3', 78], ['0', 88], ['+3', 98]] as const;

/** 세그먼트 LED 레벨미터(L/R 2줄) — 어택 빠르게·감쇠 부드럽게, 피크 LED 는 잠깐 붙잡았다가 천천히 떨어진다 */
function Leds({ playing, reduced }: { playing: boolean; reduced: boolean }) {
  const getFrequencyData = usePlayerStore((s) => s.getFrequencyData);
  const rows = useRef<(HTMLSpanElement | null)[]>([]);
  const level = useRef([0, 0]);
  const peak = useRef([0, 0]);
  const hold = useRef([0, 0]);
  useEffect(() => {
    let raf = 0;
    const paint = (t: number) => {
      const data = playing ? getFrequencyData?.() : null;
      const bins = data ? binSpectrum(data, 24) : null;
      for (let r = 0; r < 2; r++) {
        let want = 0;
        if (playing) {
          if (bins) { let sum = 0, wsum = 0; for (let i = 0; i < 24; i++) { const w = r === 0 ? 1.4 - i / 24 : 0.6 + i / 24; sum += bins[i] * w; wsum += w; } want = (sum / wsum) * 2.1; }
          else want = reduced ? 0.4 : 0.35 + 0.25 * Math.sin(t / (210 + r * 70)) * Math.cos(t / 530);
        }
        level.current[r] += (want - level.current[r]) * (want > level.current[r] ? 0.5 : 0.07);
        const lvl = Math.max(0, Math.min(1, level.current[r]));
        if (lvl >= peak.current[r]) { peak.current[r] = lvl; hold.current[r] = 30; }
        else if (hold.current[r] > 0) hold.current[r]--;
        else peak.current[r] = Math.max(lvl, peak.current[r] - 0.008);
        const el = rows.current[r];
        if (el) { el.style.setProperty('--lit', (lvl * SEGS).toFixed(2)); el.style.setProperty('--peak', String(Math.max(1, Math.ceil(peak.current[r] * SEGS)))); }
      }
      raf = requestAnimationFrame(paint);
    };
    paint(0);
    return () => cancelAnimationFrame(raf);
  }, [playing, getFrequencyData, reduced]);
  return (
    <div className="cs-meter" aria-hidden="true">
      {['L', 'R'].map((ch, r) => (
        <div key={ch} className="cs-mrow">
          <b className="cs-eng">{ch}</b>
          <span ref={(el) => { rows.current[r] = el; }} className="cs-seg">
            {Array.from({ length: SEGS }, (_, k) => <i key={k} style={{ ['--k' as any]: k }} />)}
          </span>
        </div>
      ))}
      <div className="cs-scale">{SCALE.map(([t, x]) => <span key={t} style={{ left: `${x}%` }}>{t}</span>)}<em>dB</em></div>
    </div>
  );
}

/** 볼륨 로터리 노브 — 위아래로 드래그, 휠, ↑/↓ 키로 조절하고 누르면 음소거 */
function DeckKnob() {
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; v: number; moved: boolean } | null>(null);
  const shown = isMuted ? 0 : volume;
  const set = (v: number) => usePlayerStore.getState().setVolume(Math.min(1, Math.max(0, Math.round(v * 100) / 100)));
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => { e.preventDefault(); e.stopPropagation(); const st = usePlayerStore.getState(); set((st.isMuted ? 0 : st.volume) + (e.deltaY < 0 ? 0.05 : -0.05)); };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  const angle = -135 + 270 * shown;
  return (
    <div className="cs-knobbox">
      <div
        ref={ref} className="cs-knob" role="slider" tabIndex={0} aria-label="볼륨" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(shown * 100)}
        onPointerDown={(e) => { drag.current = { y: e.clientY, v: shown, moved: false }; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* jsdom */ } }}
        onPointerMove={(e) => { const d = drag.current; if (!d) return; const dy = d.y - e.clientY; if (Math.abs(dy) > 3) d.moved = true; if (d.moved) set(d.v + dy / 140); }}
        onPointerUp={() => { const d = drag.current; drag.current = null; if (d && !d.moved) usePlayerStore.getState().toggleMute(); }}
        onKeyDown={(e) => {
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); e.stopPropagation(); set(shown + (e.key === 'ArrowUp' ? 0.05 : -0.05)); usePlayerStore.getState().bumpVolumeHud(); }
        }}
      >
        <svg viewBox="0 0 100 100" className="cs-ticks" aria-hidden="true">
          {Array.from({ length: 11 }, (_, i) => { const a = (-135 + i * 27) * Math.PI / 180; return <line key={i} x1={50 + 41 * Math.sin(a)} y1={50 - 41 * Math.cos(a)} x2={50 + 47 * Math.sin(a)} y2={50 - 47 * Math.cos(a)} stroke={i <= shown * 10 + 0.01 ? '#e4b34a' : '#7b7d83'} strokeWidth={i % 5 === 0 ? 2.2 : 1.3} strokeLinecap="round" />; })}
        </svg>
        <span className="cs-cap" style={{ transform: `rotate(${angle}deg)` }}><i /></span>
      </div>
      <b className="cs-eng">{isMuted ? 'MUTE' : 'VOL'}</b>
    </div>
  );
}

type Phase = 'idle' | 'opening' | 'out' | 'in' | 'closing';
type Flow = 'play' | 'ff' | 'rew' | 'off';

function Cassette({ track, progress, playing, reduced, phase, flow, color }: { track: Track; progress: number; playing: boolean; reduced: boolean; phase: Phase; flow: Flow; color: [number, number, number] | null }) {
  const left = useRef<SVGGElement>(null);
  const right = useRef<SVGGElement>(null);
  const fast = flow === 'ff' || flow === 'rew';
  useSpinRamp([left, right], (playing || fast) && phase !== 'out', flow === 'ff' ? 900 : flow === 'rew' ? -900 : 130, reduced);
  const base = PAPERS[hashOf(track.id) % PAPERS.length];
  const pal = color ? { ...base, stripe: `rgb(${color.join(',')})` } : base;
  const cover = (track as any).album?.cover_url || (track as any).image_url || withBase('/default-album.png');
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
    <svg className={`cs-cassette cs-p-${phase}`} viewBox="0 0 400 250" role="img" aria-label={`${track.title} 카세트`}>
      <defs>
        <linearGradient id="cs-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="rgba(70,70,76,.78)" /><stop offset=".5" stopColor="rgba(38,38,42,.82)" /><stop offset="1" stopColor="rgba(22,22,25,.88)" />
        </linearGradient>
        <linearGradient id="cs-glass" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgba(255,255,255,.28)" /><stop offset=".35" stopColor="rgba(255,255,255,.04)" /><stop offset="1" stopColor="rgba(255,255,255,0)" />
        </linearGradient>
        <radialGradient id="cs-tape-sheen" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="rgba(255,235,210,.28)" /><stop offset="1" stopColor="rgba(0,0,0,.25)" /></radialGradient>
        <radialGradient id="cs-screw" cx=".35" cy=".3" r=".8"><stop offset="0" stopColor="#d8d6d0" /><stop offset="1" stopColor="#6c6a64" /></radialGradient>
        <pattern id="cs-tape-tex" width="9" height="5" patternUnits="userSpaceOnUse">
          <rect width="9" height="5" fill="#3b2517" /><rect x="0" y="0" width="3" height="5" fill="#523520" /><rect x="6" y="1" width="1.2" height="3" fill="#2a190e" />
        </pattern>
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
 {/* 폴라로이드 스티커 — 앨범 커버 */}
      <g transform="rotate(-5 66 100)">
        <rect x="38" y="70" width="58" height="68" rx="2" fill="#fbf8ef" stroke="rgba(0,0,0,.25)" strokeWidth=".6" />
        <image href={cover} x="42" y="74" width="50" height="50" preserveAspectRatio="xMidYMid slice" />
        <rect x="42" y="74" width="50" height="50" fill="url(#cs-glass)" opacity=".5" />
        <rect x="46" y="129" width="30" height="1.4" fill="rgba(0,0,0,.28)" />
      </g>
      <circle cx="338" cy="150" r="13" fill="none" stroke={pal.ink} strokeWidth="1.6" opacity=".8" />
      <text x="338" y="156" textAnchor="middle" fontFamily={FONT} fontSize="19" fill={pal.ink} opacity=".9">A</text>
      <text x="300" y="155" textAnchor="end" fontFamily="ui-monospace,monospace" fontSize="8.5" letterSpacing="1.5" fill={pal.ink} opacity=".55">COOKIE TAPE · 90</text>
      {/* 테이프 창 */}
      <rect x="106" y="74" width="188" height="62" rx="12" fill="#0b0908" />
      <g clipPath="url(#cs-win)">
        {reel(150, left, rL)}
        {reel(250, right, rR)}
        <g className={`cs-flow cs-flow-${flow}`}>
          <rect x="130" y="118" width="280" height="5" fill="url(#cs-tape-tex)" />
        </g>
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

/** 스피커용 저음·고음 크기(0~1). 분석값이 없으면 재생 중에는 가짜 박동, 멈추면 0. */
function useBands(ref: React.RefObject<HTMLElement | null>, playing: boolean, reduced: boolean) {
  const getFrequencyData = usePlayerStore((s) => s.getFrequencyData);
  useEffect(() => {
    let raf = 0, bass = 0, treb = 0;
    const tick = (t: number) => {
      const data = playing ? getFrequencyData?.() : null;
      let wb = 0, wt = 0;
      if (data) { const b = binSpectrum(data, 16); wb = Math.max(b[0], b[1], b[2]); wt = (b[11] + b[12] + b[13] + b[14] + b[15]) / 5; }
      else if (playing && !reduced) { wb = 0.35 + 0.3 * Math.max(0, Math.sin(t / 230)); wt = 0.2 + 0.2 * Math.max(0, Math.sin(t / 97)); }
      bass += (wb - bass) * (wb > bass ? 0.6 : 0.14);
      treb += (wt - treb) * (wt > treb ? 0.6 : 0.2);
      const el = ref.current;
      if (el) { el.style.setProperty('--bass', reduced ? '0' : bass.toFixed(3)); el.style.setProperty('--treb', reduced ? '0' : treb.toFixed(3)); }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, getFrequencyData, reduced, ref]);
}

/** 북쉘프 스피커 — 월넛 인클로저, 그릴을 뗀 우퍼·트위터(고무 엣지·더스트캡). 저음에 우퍼, 고음에 트위터가 미세하게 펌핑한다. */
function Speaker({ side }: { side: 'l' | 'r' }) {
  return (
    <div className={`cs-spk cs-spk-${side}`} aria-hidden="true">
      <div className="cs-spk-body">
        <div className="cs-baffle">
          <span className="cs-tweeter"><i /></span>
          <span className="cs-woofer"><span className="cs-edge"><i className="cs-cone"><b /></i></span></span>
          <span className="cs-led" />
        </div>
      </div>
      <span className="cs-spk-shadow" />
    </div>
  );
}

export function CassettePlayer({ reduced }: { reduced: boolean }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const togglePlay = usePlayerStore((s) => s.togglePlay);
  const seek = usePlayerStore((s) => s.seek);
  const isShuffle = usePlayerStore((s) => s.isShuffle);
  const repeatMode = usePlayerStore((s) => s.repeatMode);
  const toggleShuffle = usePlayerStore((s) => s.toggleShuffle);
  const toggleRepeatMode = usePlayerStore((s) => s.toggleRepeatMode);

  // 곡이 바뀌면 카세트가 빠지고(out) 새 카세트가 들어온다(in)
  const [shown, setShown] = useState<Track | null>(currentTrack);
  const [phase, setPhase] = useState<Phase>('idle');
  useEffect(() => {
    if (!currentTrack) return;
    if (!shown || shown.id === currentTrack.id) { if (!shown) setShown(currentTrack); return; }
    if (reduced) { setShown(currentTrack); return; }
    // 약 1.2초: 문이 열리고 → 카세트가 튀어나오고 → 새 카세트가 미끄러져 들어가고 → 문이 딸깍 닫힌다
    setPhase('opening');
    const t1 = setTimeout(() => setPhase('out'), 280);
    const t2 = setTimeout(() => { setShown(currentTrack); setPhase('in'); }, 560);
    const t3 = setTimeout(() => setPhase('closing'), 980);
    const t4 = setTimeout(() => setPhase('idle'), 1200);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
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
  const [zero, setZero] = useState(0);
  const counter = String(Math.min(999, Math.max(0, Math.floor(currentTime - zero)))).padStart(3, '0');

  const [pressed, setPressed] = useState<'rew' | 'ff' | null>(null);
  const hold = useRef<{ t?: ReturnType<typeof setTimeout>; i?: ReturnType<typeof setInterval>; down?: boolean }>({});
  const jump = (d: number) => {
    const s = usePlayerStore.getState();
    const total = s.duration || dur || Infinity;
    seek(Math.max(0, Math.min(total, s.currentTime + d)));
  };
  const stopHold = () => { clearTimeout(hold.current.t); clearInterval(hold.current.i); hold.current.t = undefined; hold.current.i = undefined; setPressed(null); };
  useEffect(() => stopHold, []);
  // 짧게 누르면 이전·다음 곡(이전 곡은 3초 넘게 들었으면 먼저 처음으로 — 스토어 prev 가 처리), 0.5초 넘게 누르면 고속 되감기·빨리감기
  const heldFast = useRef(false);
  const startHold = (d: number, key: 'rew' | 'ff') => (e: React.PointerEvent) => {
    e.preventDefault();
    heldFast.current = false; hold.current.down = true;
    hold.current.t = setTimeout(() => {
      heldFast.current = true;
      setPressed(key);
      hold.current.i = setInterval(() => jump(d * 2), 120);
    }, 500);
  };
  const endHold = (step: () => void) => () => {
    const wasFast = heldFast.current;
    const pending = !!hold.current.t;
    stopHold();
    if (!wasFast && pending && hold.current.down) step();
    hold.current.down = false;
  };
  const keyClick = (step: () => void, key: 'rew' | 'ff') => (e: React.MouseEvent) => {
    if (e.detail !== 0) return; // 마우스는 pointer 이벤트에서 처리, 키보드 활성화만 여기서
    step(); setPressed(key); setTimeout(() => setPressed(null), 160);
  };
  const goPrev = () => usePlayerStore.getState().prev();
  const goNext = () => usePlayerStore.getState().next();
  // 실제 데크처럼: 두 번째 버튼은 재생/일시정지 토글, 눌림은 재생 중일 때만. 정지는 처음으로 돌아가 멈춘다.
  const playPause = () => togglePlay();
  const stop = () => { if (usePlayerStore.getState().isPlaying) togglePlay(); seek(0); };

  const setRef = useRef<HTMLDivElement>(null);
  useBands(setRef, isPlaying, reduced);
  const color = useCoverColor((shown as any)?.album?.cover_url || (shown as any)?.image_url);
  const flow: Flow = pressed === 'ff' ? 'ff' : pressed === 'rew' ? 'rew' : isPlaying ? 'play' : 'off';

  if (!shown) return null;
  const open = phase === 'opening' || phase === 'out' || phase === 'in';
  return (
    <main className="cs-wrap" data-testid="cassette-player" style={{ ['--cc' as any]: rgba(color, 1, '255,196,120') }}>
      <div className="cs-glow" aria-hidden="true" style={{ background: `radial-gradient(ellipse 55% 50% at 50% 48%, ${rgba(color, 0.42, '255,176,96')}, transparent 70%)` }} />
      <div className="cs-set" ref={setRef}>
      <Speaker side="l" />
      <div className={`cs-deck`}>
        <div className="cs-bay">
          <Cassette track={shown} progress={progress} playing={isPlaying} reduced={reduced} phase={phase} flow={flow} color={color} />
          <div className={`cs-lid${open ? ' is-open' : ''}`} aria-hidden="true" />
        </div>
        <div className="cs-panel">
          <i className="cs-screw cs-s1" /><i className="cs-screw cs-s2" /><i className="cs-screw cs-s3" /><i className="cs-screw cs-s4" />
          <div className="cs-cntbox">
            <div className="cs-counter" aria-label="카운터"><span className="cs-cnt">{counter}</span></div>
            <button type="button" className="cs-reset" onClick={() => setZero(usePlayerStore.getState().currentTime)} aria-label="카운터 리셋"><span>RESET</span></button>
          </div>
          <Leds playing={isPlaying} reduced={reduced} />
          <DeckKnob />
          <div className="cs-tgrow">
            <div className="cs-tgw"><button type="button" className={`cs-tog${isShuffle ? ' is-on' : ''}`} onClick={toggleShuffle} aria-pressed={isShuffle} aria-label={isShuffle ? '셔플 끄기' : '셔플 켜기'} title="셔플 (S)"><i /><Shuffle size={11} /></button><b className="cs-eng">SHUFFLE</b></div>
            <div className="cs-tgw"><button type="button" className={`cs-tog${repeatMode !== 'off' ? ' is-on' : ''}`} onClick={toggleRepeatMode} aria-label={repeatMode === 'one' ? '반복: 한 곡' : repeatMode === 'all' ? '반복: 전체' : '반복: 끔'} title="반복 (R)"><i />{repeatMode === 'one' ? <Repeat1 size={11} /> : <Repeat size={11} />}</button><b className="cs-eng">REPEAT</b></div>
          </div>
          <div className="cs-keys" role="group" aria-label="카세트 버튼">
            <div className="cs-kw"><button type="button" className={`cs-key${pressed === 'rew' ? ' is-down' : ''}`} aria-label="이전 곡" title="짧게: 이전 곡 · 길게: 되감기" onPointerDown={startHold(-5, 'rew')} onPointerUp={endHold(goPrev)} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyClick(goPrev, 'rew')}><SkipBack size={13} /></button><b className="cs-eng">PREV</b></div>
            <div className="cs-kw"><button type="button" className={`cs-key${isPlaying ? ' is-down' : ''}`} aria-label={isPlaying ? '일시정지' : '재생'} aria-pressed={isPlaying} onClick={playPause}><i className={`cs-kled${isPlaying ? ' is-on' : ''}`} />{isPlaying ? <Pause size={13} /> : <Play size={13} />}</button><b className="cs-eng">PLAY</b></div>
            <div className="cs-kw"><button type="button" className={`cs-key${pressed === 'ff' ? ' is-down' : ''}`} aria-label="다음 곡" title="짧게: 다음 곡 · 길게: 빨리감기" onPointerDown={startHold(5, 'ff')} onPointerUp={endHold(goNext)} onPointerLeave={stopHold} onPointerCancel={stopHold} onClick={keyClick(goNext, 'ff')}><SkipForward size={13} /></button><b className="cs-eng">NEXT</b></div>
            <div className="cs-kw"><button type="button" className="cs-key" aria-label="정지" onClick={stop}><Square size={12} /></button><b className="cs-eng">STOP</b></div>
          </div>
        </div>
      </div>
      <Speaker side="r" />
      </div>
    </main>
  );
}

export const CS_CSS = `
.imm-cassette .imm-veil{background:radial-gradient(ellipse at 30% 0%,rgba(255,196,120,.16),transparent 55%),radial-gradient(ellipse at 50% 55%,transparent 30%,rgba(0,0,0,.72) 100%)}
.cs-woodbg{position:absolute;inset:0;pointer-events:none;background:
 repeating-linear-gradient(92deg,rgba(0,0,0,0) 0 7px,rgba(20,10,4,.34) 7px 9px,rgba(0,0,0,0) 8px 21px,rgba(255,200,140,.05) 21px 23px),
 repeating-linear-gradient(88deg,rgba(0,0,0,0) 0 41px,rgba(10,5,2,.36) 41px 44px),
 linear-gradient(180deg,rgba(74,45,24,.9),rgba(42,25,13,.94));opacity:.8}
.cs-wrap{flex:1;min-height:0;display:flex;align-items:center;justify-content:center;padding:0 16px;perspective:1200px}
.cs-set{--cw:min(50vw,520px,calc(42vh * 1.6));--sw:clamp(84px,11.5vw,150px);position:relative;display:flex;align-items:flex-end;justify-content:center;gap:clamp(10px,2.2vw,32px);max-width:100%}
.cs-deck{width:var(--cw);display:flex;flex-direction:column;gap:0;filter:drop-shadow(0 30px 40px rgba(0,0,0,.6))}
.cs-bay{position:relative;padding:3.2% 3.2% 2.6%;border-radius:14px 14px 4px 4px;background:linear-gradient(180deg,#2c2c30,#17171a);border:1px solid rgba(255,255,255,.12);box-shadow:inset 0 2px 8px rgba(0,0,0,.8),inset 0 -1px 0 rgba(255,255,255,.06)}
.cs-cassette{display:block;width:100%;height:auto;will-change:transform,opacity;filter:drop-shadow(0 8px 10px rgba(0,0,0,.55))}
.cs-lid{position:absolute;inset:0;border-radius:inherit;pointer-events:none;z-index:3;transform-origin:50% 0;transition:transform .3s cubic-bezier(.3,.7,.2,1);background:linear-gradient(115deg,rgba(255,255,255,.14),rgba(255,255,255,.02) 38%,rgba(255,255,255,0) 60%,rgba(255,255,255,.05));box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.cs-lid.is-open{transform:perspective(900px) rotateX(-64deg)}
.cs-p-out{animation:cs-eject .28s cubic-bezier(.5,0,.9,.6) forwards}
.cs-p-in{animation:cs-insert .42s cubic-bezier(.2,.8,.2,1) both}
@keyframes cs-eject{to{transform:translateY(-34%) rotateX(18deg);opacity:0}}
@keyframes cs-insert{0%{transform:translateY(-38%) rotateX(18deg);opacity:0}55%{opacity:1}80%{transform:translateY(3%)}100%{transform:none;opacity:1}}
.cs-glow{position:absolute;inset:0;pointer-events:none;transition:background .8s}
.cs-deck{position:relative}
.cs-flow{animation:cs-flow .5s linear infinite;animation-play-state:paused}
.cs-flow-play{animation-play-state:running}
.cs-flow-ff{animation:cs-flow .09s linear infinite}
.cs-flow-rew{animation:cs-flow .09s linear infinite reverse}
@keyframes cs-flow{from{transform:translateX(0)}to{transform:translateX(-18px)}}
.cs-spk{position:relative;width:var(--sw);height:calc(var(--sw) * 1.95);flex:none;margin-bottom:2px}
.cs-spk-body{position:absolute;inset:0;border-radius:7px 7px 5px 5px;background:repeating-linear-gradient(88deg,rgba(0,0,0,.0) 0 5px,rgba(20,8,2,.16) 5px 6px),linear-gradient(100deg,#4d2f19,#7b4b2a 28%,#5a3720 55%,#3f2514 80%,#5e3a22);box-shadow:inset 0 1px 0 rgba(255,220,170,.28),inset 0 -2px 4px rgba(0,0,0,.5),inset 2px 0 3px rgba(255,200,140,.12),0 24px 22px -8px rgba(0,0,0,.65);padding:7%}
.cs-baffle{position:relative;width:100%;height:100%;border-radius:4px;background:linear-gradient(180deg,#1b1816,#0f0d0c);box-shadow:inset 0 2px 6px rgba(0,0,0,.85),0 1px 0 rgba(255,220,170,.12)}
.cs-tweeter{position:absolute;left:50%;top:9%;width:34%;aspect-ratio:1;margin-left:-17%;border-radius:50%;background:radial-gradient(circle,#2b2724 0 38%,#0c0b0a 40% 60%,#3a342f 62% 70%,#0c0b0a 72%);box-shadow:0 0 0 2px #1d1a18,0 1px 0 rgba(255,255,255,.1)}
.cs-tweeter i{position:absolute;inset:26%;border-radius:50%;background:radial-gradient(circle at 36% 32%,#cfc8bb,#6e675d 55%,#2c2824);transform:scale(calc(1 + var(--treb,0) * .12));will-change:transform}
.cs-woofer{position:absolute;left:50%;top:34%;width:78%;aspect-ratio:1;margin-left:-39%;border-radius:50%;background:#0b0a09;box-shadow:0 0 0 2px #1d1a18,0 1px 0 rgba(255,255,255,.1)}
.cs-edge{position:absolute;inset:5%;border-radius:50%;background:radial-gradient(circle,transparent 62%,#171514 63% 78%,#2a2623 80% 86%,#0f0e0d 88%);display:block}
.cs-cone{position:absolute;inset:14%;border-radius:50%;background:radial-gradient(circle at 40% 34%,#4a4541,#2b2825 45%,#1a1816 80%),repeating-radial-gradient(circle,rgba(255,255,255,.05) 0 2px,transparent 2px 6px);background-blend-mode:screen;display:block;transform:scale(calc(1 + var(--bass,0) * .085));will-change:transform;box-shadow:inset 0 0 8px rgba(0,0,0,.8)}
.cs-cone b{position:absolute;left:50%;top:50%;width:34%;aspect-ratio:1;margin:-17% 0 0 -17%;border-radius:50%;background:radial-gradient(circle at 36% 32%,#7d776e,#35312c 60%,#16140f)}
.cs-led{position:absolute;left:50%;bottom:4%;width:5px;height:5px;margin-left:-2.5px;border-radius:50%;background:#e9742b;box-shadow:0 0 6px #e9742b}
.cs-spk-shadow{position:absolute;left:-6%;right:-6%;bottom:-7px;height:14px;background:radial-gradient(ellipse at 50% 30%,rgba(0,0,0,.6),transparent 70%);pointer-events:none}
@media (max-width:768px){.cs-spk{display:none}.cs-set{--cw:min(88vw,540px,calc(44vh * 1.6))}}
.cs-panel{position:relative;display:grid;grid-template-columns:auto minmax(0,1fr) auto;grid-template-areas:"cnt meter knob" "cnt tg knob" "keys keys keys";gap:8px 16px;align-items:center;padding:14px 22px 12px;border-radius:2px 2px 12px 12px;
 background:repeating-linear-gradient(90deg,rgba(255,255,255,.04) 0 1px,rgba(0,0,0,.05) 1px 3px),linear-gradient(180deg,#34353a,#222327 30%,#17181b);
 border:1px solid rgba(255,255,255,.1);border-top:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.14),inset 1px 0 0 rgba(255,255,255,.05),inset 0 -2px 3px rgba(0,0,0,.5)}
.cs-screw{position:absolute;width:7px;height:7px;border-radius:50%;background:radial-gradient(circle at 35% 30%,#d8d8d4,#6a6a66);box-shadow:0 1px 1px rgba(0,0,0,.7)}
.cs-screw::after{content:'';position:absolute;left:1px;right:1px;top:3px;height:1px;background:#3a3a37;transform:rotate(-28deg)}
.cs-s1{left:6px;top:6px}.cs-s2{right:6px;top:6px}.cs-s3{left:6px;bottom:6px}.cs-s4{right:6px;bottom:6px}
.cs-eng{font:600 8.5px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;color:#9a9ca3;text-shadow:0 -1px 0 rgba(0,0,0,.7),0 1px 0 rgba(255,255,255,.06);text-transform:uppercase}
.cs-cntbox{grid-area:cnt;display:flex;flex-direction:column;align-items:flex-start;gap:7px}
.cs-counter{padding:5px 9px;border-radius:3px;background:linear-gradient(180deg,#050605,#10120f);box-shadow:inset 0 2px 5px rgba(0,0,0,.95),0 1px 0 rgba(255,255,255,.14),0 0 0 2px #0d0e10}
.cs-cnt{font:700 22px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.16em;color:#ffd48a;text-shadow:0 0 7px rgba(255,190,90,.5)}
.cs-reset{display:inline-flex;align-items:center;gap:6px;cursor:pointer;color:#9a9ca3}
.cs-reset::before{content:'';width:22px;height:11px;border-radius:2px;background:linear-gradient(180deg,#55575d,#26272b);box-shadow:0 2px 0 #09090a,inset 0 1px 0 rgba(255,255,255,.25);transition:transform .08s}
.cs-reset:active::before{transform:translateY(1.5px);box-shadow:0 .5px 0 #09090a,inset 0 1px 2px rgba(0,0,0,.5)}
.cs-reset span{font:600 8.5px/1 ui-sans-serif,system-ui,sans-serif;letter-spacing:.2em;text-shadow:0 -1px 0 rgba(0,0,0,.7)}
.cs-meter{grid-area:meter;display:flex;flex-direction:column;gap:4px;min-width:0}
.cs-mrow{display:flex;align-items:center;gap:7px}
.cs-seg{--lit:0;--peak:1;flex:1;display:flex;gap:2px;height:8px;padding:2px;border-radius:2px;background:#07080a;box-shadow:inset 0 1px 3px rgba(0,0,0,.9),0 1px 0 rgba(255,255,255,.1)}
.cs-seg i{position:relative;flex:1;border-radius:1px;background:#1b1d1c}
.cs-seg i::before{content:'';position:absolute;inset:0;border-radius:1px;background:var(--c);box-shadow:0 0 4px var(--c);opacity:clamp(0,calc((var(--lit) - var(--k)) * 2.2),1)}
.cs-seg i::after{content:'';position:absolute;inset:0;border-radius:1px;background:#fff3d0;box-shadow:0 0 5px #ffe3a0;opacity:clamp(0,calc(1 - (var(--peak) - 1 - var(--k)) * (var(--peak) - 1 - var(--k)) * 1000),1)}
.cs-seg i{--c:#3fd36b}.cs-seg i:nth-child(n+13){--c:#a8d93a}.cs-seg i:nth-child(n+16){--c:#ecc733}.cs-seg i:nth-child(n+18){--c:#ef7d2c}.cs-seg i:nth-child(n+20){--c:#e5412f}
.cs-scale{position:relative;height:10px;margin-left:19px}
.cs-scale span{position:absolute;transform:translateX(-50%);font:600 7.5px/1 ui-sans-serif,system-ui,sans-serif;color:#85878e;text-shadow:0 -1px 0 rgba(0,0,0,.7)}
.cs-scale em{position:absolute;right:-1px;top:0;font:600 7.5px/1 ui-sans-serif,sans-serif;font-style:normal;color:#85878e;letter-spacing:.1em;display:none}
.cs-knobbox{grid-area:knob;display:flex;flex-direction:column;align-items:center;gap:5px}
.cs-knob{position:relative;width:62px;height:62px;border-radius:50%;cursor:ns-resize;touch-action:none;outline:none;user-select:none;-webkit-user-select:none}
.cs-ticks{position:absolute;inset:-2px;width:calc(100% + 4px);height:calc(100% + 4px)}
.cs-cap{position:absolute;inset:11px;border-radius:50%;background:conic-gradient(from 0deg,#2a2b2f,#5c5e65,#2a2b2f 25%,#6a6c73 50%,#2a2b2f 75%,#5c5e65,#2a2b2f);box-shadow:0 5px 8px rgba(0,0,0,.65),inset 0 0 0 1px rgba(255,255,255,.12),inset 0 1px 1px rgba(255,255,255,.3);will-change:transform}
.cs-cap::before{content:'';position:absolute;inset:5px;border-radius:50%;background:radial-gradient(circle at 34% 28%,#8e9097,#3b3c41 60%,#222327);box-shadow:inset 0 -1px 2px rgba(0,0,0,.5)}
.cs-cap i{position:absolute;left:50%;top:5px;width:2.5px;height:11px;margin-left:-1.25px;border-radius:2px;background:#ffd48a;box-shadow:0 0 5px rgba(255,190,90,.8)}
.cs-knob:focus-visible{box-shadow:0 0 0 2px #fff}
.cs-tgrow{grid-area:tg;display:flex;gap:18px;align-items:flex-end;padding-left:19px}
.cs-tgw,.cs-kw{display:flex;flex-direction:column;align-items:center;gap:5px}
.cs-tog{position:relative;display:grid;place-items:center;width:46px;height:20px;border-radius:2px 2px 1px 1px;color:#c3c6cc;cursor:pointer;background:linear-gradient(180deg,#505258,#25262a 60%,#17181b);box-shadow:0 3px 0 #08080a,0 4px 4px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.28);transition:transform .08s,box-shadow .08s}
.cs-tog i{position:absolute;right:5px;top:4px;width:4px;height:4px;border-radius:50%;background:#3a2418;box-shadow:inset 0 1px 1px rgba(0,0,0,.6)}
.cs-tog.is-on{transform:translateY(2px);box-shadow:0 1px 0 #08080a,inset 0 1px 2px rgba(0,0,0,.5),inset 0 1px 0 rgba(255,255,255,.12);color:#fff}
.cs-tog.is-on i{background:#ffb347;box-shadow:0 0 6px #ff9a1f}
.cs-keys{grid-area:keys;display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-top:2px}
.cs-key{position:relative;width:100%;height:26px;display:grid;place-items:center;border-radius:2px 2px 1px 1px;color:#d4d7dd;cursor:pointer;background:linear-gradient(180deg,#61636a,#2c2d31 55%,#141518);box-shadow:0 4px 0 #060607,0 6px 6px rgba(0,0,0,.55),inset 0 1px 0 rgba(255,255,255,.4),inset 1px 0 0 rgba(255,255,255,.1);transition:transform .07s ease-out,box-shadow .07s ease-out;will-change:transform}
.cs-key svg{filter:drop-shadow(0 -1px 0 rgba(0,0,0,.7))}
.cs-key.is-down{transform:translateY(3px);box-shadow:0 1px 0 #060607,0 1px 2px rgba(0,0,0,.6),inset 0 2px 3px rgba(0,0,0,.55);background:linear-gradient(180deg,#27282c,#1a1b1e)}
.cs-kled{position:absolute;right:6px;top:5px;width:4px;height:4px;border-radius:50%;background:#173a1d;box-shadow:inset 0 1px 1px rgba(0,0,0,.6)}
.cs-kled.is-on{background:#55f07a;box-shadow:0 0 6px #3fe068}
.cs-key:focus-visible{outline:2px solid #fff;outline-offset:2px}
@media (max-width:560px){.cs-panel{grid-template-columns:auto minmax(0,1fr);grid-template-areas:"cnt meter" "knob tg" "keys keys";padding:12px 16px}.cs-tgrow{padding-left:0}}
@media (prefers-reduced-motion:reduce){.cs-p-in,.cs-p-out,.cs-flow{animation:none}.cs-key,.cs-tog,.cs-lid,.cs-reset::before{transition:none}}
`;
