'use client'

import { useState } from 'react'
import { Sparkles, Wand2, Copy, Check, Music, Disc, ArrowRight, RefreshCw, FileText, Lightbulb, Layers } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface LyricsClientProps {
  user: any
  onSendToGenerate?: (data: { prompt: string; style: string; title: string }) => void
}

const INSPIRATION_CHIPS = [
  { label: '🌃 여름밤 네온 시티 드라이브', theme: '비 내린 후 젖은 네온사인 거리를 드라이브하며 잊혀진 사랑을 떠올리는 감성적인 K-시티팝', genre: 'City Pop', mood: '감성적인 (Emotional)' },
  { label: '🌧️ 비 내리는 날의 덤덤한 이별', theme: '우산 속에서 빗소리를 들으며 서로의 안녕을 빌어주는 담담하지만 애절한 어쿠스틱 발라드', genre: 'Ballad', mood: '우울하고 쓸쓸한 (Melancholic)' },
  { label: '🔥 한계를 뛰어넘는 파워 록 앤섬', theme: '세상의 시선과 실패에 굴하지 않고 다시 일어서는 청춘의 폭발적인 에너지와 질주감', genre: 'Rock / Metal', mood: '신나고 에너제틱한 (Energetic)' },
  { label: '✨ 설레는 첫사랑 K-POP', theme: '너와 눈이 마주친 순간 터지는 스파크, 톡톡 튀는 탄산음료처럼 달콤하고 청량한 고백', genre: 'K-Pop', mood: '달콤하고 로맨틱한 (Sweet & Romantic)' },
  { label: '☕ 새벽 2시의 몽환적인 R&B', theme: '새벽 침실의 은은한 무드등 아래, 깊은 생각에 잠겨 상대방의 온기를 그리워하는 그루브', genre: 'R&B / Soul', mood: '몽환적이고 신비로운 (Dreamy)' },
  { label: '⚡ 폭발적인 페스티벌 EDM 훅', theme: '오늘 밤 모든 고민을 던져버리고 음악에 몸을 맡겨 끝없이 뛰어노는 클럽 페스티벌 사운드', genre: 'EDM / Dance', mood: '신나고 에너제틱한 (Energetic)' }
]

