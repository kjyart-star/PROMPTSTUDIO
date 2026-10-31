/** 원본 파일 헤더에서 샘플레이트를 읽는다 — 48kHz 면 48000, 그 밖에는 44100(MP3 인코더가 받는 값만) */
export function sniffSampleRate(head: Uint8Array): 44100 | 48000 {
  // WAV: "RIFF"…"WAVE", fmt 청크의 샘플레이트(오프셋 24)
  if (head.length >= 28 && head[0] === 0x52 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x46) {
    const sr = head[24] | (head[25] << 8) | (head[26] << 16) | (head[27] << 24)
    return sr === 48000 ? 48000 : 44100
  }
  // MP3: ID3v2 를 건너뛰고 첫 프레임 헤더(11비트 동기)에서 샘플레이트 표
  let i = 0
  if (head.length > 10 && head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33) {
    i = 10 + ((head[6] & 0x7f) << 21 | (head[7] & 0x7f) << 14 | (head[8] & 0x7f) << 7 | (head[9] & 0x7f))
  }
  for (; i + 3 < head.length; i++) {
    if (head[i] === 0xff && (head[i + 1] & 0xe0) === 0xe0) {
      const version = (head[i + 1] >> 3) & 3 // 3 = MPEG1
      const idx = (head[i + 2] >> 2) & 3
      if (version === 3 && idx === 1) return 48000
      return 44100
    }
  }
  return 44100
}

export async function sourceSampleRate(blob: Blob): Promise<44100 | 48000> {
  try { return sniffSampleRate(new Uint8Array(await blob.slice(0, 256 * 1024).arrayBuffer())) } catch { return 44100 }
}
