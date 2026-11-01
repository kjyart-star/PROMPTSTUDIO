import { describe, it, expect, vi } from 'vitest'
import { LrcPrecomputeQueue, pendingLrcSongs } from './lrcPrecompute'

const song = (id: string, extra: any = {}) => ({ id, audio_url: `p/${id}.mp3`, lyrics: '첫 줄\n둘째 줄\n셋째 줄', form: {}, status: 'completed', ...extra })
const auto = [{ t: 1, text: 'a' }, { t: 20, text: 'b' }]

describe('pendingLrcSongs', () => {
  it('가사가 있고 자동 맞춤(v2)이 없는 곡만 고른다', () => {
    const h = [
      song('a'),
      song('has-v2', { form: { lrc_auto: auto, lrc_auto_v: 3 } }),
      song('old-v1', { form: { lrc_auto: auto, lrc_auto_v: 1 } }),
      song('user', { form: { lrc: auto, lrc_by: 'user' } }),
      song('nolyr', { lyrics: '' }),
      song('trash', { trashed_at: '2026-10-01' }),
      song('proc', { status: 'processing' }),
      song('noaudio', { audio_url: '' }),
      song('stamped', { lyrics: '[00:01.00]가\n[00:05.00]나' }),
      song('oneline', { lyrics: '한 줄' }),
    ]
    expect(pendingLrcSongs(h).map((x) => x.id)).toEqual(['a', 'old-v1'])
  })
  it('마스터링본은 원곡 가사를 물려받아 대상이 되고, skip 으로 뺄 수 있다', () => {
    const h = [song('m', { lyrics: '', form: { kind: 'mastering', source_id: 'src' } }), song('src')]
    expect(pendingLrcSongs(h).map((x) => x.id)).toEqual(['m', 'src'])
    expect(pendingLrcSongs(h, (id) => id === 'm').map((x) => x.id)).toEqual(['src'])
  })
})

function make(history: any[], processOne: any, extra: any = {}) {
  let lock = false
  const progress: any[] = []
  const q = new LrcPrecomputeQueue({
    getHistory: () => history,
    processOne,
    onProgress: (p) => progress.push(p),
    acquire: () => (lock ? false : (lock = true)),
    release: () => { lock = false },
    sleep: async () => {},
    ...extra,
  })
  return { q, progress, isLocked: () => lock }
}
const markDone = (history: any[], id: string) => { const x = history.find((h) => h.id === id); x.form = { lrc_auto: auto, lrc_auto_v: 3 } }

describe('LrcPrecomputeQueue', () => {
  it('한 번에 한 곡씩 순서대로 처리하고 진행(n/총)을 알린다', async () => {
    const h = [song('a'), song('b'), song('c')]
    let running = 0, maxRunning = 0
    const order: string[] = []
    const { q, progress, isLocked } = make(h, async (item: any) => {
      running++; maxRunning = Math.max(maxRunning, running)
      await Promise.resolve()
      order.push(item.id); markDone(h, item.id)
      running--
      return 'saved'
    })
    await q.run()
    expect(order).toEqual(['a', 'b', 'c'])
    expect(maxRunning).toBe(1)
    expect(progress.filter(Boolean).map((p) => `${p.done + 1}/${p.total}`)).toEqual(['1/3', '2/3', '3/3'])
    expect(progress[progress.length - 1]).toBeNull()
    expect(isLocked()).toBe(false)
  })

  it('실패한 곡은 이번 접속에서 다시 시도하지 않고 다음 곡으로 넘어간다', async () => {
    const h = [song('a'), song('b')]
    const seen: string[] = []
    const { q } = make(h, async (item: any) => { seen.push(item.id); if (item.id === 'a') throw new Error('x'); markDone(h, 'b'); return 'saved' })
    await q.run()
    expect(seen).toEqual(['a', 'b'])
  })

  it('연속 3번 실패하면 접는다', async () => {
    const h = [song('a'), song('b'), song('c'), song('d')]
    const processOne = vi.fn(async () => 'failed' as const)
    const { q } = make(h, processOne)
    await q.run()
    expect(processOne).toHaveBeenCalledTimes(3)
  })

  it('재생 화면이 잠금을 쥐고 있으면 끝나길 기다린다', async () => {
    const h = [song('a')]
    let lock = true
    let sleeps = 0
    const q = new LrcPrecomputeQueue({
      getHistory: () => h,
      processOne: async (item) => { markDone(h, item.id); return 'saved' },
      onProgress: () => {},
      acquire: () => (lock ? false : (lock = true)),
      release: () => { lock = false },
      sleep: async () => { if (++sleeps === 2) lock = false },
    })
    await q.run()
    expect(sleeps).toBeGreaterThanOrEqual(2)
    expect(h[0].form.lrc_auto_v).toBe(3)
  })

  it('탭이 숨겨지면 하던 곡을 멈추고, 다시 보이면 그 곡부터 이어 한다', async () => {
    const h = [song('a')]
    let calls = 0
    let q!: LrcPrecomputeQueue
    const processOne = vi.fn(async (item: any, signal: AbortSignal) => {
      calls++
      if (calls === 1) {
        queueMicrotask(() => q.setVisible(false))
        await new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))))
      }
      markDone(h, item.id)
      return 'saved' as const
    })
    const made = make(h, processOne)
    q = made.q
    const running = q.run()
    await new Promise((r) => setTimeout(r, 10))
    expect(processOne).toHaveBeenCalledTimes(1)
    expect(h[0].form.lrc_auto_v).toBeUndefined()
    q.setVisible(true)
    await running
    expect(processOne).toHaveBeenCalledTimes(2)
    expect(h[0].form.lrc_auto_v).toBe(3)
  })

  it('재생 화면이 양보를 요청하면 하던 곡을 멈추고 시도한 것으로 세지 않는다', async () => {
    const h = [song('a')]
    let calls = 0
    let q!: LrcPrecomputeQueue
    const made = make(h, async (item: any, signal: AbortSignal) => {
      calls++
      if (calls === 1) {
        queueMicrotask(() => q.preempt())
        await new Promise((_, rej) => signal.addEventListener('abort', () => rej(new Error('aborted'))))
      }
      markDone(h, item.id)
      return 'saved' as const
    })
    q = made.q
    await q.run()
    expect(calls).toBe(2)
    expect(h[0].form.lrc_auto_v).toBe(3)
  })

  it('stop() 하면 더 하지 않는다', async () => {
    const h = [song('a'), song('b')]
    const { q } = make(h, async (item: any) => { markDone(h, item.id); q.stop(); return 'saved' as const })
    await q.run()
    expect(h[1].form.lrc_auto_v).toBeUndefined()
  })
})
