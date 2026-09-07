import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireAiAccess } from '@/lib/auth/aiGate'
import { refundCredits } from '@/lib/credits/suite'
import { generateSuiteText, suiteTextErrorResponse } from '@/lib/ai/suiteText'
import { parseLyrics } from '@/lib/ai/lyricsJson'

/**
 * 가사 생성(Version A · B). **OpenAI 를 직접 부르지 않는다** (2026-09-07 이전).
 *
 * ## 옮기면서 하나가 사라졌다 — `response_format: { type: 'json_object' }`
 * 예전에는 그 칸으로 JSON 을 **강제**했다. 게이트웨이가 지나는 Replicate 의
 * `openai/gpt-5-nano` 입력 스키마에는 그 칸이 없다(prompt · system_prompt · messages ·
 * image_input · reasoning_effort · verbosity · max_completion_tokens 가 전부다).
 * 그래서 형식 보증이 **규격에서 지시문으로 내려앉았고**, 내려앉은 만큼을 코드로 받친다:
 *
 *   ① 지시문이 JSON 만 내놓으라고 못 박는다(코드펜스·머리말 금지까지 적는다)
 *   ② 그래도 감싸서 오는 경우가 있으므로 펜스를 벗기고 첫 `{` ~ 마지막 `}` 만 읽는다
 *   ③ 그래도 안 되면 **더 짧게, 형식만** 다시 시키는 재시도 1회
 *   ④ 그래도 실패하면 한국어 실패 문구 + 크레딧 환불 (사용자 잘못이 아니다)
 *
 * 재시도는 멱등키가 달라야 한다 — 같은 키로 부르면 워커가 「이미 처리한 요청」으로 보고
 * **방금 그 깨진 답**을 그대로 돌려준다. 키가 다르면 차감도 한 번 더 일어나므로,
 * 재시도가 성공하면 **첫 번째 차감을 돌려준다**(결과는 하나인데 두 번 받을 수 없다).
 */

/** 재시도까지 실패했을 때 사용자가 읽는 말. 원인은 형식이지만 사용자가 할 일은 하나다. */
const FORMAT_FAILED = '가사를 만들었지만 형식이 어긋나 읽지 못했습니다. 잠시 후 다시 시도해 주세요.'

export async function POST(request: Request) {
  try {
    // [임시 게이트] 해제 방법은 src/lib/auth/aiGate.ts 참고
    const gate = await requireAiAccess('generate-lyrics')
    if (!gate.ok) return gate.response

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()
    const {
      theme,
      genre = 'Pop',
      mood = '감성적인 (Emotional)',
      language = '한국어',
      structure = 'Standard (Verse-Chorus-Bridge)',
      guideText = ''
    } = body

    // 지침서는 길이만 자른다 — 길다고 가사 생성을 거절하지는 않는다.
    const guides = typeof guideText === 'string' ? guideText.slice(0, 8000) : ''

    if (!theme || typeof theme !== 'string') {
      return NextResponse.json({ error: '주제 또는 스토리를 입력해주세요.' }, { status: 400 })
    }

    const systemPrompt = `You are a world-class professional songwriter and lyricist specializing in Suno AI / Udio music generation lyrics.
The user will provide a theme/story/hook, genre, mood, and language.
You MUST generate EXACTLY TWO distinctly different, complete, high-quality lyric versions in JSON format:

1. Version A: Mainstream, direct, energetic, with a very catchy and memorable hook/chorus.
2. Version B: Deep, poetic, emotional, metaphorical, with rich atmospheric imagery.

Both versions MUST use proper Suno/Udio section tags like [Intro | instrument/mood], [Verse 1], [Pre-Chorus], [Chorus], [Verse 2], [Bridge], [Outro].
Include a tailored English style prompt for Suno AI for each version.

OUTPUT FORMAT — this is not optional:
- Reply with a single JSON object and NOTHING else.
- No markdown code fences, no \`\`\`json, no explanation before or after.
- The first character of your reply MUST be { and the last MUST be }.
- Inside "lyrics", write line breaks as the two characters \\n (a valid JSON string escape).
- All four string fields below are required and none may be empty.

Schema:
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
}${guides ? `

아래 내용은 설정된 지침서 규정입니다. 가사·스타일 프롬프트 생성 시 어떠한 예외도 없이 최우선으로 준수하십시오:
---
${guides}` : ''}`

    const userContent = `Theme/Story/Hook: ${theme}
Genre: ${genre}
Mood: ${mood}
Language: ${language}
Structure: ${structure}`

    /* 재시도용 지시문. 지침서를 다시 싣지 않는다 — 첫 시도가 형식에서 넘어졌으므로
       모델에게 남은 일은 「같은 내용을 형식에 맞춰 다시 쓰는 것」 하나다. 짧을수록
       형식을 지킬 여유가 커지고, 출력 상한(4,000 토큰)도 덜 잡아먹는다. */
    const retrySystemPrompt = `${systemPrompt}

REMINDER: your previous reply could not be parsed as JSON. Output ONLY the raw JSON object. Start with { and end with }. Do not wrap it in code fences.`

    const requestId = crypto.randomUUID()
    // 가사는 화면에 모델 선택이 없다 — 예전 코드도 gpt-4o-mini 고정이었다. 등급도 그대로 둔다.
    const choice = 'gpt-4o-mini'

    const first = await generateSuiteText({
      choice,
      system: systemPrompt,
      user: userContent,
      idempotencyKey: `lyrics:${user.id}:${requestId}`,
    })
    if (!first.ok) return suiteTextErrorResponse(first)

    const parsedFirst = parseLyrics(first.text)
    if (parsedFirst) return NextResponse.json(parsedFirst)

    // ── 형식이 어긋났다. 딱 한 번 다시 시킨다(멱등키가 달라야 새로 만든다). ──
    console.warn('[lyrics] JSON 파싱 실패 — 재시도')
    const second = await generateSuiteText({
      choice,
      system: retrySystemPrompt,
      user: userContent,
      idempotencyKey: `lyrics:${user.id}:${requestId}:retry`,
    })

    if (second.ok) {
      const parsedSecond = parseLyrics(second.text)
      if (parsedSecond) {
        // 결과는 하나인데 차감은 둘이다 — 못 쓴 첫 판을 돌려준다.
        if (first.ledgerId) await refundCredits(first.ledgerId, '가사 형식 오류로 재생성')
        return NextResponse.json(parsedSecond)
      }
      console.warn('[lyrics] 재시도도 JSON 파싱 실패')
    }

    /* 두 번 다 못 읽었다. 사용자가 잘못한 것이 없으므로 차감을 전부 되돌린다
       (둘째 판이 공급자 단계에서 실패했다면 그건 워커가 이미 돌려줬다). */
    if (first.ledgerId) await refundCredits(first.ledgerId, '가사 형식 오류')
    if (second.ok && second.ledgerId) await refundCredits(second.ledgerId, '가사 형식 오류')

    return NextResponse.json({ error: FORMAT_FAILED }, { status: 502 })
  } catch (err: any) {
    console.error('API POST generate-lyrics error:', err)
    return NextResponse.json({ error: '가사 생성 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
