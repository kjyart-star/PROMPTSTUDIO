import { describe, it, expect, afterEach, vi } from 'vitest'
import { setOffthread, viaOffthread, type OffthreadOps } from './offthread'
import { renderChain } from './render'
import { defaultChain } from './presets'

afterEach(() => setOffthread(null))

const fake = (over: Partial<OffthreadOps>): OffthreadOps => ({
  render: vi.fn(), analyze: vi.fn(), tpLufs: vi.fn(), encodeWav: vi.fn(), ...over,
} as OffthreadOps)

describe('메인 스레드 밖 처리 연결', () => {
  it('등록된 처리기가 없으면 그 자리에서 처리한다', async () => {
    const r = await viaOffthread(async () => 'worker', async () => 'local')
    expect(r).toBe('local')
  })
  it('등록돼 있으면 워커로 보낸다', async () => {
    const render = vi.fn(async () => ({ integrated: -10, truePeak: -1 }))
    setOffthread(fake({ render }))
    const ch = [new Float32Array(4800), new Float32Array(4800)]
    const r = await renderChain(ch, 48000, defaultChain(), { write: false })
    expect(render).toHaveBeenCalledOnce()
    expect(r.integrated).toBe(-10)
  })
  it('워커가 죽으면(worker-broken) 그 자리 처리로 넘어간다', async () => {
    setOffthread(fake({ render: vi.fn(async () => { throw new Error('worker-broken') }) }))
    const ch = [new Float32Array(48000), new Float32Array(48000)]
    const r = await renderChain(ch, 48000, defaultChain(), { write: false })
    expect(r.channels).toBeUndefined()
    expect(r.integrated).toBe(-Infinity)
  })
  it('취소는 그대로 던진다', async () => {
    setOffthread(fake({ render: vi.fn(async () => { throw new Error('cancelled') }) }))
    await expect(renderChain([new Float32Array(10), new Float32Array(10)], 48000, defaultChain())).rejects.toThrow('cancelled')
  })
})
