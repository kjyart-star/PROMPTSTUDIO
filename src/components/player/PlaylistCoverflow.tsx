'use client';

/**
 * 전체 화면 「재생목록」 보기 — 큰 커버 1장 + 오른쪽으로 비스듬히 겹쳐 놓인 다음 곡 커버들(커버플로).
 * 커버 위에 스타일 한 줄, 아래에 제목과 「01 / 10 · 아티스트」. 바닥에는 반사가 비친다.
 * 커버를 누르거나 좌우 키를 쓰면 그 곡으로 넘어가 바로 재생한다(대기열 = 현재 재생목록).
 * 화면 구성은 컴피 브릿지 음악 탭의 재생 화면에서 가져와 쿠키뮤직 코드에 맞게 새로 작성했다.
 */

import { useEffect } from 'react';
import { usePlayerStore } from '@/stores/playerStore';
import { withBase } from '@/lib/basePath';
import type { Track } from '@/types/music';

const coverOf = (t?: Track | null) =>
  (t as any)?.album?.cover_url || (t as any)?.image_url || withBase('/default-album.png');

/** 스타일 프롬프트에서 한 줄만 — 줄바꿈·여분 공백을 접는다. */
export function styleLine(t?: Track | null): string {
  return (t?.style_prompt ?? '').replace(/\s+/g, ' ').trim();
}

const VISIBLE_NEXT = 4;
const STEP = 0.44; // 다음 커버가 앞 커버보다 오른쪽으로 밀리는 정도(커버 한 변 기준)

export type CoverflowVariant = 'persp' | 'arc';

export function PlaylistCoverflow({ reduced, listLabel, variant = 'persp' }: { reduced: boolean; listLabel: string; variant?: CoverflowVariant }) {
  const currentTrack = usePlayerStore((s) => s.currentTrack);
  const queue = usePlayerStore((s) => s.queue);
  const queueIndex = usePlayerStore((s) => s.queueIndex);
  const playTrack = usePlayerStore((s) => s.playTrack);
  const togglePlay = usePlayerStore((s) => s.togglePlay);

  const goTo = (idx: number) => {
    const target = queue[idx];
    if (target) playTrack(target, queue);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return; // Shift+방향키는 공용 단축키(이전·다음 곡)
      const el = e.target as HTMLElement | null;
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return; // 진행바 방향키는 그대로 둔다
      e.preventDefault();
      const idx = queueIndex + (e.key === 'ArrowRight' ? 1 : -1);
      if (idx < 0 || idx >= queue.length) return;
      playTrack(queue[idx], queue);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [queue, queueIndex, playTrack]);

  if (!currentTrack) return null;
  const base = Math.max(0, queueIndex);
  const arc = variant === 'arc';
  const offs = arc ? [-3, -2, -1, 0, 1, 2, 3] : [0, 1, 2, 3, 4];
  const cards = offs.map((off) => ({ off, track: queue[base + off] ?? (off === 0 ? currentTrack : undefined) }))
    .filter((c): c is { off: number; track: Track } => !!c.track);
  const span = arc ? 6 : cards.length - 1;
  const artist = (currentTrack as any).album?.artist?.name ?? '';
  const total = queue.length || 1;
  const pos = base + 1;
  const style = styleLine(currentTrack);

  return (
    <main className="pcf-wrap" data-testid="playlist-coverflow">
      <p className="pcf-style" title={style}>{style || (currentTrack as any).album?.title || listLabel}</p>
      <div className={`pcf-stage${arc ? ' pcf-arc' : ''}`} style={{ ['--span' as any]: span }} role="list">
        {cards.map(({ off, track }) => {
          const a = Math.abs(off);
          const tf = arc
            ? (reduced
              ? `translateX(calc(var(--s) * ${off * 0.5})) scale(${1 - a * 0.1})`
              : `translateX(calc(var(--s) * ${off * 0.5})) rotateY(${-off * 42}deg) scale(${1 - a * 0.08})`)
            : reduced
            ? `translateX(calc(var(--s) * ${off * STEP})) scale(${1 - off * 0.1})`
            : `translateX(calc(var(--s) * ${off * STEP})) rotateY(${off === 0 ? 0 : -38}deg) scale(${1 - off * 0.1})`;
          return (
            <button
              key={`${track.id}-${off}`}
              role="listitem"
              type="button"
              className={`pcf-card${a > 2 ? ' pcf-far' : ''}`}
              style={{ transform: tf, zIndex: 10 - a, opacity: 1 - a * 0.14 }}
              aria-label={track.title}
              aria-current={off === 0 ? 'true' : undefined}
              onClick={() => (off === 0 ? togglePlay() : goTo(base + off))}
              data-off={off}
            >
              <img src={coverOf(track)} alt="" />
              <img className="pcf-refl" src={coverOf(track)} alt="" aria-hidden="true" />
            </button>
          );
        })}
      </div>
      <h2 className="pcf-title">{currentTrack.title}</h2>
      <p className="pcf-kicker">{String(pos).padStart(2, '0')} / {String(total).padStart(2, '0')}{artist ? ` · ${artist}` : ''}</p>
    </main>
  );
}

export const PCF_CSS = `
.pcf-wrap{flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:0 20px;text-align:center;min-width:0}
.pcf-style{max-width:min(90vw,640px);margin:0 0 clamp(10px,2.4vh,22px);font-size:12px;letter-spacing:.12em;color:rgba(255,255,255,.7);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.pcf-stage{--s:min(34vw,36vh,320px);position:relative;width:calc(var(--s) * (1 + .44 * var(--span)));height:var(--s);perspective:1200px;perspective-origin:30% 40%;margin:0 auto}
.pcf-stage.pcf-arc{width:calc(var(--s) * 4);perspective-origin:50% 40%}
.pcf-arc .pcf-card{left:calc(50% - var(--s) / 2);transform-origin:center}
.pcf-card{position:absolute;left:0;top:0;width:var(--s);height:var(--s);padding:0;background:none;cursor:pointer;transform-origin:left center;transform-style:preserve-3d;transition:transform .55s cubic-bezier(.2,.8,.2,1),opacity .55s}
.pcf-card>img:first-child{width:100%;height:100%;object-fit:cover;border-radius:14px;display:block;box-shadow:0 24px 50px rgba(0,0,0,.5)}
.pcf-refl{position:absolute;left:0;top:102%;width:100%;height:100%;object-fit:cover;border-radius:14px;transform:scaleY(-1);opacity:.22;mask-image:linear-gradient(0deg,#000,transparent 38%);-webkit-mask-image:linear-gradient(0deg,#000,transparent 38%);pointer-events:none}
.pcf-title{position:relative;z-index:20;margin:calc(var(--s-gap,0px) + clamp(36px,8vh,80px)) 0 0;font-size:clamp(22px,2.6vw,36px);font-weight:800;letter-spacing:-.02em;line-height:1.15;max-width:90vw;word-break:keep-all;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;text-shadow:0 2px 18px rgba(0,0,0,.6)}
.pcf-kicker{margin-top:10px;font-size:12px;letter-spacing:.18em;font-weight:700;color:rgba(255,255,255,.6);font-variant-numeric:tabular-nums}
@media (max-width:820px){
  .pcf-stage{--s:min(46vw,30vh,240px);width:calc(var(--s) * (1 + .44 * min(var(--span), 2)))}
  .pcf-far{display:none}
  .pcf-stage.pcf-arc{width:calc(var(--s) * 2.6)}
}
@media (prefers-reduced-motion:reduce){.pcf-card{transition:none}}
`;
