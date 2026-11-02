/** 메인 스레드 ↔ 마스터링 워커 메시지 모양 */
import type { ChainParams } from '../dsp'
import type { BitDepth, DitherKind, TrackMeta } from '../fileformats'
import type { RenderOpts, AnalyzeOpts } from '../offthread'

type Plain<T> = Omit<T, 'onProgress' | 'signal'>

export type ToWorker =
  | { type: 'src'; id: number; n: number }
  | { type: 'chunk'; id: number; o: number; l: Float32Array; r: Float32Array }
  | { type: 'drop'; id: number }
  | { type: 'cancel'; job: number }
  | { type: 'render'; job: number; src: number; fs: number; params: ChainParams; opts: Plain<RenderOpts> }
  | { type: 'analyze'; job: number; src: number; fs: number; opts: Plain<AnalyzeOpts> }
  | { type: 'tpLufs'; job: number; src: number; fs: number }
  | { type: 'encodeWav'; job: number; src: number; fs: number; bits: BitDepth; dither: DitherKind; meta?: TrackMeta }

export type FromWorker =
  | { type: 'progress'; job: number; p: number }
  | { type: 'done'; job: number; result: unknown }
  | { type: 'error'; job: number; message: string }
