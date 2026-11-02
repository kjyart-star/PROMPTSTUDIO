/**
 * 마스터링 워커 — 렌더·분석·측정·WAV 만들기를 메인 스레드 밖에서 한다.
 * 원본 PCM 은 한 번만 조각으로 받아 두고(src/chunk) 여러 작업이 같이 쓴다. 메인이 drop 을 보내면 지운다.
 */
import { renderChainLocal } from '../render'
import { analyzeAudioLocal } from '../analyze'
import { TruePeakMeter, measureIntegratedLufs, linToDb } from '../dsp'
import { encodeWav } from '../fileformats'
import type { ToWorker, FromWorker } from './protocol'

const ctx = self as unknown as { postMessage: (m: FromWorker, t?: Transferable[]) => void; onmessage: ((e: MessageEvent<ToWorker>) => void) | null }
const srcs = new Map<number, Float32Array[]>()
const cancelled = new Set<number>()

function source(id: number): Float32Array[] {
  const s = srcs.get(id)
  if (!s) throw new Error('source-missing')
  return s
}

async function run(job: number, fn: () => Promise<{ result: unknown; transfer?: Transferable[] }>) {
  try {
    const { result, transfer } = await fn()
    ctx.postMessage({ type: 'done', job, result }, transfer ?? [])
  } catch (e) {
    ctx.postMessage({ type: 'error', job, message: (e as Error)?.message || 'error' })
  } finally { cancelled.delete(job) }
}

const progress = (job: number) => (p: number) => ctx.postMessage({ type: 'progress', job, p })

ctx.onmessage = (e: MessageEvent<ToWorker>) => {
  const m = e.data
  switch (m.type) {
    case 'src': srcs.set(m.id, [new Float32Array(m.n), new Float32Array(m.n)]); break
    case 'chunk': { const s = srcs.get(m.id); if (s) { s[0].set(m.l, m.o); s[1].set(m.r, m.o) } break }
    case 'drop': srcs.delete(m.id); break
    case 'cancel': cancelled.add(m.job); break
    case 'render':
      run(m.job, async () => {
        const signal = { get cancelled() { return cancelled.has(m.job) } }
        const r = await renderChainLocal(source(m.src), m.fs, m.params, { ...m.opts, signal, onProgress: progress(m.job) })
        return { result: r, transfer: r.channels?.map(c => c.buffer) }
      })
      break
    case 'analyze':
      run(m.job, async () => ({ result: await analyzeAudioLocal(source(m.src), m.fs, { ...m.opts, onProgress: progress(m.job) }) }))
      break
    case 'tpLufs':
      run(m.job, async () => {
        const ch = source(m.src)
        const tp = new TruePeakMeter()
        tp.process(ch[0], ch[1], ch[0].length)
        return { result: { truePeak: linToDb(tp.max), integrated: measureIntegratedLufs(ch, m.fs) } }
      })
      break
    case 'encodeWav':
      run(m.job, async () => ({ result: encodeWav(source(m.src), m.fs, m.bits, m.dither, m.meta) }))
      break
  }
}
