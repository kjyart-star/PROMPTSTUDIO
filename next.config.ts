import type { NextConfig } from "next";

/**
 * 쿠키뮤직은 쿠키플레이 안의 `/music` 구역으로 들어간다(Vercel 멀티존).
 * 허브(cookieplay.app)가 `/music/:path*` 를 이 배포로 넘겨 주고, 이 앱은 자기 경로가
 * `/music` 으로 시작한다고 알고 있어야 링크·자산 주소가 맞는다.
 */
const nextConfig: NextConfig = {
  basePath: '/music',
  allowedDevOrigins: ['127.0.0.1', 'localhost', '192.168.10.47'],
};

export default nextConfig;
