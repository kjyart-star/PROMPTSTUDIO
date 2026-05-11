# Supabase Google Login Setup

이 앱을 서비스로 운영할 때 최종 사용자는 Supabase 값을 입력하지 않습니다.
운영자가 프로젝트 환경변수와 Supabase Auth 설정을 끝내면 사용자는 Google 버튼으로 가입/로그인합니다.

## 필요한 권한

- Supabase 조직 안의 프로젝트 접근 권한: Owner 또는 프로젝트 설정/API/Auth를 볼 수 있는 권한
- Supabase SQL Editor 실행 권한
- Google Cloud Console에서 OAuth Client를 만들 수 있는 권한
- 배포 환경의 환경변수 설정 권한

지금 공유된 `https://supabase.com/dashboard/org/...` 주소는 조직 주소입니다.
앱 연결에는 조직 주소가 아니라 프로젝트별 API URL이 필요합니다.

## 1. Supabase 프로젝트 값 찾기

1. Supabase Dashboard에서 조직으로 들어갑니다.
2. 실제 사용할 프로젝트를 클릭합니다.
3. `Project Settings > API`로 이동합니다.
4. 아래 값을 복사합니다.
   - Project URL: `https://프로젝트ID.supabase.co`
   - Project API Keys의 `anon public`

## 2. 앱 환경변수 설정

로컬 개발에서는 `.env.local` 파일을 만들고 아래처럼 넣습니다.

```bash
VITE_SUPABASE_URL=https://프로젝트ID.supabase.co
VITE_SUPABASE_ANON_KEY=anon-public-key
```

수정 후 개발 서버를 재시작해야 Vite가 환경변수를 읽습니다.

배포할 때도 같은 값을 배포 서비스의 Environment Variables에 넣습니다.

## 3. DB 테이블 만들기

Supabase SQL Editor에서 `supabase/schema.sql` 내용을 실행합니다.

현재 앱이 바로 쓰는 테이블은 `song_history`입니다.
`profiles`, `subscriptions`는 향후 마이페이지와 결제 기능을 위해 미리 준비한 구조입니다.

## 4. Google OAuth 설정

Supabase 공식 방식은 Google Cloud에서 OAuth Client를 만들고 Supabase Auth Provider에 연결하는 방식입니다.

1. Supabase Dashboard에서 `Authentication > Providers > Google`로 이동합니다.
2. 화면에 표시되는 Callback URL을 복사합니다.
   - 현재 프로젝트의 Callback URL:
     `https://qdldfwzygnxlstxqojtq.supabase.co/auth/v1/callback`
3. Google Cloud Console에서 OAuth Client를 생성합니다.
4. Authorized redirect URIs에 Supabase Callback URL을 추가합니다.
5. Google Client ID와 Client Secret을 Supabase Google Provider 설정에 저장합니다.
6. Supabase `Authentication > URL Configuration`에서 Site URL과 Redirect URLs를 추가합니다.
   - 로컬: `http://127.0.0.1:5173`
   - 운영: `https://운영도메인`

`{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}`가 나오면
Supabase의 `Authentication > Providers > Google`이 아직 꺼져 있거나 Client ID/Secret 저장이 완료되지 않은 상태입니다.

## 5. 앱에서 확인

1. `npm run dev`
2. 앱에서 현재 모드가 `Supabase 클라우드`인지 확인합니다.
3. `Google로 가입/로그인`을 누릅니다.
4. 로그인 후 가사를 생성하고 `현재 곡 저장`을 누릅니다.
5. `저장 히스토리`에 저장 항목이 보이면 연결 완료입니다.

## 다음 단계: 결제

결제는 보통 Stripe Checkout + Webhook + Supabase Edge Function 조합으로 붙입니다.
권장 흐름은 다음과 같습니다.

1. Stripe Customer를 Supabase user id와 매핑
2. Checkout Session 생성용 서버/Edge Function 작성
3. Stripe Webhook에서 subscription 상태를 `subscriptions` 테이블에 반영
4. 앱에서 `subscriptions.status`와 `plan`을 읽어 무료/유료 기능 제한
