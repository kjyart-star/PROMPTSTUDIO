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
