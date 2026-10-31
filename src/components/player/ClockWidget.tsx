'use client';

/**
 * 전체 화면 시계 — 로파이·재생목록 영상의 시계 느낌. 큰 시:분 + 작은 날짜·요일.
 * 위치(5곳 + 드래그 후 스냅), 12/24시간, 초, 날짜, 크기, 숨기기를 설정하고 localStorage 에 기억한다.
 * 단축키 C 로 보이기·숨기기. 하단 컨트롤·상단 메뉴와 겹치지 않는 안전 영역 안에서만 놓인다.
 */

import { useEffect, useRef, useState } from 'react';
import { Settings2, X } from 'lucide-react';

type Pos = 'tl' | 'tr' | 'tc' | 'bl' | 'br' | 'free';
type Size = 's' | 'm' | 'l';
interface Cfg { hidden: boolean; pos: Pos; fx: number; fy: number; h24: boolean; sec: boolean; date: boolean; size: Size }
const KEY = 'cm.clock';
const DEFAULT: Cfg = { hidden: false, pos: 'tl', fx: 0.05, fy: 0.15, h24: false, sec: false, date: true, size: 'm' };
const TOP_SAFE = 72, FOOTER_H = 186, FOOT_GAP = 28, SIDE = 20, SNAP = 90;
export const CLOCK_EVENT = 'cm:clock-toggle';
const POS_LABEL: Record<Exclude<Pos, 'free'>, string> = { tl: '왼쪽 위', tc: '가운데 위', tr: '오른쪽 위', bl: '왼쪽 아래', br: '오른쪽 아래' };

