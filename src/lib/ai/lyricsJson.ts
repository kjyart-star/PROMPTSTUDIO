/**
 * 가사 응답에서 JSON 을 건져낸다.
 *
 * ## 왜 따로 있나
 * 2026-09-07 에 가사 생성이 게이트웨이로 옮겨 가면서 `response_format: { type: 'json_object' }`
 * 를 잃었다 — Replicate 의 `openai/gpt-5-nano` 입력 스키마에 그 칸이 없다. 형식 보증이
 * **규격에서 지시문으로** 내려앉았고, 그 자리를 이 함수가 받친다.
 *
 * 규격이 아니라 코드가 형식을 지키는 자리라서 **혼자 돌려볼 수 있게** 라우트 밖에 둔다.
 * Next·Supabase 를 하나도 부르지 않는 순수 함수다(`npm run check:lyrics-json`).
 *
 * ## 어디까지 고치나
 * 코드펜스(```json … ```)와 앞뒤 머리말 — 가장 흔한 두 가지만 벗긴다.
 * 그 밖의 손상(따옴표 깨짐, 잘린 문자열)은 **고치려 들지 않는다.** 반쯤 고친 가사를
 * 사용자에게 보여 주는 것보다 다시 만드는 편이 낫다 — 부르는 쪽이 재시도한다.
 */

export interface LyricVersion {
  title: string
  stylePrompt: string
  lyrics: string
}

export interface LyricsPair {
  versionA: LyricVersion
  versionB: LyricVersion
}

/** 셋 다 있어야 화면이 카드를 그린다. 하나라도 비면 실패로 본다. */
function readVersion(v: unknown): LyricVersion | null {
  if (!v || typeof v !== 'object') return null
  const row = v as Record<string, unknown>
  const title = typeof row.title === 'string' ? row.title.trim() : ''
  const stylePrompt = typeof row.stylePrompt === 'string' ? row.stylePrompt.trim() : ''
  const lyrics = typeof row.lyrics === 'string' ? row.lyrics.trim() : ''
  if (!title || !stylePrompt || !lyrics) return null
  return { title, stylePrompt, lyrics }
}

/** 못 읽으면 null. 예외를 던지지 않는다 — 부르는 쪽이 재시도·환불을 정한다. */
export function parseLyrics(raw: string): LyricsPair | null {
  if (typeof raw !== 'string') return null
  const unfenced = raw.replace(/```(?:json)?/gi, '').trim()
  const start = unfenced.indexOf('{')
  const end = unfenced.lastIndexOf('}')
  if (start < 0 || end <= start) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(unfenced.slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null

  const versionA = readVersion((parsed as Record<string, unknown>).versionA)
  const versionB = readVersion((parsed as Record<string, unknown>).versionB)
  if (!versionA || !versionB) return null
  return { versionA, versionB }
}
