import { describe, expect, it } from 'vitest'
import { handle } from './serve'

function bucket(files: Record<string, string>): R2Bucket {
  const meta = (k: string) => {
    const f = files[k]
    if (f === undefined) return null
    const bytes = new TextEncoder().encode(f)
    return { key: k, size: bytes.length, httpEtag: `"e-${bytes.length}"`, httpMetadata: {}, bytes }
  }
  return {
    async head(k: string) { return meta(k) as unknown as R2Object | null },
    async get(k: string, o?: { range?: { offset?: number; length?: number; suffix?: number }; onlyIf?: Headers }) {
      const m = meta(k)
      if (!m) return null
      if (o?.onlyIf?.get('if-none-match') === m.httpEtag) return m as unknown as R2Object
      let s = m.bytes
      const r = o?.range
      if (r?.suffix != null) s = m.bytes.slice(Math.max(0, m.size - r.suffix))
      else if (r) s = m.bytes.slice(r.offset ?? 0, r.length != null ? (r.offset ?? 0) + r.length : undefined)
      return { ...m, body: new Blob([s]).stream() } as unknown as R2ObjectBody
    },
  } as unknown as R2Bucket
}

const allow = (async () => new Response('{}', { status: 200 })) as unknown as typeof fetch
const env = { TRACKS: bucket({ 'audio/a.mp3': '0123456789' }), GATE_FETCH: allow }
const req = (path: string, init: RequestInit = {}) => new Request(`https://m.test/${path}`, init)

describe('cookiemusic-media', () => {
  it('전체 200 + 1년 immutable + CORS(허용 오리진)', async () => {
    const r = await handle(req('audio/a.mp3', { headers: { origin: 'https://www.cookieplay.app' } }), env)
    expect(r.status).toBe(200)
    expect(r.headers.get('content-type')).toBe('audio/mpeg')
    expect(r.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(r.headers.get('access-control-allow-origin')).toBe('https://www.cookieplay.app')
  })
  it('Range 206, 접미 구간, 파일 밖 416', async () => {
    const r = await handle(req('audio/a.mp3', { headers: { range: 'bytes=2-4' } }), env)
    expect(r.status).toBe(206)
    expect(r.headers.get('content-range')).toBe('bytes 2-4/10')
    expect(await r.text()).toBe('234')
    expect((await handle(req('audio/a.mp3', { headers: { range: 'bytes=-3' } }), env)).headers.get('content-range')).toBe('bytes 7-9/10')
    expect((await handle(req('audio/a.mp3', { headers: { range: 'bytes=99-' } }), env)).status).toBe(416)
  })
  it('없는 키·.. 경로 404, 쓰기 405, ETag 일치 304', async () => {
    expect((await handle(req('nope.mp3'), env)).status).toBe(404)
    expect((await handle(req('a/../b.mp3'), env)).status).toBe(404)
    expect((await handle(req('audio/a.mp3', { method: 'PUT' }), env)).status).toBe(405)
    const etag = (await handle(req('audio/a.mp3'), env)).headers.get('etag')!
    expect((await handle(req('audio/a.mp3', { headers: { 'if-none-match': etag } }), env)).status).toBe(304)
  })
})

describe('공개 게이트 (감사 M-7)', () => {
  const files = { TRACKS: bucket({ 'audio/a.mp3': '0123456789' }) }
  const gate = (status: number | 'throw') => (async (url: string) => {
    if (status === 'throw') throw new Error('network')
    expect(String(url)).toContain('/api/tracks/public-check?key=audio%2Fa.mp3')
    return new Response('{}', { status })
  }) as unknown as typeof fetch

  it('비공개·정지 곡(앱이 404)은 전체·Range 모두 404', async () => {
    const e = { ...files, GATE_FETCH: gate(404) }
    expect((await handle(req('audio/a.mp3'), e)).status).toBe(404)
    expect((await handle(req('audio/a.mp3', { headers: { range: 'bytes=0-3' } }), e)).status).toBe(404)
  })
  it('공개 곡(앱이 200)은 그대로 재생된다', async () => {
    const res = await handle(req('audio/a.mp3'), { ...files, GATE_FETCH: gate(200) })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('0123456789')
  })
  it('앱 오류(5xx·네트워크)면 재생을 끊지 않는다(fail-open)', async () => {
    expect((await handle(req('audio/a.mp3'), { ...files, GATE_FETCH: gate(503) })).status).toBe(200)
    expect((await handle(req('audio/a.mp3'), { ...files, GATE_FETCH: gate('throw') })).status).toBe(200)
  })
})