function load(): Cfg {
  try { return { ...DEFAULT, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return DEFAULT; }
}

/** 시계가 차지하는 영역만큼 본문(기기·카드)을 밀어내기 위한 여백(px). 위쪽 시계면 위 여백, 아래쪽이면 아래 여백. */
export function clockReserve(c: { hidden: boolean; pos: Pos; fy: number }, boxH: number, rootH: number, geo: { top: number; foot: number } = { top: TOP_SAFE, foot: FOOTER_H }): { t: number; b: number } {
  if (c.hidden || !boxH) return { t: 0, b: 0 };
  const gap = 8;
  if (c.pos === 'tl' || c.pos === 'tr' || c.pos === 'tc') return { t: Math.round(boxH + gap), b: 0 };
  if (c.pos === 'bl' || c.pos === 'br') return { t: 0, b: Math.round(boxH + FOOT_GAP + gap) };
  const y = c.fy * rootH;
  if (y + boxH / 2 < rootH / 2) return { t: Math.max(0, Math.round(y + boxH - geo.top + gap)), b: 0 };
  return { t: 0, b: Math.max(0, Math.round(rootH - geo.foot - y + gap)) };
}

export function ClockWidget({ onLayout }: { onLayout?: (c: { hidden: boolean; pos: Pos; t: number; b: number }) => void }) {
  const [cfg, setCfg] = useState<Cfg>(DEFAULT);
  const [now, setNow] = useState(() => new Date());
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ dx: number; dy: number; moved: boolean } | null>(null);
  const [geo, setGeo] = useState({ top: TOP_SAFE, foot: FOOTER_H });
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => { setCfg(load()); }, []);
  const update = (patch: Partial<Cfg>) => setCfg((c) => {
    const n = { ...c, ...patch };
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch { /* private mode */ }
    return n;
  });
  useEffect(() => {
    const report = () => {
      const el = box.current, par = el?.offsetParent as HTMLElement | null;
      const hdr = par?.querySelector('.imm-top') as HTMLElement | null, ftr = par?.querySelector('.imm-bottom') as HTMLElement | null;
      const g = { top: hdr ? hdr.offsetHeight : TOP_SAFE, foot: par && ftr ? par.clientHeight - ftr.offsetTop : FOOTER_H };
      setGeo((o) => (o.top === g.top && o.foot === g.foot ? o : g));
      const r = clockReserve(cfg, el ? el.offsetHeight : 0, par ? par.clientHeight : 0, g);
      onLayout?.({ hidden: cfg.hidden, pos: cfg.pos, ...r });
    };
    report();
    window.addEventListener('resize', report);
    return () => window.removeEventListener('resize', report);
  }, [cfg, now.getMinutes(), onLayout]);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const on = () => update({ hidden: !load().hidden });
    window.addEventListener(CLOCK_EVENT, on);
    return () => window.removeEventListener(CLOCK_EVENT, on);
  }, []);

  const h = now.getHours(), m = String(now.getMinutes()).padStart(2, '0'), s = String(now.getSeconds()).padStart(2, '0');
  const hm = cfg.h24 ? `${String(h).padStart(2, '0')}:${m}` : `${h % 12 === 0 ? 12 : h % 12}:${m}`;
  const ampm = cfg.h24 ? '' : h < 12 ? '오전' : '오후';
  const dateText = now.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', weekday: 'long' });

  const anchors = (W: number, H: number, cw: number, ch: number): Record<Exclude<Pos, 'free'>, { x: number; y: number }> => ({
    tl: { x: SIDE, y: geo.top }, tr: { x: W - cw - SIDE, y: geo.top }, tc: { x: (W - cw) / 2, y: geo.top },
    bl: { x: SIDE, y: H - geo.foot - FOOT_GAP - ch }, br: { x: W - cw - SIDE, y: H - geo.foot - FOOT_GAP - ch },
  });
  const rect = () => {
    const el = box.current, par = el?.offsetParent as HTMLElement | null;
    if (!el || !par) return null;
    const pr = par.getBoundingClientRect(), er = el.getBoundingClientRect();
    return { W: pr.width, H: pr.height, left: pr.left, top: pr.top, cw: er.width, ch: er.height };
  };
  const clampXY = (x: number, y: number, r: NonNullable<ReturnType<typeof rect>>) => ({
    x: Math.max(8, Math.min(r.W - r.cw - 8, x)),
    y: Math.max(geo.top - 8, Math.min(r.H - geo.foot - FOOT_GAP - r.ch, y)),
  });

  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('.clk-gear,.clk-pop')) return;
    const r = rect(); if (!r) return;
    const er = box.current!.getBoundingClientRect();
    drag.current = { dx: e.clientX - er.left, dy: e.clientY - er.top, moved: false };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current, r = rect();
    if (!d || !r) return;
    const x = e.clientX - r.left - d.dx, y = e.clientY - r.top - d.dy;
    if (!d.moved && Math.hypot(e.movementX || 0, e.movementY || 0) < 0.5 && !dragXY) { /* 아주 작은 움직임은 무시 */ }
    d.moved = true;
    setDragXY(clampXY(x, y, r));
  };
  const onUp = () => {
    const d = drag.current; drag.current = null;
    const r = rect();
    if (!d || !r || !d.moved || !dragXY) { setDragXY(null); return; }
    const A = anchors(r.W, r.H, r.cw, r.ch);
    let best: Exclude<Pos, 'free'> | null = null, bd = Infinity;
    (Object.keys(A) as Exclude<Pos, 'free'>[]).forEach((k) => { const dd = Math.hypot(A[k].x - dragXY.x, A[k].y - dragXY.y); if (dd < bd) { bd = dd; best = k; } });
    if (best && bd <= SNAP) update({ pos: best });
    else update({ pos: 'free', fx: dragXY.x / r.W, fy: dragXY.y / r.H });
    setDragXY(null);
  };

  if (cfg.hidden) return null;
  const style: React.CSSProperties = {};
  if (dragXY) { style.left = dragXY.x; style.top = dragXY.y; }
  else if (cfg.pos === 'free') { style.left = `${cfg.fx * 100}%`; style.top = `${cfg.fy * 100}%`; }
  else if (cfg.pos === 'bl' || cfg.pos === 'br') style.bottom = geo.foot + FOOT_GAP;
  else style.top = geo.top;
  const cls = `clk clk-${cfg.size} clk-p-${dragXY ? 'free' : cfg.pos}${dragXY ? ' is-drag' : ''}`;

  return (
    <div ref={box} className={cls} style={style} data-testid="clock-widget" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <style>{CLOCK_CSS}</style>
      <div className="clk-time" aria-label={`현재 시각 ${ampm} ${hm}`}>
        {ampm && <small className="clk-ampm">{ampm}</small>}
        <span key={hm} className="clk-hm">{hm}</span>
        {cfg.sec && <small className="clk-sec">{s}</small>}
      </div>
      {cfg.date && <div className="clk-date">{dateText}</div>}
      <button type="button" className="clk-gear" onClick={() => setOpen((v) => !v)} aria-label="시계 설정" aria-expanded={open}><Settings2 size={14} /></button>
      {open && (
        <div className="clk-pop" role="dialog" aria-label="시계 설정">
          <div className="clk-row"><b>위치</b>
            <span className="clk-seg">{(Object.keys(POS_LABEL) as Exclude<Pos, 'free'>[]).map((k) => (
              <button key={k} type="button" aria-pressed={cfg.pos === k} onClick={() => update({ pos: k })}>{POS_LABEL[k]}</button>
            ))}</span></div>
          <div className="clk-row"><b>형식</b>
            <span className="clk-seg">
              <button type="button" aria-pressed={!cfg.h24} onClick={() => update({ h24: false })}>12시간</button>
              <button type="button" aria-pressed={cfg.h24} onClick={() => update({ h24: true })}>24시간</button>
            </span></div>
          <div className="clk-row"><b>크기</b>
            <span className="clk-seg">{(['s', 'm', 'l'] as Size[]).map((z) => (
              <button key={z} type="button" aria-pressed={cfg.size === z} onClick={() => update({ size: z })}>{z === 's' ? '작게' : z === 'm' ? '보통' : '크게'}</button>
            ))}</span></div>
          <div className="clk-row"><b>표시</b>
            <span className="clk-seg">
              <button type="button" aria-pressed={cfg.sec} onClick={() => update({ sec: !cfg.sec })}>초</button>
              <button type="button" aria-pressed={cfg.date} onClick={() => update({ date: !cfg.date })}>날짜</button>
            </span></div>
          <button type="button" className="clk-hide" onClick={() => { setOpen(false); update({ hidden: true }); }}><X size={13} />시계 숨기기 (C)</button>
        </div>
      )}
    </div>
  );
}

