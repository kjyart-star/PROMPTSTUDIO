/**
 * ITU-R BS.1770 통합 음량(LUFS) 근사 — K-가중 필터 + 400ms 블록(75% 겹침) + 절대 -70 / 상대 -10 게이트.
 * 영상에 넣는 곡 음량을 목표(예: 유튜브 -14 LUFS)에 맞추는 데 쓴다. 브라우저에서만 계산(서버 없음).
 */

interface Biquad { b0: number; b1: number; b2: number; a1: number; a2: number }

/** BS.1770 의 두 단계 필터를 임의 표본 속도로 다시 계산한다(48k 표 값과 일치). */
function kWeighting(fs: number): [Biquad, Biquad] {
  // 1단: 고음 선반(헤드 효과)
  const f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196
  const K = Math.tan(Math.PI * f0 / fs)
  const Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416)
  const a0 = 1 + K / Q + K * K
  const s1: Biquad = {
    b0: (Vh + Vb * K / Q + K * K) / a0,
    b1: 2 * (K * K - Vh) / a0,
    b2: (Vh - Vb * K / Q + K * K) / a0,
    a1: 2 * (K * K - 1) / a0,
    a2: (1 - K / Q + K * K) / a0,
  }
  // 2단: 저음 차단(RLB)
  const f1 = 38.13547087602444, Q1 = 0.5003270373238773
  const K1 = Math.tan(Math.PI * f1 / fs)
  const a01 = 1 + K1 / Q1 + K1 * K1
  const s2: Biquad = { b0: 1, b1: -2, b2: 1, a1: 2 * (K1 * K1 - 1) / a01, a2: (1 - K1 / Q1 + K1 * K1) / a01 }
  return [s1, s2]
}

function applyBiquad(x: Float32Array | Float64Array, c: Biquad): Float64Array {
  const y = new Float64Array(x.length)
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0
  for (let i = 0; i < x.length; i++) {
    const v = c.b0 * x[i] + c.b1 * x1 + c.b2 * x2 - c.a1 * y1 - c.a2 * y2
    y[i] = v; x2 = x1; x1 = x[i]; y2 = y1; y1 = v
  }
  return y
}

/** 통합 음량(LUFS). 무음/너무 짧으면 -Infinity */
export function integratedLufs(channels: Float32Array[], fs: number): number {
  const n = channels[0]?.length ?? 0
  if (n < fs * 0.4) return -Infinity
  const [s1, s2] = kWeighting(fs)
  const filt = channels.slice(0, 2).map(ch => applyBiquad(applyBiquad(ch, s1), s2))
  const block = Math.round(fs * 0.4), hop = Math.round(fs * 0.1)
  const energies: number[] = []
  for (let s = 0; s + block <= n; s += hop) {
    let sum = 0
    for (const f of filt) { let e = 0; for (let i = s; i < s + block; i++) e += f[i] * f[i]; sum += e / block }
    energies.push(sum)
  }
  const lk = (e: number) => -0.691 + 10 * Math.log10(e)
  const abs = energies.filter(e => e > 0 && lk(e) > -70)
  if (!abs.length) return -Infinity
  const mean1 = abs.reduce((a, b) => a + b, 0) / abs.length
  const rel = abs.filter(e => lk(e) > lk(mean1) - 10)
  if (!rel.length) return -Infinity
  return lk(rel.reduce((a, b) => a + b, 0) / rel.length)
}

/** 목표 음량으로 맞추는 배율. 피크가 1을 넘으면 넘지 않도록 낮춘다(리미터 없음 — 소리를 찌그러뜨리지 않는다). */
export function gainToTarget(channels: Float32Array[], fs: number, targetLufs: number): { gain: number; lufs: number; limited: boolean } {
  const lufs = integratedLufs(channels, fs)
  if (!isFinite(lufs)) return { gain: 1, lufs, limited: false }
  let gain = Math.pow(10, (targetLufs - lufs) / 20)
  let peak = 0
  for (const ch of channels) for (let i = 0; i < ch.length; i++) { const a = Math.abs(ch[i]); if (a > peak) peak = a }
  let limited = false
  if (peak * gain > 0.98) { gain = 0.98 / peak; limited = true }
  return { gain, lufs, limited }
}
