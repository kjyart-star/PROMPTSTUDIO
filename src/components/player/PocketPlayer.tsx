'use client';

/**
 * 포켓 디자인 — 알루미늄 바디의 휴대용 플레이어(위 컬러 화면, 아래 클릭휠).
 * 휠을 원형으로 돌리면(또는 트랙패드·마우스 휠) 재생목록에서는 목록이 스크롤되고 지금 재생에서는 볼륨이 바뀐다.
 * 휠의 위·오른쪽·아래·왼쪽을 누르면 메뉴·다음·재생/일시정지·이전, 가운데 버튼은 선택/재생.
 * 클릭음은 기본으로 꺼져 있다. 상표·로고는 쓰지 않는다.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume1, Volume2, VolumeX, BatteryFull } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { withBase } from '@/lib/basePath';
import { albumLabel } from '@/lib/player/albumLabel';
import { useCoverColor } from './coverColor';
import { SpectrumCanvas } from './SpectrumCanvas';
import type { Track } from '@/types/music';

type Theme = 'silver' | 'gray' | 'white';
const THEMES: { id: Theme; label: string; dot: string }[] = [
  { id: 'silver', label: '실버', dot: '#c9ccd1' },
  { id: 'gray', label: '스페이스그레이', dot: '#55585e' },
  { id: 'white', label: '화이트', dot: '#f3f3f1' },
];
const PREF_KEY = 'cm.pocket';
const STEP_DEG = 24;
const coverOf = (t?: Track | null) => (t as any)?.album?.cover_url || (t as any)?.image_url || withBase('/default-album.png');
const fmt = (s: number) => (!isFinite(s) || s < 0 ? '0:00' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`);

export function PocketPlayer({ reduced }: { reduced: boolean }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const isPlaying = usePlayerStore((s) => s.isPlaying);
  const currentTime = usePlayerStore((s) => s.currentTime);
  const duration = usePlayerStore((s) => s.duration);
  const volume = usePlayerStore((s) => s.volume);
  const isMuted = usePlayerStore((s) => s.isMuted);

  const [theme, setTheme] = useState<Theme>('silver');
  const [click, setClick] = useState(false);
  const [screen, setScreen] = useState<'now' | 'list'>('now');
  const [sel, setSel] = useState(Math.max(0, queueIndex));
  const [volShow, setVolShow] = useState(false);
  const volTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const wheelRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<AudioContext | null>(null);

  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
      if (THEMES.some((t) => t.id === raw.theme)) setTheme(raw.theme);
      if (raw.click === true) setClick(true);
    } catch { /* ignore */ }
  }, []);
  const savePref = (t: Theme, c: boolean) => { try { localStorage.setItem(PREF_KEY, JSON.stringify({ theme: t, click: c })); } catch { /* ignore */ } };

  useEffect(() => { setSel(Math.max(0, queueIndex)); }, [queueIndex, screen]);
  useEffect(() => {
    const ul = listRef.current;
    const el = ul?.children[sel] as HTMLElement | undefined;
    if (ul && el) ul.scrollTop = el.offsetTop - ul.clientHeight / 2 + el.clientHeight / 2;
  }, [sel, screen]);

  const tick = useCallback(() => {
    if (!click) return;
    try {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      ctx.current = ctx.current ?? new Ctor();
      const a = ctx.current, o = a.createOscillator(), g = a.createGain();
      o.frequency.value = 1900; g.gain.setValueAtTime(0.03, a.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.018);
      o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.02);
    } catch { /* 소리는 선택 기능 */ }
  }, [click]);

  const showVol = () => {
    setVolShow(true);
    if (volTimer.current) clearTimeout(volTimer.current);
    volTimer.current = setTimeout(() => setVolShow(false), 1200);
  };
  useEffect(() => () => { if (volTimer.current) clearTimeout(volTimer.current); }, []);

  // 휠을 한 칸 돌렸을 때
  const turn = useCallback((dir: 1 | -1) => {
    tick();
    if (screen === 'list') {
      setSel((v) => Math.max(0, Math.min(usePlayerStore.getState().queue.length - 1, v + dir)));
    } else {
      const st = usePlayerStore.getState();
      const v = Math.round(((st.isMuted ? 0 : st.volume) + dir * 0.04) * 100) / 100;
      st.setVolume(Math.min(1, Math.max(0, v)));
      showVol();
    }
  }, [screen, tick]);

  // 포인터로 원형 드래그
  const drag = useRef<{ ang: number; acc: number; moved: boolean; zone: 'ring' | 'center' | null } | null>(null);
  const angleOf = (e: React.PointerEvent) => {
    const r = wheelRef.current!.getBoundingClientRect();
    return Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180 / Math.PI;
  };
  const zoneOf = (e: React.PointerEvent): 'ring' | 'center' | null => {
    const r = wheelRef.current!.getBoundingClientRect();
    const d = Math.hypot(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)) / (r.width / 2);
    return d < 0.38 ? 'center' : d <= 1 ? 'ring' : null;
  };
  const onDown = (e: React.PointerEvent) => {
    const zone = zoneOf(e);
    if (!zone) return;
    drag.current = { ang: angleOf(e), acc: 0, moved: false, zone };
    try { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); } catch { /* jsdom */ }
  };
  const onMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || d.zone !== 'ring') return;
    const a = angleOf(e);
    let delta = a - d.ang;
    if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
    d.ang = a; d.acc += delta;
    if (Math.abs(d.acc) > 6) d.moved = true;
    while (Math.abs(d.acc) >= STEP_DEG) { const dir = d.acc > 0 ? 1 : -1; turn(dir as 1 | -1); d.acc -= dir * STEP_DEG; }
  };
  const onUp = (e: React.PointerEvent) => {
    const d = drag.current; drag.current = null;
    if (!d || d.moved) return;
    tick();
    if (d.zone === 'center') return centerPress();
    const a = angleOf(e); // -90 위, 0 오른쪽, 90 아래, 180/-180 왼쪽
    if (a > -135 && a <= -45) setScreen((s) => (s === 'now' ? 'list' : 'now'));      // 위: 메뉴
    else if (a > -45 && a <= 45) usePlayerStore.getState().next();                    // 오른쪽: 다음
    else if (a > 45 && a <= 135) usePlayerStore.getState().togglePlay();              // 아래: 재생/일시정지
    else usePlayerStore.getState().prev();                                            // 왼쪽: 이전
  };
  const centerPress = () => {
    const st = usePlayerStore.getState();
    if (screen === 'list') {
      const t = st.queue[sel];
      if (t) { if (t.id === st.currentTrack?.id) st.togglePlay(); else st.playTrack(t, st.queue); setScreen('now'); }
    } else st.togglePlay();
  };

  // 마우스 휠·트랙패드 — 휠 영역 위에서만
  useEffect(() => {
    const el = wheelRef.current;
    if (!el) return;
    let acc = 0;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault(); e.stopPropagation();
      acc += Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      while (Math.abs(acc) >= 40) { const dir = acc > 0 ? 1 : -1; turn(dir as 1 | -1); acc -= dir * 40; }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [turn]);

  const cover = coverOf(currentTrack);
  const color = useCoverColor(cover);
  const accent = color ? `rgb(${color.join(',')})` : '#4aa8ff';
  const dur = duration || currentTrack?.duration_sec || 0;
  const pct = dur ? Math.min(100, (currentTime / dur) * 100) : 0;
  const shownVol = isMuted ? 0 : volume;
  const artist = (currentTrack as any)?.album?.artist?.name ?? '';
  if (!currentTrack) return null;

  return (
    <main className={`pk-wrap pk-${theme}`} data-testid="pocket-player">
      <div className="pk-stage">
        <div className="pk-dev">
          <span className="pk-side pk-hold" aria-hidden="true" />
          <div className="pk-screen">
            <header className="pk-bar">
              <b>{screen === 'now' ? '지금 재생' : '재생목록'}</b>
              <span className="pk-batt" aria-hidden="true"><BatteryFull size={15} /></span>
            </header>
            {screen === 'now' ? (
              <div className="pk-now">
                <div className="pk-art"><img src={cover} alt="" draggable={false} /></div>
                <div className="pk-meta">
                  <b title={currentTrack.title}>{currentTrack.title}</b>
                  <span>{artist}</span>
                  <small>{albumLabel(currentTrack)}</small>
                </div>
                <div className="pk-spec"><SpectrumCanvas mode="thin" playing={isPlaying} reduced={reduced} color={color} glow={0.2} /></div>
                <div className="pk-prog"><i style={{ transform: `scaleX(${pct / 100})`, background: accent }} /></div>
                <div className="pk-time"><span>{fmt(currentTime)}</span>
                  <span className="pk-tr">
                    <SkipBack size={13} />{isPlaying ? <Pause size={15} /> : <Play size={15} />}<SkipForward size={13} />
                  </span>
                  <span>-{fmt(Math.max(0, dur - currentTime))}</span></div>
                {volShow && (
                  <div className="pk-vol" role="status" data-testid="pocket-volume">
                    {shownVol === 0 ? <VolumeX size={15} /> : shownVol < 0.5 ? <Volume1 size={15} /> : <Volume2 size={15} />}
                    <span><i style={{ transform: `scaleX(${shownVol})` }} /></span>
                  </div>
                )}
              </div>
            ) : (
              <ul className="pk-list" ref={listRef} aria-label="재생목록">
                {queue.map((t, i) => (
                  <li key={`${t.id}-${i}`} className={`${i === sel ? 'is-sel' : ''}${t.id === currentTrack.id ? ' is-now' : ''}`}>
                    <span>{t.title}</span>{t.id === currentTrack.id && <Play size={11} />}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="pk-wheel" ref={wheelRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => { drag.current = null; }} data-testid="pocket-wheel">
            <span className="pk-lab pk-l-t">MENU</span>
            <span className="pk-lab pk-l-r"><SkipForward size={14} /></span>
            <span className="pk-lab pk-l-b">{isPlaying ? <Pause size={14} /> : <Play size={14} />}</span>
            <span className="pk-lab pk-l-l"><SkipBack size={14} /></span>
            <button type="button" className="pk-center" aria-label={screen === 'list' ? '선택' : isPlaying ? '일시정지' : '재생'} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); centerPress(); } }} />
          </div>
          <span className="pk-conn" aria-hidden="true" />
        </div>
        <span className="pk-floor" aria-hidden="true" />
      </div>
      <div className="pk-opts">
        <div className="pk-dots" role="group" aria-label="본체 색">
          {THEMES.map((t) => (
            <button key={t.id} type="button" aria-label={t.label} aria-pressed={theme === t.id} title={t.label} style={{ background: t.dot }} onClick={() => { setTheme(t.id); savePref(t.id, click); }} />
          ))}
        </div>
        <button type="button" className={`pk-snd${click ? ' is-on' : ''}`} aria-pressed={click} onClick={() => { setClick((c) => { savePref(theme, !c); return !c; }); }}>클릭음 {click ? '켬' : '끔'}</button>
        <button type="button" className="pk-snd" onClick={() => setScreen((s) => (s === 'now' ? 'list' : 'now'))}>{screen === 'now' ? '재생목록 보기' : '지금 재생 보기'}</button>
      </div>
    </main>
  );
}

export const PK_CSS = `
.pk-wrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:0 16px}
.pk-stage{position:relative;perspective:1100px}
.pk-dev{--pw:min(300px,calc((100vh - 330px) / 1.72));position:relative;width:var(--pw);height:calc(var(--pw) * 1.72);border-radius:calc(var(--pw) * .09);padding:calc(var(--pw) * .06);display:flex;flex-direction:column;align-items:center;gap:calc(var(--pw) * .06);transform:rotateY(-7deg) rotateX(3deg);transform-style:preserve-3d;
 background:repeating-linear-gradient(90deg,rgba(255,255,255,.07) 0 1px,rgba(0,0,0,.035) 1px 2px),linear-gradient(135deg,var(--b1),var(--b2) 45%,var(--b3));
 box-shadow:inset 0 0 0 1.5px var(--edge),inset 0 2px 1px rgba(255,255,255,.7),inset 0 -3px 4px rgba(0,0,0,.25),-10px 0 18px -10px rgba(0,0,0,.4),0 28px 36px rgba(0,0,0,.55)}
.pk-silver{--b1:#e9ebee;--b2:#c3c7cc;--b3:#a9aeb4;--edge:#8f949a;--wheel:#f7f7f6;--ink:#6a6e74}
.pk-gray{--b1:#7a7d83;--b2:#5a5d63;--b3:#44464b;--edge:#2c2d30;--wheel:#2a2b2e;--ink:#9a9da3}
.pk-white{--b1:#fbfbfa;--b2:#e6e6e3;--b3:#cfcfcb;--edge:#b5b5b0;--wheel:#ffffff;--ink:#8a8a86}
@media (max-width:820px){.pk-dev{--pw:min(92vw,calc((100vh - 300px) / 1.72))}}
.pk-side{position:absolute;top:calc(var(--pw) * .1);left:-3px;width:3px;height:calc(var(--pw) * .1);border-radius:2px 0 0 2px;background:linear-gradient(90deg,#777,#bbb)}
.pk-screen{width:100%;height:46%;border-radius:calc(var(--pw) * .035);background:linear-gradient(180deg,#14233a,#0b1220);box-shadow:inset 0 0 0 2px rgba(0,0,0,.65),0 1px 0 rgba(255,255,255,.55);overflow:hidden;position:relative;color:#eaf2ff;display:flex;flex-direction:column;font-size:calc(var(--pw) * .042)}
.pk-screen::after{content:'';position:absolute;inset:0;background:linear-gradient(160deg,rgba(255,255,255,.12),transparent 38%);pointer-events:none}
.pk-bar{display:flex;justify-content:space-between;align-items:center;padding:2% 4%;background:linear-gradient(180deg,#4a6a96,#2c4468);font-weight:700;border-bottom:1px solid rgba(0,0,0,.4)}
.pk-batt{display:inline-flex;color:#bfe3b3}
.pk-now{position:relative;flex:1;min-height:0;display:grid;grid-template-columns:38% 1fr;grid-template-rows:auto auto auto auto;gap:3% 4%;padding:4%}
.pk-art{grid-row:1/3;aspect-ratio:1;border-radius:3px;overflow:hidden;box-shadow:0 3px 8px rgba(0,0,0,.6)}
.pk-art img{width:100%;height:100%;object-fit:cover;display:block}
.pk-meta{display:flex;flex-direction:column;min-width:0;gap:2px}
.pk-meta b{font-size:1.1em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pk-meta span{opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pk-meta small{opacity:.55;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:.85em}
.pk-spec{grid-column:1/-1;height:24px}
.pk-spec .imm-spec{height:24px;margin:0}
.pk-prog{grid-column:1/-1;height:5px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden}
.pk-prog i{display:block;height:100%;transform-origin:left;transition:transform .9s linear}
.pk-time{grid-column:1/-1;display:flex;justify-content:space-between;align-items:center;font-variant-numeric:tabular-nums;opacity:.9;font-size:.9em}
.pk-tr{display:inline-flex;align-items:center;gap:10px}
.pk-vol{position:absolute;left:8%;right:8%;bottom:10%;display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:6px;background:rgba(10,16,28,.88);box-shadow:0 2px 8px rgba(0,0,0,.5);animation:vol-pop-pk .15s ease-out both}
.pk-vol>span{flex:1;height:6px;border-radius:3px;background:rgba(255,255,255,.2);overflow:hidden}
.pk-vol i{display:block;height:100%;background:#7fd0ff;transform-origin:left}
@keyframes vol-pop-pk{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
.pk-list{flex:1;min-height:0;margin:0;padding:0;list-style:none;overflow:hidden;position:relative}
.pk-list li{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:2.4% 4%;border-bottom:1px solid rgba(255,255,255,.06);white-space:nowrap}
.pk-list li span{overflow:hidden;text-overflow:ellipsis}
.pk-list li.is-now{color:#7fd0ff}
.pk-list li.is-sel{background:linear-gradient(180deg,#3d82d8,#2a5fa8);color:#fff}
.pk-wheel{position:relative;width:calc(var(--pw) * .78);aspect-ratio:1;border-radius:50%;background:radial-gradient(circle at 40% 30%,#fff,var(--wheel) 55%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.2),inset 0 -4px 8px rgba(0,0,0,.12),0 2px 3px rgba(255,255,255,.5);touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;margin-top:auto}
.pk-wheel:active{cursor:grabbing}
.pk-lab{position:absolute;color:var(--ink);font:700 calc(var(--pw) * .035)/1 inherit;letter-spacing:.08em;pointer-events:none;display:grid;place-items:center}
.pk-l-t{top:7%;left:50%;transform:translateX(-50%)}.pk-l-b{bottom:7%;left:50%;transform:translateX(-50%)}.pk-l-l{left:8%;top:50%;transform:translateY(-50%)}.pk-l-r{right:8%;top:50%;transform:translateY(-50%)}
.pk-center{position:absolute;left:50%;top:50%;width:36%;aspect-ratio:1;margin:-18% 0 0 -18%;border-radius:50%;background:radial-gradient(circle at 40% 30%,#fff,var(--b1) 70%);box-shadow:inset 0 0 0 1px rgba(0,0,0,.18),0 1px 2px rgba(0,0,0,.25);cursor:pointer;pointer-events:none}
.pk-center:focus-visible{outline:2px solid #3d82d8;outline-offset:2px}
.pk-conn{position:absolute;bottom:calc(var(--pw) * .02);left:50%;width:18%;height:3px;margin-left:-9%;border-radius:2px;background:linear-gradient(90deg,#b88a2a,#f3d27a,#b88a2a)}
.pk-floor{position:absolute;left:-12%;right:-12%;bottom:-14px;height:26px;background:radial-gradient(ellipse at 50% 20%,rgba(0,0,0,.6),transparent 70%);pointer-events:none}
.pk-opts{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center}
.pk-dots{display:inline-flex;gap:8px}
.pk-dots button{width:20px;height:20px;border-radius:50%;box-shadow:inset 0 0 0 1px rgba(0,0,0,.35);cursor:pointer}
.pk-dots button[aria-pressed=true]{outline:2px solid #fff;outline-offset:2px}
.pk-snd{padding:5px 10px;border-radius:999px;font-size:12px;font-weight:700;background:rgba(255,255,255,.14);color:#fff;cursor:pointer}
.pk-snd.is-on{background:rgba(255,255,255,.3)}
@media (prefers-reduced-motion:reduce){.pk-prog i,.pk-vol{transition:none;animation:none}.pk-dev{transform:none}}
`;
