// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { sniffSampleRate } from './sniffRate'

/** 워커 스크립트를 가짜 self 위에서 실행해 메시지 규약대로 MP3 가 나오는지 본다 */
function runWorker(rate: number, seconds: number) {
  const dir = path.resolve(__dirname, '../../../public/vendor')
  const lame = readFileSync(path.join(dir, 'lamejs.min.js'), 'utf8')
  const worker = readFileSync(path.join(dir, 'mp3-encoder-worker.js'), 'utf8')
  const sent: any[] = []
  const self: any = { postMessage: (m: any) => sent.push(m) }
  self.importScripts = () => { new Function('self', `${lame}; self.lamejs = lamejs;`)(self) }
  new Function('self', worker)(self)
  const n = Math.round(rate * seconds)
  const step = 1152 * 64
  self.onmessage({ data: { type: 'init', channels: 2, rate, kbps: 320 } })
  for (let pos = 0; pos < n; pos += step) {
    const len = Math.min(step, n - pos)
    const l = new Int16Array(len), r = new Int16Array(len)
    for (let i = 0; i < len; i++) { l[i] = Math.round(8000 * Math.sin((2 * Math.PI * 440 * (pos + i)) / rate)); r[i] = l[i] }
    self.onmessage({ data: { type: 'pcm', l: l.buffer, r: r.buffer } })
  }
  self.onmessage({ data: { type: 'end' } })
  const done = sent.find(m => m.type === 'done')
  const bytes = Buffer.concat(done.chunks.map((c: Int8Array) => Buffer.from(c.buffer, c.byteOffset, c.byteLength)))
  return { bytes, acks: sent.filter(m => m.type === 'ack').length }
}

describe('MP3 인코더 워커', () => {
  for (const rate of [44100, 48000]) {
    it(`${rate}Hz 320kbps 스테레오 — 유효한 MP3 헤더, 길이 일치`, () => {
      const seconds = 6
      const { bytes, acks } = runWorker(rate, seconds)
      expect(acks).toBeGreaterThan(1)
      expect(bytes[0]).toBe(0xff)
      expect((bytes[1] & 0xe0)).toBe(0xe0)
      expect((bytes[1] >> 3) & 3).toBe(3) // MPEG1
      expect((bytes[1] >> 1) & 3).toBe(1) // Layer III
      expect(bytes[2] >> 4).toBe(0xe) // 비트레이트 인덱스 14 = 320kbps
      expect(sniffSampleRate(bytes)).toBe(rate)
      expect((bytes[3] >> 6) & 3).not.toBe(3) // 모노 아님
      // CBR 320kbps → 초당 40000바이트
      expect(bytes.length / 40000).toBeGreaterThan(seconds - 0.1)
      expect(bytes.length / 40000).toBeLessThan(seconds + 0.2)
    })
  }
})

describe('샘플레이트 읽기', () => {
  it('WAV 헤더', () => {
    const h = new Uint8Array(44); h.set([0x52, 0x49, 0x46, 0x46]); new DataView(h.buffer).setUint32(24, 48000, true)
    expect(sniffSampleRate(h)).toBe(48000)
    new DataView(h.buffer).setUint32(24, 44100, true)
    expect(sniffSampleRate(h)).toBe(44100)
  })
  it('ID3 를 건너뛴 MP3 프레임', () => {
    const h = new Uint8Array(40); h.set([0x49, 0x44, 0x33, 3, 0, 0, 0, 0, 0, 4]); h.set([0xff, 0xfb, 0x94, 0x00], 14) // idx 1 = 48k
    expect(sniffSampleRate(h)).toBe(48000)
  })
})
