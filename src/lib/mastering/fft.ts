/**
 * FFT 와 리니어 페이즈 FIR (분할 컨볼루션).
 * import 없이 쓴다 — 워크릿 빌드가 dsp.ts 앞에 그대로 붙인다.
 */

/** 제자리 복소 FFT (radix-2). n 은 2의 거듭제곱. inverse 면 1/n 까지 나눈다 */
export class FFT {
  readonly n: number
  private cos: Float64Array
  private sin: Float64Array
  private rev: Uint32Array
  constructor(n: number) {
    this.n = n
    this.cos = new Float64Array(n / 2)
    this.sin = new Float64Array(n / 2)
    for (let i = 0; i < n / 2; i++) { this.cos[i] = Math.cos((2 * Math.PI * i) / n); this.sin[i] = Math.sin((2 * Math.PI * i) / n) }
    this.rev = new Uint32Array(n)
    const bits = Math.round(Math.log2(n))
    for (let i = 0; i < n; i++) {
      let r = 0
      for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b)
      this.rev[i] = r
    }
  }
  transform(re: Float64Array, im: Float64Array, inverse = false) {
    const n = this.n
    for (let i = 0; i < n; i++) {
      const j = this.rev[i]
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t }
    }
    const sgn = inverse ? 1 : -1
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size
      for (let i = 0; i < n; i += size) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const wr = this.cos[k], wi = sgn * this.sin[k]
          const a = i + j, b = a + half
          const tr = re[b] * wr - im[b] * wi
          const ti = re[b] * wi + im[b] * wr
          re[b] = re[a] - tr; im[b] = im[a] - ti
          re[a] += tr; im[a] += ti
        }
      }
    }
    if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n }
  }
}

/**
 * 크기 응답 함수(Hz → 선형 배율)로 리니어 페이즈 FIR 을 만든다.
 * 주파수 표본화 + 블랙맨 창. 길이는 홀수(taps), 지연은 (taps-1)/2.
 */
export function designLinearPhaseFir(mag: (f: number) => number, fs: number, taps = 4095): Float64Array {
  const M = 16384
  const fft = new FFT(M)
  const re = new Float64Array(M), im = new Float64Array(M)
  for (let k = 0; k <= M / 2; k++) {
    const v = mag((k * fs) / M)
    re[k] = v
    if (k > 0 && k < M / 2) re[M - k] = v
  }
  fft.transform(re, im, true)
  const h = new Float64Array(taps)
  const c = (taps - 1) / 2
  for (let i = 0; i < taps; i++) {
    const n = i - c
    const idx = ((n % M) + M) % M
    const w = 0.42 + 0.5 * Math.cos((Math.PI * n) / (c + 1)) + 0.08 * Math.cos((2 * Math.PI * n) / (c + 1))
    h[i] = re[idx] * w
  }
  return h
}

/** 균일 분할 FFT 컨볼루션 (스테레오). 지연 = 블록 B. */
export class PartitionedConvolver {
  readonly B: number
  private fft: FFT
  private parts: { re: Float64Array; im: Float64Array }[] = []
  private hist: { re: Float64Array; im: Float64Array }[][] = [[], []] // 채널별 입력 스펙트럼 링
  private hpos = 0
  private inBuf: Float64Array[]; private prevIn: Float64Array[]
  private outBuf: Float64Array[]
  private fill = 0
  private wr: Float64Array; private wi: Float64Array; private ar: Float64Array; private ai: Float64Array
  constructor(h: Float64Array, B = 128) {
    this.B = B
    const N = 2 * B
    this.fft = new FFT(N)
    const P = Math.ceil(h.length / B)
    for (let p = 0; p < P; p++) {
      const re = new Float64Array(N), im = new Float64Array(N)
      for (let i = 0; i < B; i++) { const k = p * B + i; if (k < h.length) re[i] = h[k] }
      this.fft.transform(re, im)
      this.parts.push({ re, im })
      for (let c = 0; c < 2; c++) this.hist[c].push({ re: new Float64Array(N), im: new Float64Array(N) })
    }
    this.inBuf = [new Float64Array(B), new Float64Array(B)]
    this.prevIn = [new Float64Array(B), new Float64Array(B)]
    this.outBuf = [new Float64Array(B), new Float64Array(B)]
    this.wr = new Float64Array(N); this.wi = new Float64Array(N); this.ar = new Float64Array(N); this.ai = new Float64Array(N)
  }
  /** 샘플 단위로 밀어 넣고 B 샘플 늦은 결과를 받는다 */
  process(L: Float32Array, R: Float32Array, n: number) {
    const B = this.B
    for (let i = 0; i < n; i++) {
      this.inBuf[0][this.fill] = L[i]; this.inBuf[1][this.fill] = R[i]
      L[i] = this.outBuf[0][this.fill]; R[i] = this.outBuf[1][this.fill]
      if (++this.fill === B) { this.fill = 0; this.block() }
    }
  }
  private block() {
    const B = this.B, N = 2 * B, P = this.parts.length
    this.hpos = (this.hpos - 1 + P) % P
    for (let c = 0; c < 2; c++) {
      const slot = this.hist[c][this.hpos]
      // [이전 블록 | 현재 블록] 을 FFT (overlap-save)
      for (let i = 0; i < B; i++) { slot.re[i] = this.prevIn[c][i]; slot.re[B + i] = this.inBuf[c][i] }
      slot.im.fill(0)
      this.fft.transform(slot.re, slot.im)
      this.prevIn[c].set(this.inBuf[c])
      const ar = this.ar, ai = this.ai
      ar.fill(0); ai.fill(0)
      for (let p = 0; p < P; p++) {
        const x = this.hist[c][(this.hpos + p) % P], hp = this.parts[p]
        for (let k = 0; k < N; k++) {
          ar[k] += x.re[k] * hp.re[k] - x.im[k] * hp.im[k]
          ai[k] += x.re[k] * hp.im[k] + x.im[k] * hp.re[k]
        }
      }
      this.fft.transform(ar, ai, true)
      for (let i = 0; i < B; i++) this.outBuf[c][i] = ar[B + i]
    }
  }
}