const CLOCK_CSS = `
.clk{position:absolute;z-index:6;color:#fff;touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;text-shadow:0 2px 18px rgba(0,0,0,.5),0 0 2px rgba(0,0,0,.25)}
.clk.is-drag{cursor:grabbing}
.clk-p-tl{left:20px;top:72px}
.clk-p-tr{right:20px;top:72px;text-align:right}
.clk-p-tc{left:50%;top:72px;transform:translateX(-50%);text-align:center}
.clk-p-bl{left:20px;bottom:214px}
.clk-p-br{right:20px;bottom:214px;text-align:right}
.clk-time{display:flex;align-items:baseline;gap:8px;line-height:1}
.clk-p-tr .clk-time,.clk-p-br .clk-time{justify-content:flex-end}.clk-p-tc .clk-time{justify-content:center}
.clk-hm{font-weight:200;font-variant-numeric:tabular-nums;letter-spacing:-.02em;animation:clk-in .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes clk-in{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.clk-ampm,.clk-sec{font-weight:300;opacity:.75;font-size:.28em}
.clk-sec{font-variant-numeric:tabular-nums}
.clk-date{margin-top:6px;font-size:14px;font-weight:500;letter-spacing:.04em;opacity:.8}
.clk-s .clk-hm{font-size:34px}.clk-m .clk-hm{font-size:54px}.clk-l .clk-hm{font-size:80px}
.clk-s .clk-date{font-size:12px}.clk-l .clk-date{font-size:16px}
.clk-gear{position:absolute;top:-6px;right:-26px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:rgba(0,0,0,.35);color:#fff;opacity:0;transition:opacity .2s;cursor:pointer}
.clk-p-tr .clk-gear,.clk-p-br .clk-gear{right:auto;left:-26px}
.clk:hover .clk-gear,.clk:focus-within .clk-gear,.clk-gear[aria-expanded=true]{opacity:1}
.clk-pop{position:absolute;top:100%;left:0;margin-top:10px;width:272px;padding:12px;border-radius:12px;background:rgba(18,18,20,.92);backdrop-filter:blur(14px);box-shadow:0 14px 36px rgba(0,0,0,.5);text-shadow:none;cursor:default;display:flex;flex-direction:column;gap:9px;z-index:2}
.clk-p-tr .clk-pop,.clk-p-br .clk-pop{left:auto;right:0}.clk-p-bl .clk-pop,.clk-p-br .clk-pop{top:auto;bottom:100%;margin:0 0 10px}
.clk-row{display:flex;align-items:flex-start;gap:10px;font-size:12px}
.clk-row b{width:30px;flex:none;padding-top:5px;color:rgba(255,255,255,.6);font-weight:600}
.clk-seg{display:flex;flex-wrap:wrap;gap:4px}
.clk-seg button{padding:5px 8px;border-radius:7px;font-size:12px;background:rgba(255,255,255,.1);color:#fff;cursor:pointer}
.clk-seg button[aria-pressed=true]{background:#fff;color:#111;font-weight:700}
.clk-hide{display:inline-flex;align-items:center;justify-content:center;gap:6px;padding:7px;border-radius:8px;font-size:12px;background:rgba(255,255,255,.08);color:#fff;cursor:pointer}
@media (max-width:820px){
  .clk-s .clk-hm{font-size:24px}.clk-m .clk-hm{font-size:34px}.clk-l .clk-hm{font-size:46px}
  .clk-date{font-size:11px}
  .clk-p-tl,.clk-p-bl{left:14px}.clk-p-tr,.clk-p-br{right:14px}
  .clk-gear{opacity:1}
}
@media (prefers-reduced-motion:reduce){.clk-hm{animation:none}.clk-gear{transition:none}}
`;
