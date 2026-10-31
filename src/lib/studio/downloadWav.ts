import { decodeAudio } from '@/lib/mastering/render'
import { encodeWav } from '@/lib/mastering/fileformats'
import { sniffSampleRate } from '@/lib/mastering/sniffRate'
import { resolveStudioAudioUrl } from './audioUrl'

/** 보관함에 WAV 로 저장된 예전 곡인가 */
export const isWavPath = (path?: string | null) => !!path && /\.wav(\?|$)/i.test(path)

const safe = (n: string) => (n || 'Untitled').replace(/[\\/:*?"<>|]/g, '_')

function save(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = name
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/**
 * WAV 내려받기. 업로드는 하지 않는다.
 * - 보관함에 WAV 로 저장된 곡은 원본을 그대로 내려받는다.
 * - MP3 곡은 브라우저에서 디코드해 16bit WAV 로 만든다(MP3 를 거쳤으니 무손실이 아니다).
 */
export async function downloadStudioWav(item: { audio_url?: string; stream_url?: string; url?: string; title?: string }) {
  const path = item.audio_url || item.stream_url || item.url
  if (!path) return
  const src = (await resolveStudioAudioUrl(path)) || path
  const res = await fetch(src)
  if (!res.ok) throw new Error('음원을 불러오지 못했습니다. 다시 시도해 주세요.')
  const buf = await res.arrayBuffer()
  const name = safe(item.title || '')
  if (isWavPath(path)) { save(new Blob([buf], { type: 'audio/wav' }), `${name}.wav`); return }
  const rate = sniffSampleRate(new Uint8Array(buf, 0, Math.min(buf.byteLength, 256 * 1024)))
  const dec = await decodeAudio(buf, rate)
  save(encodeWav(dec.channels, dec.sampleRate, 16, 'tpdf'), `${name}.wav`)
}
