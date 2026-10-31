import type { CinemaTemplate } from '../types'
import { albumBlur } from './album-blur'
import { photoStage } from './photo-stage'
import { vinylLounge } from './vinyl-lounge'
import { paperPlayer } from './paper-player'
import { cinemaFlow } from './cinema-flow'
import { soundGallery } from './sound-gallery'
import { cassette } from './cassette'
import { retroTv } from './retro-tv'
import { corkboard } from './corkboard'
import { rainWindow } from './rain-window'
import { nightDrive } from './night-drive'
import { cafeTable } from './cafe-table'
import { lofiDesk } from './lofi-desk'
import { glassCard } from './glass-card'
import { typeGrid } from './type-grid'
import { filmStrip } from './film-strip'

/** 새 템플릿 = 파일 하나 + 이 배열에 한 줄 */
export const TEMPLATES: CinemaTemplate[] = [
  albumBlur, photoStage, vinylLounge, paperPlayer, cinemaFlow, soundGallery, cassette, retroTv, corkboard,
  // 실사 장면(배경 사진·서체를 prepareScene 으로 미리 불러 둔다)
  rainWindow, nightDrive, cafeTable, lofiDesk, glassCard, typeGrid, filmStrip,
]

export const getTemplate = (id: string): CinemaTemplate => TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
