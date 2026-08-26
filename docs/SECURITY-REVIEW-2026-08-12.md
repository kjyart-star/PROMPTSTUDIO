# 보안 검수 보고서 — 2026-08-12

프롬프트 스튜디오(suno-prompt) 코드 + Supabase DB 전면 보안 검수 결과.

## 🔴 치명적 (즉시 조치 필요 — DB)

### 1. 공개 테이블 RLS 비활성 + anon 전권 (확인됨)
Supabase 어드바이저 및 직접 조회로 확인. `public.profiles`, `public.announcements`,
`public.system_guides`가 **RLS 꺼짐 + anon/authenticated에 SELECT/INSERT/UPDATE/DELETE 전권**.
anon 키는 브라우저 번들에 노출되므로, 누구나 `/rest/v1/profiles`로 직접:
- 전체 사용자 email·is_admin·credits 열람
- 자기 계정 `is_admin=true` / `credits=999999` 설정 (권한상승)
- 프로필 대량 삭제

→ API 라우트 인증을 **전부 우회**. 앱 코드 수정보다 상위의 문제.

### 2. update_user_credits RPC를 anon이 실행 가능 (확인됨)
`SECURITY DEFINER` 함수가 anon/authenticated에 EXECUTE 허용 → 누구나
`/rest/v1/rpc/update_user_credits`로 크레딧 무제한 충전 가능. 앱에서는 미사용.

**조치:** `supabase/migrations/20260812_enable_rls_critical.sql` 작성 완료(검증 완료, 앱 무손상 설계).
운영 DB 반영은 승인 게이트에 막혀 미적용 — **대표 승인/실행 필요**.
적용 방법: Supabase SQL Editor에 붙여넣기 또는 승인 후 재적용.

## 🟠 하드닝 (어드바이저 WARN)
- `is_admin`, `update_user_credits`, `set_updated_at`, `increment_play_counts`,
  `update_like_counts` — search_path 미설정. 함수 본문 확인 후 `set search_path` 권장.
- 유출 비밀번호 차단(HaveIBeenPwned) 비활성 → Supabase Auth 설정에서 활성화.
- 공개 SELECT 정책이 profiles의 email까지 노출. 앱이 email 앞부분을 아티스트 slug로
  공개 사용 중이라 즉시 제거 불가 → `handle`/`slug` 컬럼 도입 후 email 비공개화 필요(별도 작업).

## ✅ 코드 수정 완료 (이번 세션, 커밋 대기)
### 보안
- download 라우트 SSRF/오픈프록시 → 인증 필수 + 사설IP 차단(`src/lib/security/ssrf.ts`)
- AdminAuthGuard 비밀번호 하드코딩 → 서버 검증(`/api/admin/verify`, `ADMIN_SECONDARY_PASSWORD` 필요)
- temp-cleanup 오픈리다이렉트 → 상대경로만 허용
- generate-prompt → model 화이트리스트 + 입력 길이 제한
- admin/users service_role → anon 폴백 제거, 없으면 500
- suno/cover/status → 인증 추가
- playlists/save-track → getSession→getUser

### 버그
- Studio JA 사용자 크래시, 플레이리스트 편집 시 폴더/채널 소실, 배너 업로드 no-op,
  GenerateClient 정규식 이중이스케이프, ShareDialog 복사 실패 처리, 좋아요 stale-response,
  화살표키 select 차단, JA 설정페이지, ?tab=mastering 딥링크, 차트 colSpan

### 성능
- 검색 디바운스 + 전체 테이블 덤프 제한, 아티스트 페이지 profiles 전체스캔 제거,
  charts/library/layout/search 순차쿼리 병렬화, song-history read당 DELETE 제거,
  play/likes 과다페칭 축소

## 남은 설계 과제 (DB/모델 변경)
- play_count/like_count 원자적 증가(RPC), 전역 liked boolean → per-user 조인테이블,
  차트집계 1000행 상한 → RPC 필수화, email-as-slug 제거

## ⚠️ 배포 전 필수
1. 위 RLS 마이그레이션 적용
2. `ADMIN_SECONDARY_PASSWORD` 새 값으로 env 설정(기존 하드코딩값 유출됨, 재사용 금지)
3. Supabase Auth에서 유출 비밀번호 차단 활성화
