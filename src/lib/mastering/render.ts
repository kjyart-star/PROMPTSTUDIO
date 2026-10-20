import { MasterChain, LoudnessMeter, TruePeakMeter, Biquad, designShelf, designPeaking, defaultEdit, linToDb, dbToLin, type ChainParams, type EditParams } from './dsp'

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
  opts: { start?: number; end?: number; write?: boolean; edit?: EditParams; onProgress?: (p: number) => void; signal?: { cancelled: boolean } } = {},
): Promise<RenderResult> {
  const edit = opts.edit ?? defaultEdit()
  // 앞뒤 자르기(편집)와 요청 구간 중 좁은 쪽
  const eStart = Math.floor(edit.start * fs), eEnd = edit.end > 0 ? Math.floor(edit.end * fs) : src[0].length
  const start = Math.max(0, Math.floor(opts.start ?? 0), eStart)
  const end = Math.min(src[0].length, Math.floor(opts.end ?? src[0].length), eEnd)
  const len = Math.max(0, end - start)
  const chain = new MasterChain(fs, CHUNK)
  chain.meterOn = false
  chain.setParams({ ...params, listenOriginal: false })
  chain.setEdit(edit)
  chain.setPosition(start / fs)
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
  edit?: EditParams,
): Promise<{ params: ChainParams; integrated: number; truePeak: number }> {
  let p: ChainParams = structuredClone(params)
  const useLimiter = !p.bypass.limiter
  let last = { integrated: -Infinity, truePeak: -Infinity }
  const passes = 4
  for (let k = 0; k < passes; k++) {
    last = await renderChain(src, fs, p, { write: false, edit, onProgress: x => onProgress?.((k + x) / passes) })
    if (!isFinite(last.integrated)) break
    const diff = targetLufs - last.integrated
    if (Math.abs(diff) < 0.2) break
    if (useLimiter) p = { ...p, limiter: { ...p.limiter, gain: clamp(p.limiter.gain + diff, -30, 24) } }
    else p = { ...p, inputTrim: clamp(p.inputTrim + diff, -24, 24) }
  }
  onProgress?.(1)
  return { params: p, ...last }
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, Math.round(v * 10) / 10))


// ───────────────────────── 스템 믹스 ─────────────────────────

export interface StemMix {
  channels: Float32Array[]
  gain: number
  pan: number
  mute: boolean
  solo: boolean
  eq: { low: number; mid: number; high: number }
}

/** 스템마다 게인·팬·3밴드 EQ 를 걸고 더한다 (가장 긴 스템 길이) */
export async function mixStems(stems: StemMix[], fs: number): Promise<Float32Array<ArrayBuffer>[]> {
  const n = Math.max(0, ...stems.map(s => s.channels[0].length))
  const L = new Float32Array(n), R = new Float32Array(n)
  const anySolo = stems.some(s => s.solo)
  for (const s of stems) {
    if (s.mute || (anySolo && !s.solo)) continue
    const fl = [new Biquad(), new Biquad(), new Biquad()]
    fl[0].set(designShelf('low', 120, s.eq.low, 0.7071, fs))
    fl[1].set(designPeaking(1000, s.eq.mid, 0.8, fs))
    fl[2].set(designShelf('high', 8000, s.eq.high, 0.7071, fs))
    const flat = s.eq.low === 0 && s.eq.mid === 0 && s.eq.high === 0
    const g = dbToLin(s.gain)
    const ang = ((Math.max(-100, Math.min(100, s.pan)) + 100) / 200) * (Math.PI / 2)
    // 등전력 팬: 가운데에서 1, 끝에서 √2
    const gl = g * Math.cos(ang) * Math.SQRT2, gr = g * Math.sin(ang) * Math.SQRT2
    const a = s.channels[0], b = s.channels[1] ?? a
    for (let i = 0; i < a.length; i++) {
      let l = a[i], r = b[i]
      if (!flat) for (const f of fl) { l = f.l(l); r = f.r(r) }
      L[i] += l * gl; R[i] += r * gr
      if ((i & 0xfffff) === 0) await tick()
    }
  }
  return [L, R]
}

// ───────────────────────── 앨범 이어 붙이기 ─────────────────────────

export interface AlbumPiece { channels: Float32Array[]; gapAfter: number; xfadeAfter: number }

/** 곡 사이에 간격(초)을 두거나 크로스페이드(초, 등전력)로 겹친다 */
export function joinAlbum(pieces: AlbumPiece[], fs: number): Float32Array<ArrayBuffer>[] {
  let total = 0
  pieces.forEach((p, i) => {
    total += p.channels[0].length
    if (i < pieces.length - 1) {
      const x = Math.round(Math.min(p.xfadeAfter * fs, p.channels[0].length, pieces[i + 1].channels[0].length))
      total += x ? -x : Math.round(p.gapAfter * fs)
    }
  })
  const L = new Float32Array(Math.max(0, total)), R = new Float32Array(Math.max(0, total))
  let pos = 0
  pieces.forEach((p, i) => {
    const a = p.channels[0], b = p.channels[1] ?? a
    const xin = i > 0 ? Math.round(Math.min(pieces[i - 1].xfadeAfter * fs, pieces[i - 1].channels[0].length, a.length)) : 0
    const xout = i < pieces.length - 1 ? Math.round(Math.min(p.xfadeAfter * fs, a.length, pieces[i + 1].channels[0].length)) : 0
    for (let k = 0; k < a.length; k++) {
      let g = 1
      if (k < xin) g *= Math.sin((Math.PI / 2) * (k / xin))
      if (xout && k >= a.length - xout) g *= Math.cos((Math.PI / 2) * ((k - (a.length - xout)) / xout))
      const j = pos + k
      if (j >= 0 && j < L.length) { L[j] += a[k] * g; R[j] += b[k] * g }
    }
    pos += a.length - xout + (i < pieces.length - 1 && !xout ? Math.round(p.gapAfter * fs) : 0)
  })
  return [L, R]
}

export { linToDb }
