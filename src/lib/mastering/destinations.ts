/**
 * 마스터링 납품처(어디에 쓸 곡인가) 축. 값은 1차 공식 출처 확인분만 verified=true.
 * 확인 못 한 값은 보수적 앱 값 + verified=false (docs/mastering-destinations.md 「미확인」 참고).
 * 화면 노출 label 에는 타사 상표명 금지 — 상표명은 sources 에만.
 */
import type { UseId } from './compose'
import type { ExportOpts } from '@/components/studio/mastering/actions'

export type DestinationId = 'album' | 'stream' | 'video' | 'film' | 'broadcast' | 'ad' | 'club' | 'podcast-bgm'

/** confirmed = 1차 공식 문서 본문을 직접 읽어 확인. secondary = 2차 출처·검색 요약·미러만 확인(참고). unread = 공식 문서를 열람하지 못함 */
export interface DestinationSource { title: string; url: string; checked: '2026-10-21'; grade: 'confirmed' | 'secondary' | 'unread'; note?: string }

export interface Destination {
  id: DestinationId
  label: string
  /** 초보용 한 줄 */
  plain: string
  lufs: number
  tp: number
  lra: number | null
  rate: 44100 | 48000 | 96000
  bits: 16 | 24
  format: 'wav' | 'mp3'
  dither: boolean
  /** 대사와 섞일 전제: 과한 압축·리미팅 금지, 중역 비움 옵션 */
  bgmMode: boolean
  useId: UseId
  verified: { lufs: boolean; tp: boolean; lra: boolean; format: boolean }
  /** 공식 기준이 없어 앱 기존 설정을 따로 기록 (클럽·DJ) */
  appDefault?: { lufs: number; tp: number }
  sources: DestinationSource[]
}

const C = '2026-10-21' as const

