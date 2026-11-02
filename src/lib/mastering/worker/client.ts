/**
 * 마스터링 워커 클라이언트 — 브라우저에서 불러오면 offthread 에 스스로 등록한다.
 * 원본 PCM 은 1M 샘플 조각으로 나눠 보내(조각 사이에 쉼) 메인 스레드가 한 번에 오래 멈추지 않게 한다.
 * 같은 배열은 워커에 남겨 두고 다시 쓴다(최근 2개). 워커를 못 쓰면 'worker-broken' 으로 알려 그 자리 처리로 넘어간다.
 */
import { setOffthread, type OffthreadOps } from '../offthread'
import type { ToWorker, FromWorker } from './protocol'

interface Job { resolve: (v: unknown) => void; reject: (e: Error) => void; onProgress?: (p: number) => void }

const CHUNK = 1 << 20
const KEEP = 2
const tick = () => new Promise<void>(r => setTimeout(r, 0))

let worker: Worker | null = null
let broken = false
let seq = 1
const jobs = new Map<number, Job>()
const ids = new WeakMap<Float32Array, number>()
const sending = new WeakMap<Float32Array, Promise<number>>()
let resident: number[] = []
const pins = new Map<number, number>()

function fail(message: string) {
  for (const j of jobs.values()) j.reject(new Error(message))
  jobs.clear()
}

function getWorker(): Worker | null {
  if (broken) return null
  if (worker) return worker
  try {
    worker = new Worker(new URL('./mastering.worker.ts', import.meta.url), { type: 'module' })
  } catch { broken = true; return null }
  worker.onmessage = (e: MessageEvent<FromWorker>) => {
    const m = e.data
    const j = jobs.get(m.job)
    if (!j) return
    if (m.type === 'progress') j.onProgress?.(m.p)
    else {
      jobs.delete(m.job)
      if (m.type === 'done') j.resolve(m.result)
      else j.reject(new Error(m.message))
    }
  }
  worker.onerror = () => {
    broken = true
    worker?.terminate(); worker = null; resident = []
    fail('worker-broken')
  }
  return worker
}

const post = (w: Worker, m: ToWorker, t: Transferable[] = []) => w.postMessage(m, t)

/** 배열을 워커에 올려 두고 id 를 돌려준다 — 이미 있으면 그대로 */
async function ensureSource(w: Worker, ch: Float32Array[], keep: boolean): Promise<{ id: number; temp: boolean }> {
  const key = ch[0]
  const known = ids.get(key)
  if (known && resident.includes(known)) {
    resident = [...resident.filter(x => x !== known), known]
    return { id: known, temp: false }
  }
  const pending = keep ? sending.get(key) : undefined
  if (pending) return { id: await pending, temp: false }
  const p = (async () => {
    const id = seq++
    const R = ch[1] ?? ch[0]
    const n = key.length
    post(w, { type: 'src', id, n })
    for (let o = 0; o < n; o += CHUNK) {
      const l = key.slice(o, o + CHUNK), r = R.slice(o, o + CHUNK)
      post(w, { type: 'chunk', id, o, l, r }, [l.buffer, r.buffer])
      if (o + CHUNK < n) await tick()
    }
    if (keep) {
      ids.set(key, id)
      resident.push(id)
      evict(w)
    }
    return id
  })()
  if (!keep) return { id: await p, temp: true }
  sending.set(key, p)
  try { return { id: await p, temp: false } } finally { sending.delete(key) }
}

function evict(w: Worker) {
  while (resident.length > KEEP) {
    const drop = resident.find(x => !pins.get(x))
    if (drop === undefined) break
    resident = resident.filter(x => x !== drop)
    post(w, { type: 'drop', id: drop })
  }
}

/** 원본을 올리고(필요하면) 작업 하나를 보낸다 */
async function call<T>(ch: Float32Array[], keep: boolean, make: (job: number, src: number) => ToWorker, onProgress?: (p: number) => void, signal?: { cancelled: boolean }): Promise<T> {
  const w = getWorker()
  if (!w) throw new Error('worker-broken')
  const { id: src, temp } = await ensureSource(w, ch, keep)
  pins.set(src, (pins.get(src) ?? 0) + 1)
  const job = seq++
  let timer: ReturnType<typeof setInterval> | null = null
  try {
    return await new Promise<T>((resolve, reject) => {
      jobs.set(job, { resolve: v => resolve(v as T), reject, onProgress })
      if (signal) timer = setInterval(() => { if (signal.cancelled) { post(w, { type: 'cancel', job }); if (timer) clearInterval(timer); timer = null } }, 100)
      post(w, make(job, src))
    })
  } finally {
    if (timer) clearInterval(timer)
    const left = (pins.get(src) ?? 1) - 1
    if (left > 0) pins.set(src, left); else pins.delete(src)
    if (temp) post(w, { type: 'drop', id: src })
    else evict(w)
  }
}

const strip = <T extends { onProgress?: unknown; signal?: unknown }>(o: T) => { const { onProgress: _p, signal: _s, ...rest } = o; void _p; void _s; return rest }

export const workerOps: OffthreadOps = {
  render: (src, fs, params, opts) => call(src, true, (job, s) => ({ type: 'render', job, src: s, fs, params, opts: strip(opts) }), opts.onProgress, opts.signal),
  analyze: (ch, fs, opts) => call(ch, false, (job, s) => ({ type: 'analyze', job, src: s, fs, opts: strip(opts) }), opts.onProgress),
  tpLufs: (ch, fs) => call(ch, false, (job, s) => ({ type: 'tpLufs', job, src: s, fs })),
  encodeWav: (ch, fs, bits, dither, meta) => call(ch, false, (job, s) => ({ type: 'encodeWav', job, src: s, fs, bits, dither, meta })),
}

/** 브라우저에서만 등록 — 테스트(jsdom 에는 Worker 가 없다)·서버에서는 그 자리 처리 */
export function installMasteringWorker() {
  if (typeof window !== 'undefined' && typeof Worker !== 'undefined') setOffthread(workerOps)
}
installMasteringWorker()
