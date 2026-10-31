'use client';

/**
 * 옛 맥 플레이어식 커버플로 — 가운데 커버는 정면, 양옆은 Y축으로 약 70° 꺾여 촘촘히 겹쳐 서고, 바닥에는 반사가 비친다.
 * 마우스 드래그·휠(가로 스크롤)·좌우 키·커버 클릭·아래 스크러버로 넘기며, 넘기는 동안은 미리보기만 이동하고
 * 멈추거나(약 0.7초) 커버를 누르면 그 곡을 재생한다(재생 중인 곡과 보는 위치를 분리).
 * 움직임은 requestAnimationFrame 한 줄기에서 transform·opacity 만 바꾼다(레이아웃 속성 없음).
 */

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { withBase } from '@/lib/basePath';
import { albumLabel } from '@/lib/player/albumLabel';
import type { Track } from '@/types/music';

const coverOf = (t?: Track | null) =>
  (t as any)?.album?.cover_url || (t as any)?.image_url || withBase('/default-album.png');

const GAP_CENTER = 0.66; // 가운데 ↔ 첫 옆 커버 간격(커버 한 변 기준)
const GAP_SIDE = 0.15;   // 옆 커버끼리 겹쳐 서는 촘촘한 간격
const ANGLE = 70;
const PX_PER_CARD = 90;  // 드래그 한 장 넘기는 거리
const WINDOW = 7;        // 위치 좌우로 그리는 커버 수
const COMMIT_MS = 700;

