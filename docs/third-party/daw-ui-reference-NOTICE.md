# 마스터링 화면 — 참고 출처와 라이선스 고지

쿠키뮤직 스튜디오 「마스터링」의 고급 모드 화면(전송 바, 큰 카운터, 트랙·마커 목록, 채널 스트립,
떠 있는 플러그인 창의 「이름 · 슬라이더 · 값」 표, 아래 도크 탭, 상태 줄)은 아래 오픈소스 프로젝트의
화면 배치와 시각 디자인을 참고해 새로 구현했다. 소스 코드는 가져오지 않았다(원본은 Rust, 이쪽은 React/TypeScript).

- 프로젝트: SoundCraft — https://github.com/storytold/soundcraft (getartcraft.com/apps/soundcraft)
- 라이선스: Apache License 2.0 또는 MIT License (이중 라이선스)
- 참고한 자료: 저장소 docs/images 의 Mix·Edit·Automation 화면 스크린샷
- 확인 날짜: 2026-10-21

화면에는 원 프로젝트의 이름·로고를 쓰지 않는다. 신호 처리(EQ·컴프·리미터·라우드니스 측정 등)는
공개 표준 공식(RBJ 바이쿼드, ITU-R BS.1770-4, EBU Tech 3342)으로 직접 구현했다.

## Apache License 2.0 고지 요약

Licensed under the Apache License, Version 2.0 (http://www.apache.org/licenses/LICENSE-2.0) or the
MIT license (https://opensource.org/licenses/MIT), at the user's option. Distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND.
