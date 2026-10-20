/**
 * 「사용 설명서」 내용 — 화면 문구와 맞춰 쓴다.
 * 모듈 이름은 labels.ts MODULE_LABEL, 추천값은 presets.ts defaultChain, 목표 음량 표는 destinations.ts 에서 가져온다.
 * 출처 주소는 docs/mastering-destinations.md 에만 있고 여기엔 「공식 기준」 정도로만 쓴다.
 */
import type { SlotId } from '@/lib/mastering/dsp'
import { defaultChain } from '@/lib/mastering/presets'

export type HelpTabId = 'quick' | 'modules' | 'meters' | 'targets' | 'faq'
export const HELP_TABS: { id: HelpTabId; label: string }[] = [
  { id: 'quick', label: '3분 빠른 시작' },
  { id: 'modules', label: '모듈별 설명' },
  { id: 'meters', label: '미터 읽는 법' },
  { id: 'targets', label: '목표 음량 표' },
  { id: 'faq', label: '자주 묻는 질문' },
]

export interface QuickStep { n: number; title: string; body: string }
export const QUICK_STEPS: QuickStep[] = [
  { n: 1, title: '두 가지 보기', body: '맨 위 왼쪽에서 「마스터링」과 「믹서」를 바꿔요. 마스터링은 곡 하나의 최종 음량·톤을 맞추는 화면이고, 믹서는 스템(악기별 파일)을 채널로 나눠 섞는 화면이에요. 처음엔 「마스터링」으로 시작하세요. 「전문 설정」을 켜면 체인 14 모듈과 전체 미터가 같은 화면에 펼쳐져요.' },
  { n: 2, title: '곡 열기', body: '메뉴 줄의 「보관함」에서 내 곡을 고르거나, 「파일」로 컴퓨터의 WAV·MP3 등을 열어요. 파일을 화면에 끌어다 놓아도 돼요. 한 번에 20곡까지 올릴 수 있어요.' },
  { n: 3, title: '자동 분석·적용', body: '왼쪽에서 스타일을 고르면 곡을 분석해 마스터링이 자동으로 적용되고, 가장 큰 부분부터 바로 재생돼요. 마음에 안 들면 다른 스타일을 눌러 보세요.' },
  { n: 4, title: '납품처 확인', body: '화면 아래의 「어디에 쓸 곡인가요?」에서 곡이 갈 곳을 골라요. 기본은 「음반」이에요. 고르면 목표 음량·음량 상한·파일 형식이 그곳에 맞게 바뀌어요.' },
  { n: 5, title: '캐릭터·강도', body: '가운데 패널에서 캐릭터를 고르고 「목표 음량」「소리 넓이」「선명하게」 노브와 「강도」를 조절해요. 더 만지고 싶으면 「직접 다듬기」의 EQ로 저음·고음을 조금씩 손봐요.' },
  { n: 6, title: '원본·마스터 비교', body: '전송 줄의 「원본」「마스터」 버튼으로 처리 전후를 번갈아 들어요. 「음량 맞춰 비교」를 켜 두면 크기가 같아져서, 소리가 커서 좋게 들리는 착각 없이 비교할 수 있어요.' },
  { n: 7, title: '파일로 받기', body: '아래 줄에서 형식(WAV·MP3)을 고르고 내보내기를 눌러요. 「함께 내보내기」에서 다른 납품처를 같이 체크하면 한 번에 여러 버전이 만들어져요. 음반 마스터는 스트리밍·동영상용이 기본으로 같이 제안돼요.' },
]

/** 화면 캡처 자리: quick-1 ~ quick-6 (파일 없으면 숨김). 7단계 중 앞 6단계 */
export const QUICK_IMG_COUNT = 6

