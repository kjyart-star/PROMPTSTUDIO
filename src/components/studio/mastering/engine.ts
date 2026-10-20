'use client'

/**
 * 실시간 재생 엔진.
 *  곡: <audio>(스트리밍 재생) ─┐
 *  스템: 버퍼 소스×N → EQ·팬·게인 ─┴→ 워크릿 마스터 체인 → 분석기(스펙트럼·고니오) → 모니터 볼륨 → 스피커
 *  레퍼런스: <audio> → 음량 맞춤 게인 ──────────────────────→ 분석기 · 모니터
 * 곡은 전체를 메모리에 올리지 않고 재생한다(스템 모드만 디코드).
 */
import { withBase } from '@/lib/basePath'
import type { ChainParams, EditParams, MeterSnapshot } from '@/lib/mastering/dsp'

export interface StemPlay { buffer: AudioBuffer; gain: number; pan: number; mute: boolean; solo: boolean; eq: { low: number; mid: number; high: number } }

interface StemNodes { src: AudioBufferSourceNode | null; low: BiquadFilterNode; mid: BiquadFilterNode; high: BiquadFilterNode; pan: StereoPannerNode; gain: GainNode; cfg: StemPlay; /** 믹서 레벨 미터용 탭(게인 뒤) */ an?: AnalyserNode }

type Listener = () => void

export class MasteringEngine {
  readonly audio: HTMLAudioElement
  readonly refAudio: HTMLAudioElement
  ctx: AudioContext | null = null
  private node: AudioWorkletNode | null = null
  preAnalyser: AnalyserNode | null = null
  postAnalyser: AnalyserNode | null = null
  anL: AnalyserNode | null = null
  anR: AnalyserNode | null = null
  private monitor: GainNode | null = null
  private inputBus: GainNode | null = null
  private refGain: GainNode | null = null
  private ready: Promise<void> | null = null
  private params: ChainParams | null = null
  private edit: EditParams | null = null
  private monitorDb = 0
  private monitorMuted = false
  private monitorMono = false
  /** 모노 확인용 — 1채널로 접어(L+R 의 평균) 양쪽 스피커에 같은 소리를 보낸다 */
  private monoNode: GainNode | null = null
  meters: MeterSnapshot | null = null
  error: string | null = null
  private url: string | null = null
  private refUrl: string | null = null
  // 스템 모드
  private stems: StemNodes[] = []
  stemMode = false
  private stemStartCtx = 0
  private stemOffset = 0
  private stemPlaying = false
  private stemDuration = 0
  /** 레퍼런스를 듣는 중 */
  listenRef = false
  private resumeMainAfterRef = false
  private listeners = new Set<Listener>()
  private syncTimer: ReturnType<typeof setInterval> | null = null

  constructor() {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.refAudio = new Audio()
    this.refAudio.preload = 'auto'
    this.refAudio.loop = true
    for (const ev of ['play', 'pause', 'ended', 'loadedmetadata', 'seeked'] as const) this.audio.addEventListener(ev, () => { this.syncTime(); this.emit() })
    for (const ev of ['play', 'pause'] as const) this.refAudio.addEventListener(ev, () => this.emit())
  }

  on(fn: Listener) { this.listeners.add(fn); return () => { this.listeners.delete(fn) } }
  private emit() { this.listeners.forEach(f => f()) }

  /** 첫 재생(사용자 조작) 때 오디오 그래프를 만든다 */
  ensure(): Promise<void> {
    if (this.ready) return this.ready
    this.ready = (async () => {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      const ctx = new Ctx({ latencyHint: 'playback' })
      this.ctx = ctx
      await ctx.audioWorklet.addModule(withBase('/mastering/master-chain-worklet.js'))
      const src = ctx.createMediaElementSource(this.audio)
      const bus = ctx.createGain()
      const node = new AudioWorkletNode(ctx, 'master-chain', {
        numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [2],
        channelCount: 2, channelCountMode: 'explicit', channelInterpretation: 'speakers',
      })
      node.port.onmessage = e => { if (e.data?.type === 'meters') this.meters = e.data.m }
      this.node = node
      const pre = ctx.createAnalyser(); pre.fftSize = 8192; pre.smoothingTimeConstant = 0.75
      const post = ctx.createAnalyser(); post.fftSize = 8192; post.smoothingTimeConstant = 0.75
      const split = ctx.createChannelSplitter(2)
      const anL = ctx.createAnalyser(); anL.fftSize = 2048
      const anR = ctx.createAnalyser(); anR.fftSize = 2048
      const mon = ctx.createGain()
      const refSrc = ctx.createMediaElementSource(this.refAudio)
      const refGain = ctx.createGain()
      src.connect(bus)
      bus.connect(pre)
      bus.connect(node)
      node.connect(post); node.connect(mon); node.connect(split)
      split.connect(anL, 0); split.connect(anR, 1)
      refSrc.connect(refGain)
      refGain.connect(post); refGain.connect(mon); refGain.connect(split)
      const mono = ctx.createGain()
      mono.channelCount = 1; mono.channelCountMode = 'explicit'; mono.channelInterpretation = 'speakers'
      mono.connect(ctx.destination)
      this.monoNode = mono
      mon.connect(ctx.destination)
      this.inputBus = bus; this.refGain = refGain
      this.preAnalyser = pre; this.postAnalyser = post; this.monitor = mon; this.anL = anL; this.anR = anR
      this.applyMonitor()
      if (this.params) node.port.postMessage({ type: 'params', params: this.params })
      if (this.edit) node.port.postMessage({ type: 'edit', edit: this.edit })
    })().catch(err => {
      this.error = '이 브라우저에서는 실시간 처리를 시작하지 못했어요.'
      this.ready = null
      throw err
    })
    return this.ready
  }

