/**
 * 파일 쓰기: WAV(16/24/32f, TPDF·노이즈 셰이핑 디더, INFO·ID3 메타데이터), ID3v2.3 태그, ZIP(무압축).
 */

export type BitDepth = 16 | 24 | 32
export type DitherKind = 'none' | 'tpdf' | 'shaped'

export interface TrackMeta {
  title?: string
  artist?: string
  album?: string
  isrc?: string
  year?: string
  trackNo?: string
  cover?: { mime: string; data: Uint8Array } | null
}

// 노이즈 셰이핑 오차 되먹임 계수 (고역으로 잡음을 밀어낸다, 44.1/48kHz 용)
const SHAPE = [2.033, -2.165, 1.959, -1.59, 0.6149]

/** float → 정수 PCM. 디더·셰이핑 포함. 32 은 float 그대로 */
export function encodeWav(ch: Float32Array[], fs: number, bits: BitDepth, dither: DitherKind, meta?: TrackMeta, rand: () => number = Math.random): Blob {
  const nCh = ch.length
  const n = ch[0].length
  const isFloat = bits === 32
  const bps = bits / 8
  const dataLen = n * nCh * bps
  const fmtLen = isFloat ? 18 : 16
  const factLen = isFloat ? 12 : 0
  const header = 12 + 8 + fmtLen + factLen + 8
  const buf = new ArrayBuffer(header + dataLen + (dataLen & 1))
  const v = new DataView(buf)
  const u8 = new Uint8Array(buf)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
  let o = 0
  w(o, 'RIFF'); o += 4; o += 4 /* 크기는 마지막에 */; w(o, 'WAVE'); o += 4
  w(o, 'fmt '); v.setUint32(o + 4, fmtLen, true); o += 8
  v.setUint16(o, isFloat ? 3 : 1, true); v.setUint16(o + 2, nCh, true); v.setUint32(o + 4, fs, true)
  v.setUint32(o + 8, fs * nCh * bps, true); v.setUint16(o + 12, nCh * bps, true); v.setUint16(o + 14, bits, true)
  if (isFloat) v.setUint16(o + 16, 0, true)
  o += fmtLen
  if (isFloat) { w(o, 'fact'); v.setUint32(o + 4, 4, true); v.setUint32(o + 8, n, true); o += 12 }
  w(o, 'data'); v.setUint32(o + 4, dataLen, true); o += 8

  if (isFloat) {
    for (let i = 0; i < n; i++) for (let c = 0; c < nCh; c++) { v.setFloat32(o, ch[c][i], true); o += 4 }
  } else {
    const full = bits === 16 ? 32767 : 8388607
    const minV = -full - 1
    const err = Array.from({ length: nCh }, () => new Float64Array(5))
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < nCh; c++) {
        let x = ch[c][i] * full
        if (dither === 'shaped') {
          const e = err[c]
          const fb = SHAPE[0] * e[0] + SHAPE[1] * e[1] + SHAPE[2] * e[2] + SHAPE[3] * e[3] + SHAPE[4] * e[4]
          const target = x - fb
          const d = rand() - rand()
          let q = Math.round(target + d)
          if (q > full) q = full; else if (q < minV) q = minV
          e[4] = e[3]; e[3] = e[2]; e[2] = e[1]; e[1] = e[0]; e[0] = q - target
          x = q
        } else if (dither === 'tpdf') x += rand() - rand()
        let q = Math.round(x)
        if (q > full) q = full; else if (q < minV) q = minV
        if (bits === 16) { v.setInt16(o, q, true); o += 2 }
        else {
          const u = q < 0 ? q + 0x1000000 : q
          u8[o] = u & 0xff; u8[o + 1] = (u >> 8) & 0xff; u8[o + 2] = (u >> 16) & 0xff; o += 3
        }
      }
    }
  }
  const parts: BlobPart[] = [buf]
  let extra = 0
  if (meta && hasMeta(meta)) {
    const info = infoChunk(meta)
    const id3 = id3v23(meta)
    const id3c = new Uint8Array(8 + id3.length + (id3.length & 1))
    id3c.set([0x69, 0x64, 0x33, 0x20]) // 'id3 '
    new DataView(id3c.buffer).setUint32(4, id3.length, true)
    id3c.set(id3, 8)
    parts.push(info as BlobPart, id3c as BlobPart)
    extra = info.length + id3c.length
  }
  v.setUint32(4, buf.byteLength - 8 + extra, true)
  return new Blob(parts, { type: 'audio/wav' })
}

