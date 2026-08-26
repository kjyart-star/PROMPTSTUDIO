import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// 쿠키플레이(https://cookieplay.app)의 음악 서비스. 공유 카드에 뜨는 값이 여기서 나온다.
const DESCRIPTION =
  "AI로 만든 음원을 듣고, 차트에서 순위를 보고, 내 채널에 올립니다. 쿠키플레이의 음악 서비스입니다."

export const metadata: Metadata = {
  title: "쿠키뮤직 — AI 음원 차트",
  description: DESCRIPTION,
  applicationName: "쿠키뮤직",
  openGraph: {
    type: "website",
    siteName: "쿠키뮤직",
    locale: "ko_KR",
    title: "쿠키뮤직 — AI 음원 차트",
    description: DESCRIPTION,
  },
  twitter: {
    // 전용 공유 이미지가 아직 없어서 카드 종류는 summary 로 둔다 — 없는 걸 있는 척하지 않는다
    card: "summary",
    title: "쿠키뮤직 — AI 음원 차트",
    description: DESCRIPTION,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
