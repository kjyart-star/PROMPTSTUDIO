// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { EDGE, ORIGIN, installEdgeMedia, setEdgeMediaEnabled, toEdgeMediaUrl, toOriginMediaUrl } from './edgeMedia'

const TRACK = `${ORIGIN}/audio/u1/a%20b.mp3`
const calls: string[] = []
let handler: (u: string) => Response = () => new Response('ok')

beforeAll(() => {
  window.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const u = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    calls.push(u)
    return handler(u)
  }) as typeof fetch
  installEdgeMedia()
})
afterEach(() => { setEdgeMediaEnabled(null); calls.length = 0; handler = () => new Response('ok') })

describe('쿠키뮤직 에지', () => {
  it('테스트 기본은 꺼짐, 켜면 호스트만 바뀌고 왕복 변환이 된다', () => {
    expect(toEdgeMediaUrl(TRACK)).toBe(TRACK)
    setEdgeMediaEnabled(true)
    expect(toEdgeMediaUrl(TRACK)).toBe(`${EDGE}/audio/u1/a%20b.mp3`)
    expect(toOriginMediaUrl(toEdgeMediaUrl(TRACK))).toBe(TRACK)
    expect(toEdgeMediaUrl('https://x.supabase.co/a.mp3')).toBe('https://x.supabase.co/a.mp3')
  })
  it('<audio> src 설정은 에지로, 에러가 나면 원래 주소로 한 번 되돌린다', () => {
    setEdgeMediaEnabled(true)
    const a = document.createElement('audio')
    a.src = TRACK
    expect(a.getAttribute('src')).toBe(`${EDGE}/audio/u1/a%20b.mp3`)
    a.load = vi.fn()
    a.dispatchEvent(new Event('error'))
    document.body.appendChild(a)
    a.dispatchEvent(new Event('error')) // 캡처 단계 리스너는 문서까지 올라가야 한다
    expect(a.getAttribute('src')).toBe(TRACK)
    expect(a.dataset.edgeFallback).toBe('1')
  })
  it('<img> 커버도 에지로, 에러면 원래 주소로', () => {
    setEdgeMediaEnabled(true)
    const img = document.createElement('img')
    document.body.appendChild(img)
    img.setAttribute('src', `${ORIGIN}/covers/x.jpg`)
    expect(img.getAttribute('src')).toBe(`${EDGE}/covers/x.jpg`)
    img.dispatchEvent(new Event('error'))
    expect(img.getAttribute('src')).toBe(`${ORIGIN}/covers/x.jpg`)
  })
  it('fetch GET 은 에지 우선·실패 시 원래 주소, POST·인증 헤더는 그대로', async () => {
    setEdgeMediaEnabled(true)
    handler = (u) => (u.startsWith(EDGE) ? new Response('', { status: 404 }) : new Response('ok'))
    expect((await fetch(TRACK)).status).toBe(200)
    expect(calls).toEqual([`${EDGE}/audio/u1/a%20b.mp3`, TRACK])
    calls.length = 0
    handler = () => new Response('ok')
    await fetch(TRACK, { method: 'POST', body: 'x' })
    await fetch(TRACK, { headers: { Authorization: 'x' } })
    expect(calls).toEqual([TRACK, TRACK])
  })
})