const hasMeta = (m: TrackMeta) => !!(m.title || m.artist || m.album || m.isrc || m.cover || m.year || m.trackNo)

function utf8(s: string) { return new TextEncoder().encode(s) }

/** RIFF LIST/INFO — 제목(INAM)·아티스트(IART)·앨범(IPRD)·ISRC·연도(ICRD)·트랙(ITRK) */
function infoChunk(m: TrackMeta): Uint8Array {
  const items: [string, string | undefined][] = [['INAM', m.title], ['IART', m.artist], ['IPRD', m.album], ['ISRC', m.isrc], ['ICRD', m.year], ['ITRK', m.trackNo]]
  const subs: Uint8Array[] = []
  for (const [id, val] of items) {
    if (!val) continue
    const t = utf8(val)
    const len = t.length + 1
    const c = new Uint8Array(8 + len + (len & 1))
    c.set(utf8(id)); new DataView(c.buffer).setUint32(4, len, true); c.set(t, 8)
    subs.push(c)
  }
  const body = subs.reduce((s, c) => s + c.length, 0) + 4
  const out = new Uint8Array(8 + body)
  out.set(utf8('LIST')); new DataView(out.buffer).setUint32(4, body, true); out.set(utf8('INFO'), 8)
  let o = 12
  for (const c of subs) { out.set(c, o); o += c.length }
  return out
}

/** ID3v2.3 태그 (UTF-16 텍스트 프레임 + APIC 커버) */
export function id3v23(m: TrackMeta): Uint8Array {
  const frames: Uint8Array[] = []
  const text = (id: string, val?: string) => {
    if (!val) return
    // 인코딩 1 = UTF-16 + BOM
    const u16 = new Uint8Array(2 + val.length * 2 + 2)
    u16[0] = 0xff; u16[1] = 0xfe
    for (let i = 0; i < val.length; i++) { const c = val.charCodeAt(i); u16[2 + i * 2] = c & 0xff; u16[3 + i * 2] = c >> 8 }
    frames.push(frame(id, concat([new Uint8Array([1]), u16])))
  }
  text('TIT2', m.title); text('TPE1', m.artist); text('TALB', m.album); text('TSRC', m.isrc); text('TYER', m.year); text('TRCK', m.trackNo)
  if (m.cover) {
    frames.push(frame('APIC', concat([new Uint8Array([0]), utf8(m.cover.mime), new Uint8Array([0, 3, 0]), m.cover.data])))
  }
  const body = concat(frames)
  const head = new Uint8Array(10)
  head.set(utf8('ID3')); head[3] = 3; head[4] = 0; head[5] = 0
  const sz = body.length
  head[6] = (sz >> 21) & 0x7f; head[7] = (sz >> 14) & 0x7f; head[8] = (sz >> 7) & 0x7f; head[9] = sz & 0x7f
  return concat([head, body])
}

function frame(id: string, data: Uint8Array) {
  const f = new Uint8Array(10 + data.length)
  f.set(utf8(id))
  new DataView(f.buffer).setUint32(4, data.length, false)
  f.set(data, 10)
  return f
}

export function concat(arr: Uint8Array[]): Uint8Array {
  const n = arr.reduce((s, a) => s + a.length, 0)
  const out = new Uint8Array(n)
  let o = 0
  for (const a of arr) { out.set(a, o); o += a.length }
  return out
}

