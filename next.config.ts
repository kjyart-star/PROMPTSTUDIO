import type { NextConfig } from "next";

/**
 * 쿠키뮤직은 쿠키플레이 안의 `/music` 구역으로 들어간다(Vercel 멀티존).
 * 허브(cookieplay.app)가 `/music/:path*` 를 이 배포로 넘겨 주고, 이 앱은 자기 경로가
 * `/music` 으로 시작한다고 알고 있어야 링크·자산 주소가 맞는다.
 */
/**
 * 보안 헤더(감사 M-11). CSP 는 먼저 Report-Only 로 둔다 — 깨지는 곳이 없는지 본 뒤 강제로 올린다.
 * 서명 URL 이 쿼리에 있어 Referrer 는 같은 출처 밖으로 경로를 보내지 않는다.
 */
export const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), payment=()' },
  {
    key: 'Content-Security-Policy-Report-Only',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
      "style-src 'self' 'unsafe-inline' https:",
      "img-src 'self' data: blob: https:",
      "media-src 'self' blob: https:",
      "font-src 'self' data: https:",
      "connect-src 'self' https: wss:",
      "frame-ancestors 'self' https://cookieplay.app",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
]

const nextConfig: NextConfig = {
  basePath: '/music',
  async headers() {
    return [{ source: '/:path*', headers: SECURITY_HEADERS }]
  },
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.10.47'],
  /**
   * 서버리스 함수 번들에서 뺄 파일. Vercel 은 API 라우트를 한 함수 그룹으로 묶어서
   * 한 라우트가 끌어온 파일이 모든 함수 크기에 잡힌다(라우트당 57 MB, 배포당 수 GB).
   * - ffmpeg-static 바이너리(44 MB): 쓰던 `/api/convert-to-mp3` 라우트는 삭제됐다.
   *   패키지가 남아 있어도 함수 번들로 딸려 들어오지 않게 하는 안전망이다.
   * - sharp/libvips(15 MB): 이미지 최적화는 Vercel 플랫폼이 하므로 함수에는 불필요.
   *   Vercel 빌드는 이미 자동 제외하지만, 로컬 측정치를 배포와 맞추기 위해 명시한다.
   * 추적 전용 설정이라 로컬 `next start` 에는 영향 없다.
   */
  outputFileTracingExcludes: {
    '*': [
      'node_modules/ffmpeg-static/ffmpeg',
      'node_modules/sharp/**',
      'node_modules/@img/**',
    ],
  },
};

export default nextConfig;
