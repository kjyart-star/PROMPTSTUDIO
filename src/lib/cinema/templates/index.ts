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

/** 새 템플릿 = 파일 하나 + 이 배열에 한 줄 */
export const TEMPLATES: CinemaTemplate[] = [
  albumBlur, photoStage, vinylLounge, paperPlayer, cinemaFlow, soundGallery, cassette, retroTv, corkboard,
]

export const getTemplate = (id: string): CinemaTemplate => TEMPLATES.find(t => t.id === id) ?? TEMPLATES[0]