/** MP3 앞에 ID3 태그를 붙인다 */
export async function tagMp3(mp3: Blob, meta: TrackMeta): Promise<Blob> {
  if (!hasMeta(meta)) return mp3
  return new Blob([id3v23(meta) as BlobPart, mp3], { type: 'audio/mpeg' })
}

// ───────────────────────── ZIP (저장 방식, 압축 없음) ─────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[i] = c >>> 0 }
  return t
})()

export function crc32(data: Uint8Array, crc = 0): number {
  let c = ~crc >>> 0
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8)
  return ~c >>> 0
}

export interface ZipEntry { name: string; data: Blob }

/** 파일들을 무압축 ZIP 으로 묶는다. 오디오는 이미 압축됐거나 PCM 이라 무압축이 빠르고 손해가 적다 */
export async function makeZip(entries: ZipEntry[]): Promise<Blob> {
  const parts: BlobPart[] = []
  const central: Uint8Array[] = []
  let offset = 0
  for (const e of entries) {
    const name = utf8(e.name)
    const bytes = new Uint8Array(await e.data.arrayBuffer())
    const crc = crc32(bytes)
    const lh = new Uint8Array(30 + name.length)
    const lv = new DataView(lh.buffer)
    lv.setUint32(0, 0x04034b50, true); lv.setUint16(4, 20, true); lv.setUint16(6, 0x0800, true) // UTF-8 이름
    lv.setUint16(8, 0, true); lv.setUint16(10, 0, true); lv.setUint16(12, 0x21, true)
    lv.setUint32(14, crc, true); lv.setUint32(18, bytes.length, true); lv.setUint32(22, bytes.length, true)
    lv.setUint16(26, name.length, true); lv.setUint16(28, 0, true)
    lh.set(name, 30)
    parts.push(lh as BlobPart, e.data)
    const ch = new Uint8Array(46 + name.length)
    const cv = new DataView(ch.buffer)
    cv.setUint32(0, 0x02014b50, true); cv.setUint16(4, 20, true); cv.setUint16(6, 20, true); cv.setUint16(8, 0x0800, true)
    cv.setUint16(10, 0, true); cv.setUint16(12, 0, true); cv.setUint16(14, 0x21, true)
    cv.setUint32(16, crc, true); cv.setUint32(20, bytes.length, true); cv.setUint32(24, bytes.length, true)
    cv.setUint16(28, name.length, true); cv.setUint32(42, offset, true)
    ch.set(name, 46)
    central.push(ch)
    offset += lh.length + bytes.length
  }
  const cd = concat(central)
  const end = new Uint8Array(22)
  const ev = new DataView(end.buffer)
  ev.setUint32(0, 0x06054b50, true); ev.setUint16(8, entries.length, true); ev.setUint16(10, entries.length, true)
  ev.setUint32(12, cd.length, true); ev.setUint32(16, offset, true)
  parts.push(cd as BlobPart, end as BlobPart)
  return new Blob(parts, { type: 'application/zip' })
}

/** 우리가 만든(무압축) ZIP 을 읽는다 — 세션 파일용 */
export async function readZip(blob: Blob): Promise<Map<string, Blob>> {
  const buf = new Uint8Array(await blob.arrayBuffer())
  const v = new DataView(buf.buffer)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  if (eocd < 0) throw new Error('zip')
  const count = v.getUint16(eocd + 10, true)
  let p = v.getUint32(eocd + 16, true)
  const out = new Map<string, Blob>()
  const dec = new TextDecoder()
  for (let k = 0; k < count; k++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error('zip')
    const method = v.getUint16(p + 10, true)
    const size = v.getUint32(p + 20, true)
    const nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true)
    const lo = v.getUint32(p + 42, true)
    const name = dec.decode(buf.subarray(p + 46, p + 46 + nl))
    if (method !== 0) throw new Error('compressed zip not supported')
    const lnl = v.getUint16(lo + 26, true), lxl = v.getUint16(lo + 28, true)
    const start = lo + 30 + lnl + lxl
    out.set(name, new Blob([buf.slice(start, start + size)]))
    p += 46 + nl + xl + cl
  }
  return out
}
