import { MasterChain, LoudnessMeter, TruePeakMeter, linToDb, type ChainParams } from './dsp'

const CHUNK = 4096

const tick = () => new Promise<void>(r => setTimeout(r, 0))

export interface DecodedAudio { channels: Float32Array[]; sampleRate: number; duration: number }

/** 압축 파일을 지정 샘플레이트의 PCM 으로 푼다 (OfflineAudioContext 디코더 사용) */
export async function decodeAudio(data: ArrayBuffer, sampleRate = 44100): Promise<DecodedAudio> {
  const ctx = new OfflineAudioContext(2, 1, sampleRate)
  const buf = await ctx.decodeAudioData(data)
  const l = buf.getChannelData(0)
  const r = buf.numberOfChannels > 1 ? buf.getChannelData(1) : l
  return { channels: [l, r], sampleRate: buf.sampleRate, duration: buf.duration }
}

/** 파형 그리기용 최소/최대 묶음 */
export function computePeaks(ch: Float32Array[], buckets: number): Float32Array {
  const out = new Float32Array(buckets * 2)
  const n = ch[0].length
  const step = n / buckets
  for (let b = 0; b < buckets; b++) {
    const s = Math.floor(b * step), e = Math.min(n, Math.floor((b + 1) * step))
    let mn = 0, mx = 0
    // 긴 곡에서도 가볍게 — 묶음 안에서 최대 2000 지점만 본다
    const stride = Math.max(1, Math.floor((e - s) / 2000))
    for (let i = s; i < e; i += stride) {
      const v = (ch[0][i] + ch[1][i]) * 0.5
      if (v < mn) mn = v
      if (v > mx) mx = v
    }
    out[b * 2] = mn; out[b * 2 + 1] = mx
  }
  return out
}

export interface RenderResult {
  channels?: Float32Array<ArrayBuffer>[]
  integrated: number
  truePeak: number
}

/**
 * 체인을 청크 단위로 돌린다. 지연(룩어헤드)은 앞을 잘라 보정한다.
 * write=false 면 출력 버퍼를 만들지 않고 측정만 한다(자동 맞춤 분석용).
 */
export async function renderChain(
  src: Float32Array[],
  fs: number,
  params: ChainParams,
  opts: { start?: number; end?: number; write?: boolean; onProgress?: (p: number) => void; signal?: { cancelled: boolean } } = {},
): Promise<RenderResult> {
  const start = Math.max(0, Math.floor(opts.start ?? 0))
  const end = Math.min(src[0].length, Math.floor(opts.end ?? src[0].length))
  const len = Math.max(0, end - start)
  const chain = new MasterChain(fs, CHUNK)
  chain.meterOn = false
  chain.setParams({ ...params, listenOriginal: false })
  const lat = chain.latency
  const write = opts.write !== false
  const outL = write ? new Float32Array(len) : null
  const outR = write ? new Float32Array(len) : null
  const meter = new LoudnessMeter(fs)
  const tp = new TruePeakMeter()
  const bL = new Float32Array(CHUNK), bR = new Float32Array(CHUNK)
  const total = len + lat
  let produced = 0 // 출력 위치(지연 포함)
  let chunks = 0
  for (let pos = 0; pos < total; pos += CHUNK) {
    const n = Math.min(CHUNK, total - pos)
    for (let i = 0; i < n; i++) {
      const k = start + pos + i
      if (pos + i < len) { bL[i] = src[0][k]; bR[i] = src[1][k] } else { bL[i] = 0; bR[i] = 0 }
    }
    chain.process(bL, bR, bL, bR, n)
    // 앞의 lat 샘플은 지연이라 버린다
    let from = 0
    if (produced < lat) from = Math.min(n, lat - produced)
    const cnt = n - from
    if (cnt > 0) {
      const o = produced + from - lat
      const sl = bL.subarray(from, n), sr = bR.subarray(from, n)
      meter.process(sl, sr, cnt)
      tp.process(sl, sr, cnt)
      if (outL && outR) { outL.set(sl, o); outR.set(sr, o) }
    }
    produced += n
    if (++chunks % 24 === 0) {
      opts.onProgress?.(Math.min(1, pos / total))
      await tick()
      if (opts.signal?.cancelled) throw new Error('cancelled')
    }
  }
  opts.onProgress?.(1)
  return {
    channels: outL && outR ? [outL, outR] : undefined,
    integrated: meter.integrated(),
    truePeak: linToDb(tp.max),
  }
}

/**
 * 타깃 LUFS 에 맞도록 리미터 게인(리미터를 껐으면 입력 트림)을 조정한다.
 * 리미터는 비선형이라 몇 번 다시 재며 좁혀 간다.
 */
export async function autoMatchLoudness(
  src: Float32Array[],
  fs: number,
  params: ChainParams,
  targetLufs: number,
  onProgress?: (p: number) => void,
): Promise<{ params: ChainParams; integrated: number; truePeak: number }> {
  let p: ChainParams = structuredClone(params)
  const useLimiter = !p.bypass.limiter
  let last = { integrated: -Infinity, truePeak: -Infinity }
  const passes = 4
  for (let k = 0; k < passes; k++) {
    last = await renderChain(src, fs, p, { write: false, onProgress: x => onProgress?.((k + x) / passes) })
    if (!isFinite(last.integrated)) break
    const diff = targetLufs - last.integrated
    if (Math.abs(diff) < 0.2) break
    if (useLimiter) p = { ...p, limiter: { ...p.limiter, gain: clamp(p.limiter.gain + diff, -12, 24) } }
    else p = { ...p, inputTrim: clamp(p.inputTrim + diff, -24, 24) }
  }
  onProgress?.(1)
  return { params: p, ...last }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v * 10) / 10))

// ───────────────────────── WAV 쓰기 ─────────────────────────

/** PCM WAV (16/24bit). 16bit 등에서 dither=true 면 TPDF 디더를 더한다 */
export function encodeWav(ch: Float32Array[], fs: number, bits: 16 | 24, dither: boolean, rand: () => number = Math.random): Blob {
  const nCh = ch.length
  const n = ch[0].length
  const bps = bits / 8
  const dataLen = n * nCh * bps
  const buf = new ArrayBuffer(44 + dataLen)
  const v = new DataView(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  w(0, 'RIFF'); v.setUint32(4, 36 + dataLen, true); w(8, 'WAVE')
  w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, nCh, true)
  v.setUint32(24, fs, true); v.setUint32(28, fs * nCh * bps, true); v.setUint16(32, nCh * bps, true); v.setUint16(34, bits, true)
  w(36, 'data'); v.setUint32(40, dataLen, true)
  const full = bits === 16 ? 32767 : 8388607
  const minV = -full - 1
  const u8 = new Uint8Array(buf)
  let o = 44
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nCh; c++) {
      let x = ch[c][i] * full
      if (dither) x += rand() - rand() // TPDF ±1 LSB
      let q = Math.round(x)
      if (q > full) q = full; else if (q < minV) q = minV
      if (bits === 16) { v.setInt16(o, q, true); o += 2 }
      else {
        const u = q < 0 ? q + 0x1000000 : q
        u8[o] = u & 0xff; u8[o + 1] = (u >> 8) & 0xff; u8[o + 2] = (u >> 16) & 0xff; o += 3
      }
    }
  }
  return new Blob([buf], { type: 'audio/wav' })
}
