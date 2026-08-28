import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    const body = await request.json()
    const { 
      theme, 
      genre = 'Pop', 
      mood = '감성적인 (Emotional)', 
      language = '한국어', 
      structure = 'Standard (Verse-Chorus-Bridge)',
      model = 'gpt-4o-mini' 
    } = body

    if (!theme || typeof theme !== 'string') {
      return NextResponse.json({ error: '주제 또는 스토리를 입력해주세요.' }, { status: 400 })
    }

    const apiKey = (process.env.VITE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim()
    if (!apiKey) {
      // Fallback generator when OpenAI API key is unavailable (demo/mock with high quality)
      return NextResponse.json({
        versionA: {
          title: `${theme.slice(0, 15)} (Direct & Catchy Hook)`,
          stylePrompt: `${genre}, catchy hook, modern production, driving beat, clear emotional vocal, ${mood.toLowerCase()}, 120 bpm`,
          lyrics: `[Intro | dreamy synth pad & soft guitar]\n(Yeah, let the story begin)\n\n[Verse 1]\n${theme} 속에서 피어나는 이야기\n거리 위로 번져가는 네온 불빛 따라\n우리가 함께했던 그 계절의 온도가\n아직도 내 맘에 선명히 남아있어\n\n[Pre-Chorus | building drums & bass]\n점점 더 가까워지는 시간\n망설이지 말고 내 손을 잡아\n이 밤이 지나가기 전에\n\n[Chorus | energetic & powerful hook]\n우리의 노래가 하늘에 닿을 때까지\n다시 한번 외쳐보는 소중한 그 이름\n어떤 어둠도 우릴 막을 수 없어\n영원히 빛날 우리의 찬란한 순간\n\n[Verse 2]\n조금 서툴러도 괜찮아\n함께 걷는 이 길이 아름다우니까\n바람에 실려 온 멜로디 속에\n너와 나의 꿈이 담겨 있어\n\n[Bridge | atmospheric breakdown]\n아무 말 없이 서로를 바라보던 그 눈빛\n그것만으로도 난 충분했어\n\n[Chorus | all instruments climax]\n우리의 노래가 하늘에 닿을 때까지\n다시 한번 외쳐보는 소중한 그 이름\n어떤 어둠도 우릴 막을 수 없어\n영원히 빛날 우리의 찬란한 순간\n\n[Outro | fading synth & lead guitar]\nForever with you... Under the starlight... (Fade out)`
        },
        versionB: {
          title: `${theme.slice(0, 15)} (Poetic & Atmospheric)`,
          stylePrompt: `atmospheric ${genre}, deep reverb, poetic storytelling, warm analog synth, intimate vocal texture, ${mood.toLowerCase()}, emotional crescendo, 90 bpm`,
          lyrics: `[Intro | rainy ambient sound & slow piano chords]\n\n[Verse 1 | whisper-soft intimate vocal]\n새벽 세 시의 침묵 사이로\n흘러내리는 ${theme}의 잔상들\n닿지 못한 말들이 공기 중에 부유하고\n창가에 맺힌 빗방울처럼 번져가\n\n[Verse 2]\n기억의 책장을 한 장씩 넘길 때마다\n바래진 색채 속 네가 서 있어\n잡으려 하면 흩어지는 안개처럼\n넌 그렇게 아득한 향기로 남아\n\n[Chorus | emotional swell & cinematic strings]\n마음 깊은 곳에 묻어둔 비밀의 숲\n그곳에서 넌 영원히 숨 쉬고 있어\n시간이 흘러 모든 게 지워진대도\n이 아련한 울림은 멈추지 않아\n\n[Bridge | cello solo & layered vocal harmonies]\n계절이 몇 번을 바뀌어도\n내 안에 남겨진 너의 온기\n\n[Chorus | intense crescendo]\n마음 깊은 곳에 묻어둔 비밀의 숲\n그곳에서 넌 영원히 숨 쉬고 있어\n시간이 흘러 모든 게 지워진대도\n이 아련한 울림은 멈추지 않아\n\n[Outro | lone piano note fading away]\n기억의 끝자락에서... 안녕...`
        }
      })
    }

    const systemPrompt = `You are a world-class professional songwriter and lyricist specializing in Suno AI / Udio music generation lyrics.
The user will provide a theme/story/hook, genre, mood, and language.
You MUST generate EXACTLY TWO distinctly different, complete, high-quality lyric versions in JSON format:

1. Version A: Mainstream, direct, energetic, with a very catchy and memorable hook/chorus.
2. Version B: Deep, poetic, emotional, metaphorical, with rich atmospheric imagery.

Both versions MUST use proper Suno/Udio section tags like [Intro | instrument/mood], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro].
Include a tailored English style prompt for Suno AI for each version.

Respond ONLY with valid JSON matching this schema:
{
  "versionA": {
    "title": "Song Title for Version A",
    "stylePrompt": "English Suno style prompt, tags, instruments, BPM",
    "lyrics": "Full structured lyrics with section tags"
  },
  "versionB": {
    "title": "Song Title for Version B",
    "stylePrompt": "English Suno style prompt, tags, instruments, BPM",
    "lyrics": "Full structured lyrics with section tags"
  }
}`

    const userContent = `Theme/Story/Hook: ${theme}
Genre: ${genre}
Mood: ${mood}
Language: ${language}
Structure: ${structure}`

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userContent }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.9,
      }),
    })

    const data = await response.json()
    if (!response.ok) {
      console.error('OpenAI Lyrics API error:', data)
      return NextResponse.json({ error: data?.error?.message || '가사 생성에 실패했습니다.' }, { status: 500 })
    }

    const parsed = JSON.parse(data.choices?.[0]?.message?.content || '{}')
    return NextResponse.json(parsed)
  } catch (err: any) {
    console.error('API POST generate-lyrics error:', err)
    return NextResponse.json({ error: '가사 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
