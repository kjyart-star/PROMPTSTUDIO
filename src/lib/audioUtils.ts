import { withBase } from '@/lib/basePath'

export function audioBufferToWav(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const format = 1 // PCM
  const bitDepth = 16

  let result: Float32Array
  if (numChannels === 2) {
    result = interleave(buffer.getChannelData(0), buffer.getChannelData(1))
  } else {
    result = buffer.getChannelData(0)
  }

  const bufferLength = result.length * (bitDepth / 8)
  const arrayBuffer = new ArrayBuffer(44 + bufferLength)
  const view = new DataView(arrayBuffer)

  // RIFF identifier
  writeString(view, 0, 'RIFF')
  // file length
  view.setUint32(4, 36 + bufferLength, true)
  // RIFF type
  writeString(view, 8, 'WAVE')
  // format chunk identifier
  writeString(view, 12, 'fmt ')
  // format chunk length
  view.setUint32(16, 16, true)
  // sample format (raw)
  view.setUint16(20, format, true)
  // channel count
  view.setUint16(22, numChannels, true)
  // sample rate
  view.setUint32(24, sampleRate, true)
  // byte rate (sample rate * block align)
  view.setUint32(28, sampleRate * numChannels * (bitDepth / 8), true)
  // block align (channel count * bytes per sample)
  view.setUint16(32, numChannels * (bitDepth / 8), true)
  // bits per sample
  view.setUint16(34, bitDepth, true)
  // data chunk identifier
  writeString(view, 36, 'data')
  // data chunk length
  view.setUint32(40, bufferLength, true)

  // write the PCM samples
  floatTo16BitPCM(view, 44, result)

  return new Blob([view], { type: 'audio/wav' })
}

function interleave(inputL: Float32Array, inputR: Float32Array): Float32Array {
  const length = inputL.length + inputR.length
  const result = new Float32Array(length)
  let index = 0
  let inputIndex = 0

  while (index < length) {
    result[index++] = inputL[inputIndex]
    result[index++] = inputR[inputIndex]
    inputIndex++
  }
  return result
}

function writeString(view: DataView, offset: number, string: string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i))
  }
}

function floatTo16BitArray(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length)
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]))
    output[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return output
}

let lamejsLoadPromise: Promise<{ Mp3Encoder: new (channels: number, sampleRate: number, kbps: number) => { encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array; flush(): Int8Array } }> | null = null

/**
 * lamejs 를 전역 스크립트로 불러온다. npm 패키지(lamejs 1.2.1)의 CJS 모듈들(Encoder.js,
 * PsyModel.js, Lame.js 등)이 MPEGMode·ATH·BitStream 같은 형제 클래스를 require 없이
 * 전역 변수로만 참조해서(원래 전부 한 스코프로 이어붙여 쓰라고 만들어진 코드) 번들러로
 * import 하면 `ReferenceError`가 난다. 벤더에서 미리 이어붙여 만든 `lame.min.js`
 * (public/vendor/lamejs.min.js) 를 <script> 로 로드해 같은 전역 스코프 문제를 피한다.
 */
function loadLamejs() {
  const w = window as unknown as { lamejs?: { Mp3Encoder: any } }
  if (w.lamejs?.Mp3Encoder) return Promise.resolve(w.lamejs)
  if (lamejsLoadPromise) return lamejsLoadPromise

  lamejsLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = withBase('/vendor/lamejs.min.js')
    script.async = true
    script.onload = () => {
      if (w.lamejs?.Mp3Encoder) resolve(w.lamejs as any)
      else reject(new Error('lamejs 로드 실패'))
    }
    script.onerror = () => reject(new Error('lamejs 스크립트를 불러올 수 없습니다'))
    document.head.appendChild(script)
  })
  return lamejsLoadPromise
}

/**
 * AudioBuffer를 브라우저에서 직접 MP3로 인코딩한다 (lamejs).
 * 서버 ffmpeg 대신 사용 — Vercel 서버리스에는 ffmpeg 바이너리가 없고 요청 본문 크기 한도도 있어
 * 프로덕션에서 항상 실패했음. 1152 샘플(MP3 프레임 단위)씩 인코딩해 긴 곡도 메모리 폭주 없이 처리한다.
 */
