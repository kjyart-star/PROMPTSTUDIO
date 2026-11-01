'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Track } from '@/types/music';
import type { TimedLine } from '@/lib/player/lyricTiming';
import {
  autoAlign, canAutoAlign, currentAudioSrc, currentAudioTime, loadCachedLrc, markFailed, recentlyFailed, saveCachedLrc,
} from '@/lib/player/lyricSyncClient';
import { LRC_AUTO_VERSION } from '@/lib/studio/lyricsOf';
import { acquireAlignLockSoon, releaseAlignLock } from '@/lib/player/alignLock';
import { fetchSharedLrc, submitSharedLrc } from '@/lib/player/lrcShareClient';

const hasStamps = (raw?: string | null) => /\[\d{1,3}:\d{2}/.test(raw ?? '');

/** 서버에 결과가 아직 없을 때 다시 묻는 간격·최대 시간 */
const POLL_MS = 20_000;
const POLL_MAX_MS = 15 * 60_000;

/**
 * 「지금 재생」 가사 싱크 상태. 시간표 우선순위:
 * 1) track.lrc(서버가 붙여 준 판 3)  2) 서버 조회 결과(회사 PC 가 미리 계산)  3) 이 브라우저의 폴백 계산 결과.
 * 서버에 아직 없으면 재생 중일 때 브라우저가 현재 재생 위치부터 맞추기 시작하고, 줄 일부만 아는 부분 시간표(partial)를 단계적으로 내놓는다.
 * playing: 지금 재생 중인지 — 서버 재조회와 폴백 시작 조건.
 */
export function useLyricSync(track: Track | null | undefined, playing = false) {
  const id = track?.id ?? '';
  const trackLrc = (track?.lrc?.length ?? 0) >= 2 ? track!.lrc! : null;
  const [serverLrc, setServerLrc] = useState<TimedLine[] | null>(null);
  const [localLrc, setLocalLrc] = useState<TimedLine[] | null>(null);
  /** 폴백 계산 중 줄별 시작 초(아직 모르면 null) */
  const [partial, setPartial] = useState<(number | null)[] | null>(null);
  /** 서버 첫 응답을 받은 곡 id — 응답 전에는 브라우저 계산을 시작하지 않는다 */
  const [serverAskedFor, setServerAskedFor] = useState('');
  const [lineKey, setLineKey] = useState('');
  const curId = useRef('');
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const autoTried = useRef('');
  const fallbackCtl = useRef<AbortController | null>(null);
  const linesRef = useRef<{ lines: string[]; dur: number } | null>(null);

  const lrc = trackLrc ?? serverLrc ?? localLrc;
  const wantServer = !!id && !!track?.lyrics?.trim() && !trackLrc && !hasStamps(track?.lyrics);

  // 곡이 바뀌면 상태를 비우고, 이 브라우저의 폴백 캐시(판 3)만 미리 불러 둔다. 하던 폴백 작업은 멈춘다
  useEffect(() => {
    curId.current = id;
    setServerLrc(null);
    setPartial(null);
    setServerAskedFor('');
    setLocalLrc(id ? loadCachedLrc(id) : null);
    return () => { fallbackCtl.current?.abort(); fallbackCtl.current = null; };
  }, [id]);

  // 서버 조회 — 로컬 캐시가 있어도 먼저 묻는다(회사 PC 결과가 브라우저 결과보다 낫다). 없으면 재생 중 20초마다 최대 15분
  useEffect(() => {
    if (!wantServer) return;
    let dead = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const ask = async () => {
      const shared = await fetchSharedLrc(id, LRC_AUTO_VERSION);
      if (dead || curId.current !== id) return;
      if (shared) {
        fallbackCtl.current?.abort(); // 서버 결과가 오면 브라우저 계산은 그만둔다
        setServerLrc(shared);
        setPartial(null);
        setServerAskedFor(id);
        return;
      }
      setServerAskedFor(id);
      if (Date.now() - started >= POLL_MAX_MS) return;
      timer = setTimeout(function again() {
        if (dead || Date.now() - started >= POLL_MAX_MS) return;
        if (!playingRef.current) { timer = setTimeout(again, POLL_MS); return; } // 멈춰 있는 동안은 묻지 않고 기다린다
        void ask();
      }, POLL_MS);
    };
    void ask();
    return () => { dead = true; if (timer) clearTimeout(timer); };
  }, [wantServer, id]);

  // 화면이 넘겨 주는 가사 줄 목록(구간 표지 제외)
  const setAutoInput = useCallback((lines: string[], dur: number) => {
    linesRef.current = { lines, dur };
    const key = lines.join('\n');
    setLineKey((o) => (o === key ? o : key));
  }, []);

  // 폴백: 서버에 결과가 없고 재생 중이면 바로, 현재 재생 위치부터 맞춘다
  const canFallback = wantServer && playing && serverAskedFor === id && !lrc && !!lineKey;
  useEffect(() => {
    if (!canFallback || autoTried.current === id) return;
    if (!canAutoAlign() || recentlyFailed(id)) return;
    const mine = id;
    let dead = false;
    const start = async (retries: number) => {
      const input = linesRef.current;
      const src = currentAudioSrc();
      if (dead || curId.current !== mine || !input || input.lines.length < 2) return;
      if (!src) { if (retries > 0) setTimeout(() => void start(retries - 1), 1000); return; }
      if (!(await acquireAlignLockSoon())) { if (!dead && retries > 0) setTimeout(() => void start(retries - 1), 3000); return; }
      if (dead || curId.current !== mine) { releaseAlignLock(); return; }
      autoTried.current = mine;
      const ctl = new AbortController();
      fallbackCtl.current = ctl;
      try {
        const out = await autoAlign(src, input.lines, input.dur, null, () => { /* 진행률은 화면에 보이지 않는다 */ }, ctl.signal, {
          startSec: currentAudioTime(),
          onPartial: (starts) => { if (!ctl.signal.aborted && curId.current === mine) setPartial(starts); },
        });
        if (ctl.signal.aborted || curId.current !== mine) return;
        if (!out.ok || !out.lrc) { markFailed(mine); setPartial(null); return; }
        saveCachedLrc(mine, out.lrc);
        setLocalLrc(out.lrc);
        setPartial(null);
        if (track?.album_id === 'studio-generated') {
          // 내 스튜디오 곡: 사용자가 올린 LRC(form.lrc)는 건드리지 않고 자동 맞춤 전용 필드(lrc_auto)에만 저장한다
          fetch(`/api/song-history/${mine}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lrc_auto: out.lrc, lrc_auto_v: LRC_AUTO_VERSION }),
          }).catch(() => { /* 저장 실패는 조용히 */ });
        } else {
          // 공개 곡: 별도 공유 테이블에 제출(로그인한 사용자만, 서버가 검증하고 첫 유효값만 쓴다)
          void submitSharedLrc(mine, out.lrc, LRC_AUTO_VERSION);
        }
      } catch {
        if (ctl.signal.aborted) return; // 서버 결과가 와서 멈춘 것 — 실패가 아니다
        markFailed(mine);
        if (curId.current === mine) setPartial(null);
      } finally {
        releaseAlignLock();
        if (fallbackCtl.current === ctl) fallbackCtl.current = null;
      }
    };
    void start(10);
    return () => { dead = true; };
  }, [canFallback, id, track?.album_id]);

  return { lrc, partial: lrc ? null : partial, setAutoInput };
}
