'use client';

/**
 * 가사 싱크 — 브라우저 쪽 작업(음원 내려받아 디코드, 노래 구간 분석, 음성 인식으로 가사 맞추기)과 곡별 캐시.
 * 서버·유료 호출은 쓰지 않는다. 캐시는 localStorage 이고 원본 가사는 건드리지 않는다.
 */

import { findVocalSpans, type Span } from './vocalSpans';
import { finalizeAlignment } from './lyricAlign';
import type { TimedLine } from './lyricTiming';
import { whisperWorkerScript } from './whisperWorkerSource';

const SR = 16000;
const SPANS_KEY = 'cm.lyric-spans.v1:';
const LRC_KEY = 'cm.lyric-lrc.v1:';
const OFFSET_KEY = 'cm.lyric-offset.v1:';

function read<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 공간 없음 — 캐시 없이 계속 */ }
}

export const loadCachedSpans = (id: string) => read<Span[]>(SPANS_KEY + id);
export const loadCachedLrc = (id: string) => read<TimedLine[]>(LRC_KEY + id);
export const saveCachedLrc = (id: string, lrc: TimedLine[]) => write(LRC_KEY + id, lrc);
export const clearCachedLrc = (id: string) => { try { localStorage.removeItem(LRC_KEY + id); } catch { /* ignore */ } };
export const loadOffset = (id: string): number => {
  const v = Number(read<number>(OFFSET_KEY + id));
  return isFinite(v) ? v : 0;
};
export const saveOffset = (id: string, v: number) => write(OFFSET_KEY + id, v);

/** 지금 재생 중인 곡의 실제 재생 주소(서명·CORS 처리가 끝난 값) */
export function currentAudioSrc(): string {
  if (typeof document === 'undefined') return '';
  for (const el of Array.from(document.querySelectorAll('audio'))) if (el.currentSrc) return el.currentSrc;
  return '';
}

/** 주소의 음원을 16kHz 모노로 디코드한다 */
let lastDecoded: { url: string; samples: Float32Array } | null = null;
export async function decodeMono(url: string): Promise<Float32Array> {
  if (lastDecoded?.url === url) return lastDecoded.samples;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`audio ${res.status}`);
  const buf = await res.arrayBuffer();
  const Ctx = (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext) as typeof OfflineAudioContext;
  const ctx = new Ctx(1, SR, SR);
  const audio = await ctx.decodeAudioData(buf);
  const out = new Float32Array(audio.length);
  for (let c = 0; c < audio.numberOfChannels; c++) {
    const ch = audio.getChannelData(c);
    for (let i = 0; i < out.length; i++) out[i] += ch[i] / audio.numberOfChannels;
  }
  lastDecoded = { url, samples: out };
  return out;
}

/** 노래 구간 — 캐시가 있으면 그대로, 없으면 음원을 분석해 캐시한다. 실패하면 null(길이 비례 추정 유지) */
export async function analyzeSpans(id: string, url: string): Promise<Span[] | null> {
  const cached = loadCachedSpans(id);
  if (cached?.length) return cached;
  try {
    const spans = findVocalSpans(await decodeMono(url), SR);
    write(SPANS_KEY + id, spans);
    return spans;
  } catch {
    return null;
  }
}

/** 이 기기에서 자동으로 음성 인식을 돌려도 되는지 — 데이터 절약·저사양·모바일 회선이면 자동 실행하지 않는다(버튼은 그대로 쓸 수 있다) */
export function canAutoAlign(): boolean {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return false;
  const nav = navigator as any;
  if (nav.connection?.saveData) return false;
  if (/(^|-)2g$|3g/.test(String(nav.connection?.effectiveType || ''))) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;
  return true;
}

const FAIL_KEY = 'cm.lyric-autofail.v1:';
const RETRY_AFTER_MS = 7 * 24 * 3600 * 1000;
export const recentlyFailed = (id: string) => {
  const t = Number(read<number>(FAIL_KEY + id));
  return !!t && Date.now() - t < RETRY_AFTER_MS;
};
export type AlignPhase = 'download' | 'listen';
export interface AlignOutcome { ok: boolean; lrc?: TimedLine[] }

export const markFailed = (id: string) => write(FAIL_KEY + id, Date.now());

/** 워커에서 whisper small(양자화)로 줄 시작 시각을 강제 정렬한다. 끝나면 워커를 내린다(모델 파일은 브라우저 캐시에 남는다) */
function forceAlign(samples: Float32Array, lines: string[], spans: Span[] | null, onPhase: (p: AlignPhase, pct: number) => void): Promise<(number | null)[]> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([whisperWorkerScript()], { type: 'text/javascript' }));
    const worker = new Worker(url, { type: 'module' });
    const done = () => { worker.terminate(); URL.revokeObjectURL(url); };
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'download') onPhase('download', m.pct);
      else if (m.type === 'listen') onPhase('listen', m.pct);
      else if (m.type === 'result') { done(); resolve(m.starts as (number | null)[]); }
      else if (m.type === 'error') { done(); reject(new Error(m.message)); }
    };
    worker.onerror = (e) => { done(); reject(new Error(e.message || 'worker')); };
    const copy = new Float32Array(samples); // 원본은 호출한 쪽이 계속 쓴다
    worker.postMessage({ samples: copy, lines, spans }, [copy.buffer]);
  });
}

/** 원문 가사의 줄 시작 시간을 찾는다. 실패하면 ok:false */
export async function autoAlign(
  url: string, lyricLines: string[], durationSec: number, spans: Span[] | null,
  onPhase: (phase: AlignPhase, pct: number) => void,
): Promise<AlignOutcome> {
  const samples = await decodeMono(url);
  onPhase('download', 0);
  const starts = finalizeAlignment(await forceAlign(samples, lyricLines, spans, onPhase), durationSec || samples.length / SR);
  if (!starts) return { ok: false };
  return { ok: true, lrc: lyricLines.map((text, i) => ({ t: starts[i], text })) };
}
