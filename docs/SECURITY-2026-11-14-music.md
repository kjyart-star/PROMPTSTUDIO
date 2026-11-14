# 쿠키뮤직 보안 후속 처리 (2026-11-14)

감사 원문: COOKIELAB `docs/security/2026-11-14-audit.md`

| 항목 | 처리 |
|---|---|
| 아티스트 주소 | 이메일 앞부분 대신 `profiles.handle`. 없으면 `user-<무작위 8자>` 자동 생성(가입 트리거+백필). 옛 주소는 서버(서비스 키)에서만 조회해 새 주소로 영구 이동(계정이 하나일 때만). `public_profiles` 뷰에서 이메일 제거(마이그레이션 e). handle 은 모양 검증·남의 옛 주소와 겹치면 거절 |
| is_banned | 운영 DB 에 컬럼이 없어 정지가 동작하지 않았다 → 컬럼 추가(d). 정지 API 는 관리자+2차 인증 확인 뒤 서비스 키로 기록(사용자 세션은 컬럼 권한·트리거로 못 바꿈), 곡·앨범 비공개 처리도 서비스 키로(전에는 RLS 로 남의 행에 적용 안 됨). 판정: aiGate·생성·song-history POST |
| M-2 `/api/play` | 곡 id 형식 검증, IP+곡 1분 3회·IP 1분 60회(인스턴스별 최선 노력). `play_events` 는 운영에서 0행(삽입이 안 되고 있음)이라 DB 기반 제한은 쓰지 않았다 |
| M-9 | 2차 비밀번호 성공 시 HMAC 서명 쿠키(8시간, HttpOnly·Strict), 상수 시간 비교, 실패 5회/15분 제한. 관리 API(users·ban·studio-open·announcements·system-guides)가 쿠키를 서버에서 요구 |
| M-10 | 가입·콜백 오리진 허용 목록 고정(`SITE_ORIGIN` 환경변수 우선), 비밀번호 10자+흔한 값 거절 |
| M-11 | `next.config.ts` 보안 헤더(nosniff·SAMEORIGIN·Referrer-Policy·Permissions-Policy·CSP Report-Only) |
| M-12 | download 허용 호스트 목록+오디오 80MB·이미지 10MB 상한(스트리밍으로 읽다가 초과 시 중단) |
| L-6 L-7 L-8 L-9 | debug-download 라우트 제거, upload 의 개인정보 로그 제거, profile PUT 의 followers 등 무시·creditDelta 정수 검증, `.env.development`·운영 스크립트·로그 추적 해제 |
| **보류 M-7** | 비공개 전환·정지 시 CDN: R2 오브젝트는 immutable 1년 캐시로 키만 알면 무인증 재생. 막으려면 삭제·이동(사용자 음원 삭제 금지 규칙에 걸림) 또는 비공개 곡용 서명 URL 구조 변경이 필요 → 대표 결정 대기 |
| 확인 필요 L-3 | `IP_SALT` 운영 설정 여부(환경변수는 열람 금지라 확인 못 함) |
