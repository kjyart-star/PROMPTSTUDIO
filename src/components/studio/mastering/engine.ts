'use client'

/**
 * 실시간 재생 엔진: <audio>(스트리밍 재생) → 워크릿 마스터 체인 → 분석기 → 모니터 볼륨 → 스피커.
 * 곡 전체를 메모리에 올리지 않고 재생하므로 긴 곡도 가볍다.
 */
import { withBase } from '@/lib/basePath'
import type { ChainParams, MeterSnapshot } from '@/lib/mastering/dsp'

export class MasteringEngine {
  readonly audio: HTMLAudioElement
  ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  preAnalyser: AnalyserNode | null = null
  postAnalyser: AnalyserNode | null = null
  private monitor: GainNode | null = null
  private ready: Promise<void> | null = null
  private params: ChainParams | null = null
  private monitorDb = 0
  private monitorMuted = false
  meters: MeterSnapshot | null = null
  error: string | null = null
  private url: string | null = null

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
  }

  /** 첫 재생(사용자 조작) 때 오디오 그래프를 만든다 */
  ensure(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = (async () => {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx({ latencyHint: 'playback' })
      this.ctx = ctx
      await ctx.audioWorklet.addModule(withBase('/mastering/master-chain-worklet.js'))
      const src = ctx.createMediaElementSource(this.audio)
      const node = new AudioWorkletNode(ctx, 'master-chain', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [2],
        channelCount: 2,
        channelCountMode: 'explicit',
        channelInterpretation: 'speakers',
      })
      node.port.onmessage = e => { if (e.data?.type === 'meters') this.meters = e.data.m }
      this.node = node
      const pre = ctx.createAnalyser(); pre.fftSize = 8192; pre.smoothingTimeConstant = 0.75
      const post = ctx.createAnalyser(); post.fftSize = 8192; post.smoothingTimeConstant = 0.75
      const mon = ctx.createGain()
      src.connect(pre)
      src.connect(node)
      node.connect(post)
      node.connect(mon)
      mon.connect(ctx.destination)
      this.preAnalyser = pre; this.postAnalyser = post; this.monitor = mon
      this.applyMonitor()
      if (this.params) node.port.postMessage({ type: 'params', params: this.params })
    })().catch(err => {
      this.error = '이 브라우저에서는 실시간 처리를 시작하지 못했어요.'
      this.ready = null
      throw err
    })
    return this.ready
  }

  load(blob: Blob) {
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(blob)
    this.audio.src = this.url
    this.audio.load()
    this.resetMeters()
  }

  setParams(p: ChainParams) {
    this.params = p
    this.node?.port.postMessage({ type: 'params', params: p })
  }

  resetMeters() { this.node?.port.postMessage({ type: 'reset' }) }

  setMonitor(db: number, muted: boolean) {
    this.monitorDb = db; this.monitorMuted = muted
    this.applyMonitor()
  }
  private applyMonitor() {
    if (!this.monitor || !this.ctx) return
    const g = this.monitorMuted ? 0 : Math.pow(10, this.monitorDb / 20)
    this.monitor.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02)
  }

  async play() {
    await this.ensure()
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
    await this.audio.play()
  }
  pause() { this.audio.pause() }
  unload() { this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load() }
  seek(t: number) { this.audio.currentTime = Math.max(0, t) }
  get currentTime() { return this.audio.currentTime }
  get paused() { return this.audio.paused }

  /** 개발 모드의 effect 재실행(마운트→정리→마운트)에 그래프를 잃지 않도록 정리는 한 틱 미룬다 */
  private disposeTimer: ReturnType<typeof setTimeout> | null = null
  keepAlive() { if (this.disposeTimer) { clearTimeout(this.disposeTimer); this.disposeTimer = null } }
  scheduleDispose() { this.keepAlive(); this.disposeTimer = setTimeout(() => this.dispose(), 0) }

  dispose() {
    this.audio.pause()
    this.audio.removeAttribute('src')
    if (this.url) URL.revokeObjectURL(this.url)
    this.ctx?.close().catch(() => {})
  }
}
