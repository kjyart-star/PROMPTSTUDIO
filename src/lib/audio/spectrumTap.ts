/**
 * 재생 중인 <audio> 의 실제 스펙트럼을 읽는 공용 모듈 (AnalyserNode).
 * 지금 재생 화면의 막대, 미니 플레이어, 재생목록 영상 만들기가 같이 쓴다.
 *
 * 소리가 끊기지 않는 것이 분석보다 우선이다.
 *  - createMediaElementSource 는 한 번 붙이면 되돌릴 수 없고, CORS 가 안 된 음원이면 무음이 된다.
 *    그래서 audio.crossOrigin === 'anonymous' 로 불러온 음원(= CORS 통과가 증명됨)에만 붙인다.
 *  - AudioContext 가 running 이 아니면(자동재생 정책) 붙이지 않는다 — 붙인 뒤 정지 상태면 무음이 되기 때문.
 *  - 실패하면 null 을 돌려주고 호출자는 분석 없이 그대로 재생한다.
 */

export interface SpectrumTap {
  /** 0~255 주파수 막대 값. 분석 불가 상태면 null */
  getFrequencyData: () => Uint8Array | null;
  /** 컨텍스트가 멈췄다면 다시 깨운다(재생 이벤트마다 호출해도 안전) */
  resume: () => void;
}

const taps = new WeakMap<HTMLAudioElement, SpectrumTap>();

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && (navigator.maxTouchPoints ?? 0) > 1);
}

export function getSpectrumTap(audio: HTMLAudioElement): SpectrumTap | null {
  return taps.get(audio) ?? null;
}

/** audio 에 분석 노드를 붙인다. 이미 붙어 있으면 그대로 돌려준다. 못 붙이면 null(재생에는 영향 없음). */
export async function attachSpectrumTap(audio: HTMLAudioElement): Promise<SpectrumTap | null> {
  const existing = taps.get(audio);
  if (existing) { existing.resume(); return existing; }
  try {
    if (typeof window === 'undefined') return null;
    if (audio.crossOrigin !== 'anonymous') return null;
    if (isIOS()) return null; // iOS 는 웹오디오 경유 시 잠금 화면·백그라운드 재생이 끊길 수 있어 분석하지 않는다
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    try { await ctx.resume(); } catch { /* 아래에서 상태로 판단 */ }
    if (ctx.state !== 'running') { void ctx.close().catch(() => {}); return null; }

    const source = ctx.createMediaElementSource(audio);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.78;
    source.connect(analyser);
    analyser.connect(ctx.destination);

    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tap: SpectrumTap = {
      getFrequencyData: () => {
        if (ctx.state !== 'running') return null;
        analyser.getByteFrequencyData(buf);
        return buf;
      },
      resume: () => { if (ctx.state !== 'running') void ctx.resume().catch(() => {}); },
    };
    taps.set(audio, tap);
    return tap;
  } catch {
    return null;
  }
}

/** 주파수 배열을 n 개 막대(0~1)로 줄인다. 저음~고음을 로그 간격으로 묶는다. */
export function binSpectrum(data: Uint8Array, n: number, out?: number[]): number[] {
  const res = out ?? new Array<number>(n).fill(0);
  const usable = Math.floor(data.length * 0.75);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(Math.pow(i / n, 1.8) * usable);
    const b = Math.max(a + 1, Math.floor(Math.pow((i + 1) / n, 1.8) * usable));
    let sum = 0;
    for (let k = a; k < b; k++) sum += data[k];
    res[i] = sum / (b - a) / 255;
  }
  return res;
}
