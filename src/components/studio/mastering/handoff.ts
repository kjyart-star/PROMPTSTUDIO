/**
 * 간단 마스터링 → 고급 마스터링 넘겨주기. 대화창이 곡과 설정을 맡겨 두면 마스터링 화면이 열리며 한 번 꺼내 쓴다.
 */
import type { ChainParams } from '@/lib/mastering/dsp'
import type { LibrarySong, Target } from './store'

export interface MasteringHandoff {
  song: LibrarySong
  /** 간단 마스터링 결과 체인(결과 전이면 없음 — 그때는 고음 정리 설정만 넘긴다) */
  params?: ChainParams
  aiClean?: 'natural' | 'strong' | null
  target: Target
}

let pending: MasteringHandoff | null = null
/** 설정째 넘어온 곡 — 곡을 연 뒤 「자동 추천」 원클릭이 그 설정을 덮지 않게 한 번 건너뛴다 */
const keep = new Set<string>()
export const keepSettingsFor = (songId: string) => { keep.add(songId) }
export function takeKeepSettings(songId: string): boolean { return keep.delete(songId) }
export const setHandoff = (h: MasteringHandoff | null) => { pending = h }
export function takeHandoff(): MasteringHandoff | null { const h = pending; pending = null; return h }
