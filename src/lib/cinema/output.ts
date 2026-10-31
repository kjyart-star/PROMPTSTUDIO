import { ASPECTS } from './types'

export type ShortSide = 720 | 1080 | 1440
export const RESOLUTIONS: { id: ShortSide; label: string }[] = [
  { id: 720, label: '720p' }, { id: 1080, label: '1080p' }, { id: 1440, label: '1440p (2K)' },
]
export const FPS_OPTIONS = [24, 30, 60] as const
export const LUFS_OPTIONS: { value: number | null; label: string }[] = [
  { value: -14, label: '유튜브 기준 -14 LUFS' },
  { value: -16, label: '-16 LUFS (팟캐스트·애플)' },
  { value: -23, label: '-23 LUFS (방송)' },
  { value: null, label: '맞추지 않음 (원본 음량)' },
]

const even = (n: number) => Math.max(2, Math.round(n / 2) * 2)

/** 짧은 변 기준 해상도 → 가로·세로(짝수) */
export function outputSize(aspect: string, shortSide: number): { w: number; h: number } {
  const r = ASPECTS.find(a => a.id === aspect)?.ratio ?? 16 / 9
  return r >= 1 ? { w: even(shortSide * r), h: even(shortSide) } : { w: even(shortSide), h: even(shortSide / r) }
}

export function formatClock(sec: number): string {
  const s = Math.max(0, Math.round(sec))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}` : `${m}:${String(r).padStart(2, '0')}`
}

/** H.264 코덱 문자열: 해상도·프레임에 맞는 레벨 */
export function avcCodecString(w: number, h: number, fps: number): string {
  const mbps = Math.ceil(w / 16) * Math.ceil(h / 16) * fps
  if (mbps <= 108000) return 'avc1.64001f' // 4.0 이하… 720p30
  if (mbps <= 245760) return 'avc1.640028' // 4.0
  if (mbps <= 522240) return 'avc1.64002a' // 4.2
  return 'avc1.640033' // 5.1
}

export function videoBitrate(w: number, h: number, fps: number): number {
  return Math.round(Math.min(40e6, Math.max(2e6, w * h * fps * 0.09)))
}

/** 대략적인 파일 크기(바이트): 영상+오디오 192kbps */
export function estimateBytes(seconds: number, w: number, h: number, fps: number): number {
  return Math.round(seconds * (videoBitrate(w, h, fps) + 192000) / 8)
}