  load(blob: Blob) {
    this.stopStems(); this.stemMode = false; this.stems = []
    if (this.url) URL.revokeObjectURL(this.url)
    this.url = URL.createObjectURL(blob)
    this.audio.src = this.url
    this.audio.load()
    this.resetMeters()
    this.emit()
  }

  loadReference(blob: Blob | null) {
    this.refAudio.pause()
    if (this.refUrl) URL.revokeObjectURL(this.refUrl)
    this.refUrl = blob ? URL.createObjectURL(blob) : null
    if (this.refUrl) { this.refAudio.src = this.refUrl; this.refAudio.load() } else this.refAudio.removeAttribute('src')
    if (!blob && this.listenRef) this.setListenRef(false)
  }

  setRefTrim(db: number) {
    if (!this.refGain || !this.ctx) return
    this.refGain.gain.setTargetAtTime(Math.pow(10, db / 20), this.ctx.currentTime, 0.02)
  }

  /** 레퍼런스 듣기 — 곡은 멈추고(위치 유지) 레퍼런스를 재생, 돌아오면 곡을 이어서 */
  async setListenRef(on: boolean) {
    if (on === this.listenRef) return
    await this.ensure()
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
    this.listenRef = on
    if (on) {
      this.resumeMainAfterRef = !this.paused
      this.pauseMain()
      await this.refAudio.play().catch(() => {})
    } else {
      this.refAudio.pause()
      if (this.resumeMainAfterRef) await this.playMain()
    }
    this.emit()
  }

  /** 스템 모드: 디코드된 버퍼들을 동시에 재생 */
  async loadStems(cfg: StemPlay[]) {
    await this.ensure()
    const ctx = this.ctx!
    this.pauseMain()
    this.stopStems()
    this.stems = cfg.map(c => {
      const low = ctx.createBiquadFilter(); low.type = 'lowshelf'; low.frequency.value = 120
      const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = 0.8
      const high = ctx.createBiquadFilter(); high.type = 'highshelf'; high.frequency.value = 8000
      const pan = ctx.createStereoPanner()
      const gain = ctx.createGain()
      low.connect(mid); mid.connect(high); high.connect(pan); pan.connect(gain); gain.connect(this.inputBus!)
      const an = ctx.createAnalyser(); an.fftSize = 256
      gain.connect(an)
      const n: StemNodes = { src: null, low, mid, high, pan, gain, cfg: c, an }
      return n
    })
    this.stemDuration = Math.max(0, ...cfg.map(c => c.buffer.duration))
    this.stemMode = true
    const cur = this.audio.currentTime || 0
    this.stemOffset = cur < this.stemDuration - 0.05 ? cur : 0
    this.updateStems(cfg)
    this.emit()
  }

  updateStems(cfg: StemPlay[]) {
    const anySolo = cfg.some(c => c.solo)
    cfg.forEach((c, i) => {
      const n = this.stems[i]
      if (!n) return
      n.cfg = { ...c, buffer: n.cfg.buffer }
      n.low.gain.value = c.eq.low; n.mid.gain.value = c.eq.mid; n.high.gain.value = c.eq.high
      n.pan.pan.value = Math.max(-1, Math.min(1, c.pan / 100))
      n.gain.gain.value = c.mute || (anySolo && !c.solo) ? 0 : Math.pow(10, c.gain / 20)
    })
  }

  /** 스템마다 지금 피크(선형 0~1, 게인·뮤트 뒤) — 믹서 미터용. 멈춰 있으면 0 */
  private stemBuf: Float32Array<ArrayBuffer> | null = null
  stemLevels(): number[] {
    return this.stems.map(n => {
      if (!n.an || !this.stemPlaying) return 0
      if (!this.stemBuf || this.stemBuf.length !== n.an.fftSize) this.stemBuf = new Float32Array(n.an.fftSize)
      n.an.getFloatTimeDomainData(this.stemBuf)
      let pk = 0
      for (let i = 0; i < this.stemBuf.length; i++) { const v = Math.abs(this.stemBuf[i]); if (v > pk) pk = v }
      return pk
    })
  }

  leaveStems() {
    const t = this.currentTime
    this.stopStems()
    this.stems.forEach(n => n.gain.disconnect())
    this.stems = []
    this.stemMode = false
    this.audio.currentTime = Math.min(t, this.audio.duration || t)
    this.emit()
  }