export interface ModuleHelp { slot: SlotId; what: string; when: string }
export const MODULE_HELP: ModuleHelp[] = [
  { slot: 'gate', what: '곡이 조용한 구간의 잡음(히스, 웅웅거림)을 줄여요.', when: '녹음 잡음이 들릴 때. 곡이 이미 깨끗하면 꺼 두세요.' },
  { slot: 'eq', what: '저음·중음·고음의 양을 다듬어요.', when: '답답하거나 너무 날카로울 때. 기본은 평평하게 켜져 있어요.' },
  { slot: 'mseq', what: '가운데 소리(보컬·베이스)와 양옆 소리를 따로 다듬어요.', when: '양옆만 밝게 하거나, 가운데 저음을 정리하고 싶을 때.' },
  { slot: 'dyneq', what: '특정 대역이 튈 때만 자동으로 깎거나 올려요.', when: '보컬이 가끔 거슬리거나 저음이 부풀 때.' },
  { slot: 'deesser', what: '「스」「츠」 같은 날카로운 소리를 줄여요.', when: '고음이 귀를 찌를 때. 소리를 들어보는 스위치로 줄어드는 소리를 확인할 수 있어요.' },
  { slot: 'match', what: '레퍼런스 곡의 톤을 따라가요.', when: '좋아하는 곡과 비슷한 느낌을 원할 때. 레퍼런스 곡을 먼저 불러와야 해요.' },
  { slot: 'comp', what: '큰 소리를 눌러 전체를 고르게 해요.', when: '소리가 들쭉날쭉할 때. 기본은 켜져 있어요.' },
  { slot: 'multiband', what: '저음·중음·고음을 따로 눌러요.', when: '저음만 너무 커서 전체가 눌릴 때.' },
  { slot: 'transient', what: '때리는 소리와 울림의 길이를 바꿔요.', when: '드럼이 둔하거나 울림이 너무 길 때.' },
  { slot: 'imager', what: '저·중·고 대역마다 양옆으로 퍼지는 정도를 바꿔요.', when: '고음만 넓히고 저음은 모아 두고 싶을 때.' },
  { slot: 'stereo', what: '소리가 양옆으로 퍼지는 정도와 저음 모으기를 바꿔요.', when: '더 넓거나 단단하게 하고 싶을 때. 기본은 켜져 있어요.' },
  { slot: 'saturation', what: '따뜻하고 진한 질감을 입혀요.', when: '디지털 느낌이 차갑거나 밋밋할 때.' },
  { slot: 'clipper', what: '튀는 순간만 둥글게 깎아요.', when: '짧은 피크 때문에 음량을 못 키울 때.' },
  { slot: 'limiter', what: '전체 음량을 키우고 천장을 넘지 않게 막아요.', when: '항상 마지막에. 음량 상한을 정하는 가장 중요한 모듈이에요.' },
]

const ON = (b: boolean) => (b ? '기본 켜짐' : '기본 꺼짐')
/** 추천값 — presets.ts defaultChain 의 값에서 만든다 */
export function moduleRecommend(slot: SlotId): string {
  const c = defaultChain()
  const on = ON(!c.bypass[slot])
  switch (slot) {
    case 'gate': return `${on} · 기준 ${c.gate.threshold} dB, 비율 ${c.gate.ratio}:1, 줄이는 양 ${c.gate.range} dB`
    case 'eq': return `${on} · 모든 대역 0 dB(평평)에서 시작`
    case 'mseq': return `${on} · 가운데·양옆 모두 0 dB(평평)에서 시작`
    case 'dyneq': return `${on} · 200 Hz·2.8 kHz 두 곳을 기준 ${c.dyneq.bands[0].threshold} dB 안팎으로 감시`
    case 'deesser': return `${on} · 중심 ${c.deesser.freq} Hz, 기준 ${c.deesser.threshold} dB, 줄이는 양 ${c.deesser.range} dB`
    case 'match': return `${on} · 따라가는 세기 ${c.match.strength}%`
    case 'comp': return `${on} · 기준 ${c.comp.threshold} dB, 비율 ${c.comp.ratio}:1, 어택 ${c.comp.attack} ms, 릴리즈 ${c.comp.release} ms`
    case 'multiband': return `${on} · 경계 ${c.multiband.lowX} Hz·${c.multiband.highX} Hz, 비율 ${c.multiband.bands[0].ratio}:1 안팎`
    case 'transient': return `${on} · 어택 ${c.transient.attack}, 서스테인 ${c.transient.sustain}(변화 없음)에서 시작`
    case 'imager': return `${on} · 세 대역 모두 ${c.imager.widths[0]}%(그대로)`
    case 'stereo': return `${on} · 넓이 ${c.stereo.width}%(그대로), 저음 모으기 ${c.stereo.bassMono}`
    case 'saturation': return `${on} · 깊이 ${c.saturation.drive}, 섞는 양 ${c.saturation.mix}%`
    case 'clipper': return `${on} · 기준 ${c.clipper.threshold} dB, 부드러움 ${c.clipper.softness}`
    case 'limiter': return `${on} · 천장 ${c.limiter.ceiling} dB, 게인 ${c.limiter.gain} dB, 릴리즈 ${c.limiter.release} ms, 트루피크 감시 ${c.limiter.truePeak ? '켜짐' : '꺼짐'}`
  }
}

