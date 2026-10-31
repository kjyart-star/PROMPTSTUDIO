'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@/types/music';
import type { Span } from '@/lib/player/vocalSpans';
import type { TimedLine } from '@/lib/player/lyricTiming';
import {
  analyzeSpans, autoAlign, clearCachedLrc, currentAudioSrc, loadCachedLrc, loadCachedSpans,
  loadOffset, saveCachedLrc, saveOffset,
} from '@/lib/player/lyricSyncClient';

export type AlignState =
  | { phase: 'idle' }
  | { phase: 'download' | 'listen'; pct: number }
  | { phase: 'fail' }
  | { phase: 'done' };

const hasStamps = (raw?: string | null) => /\[\d{1,3}:\d{2}/.test(raw ?? '');

/**
 * 「지금 재생」 가사 싱크 상태 — 저장된 시간표(트랙 → 자동 맞추기 캐시), 음원 분석으로 찾은 노래 구간,
 * 곡별 가사 오프셋(±0.25초 단위), 「가사 자동 맞추기」 진행 상태.
 */
export function useLyricSync(track: Track | null | undefined, enabled: boolean) {
  const id = track?.id ?? '';
  const trackLrc = (track?.lrc?.length ?? 0) >= 2 ? track!.lrc! : null;
  const [spans, setSpans] = useState<Span[] | null>(null);
  const [localLrc, setLocalLrc] = useState<TimedLine[] | null>(null);
  const [offset, setOffsetState] = useState(0);
  const [align, setAlign] = useState<AlignState>({ phase: 'idle' });
  const curId = useRef('');

  useEffect(() => {
    curId.current = id;
    setAlign({ phase: 'idle' });
    if (!id) { setSpans(null); setLocalLrc(null); setOffsetState(0); return; }
    setSpans(loadCachedSpans(id));
    setLocalLrc(loadCachedLrc(id));
    setOffsetState(loadOffset(id));
  }, [id]);

  const lrc = trackLrc ?? localLrc;
  const needsAnalysis = enabled && !!id && !!track?.lyrics?.trim() && !lrc && !hasStamps(track?.lyrics) && !spans;

  // 노래 구간 분석 — 재생 주소가 붙을 때까지 잠깐 기다리며 다시 시도한다
  useEffect(() => {
    if (!needsAnalysis) return;
    let dead = false;
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const run = async () => {
      const src = currentAudioSrc();
      if (!src) { if (++tries < 8 && !dead) timer = setTimeout(run, 1200); return; }
      const found = await analyzeSpans(id, src);
      if (!dead && curId.current === id && found) setSpans(found);
    };
    run();
    return () => { dead = true; clearTimeout(timer); };
  }, [needsAnalysis, id]);

  const setOffset = useCallback((v: number) => {
    const next = Math.max(-10, Math.min(10, Math.round(v * 100) / 100));
    setOffsetState(next);
    if (id) saveOffset(id, next);
  }, [id]);

  const runAlign = useCallback(async (lyricLines: string[], dur: number) => {
    const src = currentAudioSrc();
    if (!id || !src || lyricLines.length < 2) { setAlign({ phase: 'fail' }); return; }
    const mine = id;
    setAlign({ phase: 'download', pct: 0 });
    try {
      const out = await autoAlign(src, lyricLines, dur, (phase, pct) => {
        if (curId.current === mine) setAlign({ phase, pct });
      });
      if (curId.current !== mine) return;
      if (!out.ok || !out.lrc) { setAlign({ phase: 'fail' }); return; }
      saveCachedLrc(mine, out.lrc);
      setLocalLrc(out.lrc);
      setAlign({ phase: 'done' });
      // 내 스튜디오 곡이면 LRC 로 저장(실패해도 이 브라우저 캐시는 남는다)
      if (track?.album_id === 'studio-generated') {
        fetch(`/api/song-history/${mine}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc: out.lrc }),
        }).catch(() => { /* 저장 실패는 조용히 */ });
      }
    } catch {
      if (curId.current === mine) setAlign({ phase: 'fail' });
    }
  }, [id, track?.album_id]);

  const resetAlign = useCallback(() => {
    if (!id) return;
    clearCachedLrc(id);
    setLocalLrc(null);
    setAlign({ phase: 'idle' });
  }, [id]);

  return { lrc, spans, offset, setOffset, align, runAlign, resetAlign, hasLocalLrc: !!localLrc && !trackLrc };
}
