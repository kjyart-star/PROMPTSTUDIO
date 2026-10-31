// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react'

vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://p/x.png' } }) }) } }) }))
import AlbumArtDialog from './AlbumArtDialog'
import StemDialog from './StemDialog'

const calls: { url: string; method: string }[] = []
let postRes: { status: number; body: any }
beforeEach(() => {
  calls.length = 0
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    const method = init?.method || 'GET'
    calls.push({ url, method })
    if (url.includes('quote=1')) return new Response(JSON.stringify({ creditsMilli: 1000 }))
    if (method === 'POST') return new Response(JSON.stringify(postRes.body), { status: postRes.status })
    return new Response(JSON.stringify({ status: 'processing' }))
  }))
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const song = { id: 's1', title: '곡', prompt: 'city pop', genre: 'Pop', form: {} }

describe('유료 창 — 일반 사용자 경로', () => {
  it('앨범아트: 금액이 버튼과 확인 창에 보이고, 확인 전에는 요청하지 않는다', async () => {
    render(<AlbumArtDialog song={song} userId="u1" onClose={() => {}} onApply={() => {}} />)
    const start = await screen.findByText(/AI 로 만들기/)
    await waitFor(() => expect(start.textContent).toContain('✦1'))
    fireEvent.click(start)
    expect(screen.getByRole('alertdialog').textContent).toContain('✦1')
    expect(screen.getByRole('alertdialog').textContent).toContain('자동으로 돌려드려요')
    expect(calls.some((c) => c.method === 'POST')).toBe(false)
  })

  it('앨범아트: 크레딧이 모자라면 안내와 충전 링크가 뜬다', async () => {
    postRes = { status: 402, body: { error: 'insufficient_credits' } }
    render(<AlbumArtDialog song={song} userId="u1" onClose={() => {}} onApply={() => {}} />)
    fireEvent.click(await screen.findByText(/AI 로 만들기/))
    fireEvent.click(await screen.findByText(/사용하고 시작/))
    expect(await screen.findByText(/크레딧이 모자라요/)).toBeTruthy()
    expect(screen.getByText(/크레딧 충전하러 가기/).getAttribute('href')).toContain('/pricing')
  })

  it('앨범아트: 하루 상한(429) 안내를 그대로 보여 준다', async () => {
    postRes = { status: 429, body: { error: '오늘 쓸 수 있는 횟수를 모두 썼어요. 내일 다시 이용해 주세요.' } }
    render(<AlbumArtDialog song={song} userId="u1" onClose={() => {}} onApply={() => {}} />)
    fireEvent.click(await screen.findByText(/AI 로 만들기/))
    fireEvent.click(await screen.findByText(/사용하고 시작/))
    expect(await screen.findByText(/내일 다시/)).toBeTruthy()
  })

  it('스템: 확인 창 금액, 연타해도 요청은 한 번', async () => {
    postRes = { status: 200, body: { status: 'processing' } }
    render(<StemDialog song={song} priceMilli={3000} onClose={() => {}} onChanged={() => {}} />)
    fireEvent.click(screen.getByText(/보컬 \/ 악기로 나누기/))
    expect(screen.getByRole('alertdialog').textContent).toContain('✦3')
    const yes = screen.getByText(/사용하고 시작/)
    fireEvent.click(yes); fireEvent.click(yes)
    await waitFor(() => expect(calls.filter((c) => c.method === 'POST').length).toBe(1))
  })

  it('스템: 접수 실패 시 환불 문구가 보인다', async () => {
    postRes = { status: 502, body: { error: '잠시 뒤 다시 시도해 주세요.', refunded: true } }
    render(<StemDialog song={song} priceMilli={3000} onClose={() => {}} onChanged={() => {}} />)
    fireEvent.click(screen.getByText(/보컬 \/ 악기로 나누기/))
    fireEvent.click(screen.getByText(/사용하고 시작/))
    expect(await screen.findByText(/크레딧은 돌려드렸어요/)).toBeTruthy()
  })
})
