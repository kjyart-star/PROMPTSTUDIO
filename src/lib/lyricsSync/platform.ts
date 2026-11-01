/**
 * 가사 싱크 — 플랫폼 판별(순수 TS, 서버·웹·앱 공용).
 * 폰에서는 기본적으로 정렬을 계산하지 않는다(모델 77~291MB 내려받기·배터리). 폰에서 만든 곡은 서버 무료 큐가 먼저 채운다.
 */

/** 사용자 에이전트 문자열이 폰·태블릿인지 */
export function isMobileUA(ua: string | null | undefined): boolean {
  return /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle|Opera Mini|IEMobile/i.test(String(ua ?? ''));
}

/** 곡을 만든(올린) 기기 종류 — form.client_platform 에 남겨 서버 큐 우선순위에 쓴다 */
export type ClientPlatform = 'mobile' | 'desktop';
export const platformOfUA = (ua: string | null | undefined): ClientPlatform => (isMobileUA(ua) ? 'mobile' : 'desktop');
