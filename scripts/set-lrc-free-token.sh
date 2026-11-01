#!/usr/bin/env bash
# 가사 싱크 무료 큐 토큰(LRC_FREE_TOKEN) 새로 만들어 세 곳에 같은 값으로 넣기 — 대표가 직접 실행한다.
#   1) GitHub Actions secret (10분마다 워커를 깨우는 lrc-free-kick 워크플로)
#   2) Vercel 운영 환경변수 (서버 /api/lrc-free 가 토큰을 확인하고, 이벤트로 워커를 깨울 때 쓴다)
#   3) Cloudflare 워커 secret (cookiemusic-lrc-free)
# 토큰은 화면에 출력하지 않는다. Vercel 은 같은 코드로 다시 배포해 새 값을 반영한다.
#
# 필요: openssl, gh(로그인), vercel(로그인, 이 저장소에 연결됨), npx wrangler(로그인)
# 실행: bash scripts/set-lrc-free-token.sh   (저장소 어디서 실행해도 된다)

set -u

REPO_GH="kjyart-star/PROMPTSTUDIO"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WRANGLER_TOML="$ROOT/workers/lrc-free/wrangler.toml"
WORKFLOW="lrc-free-kick.yml"

ok()   { printf '  [성공] %s\n' "$1"; }
fail() { printf '  [실패] %s\n' "$1"; FAILED=1; }
FAILED=0

if [ ! -f "$WRANGLER_TOML" ]; then
  echo "워커 설정 파일이 없습니다: $WRANGLER_TOML"
  echo "저장소를 최신으로 받은 뒤(git pull) 다시 실행하세요."
  exit 1
fi

echo "1/6 토큰 만들기"
TOKEN="$(openssl rand -base64 36 | tr -d '\n=+/' | cut -c1-48)"
if [ "${#TOKEN}" -ge 32 ]; then ok "토큰 생성(${#TOKEN}자, 화면에 출력하지 않음)"; else echo "  [실패] 토큰 생성"; exit 1; fi

echo "2/6 GitHub Actions secret ($REPO_GH)"
if printf '%s' "$TOKEN" | gh secret set LRC_FREE_TOKEN -R "$REPO_GH" >/dev/null 2>&1; then ok "gh secret set LRC_FREE_TOKEN"; else fail "gh secret set (gh auth status 를 확인하세요)"; fi

echo "3/6 Vercel 운영 환경변수"
cd "$ROOT" || exit 1
if vercel env ls production 2>/dev/null | grep -q "LRC_FREE_TOKEN"; then
  if printf '%s' "$TOKEN" | vercel env update LRC_FREE_TOKEN production --yes >/dev/null 2>&1; then ok "vercel env update LRC_FREE_TOKEN (기존 값 교체)"; else fail "vercel env update"; fi
else
  if printf '%s' "$TOKEN" | vercel env add LRC_FREE_TOKEN production >/dev/null 2>&1; then ok "vercel env add LRC_FREE_TOKEN"; else fail "vercel env add"; fi
fi

echo "4/6 Cloudflare 워커 secret (cookiemusic-lrc-free)"
if printf '%s' "$TOKEN" | npx --yes wrangler secret put LRC_FREE_TOKEN --config "$WRANGLER_TOML" >/dev/null 2>&1; then ok "wrangler secret put LRC_FREE_TOKEN"; else fail "wrangler secret put (npx wrangler whoami 를 확인하세요)"; fi

unset TOKEN

if [ "$FAILED" -ne 0 ]; then
  echo
  echo "실패한 단계가 있습니다. 세 곳의 값이 달라졌을 수 있으니 문제를 고친 뒤 이 스크립트를 처음부터 다시 실행하세요."
  exit 1
fi

echo
echo "5/6 Vercel 운영 다시 배포(지금 운영 중인 배포를 같은 코드로 다시 빌드해 새 값을 반영)"
PROD_URL="$(vercel ls --prod 2>/dev/null | grep -m1 -oE 'https://[a-z0-9-]+\.vercel\.app')"
if [ -n "$PROD_URL" ] && vercel redeploy "$PROD_URL" --target production >/dev/null 2>&1; then ok "vercel redeploy"; else fail "vercel redeploy (master 에 푸시해도 반영됩니다)"; fi

echo "6/6 Actions 워크플로 한 번 실행"
if gh workflow run "$WORKFLOW" -R "$REPO_GH" >/dev/null 2>&1; then ok "gh workflow run $WORKFLOW"; else fail "gh workflow run $WORKFLOW"; fi

echo
echo "결과 확인(30초쯤 뒤, 아래 명령을 차례로):"
echo "  gh run list --workflow $WORKFLOW -R $REPO_GH --limit 1"
echo "  gh run view <위 목록의 ID> --log -R $REPO_GH"
echo "  curl -s https://cookiemusic-lrc-free.kjyart.workers.dev/status"
echo "로그에 unauthorized 가 없으면 성공입니다."
