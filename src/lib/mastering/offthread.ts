/**
 * 무거운 오디오 처리를 메인 스레드 밖(Web Worker)으로 보내는 연결점.
 * render.ts·analyze.ts 는 여기 등록된 처리기가 있으면 그쪽으로 보내고, 없으면(테스트·워커 안·서버) 그 자리에서 처리한다.
 * 브라우저에서는 worker/client.ts 가 불러와지는 순간 스스로 등록한다. 워커 파일은 이 등록을 하지 않으므로 서로 부르지 않는다.
 */
import type { ChainParams, EditParams } from './dsp'
import type { BitDepth, DitherKind, TrackMeta } from './fileformats'

export interface RenderOpts {
  start?: number; end?: number; write?: boolean; edit?: EditParams
  onProgress?: (p: number) => void; signal?: { cancelled: boolean }
}
export interface AnalyzeOpts { spectrogramCols?: number; onProgress?: (p: number) => void; harsh?: boolean }

export interface OffthreadOps {
  render(src: Float32Array[], fs: number, params: ChainParams, opts: RenderOpts): Promise<import('./render').RenderResult>
  analyze(ch: Float32Array[], fs: number, opts: AnalyzeOpts): Promise<import('./analyze').Analysis>
  tpLufs(ch: Float32Array[], fs: number): Promise<{ truePeak: number; integrated: number }>
  encodeWav(ch: Float32Array[], fs: number, bits: BitDepth, dither: DitherKind, meta?: TrackMeta): Promise<Blob>
}

let ops: OffthreadOps | null = null
export const setOffthread = (o: OffthreadOps | null) => { ops = o }
export const offthread = () => ops

/** 워커가 죽었으면(모듈을 못 싣는 등) 그 자리 처리로 넘어간다 — 취소·실제 오류는 그대로 던진다 */
export async function viaOffthread<T>(run: (o: OffthreadOps) => Promise<T>, local: () => Promise<T>): Promise<T> {
  const o = ops
  if (o) {
    try { return await run(o) } catch (e) { if ((e as Error)?.message !== 'worker-broken') throw e }
  }
  return local()
}