  private startStems() {
    const ctx = this.ctx!
    const at = ctx.currentTime + 0.03
    if (this.stemOffset >= this.stemDuration - 0.05) this.stemOffset = 0
    let longest: AudioBufferSourceNode | null = null
    for (const n of this.stems) {
      const s = ctx.createBufferSource()
      s.buffer = n.cfg.buffer
      s.connect(n.low)
      s.start(at, Math.min(this.stemOffset, n.cfg.buffer.duration))
      n.src = s
      if (n.cfg.buffer.duration >= this.stemDuration - 0.001) longest = s
    }
    if (longest) longest.onended = () => { if (this.stemPlaying && this.stems.some(n => n.src === longest)) { this.stemPlaying = false; this.stemOffset = this.stemDuration; this.emit() } }
    this.stemStartCtx = at
    this.stemPlaying = true
  }
  private stopStems() {
    if (this.stemPlaying && this.ctx) this.stemOffset = this.currentTime
    for (const n of this.stems) { try { n.src?.stop() } catch {} ; n.src?.disconnect(); n.src = null }
    this.stemPlaying = false
  }

  get duration() { return this.stemMode ? this.stemDuration : this.audio.duration || 0 }
  get currentTime() {
    if (!this.stemMode) return this.audio.currentTime
    if (!this.stemPlaying || !this.ctx) return this.stemOffset
    return Math.min(this.stemDuration, this.stemOffset + Math.max(0, this.ctx.currentTime - this.stemStartCtx))
  }
  get paused() { return this.stemMode ? !this.stemPlaying : this.audio.paused }

  setParams(p: ChainParams) {
    this.params = p
    this.node?.port.postMessage({ type: 'params', params: p })
  }
  setEdit(e: EditParams) {
    this.edit = e
    this.node?.port.postMessage({ type: 'edit', edit: e })
  }
  private syncTime() { this.node?.port.postMessage({ type: 'time', t: this.currentTime }) }

  resetMeters() { this.node?.port.postMessage({ type: 'reset' }) }

  /** 모니터 볼륨·음소거·모노 확인 — 스피커로 가는 소리만 바뀌고 미터·내보내기에는 영향이 없다 */
  setMonitor(db: number, muted: boolean, mono = false) {
    const monoChanged = mono !== this.monitorMono
    this.monitorDb = db; this.monitorMuted = muted; this.monitorMono = mono
    this.applyMonitor(monoChanged)
  }
  private applyMonitor(rewire = true) {
    if (!this.monitor || !this.ctx) return
    const g = this.monitorMuted ? 0 : Math.pow(10, this.monitorDb / 20)
    this.monitor.gain.setTargetAtTime(g, this.ctx.currentTime, 0.02)
    if (rewire && this.monoNode) {
      try { this.monitor.disconnect() } catch {}
      this.monitor.connect(this.monitorMono ? this.monoNode : this.ctx.destination)
    }
  }

  private async playMain() {
    if (this.stemMode) { if (!this.stemPlaying) this.startStems() }
    else await this.audio.play()
    this.syncTime()
    if (!this.syncTimer) this.syncTimer = setInterval(() => { if (!this.paused) this.syncTime() }, 500)
    this.emit()
  }
  private pauseMain() {
    if (this.stemMode) this.stopStems()
    else this.audio.pause()
    this.emit()
  }

  async play() {
    await this.ensure()
    if (this.ctx?.state === 'suspended') await this.ctx.resume()
    if (this.listenRef) { await this.refAudio.play().catch(() => {}); return }
    await this.playMain()
  }
  pause() {
    if (this.listenRef) { this.refAudio.pause(); this.emit(); return }
    this.pauseMain()
  }
  seek(t: number) {
    const v = Math.max(0, t)
    if (this.stemMode) {
      const was = this.stemPlaying
      this.stopStems()
      this.stemOffset = Math.min(v, this.stemDuration)
      if (was) this.startStems()
    } else this.audio.currentTime = v
    this.syncTime()
    this.emit()
  }
  get playingAnything() { return this.listenRef ? !this.refAudio.paused : !this.paused }

  unload() { this.stopStems(); this.stems = []; this.stemMode = false; this.audio.pause(); this.audio.removeAttribute('src'); this.audio.load(); this.emit() }

  /** 개발 모드의 effect 재실행(마운트→정리→마운트)에 그래프를 잃지 않도록 정리는 한 틱 미룬다 */
  private disposeTimer: ReturnType<typeof setTimeout> | null = null
  keepAlive() { if (this.disposeTimer) { clearTimeout(this.disposeTimer); this.disposeTimer = null } }
  scheduleDispose() { this.keepAlive(); this.disposeTimer = setTimeout(() => this.dispose(), 0) }

  dispose() {
    this.stopStems()
    this.audio.pause(); this.refAudio.pause()
    this.audio.removeAttribute('src'); this.refAudio.removeAttribute('src')
    if (this.url) URL.revokeObjectURL(this.url)
    if (this.refUrl) URL.revokeObjectURL(this.refUrl)
    if (this.syncTimer) clearInterval(this.syncTimer)
    this.ctx?.close().catch(() => {})
  }
}
