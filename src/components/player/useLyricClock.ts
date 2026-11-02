'use client';

import { useEffect, useRef, useState } from 'react';
import { playingAudioTime } from '@/lib/player/mediaClock';

/**
 * 가사 강조용 시계 — 재생 중에는 오디오 요소의 실제 재생 시각(media clock)을 requestAnimationFrame 마다 읽는다.
 * timeupdate(HTML 표준상 15~250ms 간격, 크롬은 약 250ms)에 기대면 줄 강조가 최대 0.25초 늦게 켜지고 들쭉날쭉하다.
 * 매 프레임 다시 그리지 않도록 compute(t) 결과가 바뀔 때만 상태를 바꾼다(줄이 바뀔 때만 다시 그림).
 * 멈춤·숨김 상태에서는 스토어 시각(fallback, 탐색 포함)으로 계산한다.
 */
export function useLyricClock<T>(running: boolean, fallbackTime: number, compute: (t: number) => T, same: (a: T, b: T) => boolean): T {
  const computeRef = useRef(compute);
  computeRef.current = compute;
  const sameRef = useRef(same);
  sameRef.current = same;
  const [val, setVal] = useState<T>(() => compute(fallbackTime));
  const valRef = useRef(val);

  const push = (next: T) => {
    if (!sameRef.current(valRef.current, next)) { valRef.current = next; setVal(next); }
  };

  const nowOf = () => { if (!running) return fallbackTime; const t = playingAudioTime(); return t > 0 ? t : fallbackTime; };
  // 그릴 때마다(탐색·시간표 도착·멈춤) 바로 다시 계산 — 재생 중이면 오디오 시각, 아니면 스토어 시각
  useEffect(() => { push(computeRef.current(nowOf())); });

  useEffect(() => {
    if (!running || typeof requestAnimationFrame === 'undefined') return;
    let id = 0;
    const tick = () => {
      const t = playingAudioTime();
      push(computeRef.current(t > 0 ? t : fallbackTime));
      id = requestAnimationFrame(tick);
    };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running]);

  return val;
}