export interface MeterHelp { name: string; body: string }
export const METER_ITEMS: MeterHelp[] = [
  { name: '통합 LUFS', body: '곡 전체의 체감 음량이에요. 스트리밍은 -14 근처가 기준이에요. 숫자가 클수록(0에 가까울수록) 크게 들려요.' },
  { name: '단기 LUFS', body: '최근 3초의 체감 음량이에요. 곡이 진행되며 어디가 크고 작은지 볼 때 써요.' },
  { name: '트루피크', body: '가장 큰 순간의 높이예요. 0을 넘으면 소리가 찌그러질 수 있어서, 보통 -1 dB 아래로 막아 둬요.' },
  { name: 'LRA', body: '조용한 곳과 큰 곳의 차이예요(단위 LU). 클수록 강약이 크고, 작을수록 일정해요.' },
  { name: 'PSR · PLR', body: 'PSR은 순간 피크와 체감 음량의 차이, PLR은 최대 피크와 평균 음량의 차이예요. 둘 다 작을수록 눌려서 납작한 소리예요.' },
  { name: '상관도', body: '+1에 가까우면 모노로 들어도 안전해요. 0 근처는 많이 퍼진 소리, 마이너스면 모노에서 소리가 빠질 수 있어요.' },
  { name: '스펙트럼', body: '저음부터 고음까지 소리가 얼마나 있는지 보여 줘요. 왼쪽이 저음, 오른쪽이 고음이에요.' },
  { name: '게인 리덕션(GR)', body: '압축·음량 상한이 소리를 누르고 있는 양이에요. 많이 눌릴수록 막대가 길어져요. 계속 크게 눌리면 강도를 낮춰 보세요.' },
]

export interface FaqItem { q: string; a: string }
export const FAQ_ITEMS: FaqItem[] = [
  { q: '보관함 곡이 안 열려요', a: '화면에 이유가 나와요. 「인터넷 연결을 확인해 주세요」면 연결을 확인하고, 「로그인이 만료됐어요」면 다시 로그인한 뒤 불러오세요. 「저장소에 음원 파일이 없어요」는 파일이 지워진 경우예요. 「음원 주소가 만료됐어요」나 「너무 오래 걸려 멈췄어요」는 잠시 뒤 다시 불러오면 돼요. 계속 안 되면 곡을 내려받아 「파일」로 열어 보세요.' },
  { q: '소리가 안 나요', a: '브라우저는 처음에 사용자가 누르기 전에는 소리를 막아요. 재생 버튼(Space)을 한 번 눌러 보세요. 그다음 스피커 아이콘이 음소거가 아닌지, 「모니터 볼륨」이 너무 낮지 않은지 확인하세요. 컴퓨터 자체 볼륨과 출력 장치도 봐 주세요.' },
  { q: '내보낸 파일이 목표와 다르게 나왔어요', a: '내보내기 뒤 나오는 결과 보고에서 실제 음량·트루피크를 확인하세요. 「자동 맞춤」을 누르면 곡 전체를 재서 목표에 맞춰요. 납품처를 바꿨는데 파일 설정을 직접 건드렸다면 「납품처 기준으로」를 눌러 되돌리세요. 반복 구간만 내보내기로 되어 있지 않은지도 확인하세요.' },
  { q: '피크가 넘쳐요(빨간색)', a: '「음량 상한(리미터)」 모듈의 추천값으로 맞춰 보세요: 천장 -1 dB, 트루피크 감시 켜짐. 그래도 넘치면 목표 음량 노브를 조금 낮추거나 「자동 맞춤」을 다시 눌러요.' },
  { q: '스템이 없어요 / 믹서에 채널이 안 보여요', a: '믹서는 스템(악기별 파일)을 넣어야 채널이 생겨요. 곡 하나만 있을 땐 마스터 채널만 보여요. 곡을 스템으로 자동으로 나누는 기능은 준비 중이에요.' },
  { q: '되돌리기는 어떻게 해요?', a: '실행 취소는 ⌘/Ctrl+Z, 다시 실행은 Shift+⌘/Ctrl+Z 예요(전문 설정 화면에서는 버튼도 있어요). 다른 단축키: Space 재생·정지, Enter 정지, L 구간 반복, M 마커.' },
]

export const TARGETS_NOTE = '값은 공식 기준을 확인한 것만 「확인」으로 표시해요. 확인하지 못한 값은 보수적으로 잡은 앱 기준값이에요.'
