'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * 전체 화면 배경 — 커버 색 블러. 곡이 바뀌어도 번쩍이지 않게 디졸브한다.
 *  - 레이어 두 장(A/B)을 고정으로 두고, 새 커버를 decode() 로 다 읽은 뒤에만 위 레이어를 0→1 로 올린다.
 *  - 아래 레이어는 위 레이어가 다 덮을 때까지 1 로 유지하고, 끝난 뒤 역할만 바꾼다(밝기 출렁임 없음).
 *  - 블러는 작은 캔버스(48px)에 한 번 그려 CSS 필터를 정적으로 쓰고, 움직이는 건 레이어 opacity 뿐이다.
 */
const SIZE = 48;
const MS = 700;

function paint(cv: HTMLCanvasElement | null, img: HTMLImageElement) {
  const g = cv?.getContext('2d');
  if (!cv || !g) return;
  cv.width = cv.height = SIZE;
  const r = Math.max(SIZE / img.naturalWidth, SIZE / img.naturalHeight) || 1;
  const w = img.naturalWidth * r, h = img.naturalHeight * r;
  g.drawImage(img, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
}

export function ImmBackground({ src, reduced }: { src: string; reduced: boolean }) {
  const cvs = [useRef<HTMLCanvasElement>(null), useRef<HTMLCanvasElement>(null)];
  const [cur, setCur] = useState(0);          // 지금 보이는(바닥) 레이어
  const [incoming, setIncoming] = useState(false); // 위 레이어가 올라오는 중
  const shown = useRef('');
  const token = useRef(0);
  const curRef = useRef(0);
  curRef.current = cur;

  useEffect(() => {
    if (!src || src === shown.current) return;
    const my = ++token.current;
    const img = new Image();
    img.src = src;
    const ready = (img.decode ? img.decode() : new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = rej; })).catch(() => null);
    let timer: ReturnType<typeof setTimeout> | undefined;
    ready.then(() => {
      if (my !== token.current) return; // 더 새 요청이 있으면 버린다
      if (!img.naturalWidth) return;
      const c = curRef.current;
      if (!shown.current) { paint(cvs[c].current, img); shown.current = src; return; } // 처음엔 바로
      const inc = 1 - c;
      paint(cvs[inc].current, img);
      shown.current = src;
      if (reduced) { setCur(inc); return; }
      setIncoming(true);
      timer = setTimeout(() => { setCur(inc); setIncoming(false); }, MS + 40);
    });
    return () => { if (timer) clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src, reduced]);

  const layer = (i: number) => {
    const isCur = i === cur;
    const op = isCur ? 1 : incoming ? 1 : 0;
    return (
      <div key={i} className="imm-bgl" aria-hidden="true"
        style={{ opacity: op, zIndex: isCur ? 1 : 2, transition: !isCur && incoming && !reduced ? `opacity ${MS}ms ease-in-out` : 'none' }}>
        <canvas ref={cvs[i]} />
      </div>
    );
  };
  return <div className="imm-bgwrap" aria-hidden="true">{layer(0)}{layer(1)}</div>;
}

export const BG_CSS = `
.imm-bgwrap{position:absolute;inset:0;overflow:hidden;background:#0d0d0d;isolation:isolate;z-index:0}
.imm-bgl{position:absolute;inset:0;will-change:opacity}
.imm-bgl canvas{position:absolute;inset:-12%;width:124%;height:124%;filter:blur(28px) saturate(1.5) brightness(.85);transform:scale(1.1)}
`;