export function LyricsClient({ user, onSendToGenerate }: LyricsClientProps) {
  const router = useRouter()

  const [theme, setTheme] = useState('')
  const [genre, setGenre] = useState('K-Pop')
  const [mood, setMood] = useState('감성적인 (Emotional)')
  const [language, setLanguage] = useState('한국어 + 영어 혼합 (K-Pop Style)')
  const [isGenerating, setIsGenerating] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [resultA, setResultA] = useState<{ title: string; stylePrompt: string; lyrics: string } | null>(null)
  const [resultB, setResultB] = useState<{ title: string; stylePrompt: string; lyrics: string } | null>(null)

  const handleCopy = (text: string, key: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
  }

  const handleGenerate = async () => {
    if (!theme.trim()) {
      alert('곡의 주제나 스토리, 훅을 입력해주세요!')
      return
    }

    setIsGenerating(true)
    try {
      const res = await fetch('/api/generate-lyrics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ theme, genre, mood, language })
      })

      const data = await res.json()
      if (res.ok && data.versionA && data.versionB) {
        setResultA(data.versionA)
        setResultB(data.versionB)
      } else {
        alert(data.error || '가사 생성에 실패했습니다.')
      }
    } catch (err) {
      console.error(err)
      alert('네트워크 오류로 가사를 생성하지 못했습니다.')
    } finally {
      setIsGenerating(false)
    }
  }

  const loadSample = () => {
    setTheme('네온 사인이 번지는 밤거리, 잊고 있던 옛 연인과의 추억을 회상하며 그루비하게 달리는 K-시티팝')
    setGenre('City Pop')
    setMood('감성적인 (Emotional)')
    setLanguage('한국어 + 영어 혼합 (K-Pop Style)')

    setResultA({
      title: 'Neon Midnight Drive (네온 미드나잇)',
      stylePrompt: 'Korean city pop, 80s analog synth, groovy slap bass, bright female vocal, brass stabs, driving drum beat, 120 bpm',
      lyrics: `[Intro | dreamy synth pad & slap bass]\n(Under the neon lights... Yeah...)\n\n[Verse 1]\n비 내린 아스팔트 위로 번지는 네온 사인\n라디오에선 익숙한 시티팝 멜로디라인\n차창을 스치는 서늘한 밤바람 속에\n문득 스쳐 지나가는 너의 미소\n\n[Pre-Chorus | building drums & synth brass]\n시간은 빠르게 흘러갔지만\n여전히 내 맘은 그 자리에 있어\n더 늦기 전에 너에게 전하고 싶어\n\n[Chorus | energetic & catchy hook]\nNeon Midnight Drive, 이 밤을 달려봐\n흘러가는 음악 속에 우리 둘의 기억을 담아\n도심의 불빛이 하나둘 꺼져가도\n너와 나의 멜로디는 멈추지 않아 (Never stop!)\n\n[Verse 2]\n핸들을 잡은 손끝에 전해지는 리듬\n너와 함께 걷던 그 골목길을 지나\n거울 속에 비친 내 눈빛은\n다시 널 향해 달려가고 있어\n\n[Bridge | atmospheric guitar solo & vocal echo]\n(Can we turn back time?)\n단 한 번만이라도 다시 널 볼 수 있다면\n\n[Chorus | powerful climax with brass]\nNeon Midnight Drive, 이 밤을 달려봐\n흘러가는 음악 속에 우리 둘의 기억을 담아\n도심의 불빛이 하나둘 꺼져가도\n너와 나의 멜로디는 멈추지 않아\n\n[Outro | fading synth groove]\nDrive all night... with you... (Fade out)`
    })

    setResultB({
      title: 'Midnight Reverie (자정의 몽상)',
      stylePrompt: 'atmospheric city pop, lush synth textures, deep reverb, melancholic saxophone solo, intimate breathy vocal, 95 bpm',
      lyrics: `[Intro | rain sound effect & warm electric piano]\n\n[Verse 1 | whispery intimate vocal]\n자정이 지난 도시의 침묵\n유리창에 맺힌 눈물 같은 빗방울\n핸드폰 속 지우지 못한 너의 사진\n흐릿해진 기억의 조각들을 맞춰가\n\n[Verse 2]\n가로등 불빛이 길게 드리운 그림자\n혼자 남겨진 차 안에는 차가운 공기뿐\n라디오의 잡음마저 너의 목소리 같아\n난 또 어디로 향하는 걸까\n\n[Chorus | emotional swell & cinematic synth strings]\n새벽의 끝에서 널 부르면\n바람을 타고 내게 돌아와 줄까\n잊으려 할수록 더욱 선명해지는\n가장 찬란했던 우리 둘의 계절\n\n[Bridge | soulful saxophone solo]\n(Woo... 아직 널 보내지 못했어...)\n\n[Chorus | intense emotional crescendo]\n새벽의 끝에서 널 부르면\n바람을 타고 내게 돌아와 줄까\n잊으려 할수록 더욱 선명해지는\n가장 찬란했던 우리 둘의 계절\n\n[Outro | lone piano fading away]\nGoodnight, my love... 안녕...`
    })
  }

  const sendToGenerate = (version: { title: string; stylePrompt: string; lyrics: string }) => {
    if (onSendToGenerate) {
      onSendToGenerate({
        prompt: version.lyrics,
        style: version.stylePrompt,
        title: version.title
      })
    } else {
      router.push(`/studio?tab=suno`)
    }
  }

  return (
    <div className="w-full pb-12 space-y-6">
      {/* 🚀 Top Lyrical Assistant Hero Banner (musicmake.ai 스타일) */}
      <div className="relative overflow-hidden rounded-3xl bg-[#121612] border border-[#1e261f] p-6 lg:p-8 shadow-2xl">
        <div className="relative z-10 space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#e6ff00]/10 border border-[#e6ff00]/30 text-[#e6ff00] text-xs font-black tracking-wider uppercase">
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Dual Lyrics Engine (musicmake.ai style)</span>
          </div>
          <h1 className="text-2xl lg:text-3xl font-black tracking-tight text-white flex items-center gap-2.5">
            <span>AI 가사 생성기</span>
            <span className="text-[#e6ff00] drop-shadow-[0_0_15px_rgba(230,255,0,0.3)]">(Dual Version A & B)</span>
          </h1>
          <p className="text-xs lg:text-sm text-zinc-400 font-medium max-w-3xl leading-relaxed">
            단 하나의 테마, 스토리, 훅(Hook)으로부터 <strong className="text-zinc-200">대중적 훅 중심의 Version A</strong>와 <strong className="text-zinc-200">감성적 은유 중심의 Version B</strong>를 동시에 생성하여 가장 완벽한 가사를 선택할 수 있습니다.
          </p>
        </div>
      </div>

      {/* 🎯 Main Input Card */}
      <div className="bg-[#121612] p-6 rounded-2xl border border-[#1e261f] shadow-xl space-y-5">
        <div className="flex justify-between items-center border-b border-[#1e261f] pb-3">
          <h2 className="text-sm font-bold text-zinc-200 flex items-center gap-2">
            <Lightbulb className="w-4 h-4 text-[#e6ff00]" />
            <span>곡의 주제 및 스토리 아이디어 (Theme & Story Hook)</span>
          </h2>
          <span className="text-xs text-zinc-500 font-mono">{theme.length} / 300</span>
        </div>

        {/* Quick Inspiration Chips */}
        <div className="space-y-2">
          <label className="text-[11px] font-bold text-zinc-400">💡 빠른 영감 프리셋 (클릭 시 자동 적용)</label>
          <div className="flex flex-wrap gap-2">
            {INSPIRATION_CHIPS.map((chip, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTheme(chip.theme)
                  setGenre(chip.genre)
                  setMood(chip.mood)
                }}
                className="px-3 py-1.5 rounded-xl bg-[#090d0a] hover:bg-[#162017] border border-[#1a231b] hover:border-[#e6ff00]/40 text-zinc-300 hover:text-[#e6ff00] text-xs font-semibold transition-all cursor-pointer shadow-sm"
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* Textarea Input */}
        <div className="space-y-1">
          <textarea
            rows={4}
            value={theme}
            maxLength={300}
            onChange={(e) => setTheme(e.target.value)}
            placeholder="어떤 노래를 만들고 싶으신가요? 상황, 감정, 스토리, 핵심 메시지, 또는 떠오르는 가사 한 줄을 자유롭게 적어주세요. (예: 비 내리는 여름밤, 이별 후 오랜만에 우연히 마주친 옛 연인과의 짧은 대화)"
            className="w-full bg-[#090d0a] border border-[#1a231b] rounded-2xl p-4 text-xs lg:text-sm text-zinc-200 placeholder-zinc-600 focus:outline-none focus:border-[#e6ff00]/60 resize-none custom-scrollbar leading-relaxed"
          />
        </div>

        {/* Settings Selectors Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* Genre */}
          <div className="space-y-1.5 bg-[#090d0a] p-3.5 rounded-xl border border-[#1a231b]">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">장르 (Genre)</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="K-Pop" className="bg-[#121612]">K-Pop (케이팝)</option>
              <option value="City Pop" className="bg-[#121612]">City Pop (시티팝)</option>
              <option value="Ballad" className="bg-[#121612]">Ballad (발라드)</option>
              <option value="R&B / Soul" className="bg-[#121612]">R&B / Soul (알앤비/소울)</option>
              <option value="Rock / Metal" className="bg-[#121612]">Rock / Metal (록/메탈)</option>
              <option value="Hip-Hop / Rap" className="bg-[#121612]">Hip-Hop / Rap (힙합/랩)</option>
              <option value="EDM / Dance" className="bg-[#121612]">EDM / Dance (댄스/일렉트로닉)</option>
              <option value="Acoustic / Indie" className="bg-[#121612]">Acoustic / Indie (어쿠스틱/인디)</option>
              <option value="Jazz / Lo-Fi" className="bg-[#121612]">Jazz / Lo-Fi (재즈/로파이)</option>
            </select>
          </div>

          {/* Mood */}
          <div className="space-y-1.5 bg-[#090d0a] p-3.5 rounded-xl border border-[#1a231b]">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">감정/분위기 (Mood)</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="감성적인 (Emotional)" className="bg-[#121612]">감성적인 (Emotional)</option>
              <option value="신나고 에너제틱한 (Energetic)" className="bg-[#121612]">신나고 에너제틱한 (Energetic)</option>
              <option value="달콤하고 로맨틱한 (Sweet & Romantic)" className="bg-[#121612]">달콤하고 로맨틱한 (Romantic)</option>
              <option value="몽환적이고 신비로운 (Dreamy)" className="bg-[#121612]">몽환적이고 신비로운 (Dreamy)</option>
              <option value="우울하고 쓸쓸한 (Melancholic)" className="bg-[#121612]">우울하고 쓸쓸한 (Melancholic)</option>
              <option value="다크하고 강렬한 (Dark & Intense)" className="bg-[#121612]">다크하고 강렬한 (Dark & Intense)</option>
            </select>
          </div>

          {/* Language */}
          <div className="space-y-1.5 bg-[#090d0a] p-3.5 rounded-xl border border-[#1a231b]">
            <label className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">가사 언어 (Language)</label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="w-full bg-transparent text-xs font-bold text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="한국어 + 영어 혼합 (K-Pop Style)" className="bg-[#121612]">한국어 + 영어 혼합 (K-Pop Style)</option>
              <option value="한국어 (Korean Only)" className="bg-[#121612]">한국어 전용 (Korean Only)</option>
              <option value="영어 (English Only)" className="bg-[#121612]">영어 전용 (English Only)</option>
              <option value="일본어 (Japanese)" className="bg-[#121612]">일본어 (Japanese)</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-[#1e261f]">
          <button
            type="button"
            onClick={loadSample}
            className="px-4 py-3 bg-[#161c16] hover:bg-[#1f271f] border border-[#232d24] rounded-xl text-xs font-bold text-zinc-300 transition-colors cursor-pointer"
          >
            샘플 불러오기
          </button>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={isGenerating}
            className="px-7 py-3 bg-[#e6ff00] hover:bg-[#d4f900] active:scale-[0.99] text-black text-xs font-black uppercase tracking-wider rounded-xl shadow-lg shadow-yellow-950/40 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 fill-current text-black" />
            <span>{isGenerating ? 'AI 듀얼 가사 작성 중...' : '✨ 듀얼 가사 생성하기 (Version A & B)'}</span>
          </button>
        </div>
      </div>

      {/* 🎭 Dual Outputs (Version A vs Version B) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Version A */}
        <div className="bg-[#121612] border border-[#1e261f] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1e261f] pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-[#e6ff00]/10 border border-[#e6ff00]/30 text-[#e6ff00] text-xs font-black">
                  Version A
                </span>
                <span className="text-xs text-zinc-400 font-semibold">• 대중적 & 캐치한 훅 (Direct & Catchy)</span>
              </div>

              {resultA && (
                <button
                  type="button"
                  onClick={() => handleCopy(resultA.lyrics, 'lyricsA')}
                  className="px-2.5 py-1 rounded-lg bg-[#090d0a] hover:bg-[#162017] border border-[#1a231b] text-zinc-300 hover:text-[#e6ff00] text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedKey === 'lyricsA' ? <Check className="w-3.5 h-3.5 text-[#e6ff00]" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'lyricsA' ? '복사됨!' : '가사 복사'}</span>
                </button>
              )}
            </div>

            {resultA ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Title & Style */}
                <div className="bg-[#090d0a] p-3 rounded-xl border border-[#1a231b] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400">곡 제목</span>
                    <span className="text-xs font-black text-[#e6ff00]">{resultA.title}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1a231b] pt-1.5">
                    <span className="text-[10px] font-bold text-zinc-400">Suno 스타일 태그</span>
                    <span className="text-[11px] font-mono text-zinc-300 truncate max-w-xs">{resultA.stylePrompt}</span>
                  </div>
                </div>

                {/* Lyrics Area */}
                <textarea
                  rows={14}
                  value={resultA.lyrics}
                  onChange={(e) => setResultA({ ...resultA, lyrics: e.target.value })}
                  className="w-full flex-1 bg-[#090d0a] border border-[#1a231b] rounded-xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-[#e6ff00]/60 resize-none custom-scrollbar leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-600 min-h-[300px]">
                <FileText className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-xs">상단에서 주제를 입력하고 생성 버튼을 누르면<br/>대중적 훅 중심의 Version A 가사가 생성됩니다.</p>
              </div>
            )}
          </div>

          {resultA && (
            <div className="pt-2 border-t border-[#1e261f] flex gap-2">
              <button
                type="button"
                onClick={() => sendToGenerate(resultA)}
                className="w-full py-3 bg-[#e6ff00] hover:bg-[#d4f900] active:scale-[0.99] text-black rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-yellow-950/30"
              >
                <Music className="w-4 h-4 fill-current text-black" />
                <span>Version A로 음악 생성하기 ↗</span>
              </button>
            </div>
          )}
        </div>

        {/* Version B */}
        <div className="bg-[#121612] border border-[#1e261f] rounded-2xl p-6 shadow-xl flex flex-col justify-between space-y-4">
          <div className="space-y-4 flex-1 flex flex-col">
            <div className="flex items-center justify-between border-b border-[#1e261f] pb-3">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-black">
                  Version B
                </span>
                <span className="text-xs text-zinc-400 font-semibold">• 시적 은유 & 감성 전개 (Poetic & Atmospheric)</span>
              </div>

              {resultB && (
                <button
                  type="button"
                  onClick={() => handleCopy(resultB.lyrics, 'lyricsB')}
                  className="px-2.5 py-1 rounded-lg bg-[#090d0a] hover:bg-[#162017] border border-[#1a231b] text-zinc-300 hover:text-purple-300 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                >
                  {copiedKey === 'lyricsB' ? <Check className="w-3.5 h-3.5 text-purple-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'lyricsB' ? '복사됨!' : '가사 복사'}</span>
                </button>
              )}
            </div>

            {resultB ? (
              <div className="space-y-3 flex-1 flex flex-col">
                {/* Title & Style */}
                <div className="bg-[#090d0a] p-3 rounded-xl border border-[#1a231b] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-zinc-400">곡 제목</span>
                    <span className="text-xs font-black text-purple-300">{resultB.title}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-[#1a231b] pt-1.5">
                    <span className="text-[10px] font-bold text-zinc-400">Suno 스타일 태그</span>
                    <span className="text-[11px] font-mono text-zinc-300 truncate max-w-xs">{resultB.stylePrompt}</span>
                  </div>
                </div>

                {/* Lyrics Area */}
                <textarea
                  rows={14}
                  value={resultB.lyrics}
                  onChange={(e) => setResultB({ ...resultB, lyrics: e.target.value })}
                  className="w-full flex-1 bg-[#090d0a] border border-[#1a231b] rounded-xl p-4 text-xs font-mono text-zinc-200 focus:outline-none focus:border-purple-400/60 resize-none custom-scrollbar leading-relaxed"
                />
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-zinc-600 min-h-[300px]">
                <FileText className="w-8 h-8 mb-3 opacity-40" />
                <p className="text-xs">상단에서 주제를 입력하고 생성 버튼을 누르면<br/>시적 은유 중심의 Version B 가사가 생성됩니다.</p>
              </div>
            )}
          </div>

          {resultB && (
            <div className="pt-2 border-t border-[#1e261f] flex gap-2">
              <button
                type="button"
                onClick={() => sendToGenerate(resultB)}
                className="w-full py-3 bg-[#221730] hover:bg-[#321f48] border border-purple-500/40 text-purple-200 active:scale-[0.99] rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <Music className="w-4 h-4 text-purple-300" />
                <span>Version B로 음악 생성하기 ↗</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
