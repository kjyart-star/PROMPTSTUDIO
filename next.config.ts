import type { NextConfig } from "next";

/**
 * 쿠키뮤직은 쿠키플레이 안의 `/music` 구역으로 들어간다(Vercel 멀티존).
 * 허브(cookieplay.app)가 `/music/:path*` 를 이 배포로 넘겨 주고, 이 앱은 자기 경로가
 * `/music` 으로 시작한다고 알고 있어야 링크·자산 주소가 맞는다.
 */
const nextConfig: NextConfig = {
  basePath: '/music',
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
