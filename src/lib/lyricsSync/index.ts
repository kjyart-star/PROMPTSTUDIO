/**
 * 가사 싱크 공용 모듈(순수 TS — DOM·React·Next 없음). 웹 플레이어·스튜디오·서버 라우트·Cloudflare 워커와
 * 앞으로 만들 앱이 같은 정렬 후처리·검증·제출 형식을 쓴다.
 */
export { finalizeAlignment, ONSET_LEAD_SEC } from '@/lib/player/lyricAlign';
export { validateAutoLrc, plausibleSpacing, lrcAgree, alignLineTexts, AGREE_SEC, AGREE_RATIO, LOW_CONF, type LrcLine, type LrcCheck } from '@/lib/player/lrcValidate';
export { isMobileUA, platformOfUA, type ClientPlatform } from './platform';
export { clientInfoOf, modelTagOf, CLIENT_KINDS, ENGINES, type ClientInfo, type ClientKind, type Engine } from './submission';
