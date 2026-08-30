import type { Metadata } from 'next'
import { SuiteBar } from '@/components/layout/SuiteBar'
import { PersistentPlayer } from '@/components/player/PersistentPlayer'

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
      {/* 하단 재생 바 — 쿠키뮤직 스트리밍과 같은 플레이어를 그대로 쓴다.
          playerStore 는 모듈 싱글턴이라 스튜디오의 재생 버튼이 이미 이 스토어를 물고 있었고,
          여기서 오디오 엘리먼트를 붙여줘야 실제로 소리가 난다. */}
      <PersistentPlayer />
      {/* NowPlayingPanel(가사·대기열 우측 패널)은 스트리밍 전용 UI다 — 스튜디오에는
          안 나와야 한다는 지적(대표, 2026-08-30)으로 여기서 뺐다. 오디오 재생 자체는
          위 PersistentPlayer 가 담당하므로 소리에는 영향 없다. */}
    </div>
  )
}