const SPOTIFY: DestinationSource = { title: 'Spotify for Artists — Loudness normalization', url: 'https://support.spotify.com/us/artists/article/loudness-normalization/', checked: C, grade: 'confirmed', note: '기준 -14 LUFS(보통), 큰 소리 -11·작은 소리 -19. 트루피크 -1 dB 미만, -14 LUFS 보다 큰 마스터는 -2 dB 미만. LRA 언급 없음' }
const EBU: DestinationSource = { title: 'EBU R 128', url: 'https://tech.ebu.ch/docs/r/r128.pdf', checked: C, grade: 'confirmed', note: 'v4(2020-08): 목표 -23.0 LUFS ±0.5 LU(생방송 ±1.0), 트루피크 최대 -1 dBTP. LRA 는 참고 측정치일 뿐 허용 한도 수치 없음(Tech 3342)' }
const KR_BROADCAST: DestinationSource = { title: '디지털 텔레비전 방송프로그램 음량 등에 관한 기준(미래창조과학부고시 제2014-87호) — 법령 데이터베이스 미러', url: 'https://www.ulex.co.kr/%EB%B2%95%EB%A5%A0/2100000094621-46366-%EB%94%94%EC%A7%80%ED%84%B8%ED%85%94%EB%A0%88', checked: C, grade: 'secondary', note: '참고(2차): 평균 음량 -24 LKFS, 운용상 허용오차 ±2 dB, 방송광고 포함, 전문 음악 생방송 예외, BS.1770-3 측정. 트루피크 한도 규정 없음. 정부 원문(law.go.kr)은 본문을 열람하지 못함' }
const KR_BROADCAST_GUIDE: DestinationSource = { title: '디지털 텔레비전 방송프로그램 음량기준 등에 관한 업무지침(중앙전파관리소예규 제119호)', url: 'https://www.law.go.kr/LSW/admRulSideInfoP.do?langType=Ko&joBrNo=00&docCls=jo&chrClsCd=010202&urlMode=admRulScJoRltInfoR&joChgYn=N&joNo=0003&admRulSeq=2100000047809', checked: C, grade: 'confirmed', note: '정부 원문: 「방송프로그램」 정의에 방송광고 포함(제3조). 수치는 고시 제2014-87호·TTA 「디지털 방송 음량레벨 운용기준」(TTAK.KO-07.0114)에 위임. TTAK.KO-07.0098 은 찾지 못함' }
const ATSC: DestinationSource = { title: 'ATSC A/85:2026-07 Establishing and Maintaining Audio Loudness', url: 'https://www.atsc.org/wp-content/uploads/2026/07/A85-2026-07.pdf', checked: C, grade: 'confirmed', note: '메타데이터 없는 납품: 목표 -24 LKFS(허용 약 ±2 dB), 트루피크 -2 dBTP 미만(±0.5). 장편은 대사 기준, 광고 등 단편은 전체 믹스 기준(표 M.1). LRA 수치 없음' }
const AES: DestinationSource = { title: 'AES TD1004.1.15-10 스트리밍 음량 권고(TD1008 로 대체됨)', url: 'https://aes.org/wp-content/uploads/2024/01/AESTD1004_1_15_10.pdf', checked: C, grade: 'confirmed', note: '목표 -16 LUFS 이하·-20 LUFS 이상 권고, 최대 피크 -1.0 dB TP. 음반(CD) 마스터용 공식 LUFS 기준은 아님. 후속 TD1008 은 본문을 열람하지 못함(참고(2차) 요약: -14 ~ -18)' }
const NETFLIX: DestinationSource = { title: 'Netflix Sound Mix Specifications & Best Practices', url: 'https://partnerhelp.netflixstudios.com/hc/en-us/articles/360001794307-Netflix-Sound-Mix-Specifications-Best-Practices-v1-5', checked: C, grade: 'secondary', note: '참고(2차): 공식 페이지는 열람 불가(스크립트 렌더링, 본문 비어 있음). 검색 요약 기준 대사 게이트 -27 LKFS ±2 LU(1770-1), 트루피크 -2 dBTP(M&E·돌비애트모스 문서). 음악 단독 음량 기준 못 찾음. 옛 주소 backlothelp 는 studiopartner.netflix.net 으로 이전됨' }
const APPLE_POD: DestinationSource = { title: 'Apple Podcasts — Audio requirements', url: 'https://podcasters.apple.com/support/893-audio-requirements', checked: C, grade: 'confirmed', note: '-16 LKFS ±1, 트루피크 -1 dBFS 이하, WAV/FLAC 최소 44.1 kHz 16/24비트' }
const LOC_CD: DestinationSource = { title: 'Library of Congress — Linear Pulse Code Modulated Audio (LPCM)', url: 'https://www.loc.gov/preservation/digital/formats/fdd/fdd000011.shtml', checked: C, grade: 'secondary', note: 'Red Book CD = LPCM 16비트 44.1 kHz (규격 IEC 60908 은 유료라 원문 미열람). 디더는 16비트로 줄일 때의 일반 관행' }

const ALBUM_PRACTICE: DestinationSource = { title: '음반 음량 — 업계 관행(공식 기준 없음)', url: 'https://www.loc.gov/preservation/digital/formats/fdd/fdd000011.shtml', checked: C, grade: 'unread', note: '-9 LUFS 는 업계 관행 값(공식 기준 없음). 트루피크는 파생본 손실 변환 오버 방지를 위해 -1 로 통일' }

