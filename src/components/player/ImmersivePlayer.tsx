'use client';

/**
 * 전체 화면 「지금 재생」 — 싱크 가사 + 커버 궤도 + 막대 시각화 / 재생목록 커버플로우.
 * 화면 구성 아이디어는 boks-music(MIT, https://github.com/boksajang/boks-music)의 재생 화면에서 착안했고,
 * 코드는 쿠키뮤직에서 새로 작성했다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Mic2, GalleryHorizontal, HelpCircle, Clock, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { usePlayerStore } from '@/stores/playerStore';
import { buildTimedLyrics, activeLineIndex } from '@/lib/player/lyricTiming';
import { useLyricSync } from './useLyricSync';
import { LyricSyncBar, SYNC_LABELS, SYNC_CSS } from './LyricSyncBar';
import { withBase } from '@/lib/basePath';
import { PlaylistCoverflow, PCF_CSS } from './PlaylistCoverflow';
import { CCF_CSS } from './ClassicCoverflow';
import { CassettePlayer, CS_CSS } from './CassettePlayer';
import { LpDisc } from './LpDisc';
import { ClockWidget, CLOCK_EVENT } from './ClockWidget';
import { PocketPlayer, PK_CSS } from './PocketPlayer';
import { SpectrumCanvas, SPEC_CSS } from './SpectrumCanvas';
import { useCoverColor } from './coverColor';
import { ImmBackground, BG_CSS } from './ImmBackground';
import { VolumeControl, VOL_CTL_CSS } from './VolumeControl';
import type { Track } from '@/types/music';

type View = 'now' | 'list';
const VIEW_KEY = 'cm.immersive-view';
const DESIGN_KEY = 'cm.immersive-design';
type Design = 'lyrics' | 'card' | 'cassette' | 'pocket' | 'persp' | 'arc';
const NOW_DESIGNS: Design[] = ['lyrics', 'card', 'cassette', 'pocket'];
const LIST_DESIGNS: Design[] = ['persp', 'arc'];

const T = {
  KO: { close: '닫기', now: '지금 재생', list: '재생목록', playing: '지금 재생 중', est: '가사 시간 추정', noLyr: '등록된 가사가 없습니다', prev: '이전 곡', next: '다음 곡', play: '재생', pause: '일시정지', seek: '재생 위치', view: '보기 전환', section: '구간', design: '디자인', lyrics: '가사형', card: '카드형', cassette: '카세트', pocket: '포켓', persp: '커버플로', arc: '원통형' },
  EN: { close: 'Close', now: 'Now playing', list: 'Playlist', playing: 'Now playing', est: 'Lyric timing estimated', noLyr: 'No lyrics for this track', prev: 'Previous', next: 'Next', play: 'Play', pause: 'Pause', seek: 'Seek', view: 'Switch view', section: 'Section', design: 'Design', lyrics: 'Lyrics', card: 'Card', cassette: 'Cassette', pocket: 'Pocket', persp: 'Cover Flow', arc: 'Arc' },
  JA: { close: '閉じる', now: '再生中', list: 'プレイリスト', playing: '再生中', est: '歌詞タイミングは推定', noLyr: '歌詞がありません', prev: '前の曲', next: '次の曲', play: '再生', pause: '一時停止', seek: '再生位置', view: '表示切替', section: 'パート', design: 'デザイン', lyrics: '歌詞', card: 'カード', cassette: 'カセット', pocket: 'ポケット', persp: 'カバーフロー', arc: '円筒' },
} as const;

function fmt(sec: number) {
  if (!isFinite(sec) || sec < 0) return '0:00';
  return `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
}
const coverOf = (t?: Track | null) =>
  (t as any)?.album?.cover_url || (t as any)?.image_url || withBase('/default-album.png');

function usePrefersReducedMotion() {
  const [r, setR] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setR(mq.matches);
    const on = () => setR(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return r;
}

export function ImmersivePlayer() {
  const {
    isImmersiveOpen, setImmersiveOpen, currentTrack, queue, queueIndex,
    isPlaying, currentTime, duration, togglePlay, next, prev, seek,
    isShuffle, repeatMode, toggleShuffle, toggleRepeatMode,
  } = usePlayerStore();
  const reduced = usePrefersReducedMotion();
  const coverColor = useCoverColor(currentTrack ? coverOf(currentTrack) : '');
  const [lang, setLang] = useState<'KO' | 'EN' | 'JA'>('KO');
  const [view, setView] = useState<View>('now');
  const [designs, setDesigns] = useState<{ now: Design; list: Design }>({ now: 'lyrics', list: 'persp' });
  useEffect(() => {
    try {
      const raw = JSON.parse(localStorage.getItem(DESIGN_KEY) || '{}');
      setDesigns({
        now: NOW_DESIGNS.includes(raw.now) ? raw.now : 'lyrics',
        list: LIST_DESIGNS.includes(raw.list) ? raw.list : 'persp',
      });
    } catch { /* ignore */ }
  }, []);
  const pickDesign = (d: Design) => {
    const next = NOW_DESIGNS.includes(d) ? { ...designs, now: d } : { ...designs, list: d };
    setDesigns(next);
    try { localStorage.setItem(DESIGN_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const [clockLay, setClockLay] = useState<{ hidden: boolean; pos: string }>({ hidden: false, pos: 'tl' });
  const onClock = useCallback((c: { hidden: boolean; pos: string }) => setClockLay(c), []);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lyricBoxRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<Record<number, HTMLElement | null>>({});

  useEffect(() => {
    try {
      const l = (localStorage.getItem('language') || 'KO').toUpperCase();
      if (l === 'EN' || l === 'JA' || l === 'KO') setLang(l);
    } catch { /* ignore */ }
  }, [isImmersiveOpen]);
  const t = T[lang];

  const hasList = queue.length > 1;
  // 재생목록·앨범을 재생 중이면 커버플로우를 기본으로, 사용자가 고른 보기는 기억한다.
  useEffect(() => {
    if (!isImmersiveOpen) return;
    let saved: string | null = null;
    try { saved = localStorage.getItem(VIEW_KEY); } catch { /* ignore */ }
    setView(hasList && saved !== 'now' ? 'list' : 'now');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImmersiveOpen]);
  const pickView = (v: View) => {
    setView(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* ignore */ }
  };

  useEffect(() => {
    if (!isImmersiveOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setImmersiveOpen(false); };
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [isImmersiveOpen, setImmersiveOpen]);

  const dur = duration || currentTrack?.duration_sec || 0;
  const sync = useLyricSync(currentTrack, isImmersiveOpen && view === 'now' && designs.now === 'lyrics');
  const timed = useMemo(
    () => buildTimedLyrics(currentTrack?.lyrics, dur, { lrc: sync.lrc, spans: sync.spans }),
    [currentTrack?.lyrics, dur, sync.lrc, sync.spans],
  );
  // 오프셋이 +면 가사가 그만큼 먼저 나온다(가사 빠르게)
  const active = timed.mode === 'none' ? -1 : activeLineIndex(timed.lines, currentTime + sync.offset);

  useEffect(() => {
    const box = lyricBoxRef.current;
    const el = lineRefs.current[active];
    if (!box || !el || typeof box.scrollTo !== 'function') return;
    box.scrollTo({ top: el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2, behavior: reduced ? 'auto' : 'smooth' });
  }, [active, reduced, view, isImmersiveOpen]);

  // 닫을 때도 사라지는 움직임이 끝난 뒤에 떼어 낸다
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    if (isImmersiveOpen) { setMounted(true); return; }
    if (!mounted) return;
    if (reduced) { setMounted(false); return; }
    const id = setTimeout(() => setMounted(false), 280);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isImmersiveOpen, reduced]);

  if ((!isImmersiveOpen && !mounted) || !currentTrack) return null;
  const closing = !isImmersiveOpen;

  const cover = coverOf(currentTrack);
  const progress = dur ? currentTime / dur : 0;
  const artist = (currentTrack as any).album?.artist?.name ?? '';
  const total = queue.length || 1;
  const pos = Math.max(0, queueIndex) + 1;

  return (
    <div className={`imm-root${closing ? ' imm-out' : ' imm-in'}${view === 'now' && designs.now === 'card' ? ' imm-framed' : ''}${view === 'now' && designs.now === 'cassette' ? ' imm-cassette' : ''}${!clockLay.hidden ? ` imm-clock-on imm-clock-${clockLay.pos}` : ''}`} role="dialog" aria-modal="true" aria-label={t.playing} data-testid="immersive-player">
      <style>{IMM_CSS + SYNC_CSS + PCF_CSS + CCF_CSS + CS_CSS + VOL_CTL_CSS + BG_CSS + SPEC_CSS + PK_CSS}</style>
      <ImmBackground src={cover} reduced={reduced} />
      {view === 'now' && designs.now === 'cassette' && <div className="cs-woodbg" aria-hidden="true" />}
      <div className="imm-veil" aria-hidden="true" />

      <header className="imm-top">
        <div className="imm-tabs" role="tablist" aria-label={t.view}>
          <button role="tab" aria-selected={view === 'now'} onClick={() => pickView('now')}><Mic2 size={15} />{t.now}</button>
          <button role="tab" aria-selected={view === 'list'} onClick={() => pickView('list')}><GalleryHorizontal size={15} />{t.list}</button>
        </div>
        <div className="imm-designs" role="group" aria-label={t.design}>
          {(view === 'now' ? NOW_DESIGNS : LIST_DESIGNS).map((d) => (
            <button key={d} aria-pressed={designs[view === 'now' ? 'now' : 'list'] === d} onClick={() => pickDesign(d)}>{t[d]}</button>
          ))}
        </div>
        <button className="imm-close imm-help" onClick={() => window.dispatchEvent(new CustomEvent(CLOCK_EVENT))} aria-label="시계 보이기·숨기기 (C)" title="시계 보이기·숨기기 (C)">
          <Clock size={17} />
        </button>
        <button className="imm-close imm-help" onClick={() => usePlayerStore.getState().setShortcutHelpOpen(true)} aria-label="단축키 안내 (?)" title="단축키 안내 (?)">
          <HelpCircle size={18} />
        </button>
        <button ref={closeRef} className="imm-close" onClick={() => setImmersiveOpen(false)} aria-label={t.close} title={t.close}>
          <X size={20} />
        </button>
      </header>

      {view === 'now' && designs.now === 'cassette' ? (
        <CassettePlayer reduced={reduced} />
      ) : view === 'now' && designs.now === 'pocket' ? (
        <PocketPlayer reduced={reduced} />
      ) : view === 'now' ? (
        <main className="imm-now">
          <section className="imm-left">
            <div className="imm-coverwrap">
              <LpDisc key={currentTrack.id} playing={isPlaying} label={cover} out={0.44} />
              <img className={`imm-cover imm-breathe${isPlaying ? '' : ' is-paused'}`} src={cover} alt="" />
            </div>
            <p key={`k${currentTrack.id}`} className="imm-kicker imm-swap">{String(pos).padStart(2, '0')} / {String(total).padStart(2, '0')} · {t.playing}</p>
            <h2 key={`t${currentTrack.id}`} className="imm-title imm-swap">{currentTrack.title}</h2>
            {artist && <p key={`a${currentTrack.id}`} className="imm-artist imm-swap">{artist}</p>}
          </section>

          {designs.now !== 'card' && (
          <section className="imm-right" aria-label="가사">
            {timed.lines.length === 0 ? (
              <p className="imm-nolyr">{t.noLyr}</p>
            ) : (
              <>
                <div className="imm-lyrics" ref={lyricBoxRef}>
                  <div className="imm-pad" />
                  {timed.lines.map((l, i) => {
                    if (l.kind === 'section') return <p key={i} className="imm-sec" ref={(el) => { lineRefs.current[i] = el; }}>{l.text}</p>;
                    const d = active < 0 ? 3 : Math.abs(i - active);
                    const cls = i === active ? 'imm-line is-active' : 'imm-line';
                    return (
                      <p
                        key={i}
                        ref={(el) => { lineRefs.current[i] = el; }}
                        className={cls}
                        style={{ opacity: i === active ? 1 : Math.max(0.16, 0.6 - d * 0.14) }}
                        aria-current={i === active ? 'true' : undefined}
                        onClick={() => { if (!isNaN(l.start)) seek(Math.max(0, l.start - sync.offset)); }}
                      >{l.text}</p>
                    );
                  })}
                  <div className="imm-pad" />
                </div>
                {(timed.mode === 'estimated' || timed.mode === 'exact') && (
                  <LyricSyncBar
                    labels={SYNC_LABELS[lang]}
                    mode={timed.mode}
                    basis={timed.basis}
                    offset={sync.offset}
                    onOffset={sync.setOffset}
                    align={sync.align}
                    onAlign={() => {
                      sync.runAlign(currentTrack.lyrics ? timed.lines.filter((l) => l.kind === 'line').map((l) => l.text) : [], dur);
                    }}
                    canAlignAgain={sync.hasLocalLrc}
                  />
                )}
              </>
            )}
          </section>
          )}
        </main>
      ) : (
        <PlaylistCoverflow reduced={reduced} listLabel={t.list} variant={designs.list === 'arc' ? 'arc' : 'persp'} />
      )}

      <ClockWidget onLayout={onClock} />

      <footer className="imm-bottom">
        <SpectrumCanvas mode={view === 'list' ? 'mirror' : designs.now === 'card' ? 'line' : 'thin'} playing={isPlaying} reduced={reduced} color={coverColor} glow={view === 'list' ? 0.4 : designs.now === 'card' ? 0.7 : 0.5} />
        <div className="imm-seekrow">
          <span>{fmt(currentTime)}</span>
          <input
            type="range" min={0} max={Math.max(1, Math.floor(dur))} step={1}
            value={Math.min(Math.floor(currentTime), Math.max(1, Math.floor(dur)))}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label={t.seek}
            style={{ ['--p' as any]: `${progress * 100}%` }}
          />
          <span>{fmt(dur)}</span>
        </div>
        <div className="imm-ctrl">
          <button className={`imm-mode${isShuffle ? ' is-on' : ''}`} onClick={toggleShuffle} aria-pressed={isShuffle} aria-label={isShuffle ? '셔플 끄기' : '셔플 켜기'} title="셔플 (S)"><Shuffle size={19} /></button>
          <button onClick={prev} aria-label={t.prev}><SkipBack size={22} /></button>
          <button className="imm-play" onClick={togglePlay} aria-label={isPlaying ? t.pause : t.play}>
            {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" />}
          </button>
          <button onClick={next} aria-label={t.next}><SkipForward size={22} /></button>
          <button className={`imm-mode${repeatMode !== 'off' ? ' is-on' : ''}`} onClick={toggleRepeatMode} aria-label={repeatMode === 'one' ? '반복: 한 곡' : repeatMode === 'all' ? '반복: 전체' : '반복: 끔'} title="반복 (R)">{repeatMode === 'one' ? <Repeat1 size={19} /> : <Repeat size={19} />}</button>
          <div className="imm-vol"><VolumeControl /></div>
        </div>
      </footer>
    </div>
  );
}

const IMM_CSS = `
.imm-root{position:fixed;inset:0;z-index:90;display:flex;flex-direction:column;color:#f4efe8;background:#0d0d0d;overflow:hidden;font-family:inherit}
@keyframes imm-fadein{from{opacity:0}to{opacity:1}}
@keyframes imm-rise{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
.imm-swap{animation:imm-rise .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes imm-breathe{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
.imm-breathe{animation:imm-breathe 4.2s ease-in-out infinite;will-change:transform}
.imm-breathe.is-paused{animation-play-state:paused}
@keyframes imm-open{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes imm-close{from{opacity:1;transform:none}to{opacity:0;transform:scale(.94)}}
.imm-in{animation:imm-open .42s cubic-bezier(.2,.8,.2,1) both}
.imm-out{animation:imm-close .28s ease-in both;pointer-events:none}
.imm-veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(13,13,13,.25),rgba(13,13,13,.78) 85%)}
.imm-root>*:not(.imm-bgwrap):not(.imm-veil):not(.cs-woodbg):not(.clk){position:relative}
.imm-top{display:flex;justify-content:flex-start;align-items:center;padding:16px 20px}
.imm-tabs{display:inline-flex;gap:4px;padding:4px;border-radius:10px;background:rgba(255,255,255,.1);backdrop-filter:blur(12px)}
.imm-tabs button{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:7px;font-size:13px;font-weight:700;color:rgba(255,255,255,.7);cursor:pointer}
.imm-tabs button[aria-selected=true]{background:rgba(255,255,255,.92);color:#111}
.imm-designs{display:inline-flex;gap:2px;padding:3px;border-radius:10px;background:rgba(255,255,255,.08);margin-left:auto;margin-right:12px}
.imm-designs button{padding:6px 10px;border-radius:7px;font-size:12px;font-weight:700;color:rgba(255,255,255,.65);cursor:pointer}
.imm-designs button[aria-pressed=true]{background:rgba(255,255,255,.22);color:#fff}
.imm-framed .imm-now{grid-template-columns:minmax(0,1fr);justify-items:center;align-content:center;text-align:center;margin:0 clamp(16px,4vw,64px) 8px;border:1px solid rgba(255,255,255,.16);border-radius:28px;background:rgba(0,0,0,.28);backdrop-filter:blur(18px);padding:clamp(16px,3vw,40px) clamp(20px,4vw,64px)}
.imm-close{width:40px;height:40px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.12);cursor:pointer}
.imm-help{margin-right:8px}
.imm-close:hover{background:rgba(255,255,255,.22)}
.imm-now{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.05fr);gap:clamp(24px,5vw,80px);align-items:center;padding:0 clamp(20px,6vw,96px)}
.imm-framed .imm-left{align-items:center;text-align:center}
.imm-framed .imm-coverwrap{width:min(40vw,44vh,400px);margin:0 0 30px;transform:translateX(-21%)}
.imm-framed .imm-left h2{order:1}.imm-framed .imm-kicker{order:2;margin-top:10px}.imm-framed .imm-artist{order:3}
.imm-left{display:flex;flex-direction:column;align-items:flex-start;min-width:0}
.imm-coverwrap{position:relative;isolation:isolate;width:min(28vw,44vh,380px);aspect-ratio:1;margin:0 0 24px 14px}
.imm-cover{width:100%;height:100%;object-fit:cover;border-radius:22px;box-shadow:0 30px 70px rgba(0,0,0,.55)}
.imm-kicker{font-size:12px;letter-spacing:.18em;font-weight:700;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
.imm-title{font-size:clamp(28px,3.6vw,52px);line-height:1.1;font-weight:800;margin:8px 0 0;letter-spacing:-.02em;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.imm-artist{margin-top:8px;font-size:15px;color:rgba(255,255,255,.7)}
.imm-right{min-width:0;height:min(58vh,560px);display:flex;flex-direction:column}
.imm-lyrics{position:relative;flex:1;min-height:0;overflow:hidden;border-left:2px solid rgba(255,255,255,.18);padding-left:clamp(16px,2.4vw,32px);mask-image:linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent);-webkit-mask-image:linear-gradient(180deg,transparent,#000 22%,#000 78%,transparent)}
.imm-pad{height:40%}
.imm-line{font-size:clamp(18px,2vw,28px);line-height:1.45;font-weight:700;margin:0 0 14px;cursor:pointer;transition:opacity .35s,color .35s,transform .35s;transform-origin:left center;word-break:keep-all}
.imm-line.is-active{color:#fff;transform:scale(1.04);text-shadow:0 0 28px rgba(255,255,255,.35)}
.imm-sec{font-size:11px;letter-spacing:.2em;text-transform:uppercase;font-weight:800;color:rgba(255,255,255,.4);margin:18px 0 8px}
.imm-est{margin-top:10px;font-size:12px;color:rgba(255,255,255,.55);padding-left:clamp(16px,2.4vw,32px)}
.imm-nolyr{margin:auto 0;font-size:16px;color:rgba(255,255,255,.55);border-left:2px solid rgba(255,255,255,.18);padding-left:24px}
.imm-bottom{padding:0 clamp(20px,6vw,96px) 22px}
.imm-seekrow{display:flex;align-items:center;gap:12px;font-size:12px;font-variant-numeric:tabular-nums;color:rgba(255,255,255,.7)}
.imm-seekrow input{flex:1;height:4px;-webkit-appearance:none;appearance:none;border-radius:2px;cursor:pointer;background:linear-gradient(90deg,#fff var(--p,0%),rgba(255,255,255,.22) var(--p,0%))}
.imm-seekrow input::-webkit-slider-thumb{-webkit-appearance:none;width:12px;height:12px;border-radius:50%;background:#fff}
.imm-seekrow input::-moz-range-thumb{width:12px;height:12px;border:0;border-radius:50%;background:#fff}
.imm-ctrl .imm-mode{width:38px;height:38px;color:rgba(255,255,255,.55);position:relative}
.imm-ctrl .imm-mode.is-on{color:#fff}
.imm-ctrl .imm-mode.is-on::after{content:'';position:absolute;bottom:2px;left:50%;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:#fff}
.imm-clock-tc .imm-now,.imm-clock-tc .cs-wrap,.imm-clock-tc .pk-wrap,.imm-clock-tc .pcf-wrap,.imm-clock-tc .ccf-wrap{padding-top:96px}
@media (max-width:820px){.imm-clock-on:not(.imm-clock-bl):not(.imm-clock-br) .imm-now,.imm-clock-on:not(.imm-clock-bl):not(.imm-clock-br) .cs-wrap,.imm-clock-on:not(.imm-clock-bl):not(.imm-clock-br) .pk-wrap,.imm-clock-on:not(.imm-clock-bl):not(.imm-clock-br) .pcf-wrap,.imm-clock-on:not(.imm-clock-bl):not(.imm-clock-br) .ccf-wrap{padding-top:70px}}
.imm-vol{position:absolute;right:0;top:50%;transform:translateY(-50%)}
.imm-cassette .imm-vol{display:none}
@media (max-width:820px){.imm-vol .vol-ctl input{width:64px}}
.imm-ctrl{position:relative;display:flex;justify-content:center;align-items:center;gap:28px;margin-top:10px}
.imm-ctrl button{width:44px;height:44px;display:grid;place-items:center;border-radius:50%;cursor:pointer;color:#fff}
.imm-ctrl .imm-play{width:56px;height:56px;background:#fff;color:#111}
.imm-root button:focus-visible,.imm-seekrow input:focus-visible{outline:2px solid #fff;outline-offset:3px}
@media (max-width:820px){
  .imm-now{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr);gap:12px;align-content:start;padding:0 20px}
  .imm-left{align-items:center;text-align:center}
  .imm-coverwrap{width:min(42vw,26vh,200px);margin:6px 0 14px}
  .imm-title{font-size:22px;-webkit-line-clamp:2}
  .imm-right{height:100%;min-height:0}
  .imm-line{font-size:17px}
}
@media (prefers-reduced-motion:reduce){
    .imm-line,  .imm-in,.imm-out,.imm-swap,.imm-breathe{animation:none}
}
`;
