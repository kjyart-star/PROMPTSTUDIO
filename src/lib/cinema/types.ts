/**
 * 플레이리스트 시네마 — 공용 타입.
 * 구조: 장면 템플릿(레이아웃) × 형태(visualizer 12종) × 색상(팔레트) 세 축이 서로 독립이다.
 * 미리보기·썸네일·내보내기가 모두 같은 draw 함수를 쓴다(가짜 이미지 금지).
 * 참고: boks-music 「PLAYLIST CINEMA」 화면의 구성(화면 구성 아이디어만 참고, 코드 복사 없음).
 */

export type VizShapeId =
  | 'dots' | 'bars-reflect' | 'wave-line' | 'wave-dual' | 'area-soft' | 'area-mirror'
  | 'ribbon' | 'ring-bars' | 'ring-line' | 'ring-dual' | 'radial-dots' | 'ring-oval'

export interface Palette {
  id: string
  name: string
  /** 그라데이션 색 정지점(2개 이상, 밝은 색 위주). 형태·강조 글자에 쓴다 */
  colors: string[]
  /** 대표 강조색 */
  accent: string
}

export interface LyricLineT { text: string; start: number }

export interface Box { x: number; y: number; w: number; h: number }

export interface CinemaFrame {
  /** 캔버스 픽셀 크기 */
  w: number
  h: number
  /** 이 곡 안에서의 시간(초) */
  t: number
  trackIndex: number
  trackCount: number
  trackTitle: string
  /** 타이틀 문구(영상 이름이 아니라 화면 상단 작은 글귀) */
  headline: string
  /** 커버 이미지. 없으면 null — 템플릿은 coverSeed 기반 대체 그림(drawCover)을 쓴다 */
  cover: CanvasImageSource | null
  coverSeed: string
  /** 가사 영상이면 'lyrics', 경음악이면 'instrumental' (경음악은 lines 가 비어 있다) */
  kind: 'lyrics' | 'instrumental'
  lines: LyricLineT[]
  /** 현재 줄 번호(-1 = 아직 시작 전·간주) */
  activeIndex: number
  /** 줄 시간이 추정값이면 true — 화면 어딘가에 「가사 시간 추정」을 작게 표시 */
  lyricsEstimated: boolean
  /** 이 곡 길이(초) */
  duration: number
  /** 스펙트럼 막대 0..1 (길이 64, 저음→고음) */
  bars: Float32Array
  /** 전체 음량 0..1 */
  level: number
  shape: VizShapeId
  palette: Palette
}

export interface CinemaTemplate {
  id: string
  /** 한국어 표시명 */
  name: string
  /** 카드 아래 한 줄 설명 */
  blurb: string
  /** 이 템플릿을 고르면 기본으로 잡히는 형태 */
  defaultShape: VizShapeId
  /** 한 프레임을 그린다. ctx 는 (0,0)~(f.w,f.h) 를 가득 채워야 한다 */
  draw(ctx: CanvasRenderingContext2D, f: CinemaFrame): void
}

export interface AspectDef { id: '16:9' | '9:16' | '1:1' | '4:3'; label: string; ratio: number }
export const ASPECTS: AspectDef[] = [
  { id: '16:9', label: '16:9 가로', ratio: 16 / 9 },
  { id: '9:16', label: '9:16 세로', ratio: 9 / 16 },
  { id: '1:1', label: '1:1 정사각', ratio: 1 },
  { id: '4:3', label: '4:3', ratio: 4 / 3 },
]
