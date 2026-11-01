'use client';

/**
 * 가사 싱크 — 브라우저 쪽 작업(음원 내려받아 디코드, 노래 구간 분석, 음성 인식으로 가사 맞추기)과 곡별 캐시.
 * 서버·유료 호출은 쓰지 않는다. 캐시는 localStorage 이고 원본 가사는 건드리지 않는다.
 */

import { findVocalSpans, type Span } from './vocalSpans';
import { finalizeAlignment, lowConfidenceOf, ONSET_LEAD_SEC } from './lyricAlign';
import type { TimedLine } from './lyricTiming';
import { whisperWorkerScript } from './whisperWorkerSource';
import { isMobileUA } from '@/lib/lyricsSync/platform';

const SR = 16000;
const SPANS_KEY = 'cm.lyric-spans.v1:';
/**
 * v3(2026-11-02): 서버(회사 PC)가 판 3 을 미리 계산한다. 브라우저 폴백 결과도 판 3 키에 따로 담아 옛 v2 캐시는 읽지 않는다.
 * (곡별 가사 오프셋 cm.lyric-offset.* 는 더 이상 읽지 않는다 — 지우지는 않는다.)
 */
const LRC_KEY = 'cm.lyric-lrc.v3:';

function read<T>(key: string): T | null {
  try { const v = localStorage.getItem(key); return v ? (JSON.parse(v) as T) : null; } catch { return null; }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* 저장 공간 없음 — 캐시 없이 계속 */ }
}

const loadCachedSpans = (id: string) => read<Span[]>(SPANS_KEY + id);
export const loadCachedLrc = (id: string) => read<TimedLine[]>(LRC_KEY + id);
export const saveCachedLrc = (id: string, lrc: TimedLine[]) => write(LRC_KEY + id, lrc);

/** 지금 재생 중인 곡의 실제 재생 주소(서명·CORS 처리가 끝난 값) */
export function currentAudioSrc(): string {
  if (typeof document === 'undefined') return '';
  for (const el of Array.from(document.querySelectorAll('audio'))) if (el.currentSrc) return el.currentSrc;
  return '';
}