export const DESTINATIONS: Destination[] = [
  {
    id: 'album', label: '음반 (CD · 디지털 앨범)', plain: '앨범으로 내는 곡. 음량 규정이 없어 여유 있게 키웁니다.',
    lufs: -9, tp: -1, lra: null, rate: 44100, bits: 16, format: 'wav', dither: true, bgmMode: false, useId: 'use-cd',
    verified: { lufs: false, tp: false, lra: false, format: true },
    sources: [LOC_CD, AES, ALBUM_PRACTICE],
  },
  {
    id: 'stream', label: '음원 스트리밍', plain: '음원 서비스에 올리는 곡. 서비스가 알아서 음량을 맞춰 줍니다.',
    lufs: -14, tp: -1, lra: null, rate: 44100, bits: 24, format: 'wav', dither: false, bgmMode: false, useId: 'use-stream',
    verified: { lufs: true, tp: true, lra: false, format: false },
    sources: [SPOTIFY, AES],
  },
  {
    id: 'video', label: '동영상 플랫폼 · 쇼츠', plain: '영상 사이트에 올리는 곡. 너무 크면 자동으로 줄어듭니다.',
    lufs: -14, tp: -1, lra: null, rate: 48000, bits: 24, format: 'wav', dither: false, bgmMode: false, useId: 'use-video',
    verified: { lufs: false, tp: false, lra: false, format: false },
    sources: [{ title: 'YouTube 고객센터 — 음량 정규화', url: 'https://support.google.com/youtube/', checked: C, grade: 'unread', note: '공식 크리에이터 문서에서 -14 LUFS 수치를 찾지 못함(시청자용 「안정적인 음량」 도움말만 있음, 2026-10-21 재확인). -14 는 외부 측정 기반 2차 통설 — 미확인, 스트리밍 값과 같게 둔 보수적 값' }],
  },
  {
    id: 'film', label: '영화', plain: '영화 속 음악. 대사·효과음과 섞이니 여유 있게 둡니다.',
    lufs: -23, tp: -2, lra: null, rate: 48000, bits: 24, format: 'wav', dither: false, bgmMode: true, useId: 'use-bgm',
    verified: { lufs: false, tp: false, lra: false, format: false },
    sources: [NETFLIX],
  },
  {
    id: 'broadcast', label: '드라마 · 방송', plain: '방송에 나가는 곡. 방송 음량 기준에 맞춥니다.',
    lufs: -24, tp: -2, lra: null, rate: 48000, bits: 24, format: 'wav', dither: false, bgmMode: true, useId: 'use-broadcast',
    verified: { lufs: true, tp: true, lra: false, format: false },
    sources: [ATSC, KR_BROADCAST_GUIDE, KR_BROADCAST, EBU],
  },
  {
    id: 'ad', label: '광고', plain: '광고에 쓰는 곡. 방송 광고도 방송 음량 기준을 따릅니다.',
    lufs: -24, tp: -2, lra: null, rate: 48000, bits: 24, format: 'wav', dither: false, bgmMode: false, useId: 'use-shorts',
    verified: { lufs: true, tp: true, lra: false, format: false },
    sources: [{ ...ATSC, note: '단편(광고 등)은 전체 믹스 기준 -24 LKFS, 트루피크 -2 dBTP(표 M.1). 한국 방송광고도 방송프로그램에 포함되어 같은 -24 LKFS 기준(업무지침 제3조 정의 + 고시 2차 미러)' }, KR_BROADCAST_GUIDE, KR_BROADCAST],
  },
  {
    id: 'club', label: '클럽 · DJ', plain: '클럽에서 트는 곡. 공식 기준이 없어 크고 단단하게 만듭니다.',
    lufs: -8, tp: -0.3, lra: null, rate: 44100, bits: 24, format: 'wav', dither: false, bgmMode: false, useId: 'use-club',
    verified: { lufs: false, tp: false, lra: false, format: false },
    appDefault: { lufs: -8, tp: -0.3 },
    sources: [{ title: 'AES 표준 목록 — 클럽·DJ 전용 음량 기준 없음', url: 'https://www.aes.org/standards/', checked: C, grade: 'unread', note: '공식 기준이 없어 앱 기존 설정(-8 LUFS, TP -0.3)을 그대로 사용' }],
  },
  {
    id: 'podcast-bgm', label: '팟캐스트 배경음악', plain: '말소리 뒤에 깔리는 음악. 말이 묻히지 않게 합니다.',
    lufs: -16, tp: -1, lra: null, rate: 44100, bits: 24, format: 'wav', dither: false, bgmMode: true, useId: 'use-bgm',
    verified: { lufs: true, tp: true, lra: false, format: true },
    sources: [APPLE_POD],
  },
]

export const DEFAULT_DESTINATION: DestinationId = 'album'

export const destinationById = (id: string): Destination =>
  DESTINATIONS.find(d => d.id === id) ?? DESTINATIONS[0]

/** 내보내기 옵션. 16비트는 디더(노이즈 셰이핑), 24비트는 디더 없음 */
export function exportOptsFor(d: Destination): Pick<ExportOpts, 'format' | 'bits' | 'rate' | 'dither'> {
  return { format: d.format, bits: d.bits, rate: d.rate, dither: d.dither && d.bits === 16 ? 'shaped' : 'none' }
}

/** 음반 마스터에서 함께 내보낼 파생본 기본 제안 */
export const DERIVATIVES: Record<DestinationId, DestinationId[]> = {
  album: ['stream', 'video'],
  stream: [], video: [], film: [], broadcast: [], ad: [], club: [], 'podcast-bgm': [],
}