export async function encodeAudioBufferToMp3(
  buffer: AudioBuffer,
  kbps: number = 320,
  onProgress?: (percent: number) => void
): Promise<Blob> {
  const { Mp3Encoder } = await loadLamejs()
  const channels = buffer.numberOfChannels >= 2 ? 2 : 1
  const encoder = new Mp3Encoder(channels, buffer.sampleRate, kbps)

  const left = floatTo16BitArray(buffer.getChannelData(0))
  const right = channels === 2 ? floatTo16BitArray(buffer.getChannelData(1)) : null
  const totalSamples = left.length
  const sampleBlockSize = 1152

  const chunks: Int8Array[] = []
  for (let i = 0; i < totalSamples; i += sampleBlockSize) {
    const leftChunk = left.subarray(i, i + sampleBlockSize)
    const rightChunk = right ? right.subarray(i, i + sampleBlockSize) : undefined
    const mp3buf = encoder.encodeBuffer(leftChunk, rightChunk)
    if (mp3buf.length > 0) chunks.push(mp3buf)

    if (i % (sampleBlockSize * 200) === 0) {
      onProgress?.(Math.min(99, Math.round((i / totalSamples) * 100)))
      // 메인 스레드에 숨 돌릴 틈을 준다 (긴 곡에서 UI 멈춤 방지)
      await new Promise(resolve => setTimeout(resolve, 0))
    }
  }

  const finalBuf = encoder.flush()
  if (finalBuf.length > 0) chunks.push(finalBuf)
  onProgress?.(100)

  return new Blob(chunks as BlobPart[], { type: 'audio/mp3' })
}

function floatTo16BitPCM(view: DataView, offset: number, input: Float32Array) {
  for (let i = 0; i < input.length; i++, offset += 2) {
    const s = Math.max(-1, Math.min(1, input[i]))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true)
  }
}

export function estimateTruePeak(buffer: AudioBuffer): number {
  const factor = 8
  const taps = 12
  let peak = 0

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < data.length; index += 1) {
      peak = Math.max(peak, Math.abs(data[index]))
    }
  }

  const candidateThreshold = peak * 0.62
  let truePeak = peak

  for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let index = 0; index < data.length; index += 1) {
      const previous = index > 0 ? Math.abs(data[index - 1]) : 0
      const current = Math.abs(data[index])
      const next = index < data.length - 1 ? Math.abs(data[index + 1]) : 0

      if (Math.max(previous, current, next) < candidateThreshold) continue

      for (let phase = 1; phase < factor; phase += 1) {
        truePeak = Math.max(truePeak, Math.abs(sincInterpolateFast(data, index + phase / factor, taps)))
      }
    }
  }
  return truePeak
}

function sincInterpolateFast(data: Float32Array, position: number, taps: number): number {
  const center = Math.floor(position)
  let sum = 0
  let weightSum = 0

  for (let offset = -taps; offset <= taps; offset += 1) {
    const index = center + offset
    if (index < 0 || index >= data.length) continue

    const distance = position - index
    const windowValue = 0.5 + 0.5 * Math.cos((Math.PI * distance) / taps)
    const weight = sincFast(distance) * windowValue

    sum += data[index] * weight
    weightSum += weight
  }

  return weightSum ? sum / weightSum : 0
}

function sincFast(value: number): number {
  if (Math.abs(value) < 1e-8) return 1
  const x = Math.PI * value
  return Math.sin(x) / x
}

export function makeDistortionCurve(amount: number) {
  const k = typeof amount === 'number' ? amount : 50
  const n_samples = 44100
  const curve = new Float32Array(n_samples)
  const deg = Math.PI / 180
  let i = 0
  let x
  for ( ; i < n_samples; ++i ) {
    x = i * 2 / n_samples - 1
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) )
  }
  return curve
}

export function makeSoftClipCurve(amount: number = 1.2) {
  const n_samples = 44100
  const curve = new Float32Array(n_samples)
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1
    // Math.tanh provides a perfect mathematical soft clip (tape saturation curve)
    curve[i] = Math.tanh(x * amount) / Math.tanh(amount)
  }
  return curve
}