export function ClassicCoverflow({ reduced }: { reduced: boolean }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const n = queue.length;
  const nowIdx = Math.max(0, Math.min(queueIndex, n - 1));
  const [sel, setSel] = useState(nowIdx);   // 보고 있는(미리보기) 곡
  const [win, setWin] = useState(nowIdx);   // 그리는 창의 중심

  const pos = useRef(nowIdx);
  const target = useRef(nowIdx);
  const raf = useRef(0);
  const last = useRef(0);
  const browsing = useRef(false);
  const snapT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commitT = useRef<ReturnType<typeof setTimeout> | null>(null);
  const els = useRef<Map<number, HTMLElement>>(new Map());
  const drag = useRef<{ x0: number; t0: number; moved: boolean; idx: number | null; lastX: number; lastT: number; vel: number } | null>(null);
  const live = useRef({ queue, nowIdx, n, reduced });
  live.current = { queue, nowIdx, n, reduced };

  const clamp = (v: number) => Math.max(0, Math.min(live.current.n - 1, v));

  const apply = useCallback(() => {
    const p = pos.current;
    const red = live.current.reduced;
    els.current.forEach((el, i) => {
      const d = i - p, a = Math.abs(d), s = Math.sign(d), t = Math.min(a, 1);
      const x = s * (a < 1 ? a * GAP_CENTER : GAP_CENTER + (a - 1) * GAP_SIDE);
      const z = -t * 0.45;
      const rot = red ? 0 : -s * ANGLE * t;
      const scale = 1.08 - t * 0.08;
      el.style.transform = `translate3d(calc(var(--s) * ${x.toFixed(4)}),0,calc(var(--s) * ${z.toFixed(4)})) rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      el.style.opacity = String(Math.max(0, Math.min(1, 1 - (a - 4.2) * 0.9)));
      el.style.zIndex = String(1000 - Math.round(a * 20));
      el.style.pointerEvents = a > 5 ? 'none' : 'auto';
    });
    const c = Math.round(p);
    setWin((w) => (Math.abs(w - c) >= 3 ? c : w));
  }, []);

  const step = useCallback((now: number) => {
    const dt = Math.min(0.05, (now - last.current) / 1000 || 0.016);
    last.current = now;
    const diff = target.current - pos.current;
    if (live.current.reduced || Math.abs(diff) < 0.002) pos.current = target.current;
    else pos.current += diff * (1 - Math.exp(-dt * (drag.current ? 20 : 8.5)));
    apply();
    raf.current = pos.current !== target.current || drag.current ? requestAnimationFrame(step) : 0;
  }, [apply]);

  const kick = useCallback(() => {
    if (raf.current) return;
    last.current = performance.now();
    raf.current = requestAnimationFrame(step);
  }, [step]);

  useLayoutEffect(() => { apply(); });
  useEffect(() => () => {
    if (raf.current) cancelAnimationFrame(raf.current);
    if (snapT.current) clearTimeout(snapT.current);
    if (commitT.current) clearTimeout(commitT.current);
  }, []);

  const browseTo = useCallback((v: number, snapMs = 0) => {
    target.current = clamp(v);
    browsing.current = true;
    const s = Math.round(target.current);
    setSel(s);
    kick();
    if (snapT.current) clearTimeout(snapT.current);
    if (snapMs) snapT.current = setTimeout(() => { target.current = clamp(Math.round(target.current)); kick(); }, snapMs);
    if (commitT.current) clearTimeout(commitT.current);
    commitT.current = setTimeout(() => {
      browsing.current = false;
      const i = Math.round(target.current);
      const { queue: q, nowIdx: ni } = live.current;
      if (i !== ni && q[i]) playTrack(q[i], q);
    }, COMMIT_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kick, playTrack]);

  const cancelBrowse = useCallback(() => {
    if (snapT.current) clearTimeout(snapT.current);
    if (commitT.current) clearTimeout(commitT.current);
    browsing.current = false;
  }, []);

  const backToNow = () => {
    cancelBrowse();
    target.current = live.current.nowIdx;
    setSel(live.current.nowIdx);
    kick();
  };

  const activate = (i: number) => {
    const { queue: q, nowIdx: ni } = live.current;
    cancelBrowse();
    if (i === ni) { togglePlay(); return; }
    target.current = i; setSel(i); kick();
    if (q[i]) playTrack(q[i], q);
  };

  // 재생 중인 곡이 바뀌면(다음 곡·자동 재생 등) 보는 위치도 따라간다 — 직접 넘기는 중이 아닐 때만
  useEffect(() => {
    if (browsing.current) return;
    target.current = nowIdx; setSel(nowIdx); kick();
  }, [nowIdx, n, kick]);

  // 좌우 키 = 미리보기 이동
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return;
      e.preventDefault();
      browseTo(Math.round(target.current) + (e.key === 'ArrowRight' ? 1 : -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [browseTo]);

  // 휠·트랙패드 가로 스크롤 (preventDefault 가 필요해 passive:false 로 직접 등록)
  const stageRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      if (!dx) return;
      e.preventDefault();
      browseTo(target.current + dx / 110, 160);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [browseTo]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const card = (e.target as HTMLElement).closest('[data-i]') as HTMLElement | null;
    cancelBrowse();
    drag.current = { x0: e.clientX, t0: target.current, moved: false, idx: card ? Number(card.dataset.i) : null, lastX: e.clientX, lastT: performance.now(), vel: 0 };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
    kick();
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x0;
    if (!d.moved && Math.abs(dx) > 6) d.moved = true;
    if (!d.moved) return;
    const now = performance.now();
    const nt = clamp(d.t0 - dx / PX_PER_CARD);
    const dt = Math.max(1, now - d.lastT) / 1000;
    d.vel = d.vel * 0.6 + ((nt - target.current) / dt) * 0.4;
    d.lastT = now;
    target.current = nt;
    browsing.current = true;
    setSel(Math.round(nt));
    kick();
  };
  const onPointerUp = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    if (!d.moved) { if (d.idx !== null) activate(d.idx); return; }
    // 관성: 놓은 속도만큼 더 흘러간 뒤 가장 가까운 커버에 멈춘다
    browseTo(Math.round(target.current + Math.max(-12, Math.min(12, d.vel * 0.25))));
  };

  if (!currentTrack || n === 0) return null;
  const selTrack = queue[sel] ?? currentTrack;
  const artist = (selTrack as any).album?.artist?.name ?? '';
  const style = (selTrack.style_prompt ?? '').replace(/\s+/g, ' ').trim() || albumLabel(selTrack);
  const from = Math.max(0, win - WINDOW), to = Math.min(n - 1, win + WINDOW);
  const idxs: number[] = [];
  for (let i = from; i <= to; i++) idxs.push(i);

  return (
    <main className="ccf-wrap" data-testid="playlist-coverflow">
      <p className="pcf-style" title={style}>{style}</p>
      <div
        ref={stageRef}
        className="ccf-stage"
        role="list"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {idxs.map((i) => {
          const t = queue[i];
          const now = i === nowIdx;
          return (
            <button
              key={`${t.id}-${i}`}
              ref={(el) => { if (el) els.current.set(i, el); else els.current.delete(i); }}
              type="button"
              role="listitem"
              data-i={i}
              className="ccf-card"
              aria-label={t.title}
              aria-current={i === sel ? 'true' : undefined}
              tabIndex={i === sel ? -1 : 0}
              onClick={(e) => { if (e.detail === 0) activate(i); }}
            >
              <span className={`ccf-art${now ? ' is-now' : ''}${now && !isPlaying ? ' is-paused' : ''}`}>
                <img src={coverOf(t)} alt="" draggable={false} />
                <img className="ccf-refl" src={coverOf(t)} alt="" aria-hidden="true" draggable={false} />
              </span>
            </button>
          );
        })}
        <div className="ccf-floor" aria-hidden="true" />
      </div>
      <h2 key={selTrack.id} className="pcf-title imm-swap">{selTrack.title}</h2>
      <p key={`k-${selTrack.id}`} className="pcf-kicker imm-swap">{String(sel + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}{artist ? ` · ${artist}` : ''}</p>
      <div className="ccf-scrub">
        <input
          type="range" min={0} max={Math.max(0, n - 1)} step={1} value={sel}
          onChange={(e) => browseTo(Number(e.target.value))}
          aria-label="재생목록 위치"
          style={{ ['--p' as any]: `${n > 1 ? (sel / (n - 1)) * 100 : 0}%` }}
        />
        <button type="button" className={`ccf-back${sel !== nowIdx ? ' is-on' : ''}`} onClick={backToNow} tabIndex={sel !== nowIdx ? 0 : -1} aria-hidden={sel === nowIdx}>
          <Undo2 size={14} />지금 재생 중인 곡으로
        </button>
      </div>
    </main>
  );
}

export const CCF_CSS = `
.ccf-wrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;text-align:center;min-width:0}
.ccf-stage{--s:min(36vw,36vh,320px);position:relative;width:100%;max-width:1100px;height:calc(var(--s) * 1.3);perspective:1100px;perspective-origin:50% 38%;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none;overflow:visible}
.ccf-stage:active{cursor:grabbing}
.ccf-card{position:absolute;left:calc(50% - var(--s) / 2);top:0;width:var(--s);height:var(--s);padding:0;background:none;will-change:transform,opacity;transform-origin:50% 50%}
.ccf-art{display:block;position:relative;width:100%;height:100%;transition:translate .25s ease-out,scale .2s ease-out}
.ccf-art img:first-child{width:100%;height:100%;object-fit:cover;display:block;border-radius:4px;box-shadow:0 18px 40px rgba(0,0,0,.55);pointer-events:none}
.ccf-refl{position:absolute;left:0;top:100%;width:100%;height:100%;object-fit:cover;border-radius:4px;transform:scaleY(-1);opacity:.32;mask-image:linear-gradient(0deg,#000,transparent 52%);-webkit-mask-image:linear-gradient(0deg,#000,transparent 52%);pointer-events:none}
.ccf-card:hover .ccf-art{translate:0 -6px}
.ccf-card:active .ccf-art{scale:1.04}
.ccf-art.is-now{animation:imm-breathe 4.2s ease-in-out infinite}
.ccf-art.is-paused{animation-play-state:paused}
.ccf-floor{position:absolute;left:-25%;right:-25%;top:calc(var(--s) * .9);height:calc(var(--s) * .75);background:radial-gradient(ellipse 50% 60% at 50% 12%,rgba(255,255,255,.08),rgba(0,0,0,.34) 45%,transparent 100%);-webkit-mask-image:radial-gradient(ellipse 50% 60% at 50% 12%,#000 20%,transparent 100%);mask-image:radial-gradient(ellipse 50% 60% at 50% 12%,#000 20%,transparent 100%);pointer-events:none;z-index:0}
.ccf-scrub{display:flex;align-items:center;gap:14px;width:min(560px,86vw);margin-top:clamp(12px,2.4vh,22px)}
.ccf-scrub input{flex:1;height:4px;-webkit-appearance:none;appearance:none;border-radius:2px;cursor:pointer;background:linear-gradient(90deg,rgba(255,255,255,.85) var(--p,0%),rgba(255,255,255,.22) var(--p,0%))}
.ccf-scrub input::-webkit-slider-thumb{-webkit-appearance:none;width:14px;height:14px;border-radius:50%;background:#fff}
.ccf-scrub input::-moz-range-thumb{width:14px;height:14px;border:0;border-radius:50%;background:#fff}
.ccf-back{display:inline-flex;align-items:center;gap:6px;flex:none;padding:6px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.16);color:#fff;cursor:pointer;opacity:0;scale:.92;pointer-events:none;transition:opacity .25s,scale .25s}
.ccf-back.is-on{opacity:1;scale:1;pointer-events:auto}
@media (max-width:820px){
  .ccf-stage{--s:min(54vw,28vh,230px)}
  .ccf-back{padding:6px 8px;font-size:11px}
}
@media (prefers-reduced-motion:reduce){.ccf-art{transition:none}.ccf-art.is-now{animation:none}}
`;