/** 지금 재생 중인 오디오 요소의 재생 위치(초) */
export function currentAudioTime(): number {
  if (typeof document === 'undefined') return 0;
  for (const el of Array.from(document.querySelectorAll('audio'))) if (el.currentSrc) return el.currentTime || 0;
  return 0;
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

/**
 * 이 기기에서 자동으로 음성 인식을 돌려도 되는지 — 폰·태블릿, 데이터 절약, 느린 회선, 저메모리면 돌리지 않는다
 * (모델 77~291MB 를 받지 않는다). 그 곡은 서버 무료 큐와 데스크톱 사용자가 채운다.
 */
export function canAutoAlign(): boolean {
  if (typeof window === 'undefined' || typeof Worker === 'undefined') return false;
  const nav = navigator as any;
  if (nav.userAgentData?.mobile === true || isMobileUA(nav.userAgent)) return false;
  // iPadOS 는 데스크톱 사파리처럼 보인다 — 터치 전용 기기면 폰·태블릿으로 본다
  if (/Macintosh/.test(String(nav.userAgent || '')) && Number(nav.maxTouchPoints) > 1) return false;
  if (nav.connection?.saveData) return false;
  if (/(^|-)2g$|3g/.test(String(nav.connection?.effectiveType || ''))) return false;
  if (typeof nav.deviceMemory === 'number' && nav.deviceMemory < 4) return false;
  return true;
}

/**
 * 공개 단계에서 공개하는 사람 기기가 계산할 수 있는지 — 폰·태블릿·데이터 절약 규칙은 듣기 단계에만 적용하고 여기서는 풀어 둔다.
 * (2026-11-02 결정: 처리 능력이 공개하는 사람 수에 비례해야 하므로 공개자 기기가 반드시 계산한다)
 */
export function canAlignForPublish(): boolean {
  return typeof window !== 'undefined' && typeof Worker !== 'undefined';
}

/** 배터리가 부족한지(충전 중이 아니고 30% 미만). 알 수 없으면 부족하지 않다고 본다 */
export async function batteryLow(): Promise<boolean> {
  try {
    const get = (navigator as any).getBattery as undefined | (() => Promise<{ level: number; charging: boolean }>);
    if (!get) return false;
    const b = await get.call(navigator);
    return !b.charging && b.level < 0.3;
  } catch {
    return false;
  }
}

const FAIL_KEY = 'cm.lyric-autofail.v2:';
const RETRY_AFTER_MS = 7 * 24 * 3600 * 1000;
export const recentlyFailed = (id: string) => {
  const t = Number(read<number>(FAIL_KEY + id));
  return !!t && Date.now() - t < RETRY_AFTER_MS;
};
export type AlignPhase = 'decode' | 'download' | 'listen';
export interface AlignOutcome {
  ok: boolean; lrc?: TimedLine[];
  /** 정렬기가 직접 찾지 못하고 이웃 사이를 채운 줄이 10% 넘음 — 만든 사람에게 「가사 시간 확인」을 권한다 */
  lowConfidence?: boolean;
}
export interface AlignOptions {
  /** 재생 위치(초) — 이 근처 가사 줄부터 먼저 맞춘다 */
  startSec?: number;
  /** 창 하나가 끝날 때마다 줄별 시작 초(아직 모르면 null, 소리보다 앞당긴 값)를 알린다 */
  onPartial?: (starts: (number | null)[]) => void;
  /** 어떤 장치로 돌리는지('webgpu' | 'wasm') */
  onDevice?: (device: string) => void;
  /** WebGPU 를 쓰지 않고 WASM q8 로만(메모리 부족 재시도) */
  forceWasm?: boolean;
}

export const markFailed = (id: string) => write(FAIL_KEY + id, Date.now());

/** 부분 결과의 시작 초를 화면용으로 바꾼다 — 소리보다 살짝 앞당기고(finalizeAlignment 와 같은 값), 모르는 줄은 null */
export const leadStarts = (raw: (number | null)[]): (number | null)[] =>
  raw.map((v) => (v === null || v === undefined || !isFinite(v) ? null : Math.round(Math.max(0, v - ONSET_LEAD_SEC) * 100) / 100));

/** 워커에서 whisper base(WebGPU fp32, 없으면 WASM q8)로 줄 시작 시각을 강제 정렬한다. 끝나면 워커를 내린다(모델 파일은 브라우저 캐시에 남는다) */
function forceAlign(samples: Float32Array, lines: string[], spans: Span[] | null, onPhase: (p: AlignPhase, pct: number) => void, signal?: AbortSignal, opts?: AlignOptions): Promise<(number | null)[]> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) { reject(new Error('aborted')); return; }
    const url = URL.createObjectURL(new Blob([whisperWorkerScript()], { type: 'text/javascript' }));
    const worker = new Worker(url, { type: 'module' });
    const done = () => { signal?.removeEventListener('abort', onAbort); worker.terminate(); URL.revokeObjectURL(url); };
    const onAbort = () => { done(); reject(new Error('aborted')); };
    signal?.addEventListener('abort', onAbort);
    worker.onmessage = (e: MessageEvent) => {
      const m = e.data;
      if (m.type === 'download') onPhase('download', m.pct);
      else if (m.type === 'listen') onPhase('listen', m.pct);
      else if (m.type === 'device') opts?.onDevice?.(m.device);
      else if (m.type === 'partial') opts?.onPartial?.(leadStarts(m.starts as (number | null)[]));
      else if (m.type === 'result') { done(); resolve(m.starts as (number | null)[]); }
      else if (m.type === 'error') { done(); reject(new Error(m.message)); }
    };
    worker.onerror = (e) => { done(); reject(new Error(e.message || 'worker')); };
    const copy = new Float32Array(samples); // 원본은 호출한 쪽이 계속 쓴다
    worker.postMessage({ samples: copy, lines, spans, startSec: opts?.startSec ?? 0, forceWasm: !!opts?.forceWasm }, [copy.buffer]);
  });
}

/** 원문 가사의 줄 시작 시간을 찾는다. 실패하면 ok:false */
export async function autoAlign(
  url: string, lyricLines: string[], durationSec: number, spans: Span[] | null,
  onPhase: (phase: AlignPhase, pct: number) => void,
  signal?: AbortSignal,
  opts?: AlignOptions,
): Promise<AlignOutcome> {
  onPhase('decode', 0);
  const samples = await decodeMono(url);
  if (signal?.aborted) throw new Error('aborted');
  onPhase('download', 0);
  const raw = await forceAlign(samples, lyricLines, spans, onPhase, signal, opts);
  const starts = finalizeAlignment(raw, durationSec || samples.length / SR);
  if (!starts) return { ok: false };
  return { ok: true, lrc: lyricLines.map((text, i) => ({ t: starts[i], text })), lowConfidence: lowConfidenceOf(raw) };
}
