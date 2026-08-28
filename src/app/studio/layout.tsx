import type { Metadata } from 'next'
import { SuiteBar } from '@/components/layout/SuiteBar'

export const metadata: Metadata = {
  title: '쿠키뮤직스튜디오 — All-in-One AI Music Studio',
  description: 'AI 작사, 프롬프트 엔지니어링, Suno 음원 생성, AI 커버 아트, 오디오 마스터링을 제공하는 전문 음악 제작 스튜디오',
}

export default function StudioRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="cm-studio min-h-screen bg-[#07090e] text-zinc-100 flex flex-col selection:bg-purple-500 selection:text-white">
      <SuiteBar active="studio" />
      {children}
    </div>
  )
}
