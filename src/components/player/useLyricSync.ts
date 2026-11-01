'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@/types/music';
import type { Span } from '@/lib/player/vocalSpans';
import type { TimedLine } from '@/lib/player/lyricTiming';
import {
  analyzeSpans, autoAlign, canAutoAlign, clearCachedLrc, currentAudioSrc, loadCachedLrc, loadCachedSpans,
  loadOffset, markFailed, recentlyFailed, saveCachedLrc, saveOffset, takeLegacyOffset,
} from '@/lib/player/lyricSyncClient';
import { LRC_AUTO_VERSION } from '@/lib/studio/lyricsOf';

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
/** 한 번에 한 곡만 음성 인식을 돌린다(브라우저 부담) */
let aligning = false;

/**
 * playing: 지금 재생 중인지 — 곡을 처음 재생할 때 유휴 시간에 자동으로 가사 맞추기를 시작한다.
 */
export function useLyricSync(track: Track | null | undefined, enabled: boolean, playing = false) {
  const id = track?.id ?? '';
  const trackLrc = (track?.lrc?.length ?? 0) >= 2 ? track!.lrc! : null;
  const [spans, setSpans] = useState<Span[] | null>(null);
  const [localLrc, setLocalLrc] = useState<TimedLine[] | null>(null);
  const [offset, setOffsetState] = useState(0);
  const [align, setAlign] = useState<AlignState>({ phase: 'idle' });
  /** 옛 시간표에 맞춰 넣었던 오프셋을 초기화했는지 — 화면에 「다시 맞췄어요」 */
  const [realigned, setRealigned] = useState(false);
  const curId = useRef('');
  const spansRef = useRef<Span[] | null>(null);
  spansRef.current = spans;
  const autoTried = useRef('');
  const linesRef = useRef<{ lines: string[]; dur: number } | null>(null);

  useEffect(() => {
    curId.current = id;
    setAlign({ phase: 'idle' });
    if (!id) { setSpans(null); setLocalLrc(null); setOffsetState(0); setRealigned(false); return; }
    setSpans(loadCachedSpans(id));
    setLocalLrc(loadCachedLrc(id));
    setOffsetState(loadOffset(id));
    setRealigned(takeLegacyOffset(id));
  }, [id]);

  const lrc = trackLrc ?? localLrc;
  const needsAnalysis = (enabled || playing) && !!id && !!track?.lyrics?.trim() && !lrc && !hasStamps(track?.lyrics) && !spans;

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
    if (aligning) return;
    aligning = true;
    setAlign({ phase: 'download', pct: 0 });
    try {
      const out = await autoAlign(src, lyricLines, dur, spansRef.current, (phase, pct) => {
        if (curId.current === mine) setAlign({ phase, pct });
      });
      if (curId.current !== mine) return;
      if (!out.ok || !out.lrc) { markFailed(mine); setAlign({ phase: 'fail' }); return; }
      saveCachedLrc(mine, out.lrc);
      setLocalLrc(out.lrc);
      setAlign({ phase: 'done' });
      // 내 스튜디오 곡이면 LRC 로 저장(실패해도 이 브라우저 캐시는 남는다)
      if (track?.album_id === 'studio-generated') {
        // 사용자가 올린 LRC(form.lrc)는 건드리지 않고 자동 맞춤 전용 필드(lrc_auto)에만 저장한다
        fetch(`/api/song-history/${mine}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc_auto: out.lrc, lrc_auto_v: LRC_AUTO_VERSION }),
        }).catch(() => { /* 저장 실패는 조용히 */ });
      }
    } catch {
      markFailed(mine);
      if (curId.current === mine) setAlign({ phase: 'fail' });
    } finally {
      aligning = false;
    }
  }, [id, track?.album_id]);

  const resetAlign = useCallback(() => {
    if (!id) return;
    clearCachedLrc(id);
    setLocalLrc(null);
    setAlign({ phase: 'idle' });
  }, [id]);

  // 곡을 처음 재생할 때 유휴 시간에 자동으로 맞춘다. 줄 목록은 화면(추정 계산)이 넘겨 준다.
  const setAutoInput = useCallback((lines: string[], dur: number) => { linesRef.current = { lines, dur }; }, []);
  const canAuto = playing && !!id && !!track?.lyrics?.trim() && !lrc && !hasStamps(track?.lyrics) && align.phase === 'idle';
  useEffect(() => {
    if (!canAuto || autoTried.current === id) return;
    if (!canAutoAlign() || recentlyFailed(id)) return;
    let dead = false;
    const start = () => {
      const input = linesRef.current;
      if (dead || !input || autoTried.current === id || !currentAudioSrc()) return;
      autoTried.current = id;
      runAlign(input.lines, input.dur);
    };
    // 분석(노래 구간)이 먼저 끝나도록 잠깐 기다린 뒤, 브라우저가 한가할 때 시작
    const t = setTimeout(() => {
      const ric = (window as any).requestIdleCallback as undefined | ((cb: () => void, o?: { timeout: number }) => number);
      if (ric) ric(start, { timeout: 8000 }); else start();
    }, 4000);
    return () => { dead = true; clearTimeout(t); };
  }, [canAuto, id, runAlign, spans]);

  return { lrc, spans, offset, setOffset, align, runAlign, resetAlign, setAutoInput, hasLocalLrc: !!localLrc && !trackLrc, realigned };
}
