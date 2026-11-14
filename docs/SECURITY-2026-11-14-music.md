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
| **M-7 수정(2026-11-14)** | 파일은 삭제·이동하지 않는다. ① 음원 CDN 두 곳(`cookiemusic-cdn` 워커·`cookiemusic-media` Pages)이 GET 마다 앱 `/music/api/tracks/public-check?key=` 에 「공개 곡이고 주인이 정지 안 됐나」를 묻고 404 면 R2·Cache API 를 열기 전에 404(예전 캐시 사본도 안 나감). 에지 캐시 성공 60초·거절 5초 → 전환이 약 1분 안에 반영. 앱 오류·시간 초과는 재생을 끊지 않도록 통과(fail-open), 명시적 404 만 거절. ② 비공개·정지 곡 재생은 기존 `signed-url` 의 소유자 전용 Supabase 서명(1시간)으로만. ③ 비공개 전환·정지 시 `purgeTrackCache`(Cloudflare 퍼지) 호출 — 자격(`CF_API_TOKEN`·`CF_ZONE_ID`·`CDN_PURGE_BASE`) 없으면 건너뜀. 알려진 한계: HEAD 는 이전 스크립트용으로 게이트 밖(존재·크기만), 이미 브라우저 HTTP 캐시에 받아 둔 사본은 못 비움 |
| **대표 작업(M-7 퍼지)** | 음원 CDN 이 `*.workers.dev`·`*.pages.dev` 라 Cloudflare zone 이 없어 퍼지 API 대상이 없고, 게이트가 캐시보다 앞이라 지금은 필요 없음. 나중에 음원을 커스텀 도메인(zone)으로 앞단에 둘 때만: Cloudflare API 토큰(Cache Purge 권한) 발급 → Vercel 환경변수 `CF_API_TOKEN`·`CF_ZONE_ID`·`CDN_PURGE_BASE`(예 `https://cdn.example.com`) 등록 |
| 확인 필요 L-3 | `IP_SALT` 운영 설정 여부(환경변수는 열람 금지라 확인 못 함) |
