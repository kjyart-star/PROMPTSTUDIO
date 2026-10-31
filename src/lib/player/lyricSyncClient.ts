'use client';

/**
 * 가사 싱크 — 브라우저 쪽 작업(음원 내려받아 디코드, 노래 구간 분석, 음성 인식으로 가사 맞추기)과 곡별 캐시.
 * 서버·유료 호출은 쓰지 않는다. 캐시는 localStorage 이고 원본 가사는 건드리지 않는다.
 */

import { findVocalSpans, type Span } from './vocalSpans';
import { alignLyricsToSegments, type AsrSegment } from './lyricAlign';
import type { TimedLine } from './lyricTiming';

const SR = 16000;
const SPANS_KEY = 'cm.lyric-spans.v1:';
const LRC_KEY = 'cm.lyric-lrc.v1:';
const OFFSET_KEY = 'cm.lyric-offset.v1:';
const TRANSFORMERS_URL = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.6';
const WHISPER_MODEL = 'onnx-community/whisper-base_timestamped';

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
export async function decodeMono(url: string): Promise<Float32Array> {
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

let asrPromise: Promise<any> | null = null;
async function getAsr(onProgress: (pct: number) => void) {
  if (!asrPromise) {
    asrPromise = (async () => {
      const tf: any = await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ TRANSFORMERS_URL);
      tf.env.allowLocalModels = false;
      try { tf.env.backends.onnx.wasm.proxy = true; } catch { /* 지원 안 하면 그냥 진행 */ }
      const files = new Map<string, { loaded: number; total: number }>();
      return tf.pipeline('automatic-speech-recognition', WHISPER_MODEL, {
        dtype: 'q8',
        progress_callback: (p: any) => {
          if (p?.status === 'progress' && p.file) {
            files.set(p.file, { loaded: p.loaded, total: p.total });
            let l = 0, t = 0;
            files.forEach((f) => { l += f.loaded; t += f.total; });
            if (t) onProgress(Math.round((l / t) * 100));
          }
        },
      });
    })().catch((e) => { asrPromise = null; throw e; });
  }
  return asrPromise;
}

export type AlignPhase = 'download' | 'listen';
export interface AlignOutcome { ok: boolean; lrc?: TimedLine[] }

/** 음성 인식으로 원문 가사의 줄 시작 시간을 찾는다. 실패하면 ok:false */
export async function autoAlign(
  url: string, lyricLines: string[], durationSec: number,
  onPhase: (phase: AlignPhase, pct: number) => void,
): Promise<AlignOutcome> {
  const samples = await decodeMono(url);
  onPhase('download', 0);
  const asr = await getAsr((pct) => onPhase('download', pct));
  onPhase('listen', 0);
  const out = await asr(samples, {
    language: 'korean', task: 'transcribe', return_timestamps: true,
    chunk_length_s: 30, stride_length_s: 5, no_repeat_ngram_size: 3, repetition_penalty: 1.3,
  });
  const segs: AsrSegment[] = (out?.chunks ?? [])
    .filter((c: any) => c?.timestamp && isFinite(c.timestamp[0]))
    .map((c: any) => ({ text: String(c.text || ''), start: c.timestamp[0], end: c.timestamp[1] ?? c.timestamp[0] }));
  const res = alignLyricsToSegments(lyricLines, segs, durationSec || samples.length / SR);
  if (!res.ok) return { ok: false };
  return { ok: true, lrc: lyricLines.map((text, i) => ({ t: Math.round(res.lines[i].t * 100) / 100, text })) };
}
