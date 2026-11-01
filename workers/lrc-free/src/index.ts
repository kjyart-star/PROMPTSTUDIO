/**
 * cookiemusic-lrc-free — 가사 싱크 Workers AI 무료 큐. POST /run(토큰)으로 깨운다 — GitHub Actions 10분마다 + 서버 이벤트.
 * 1) 공개 대기 24시간 지난 곡 정리(싱크 없이 공개) 2) 작업 받기(공개 대기·폰에서 만든 곡 먼저) 3) 곡마다 하루 뉴런 상한을 D1 에서 예약한 뒤
 *    whisper-large-v3-turbo 로 받아쓰기 4) 단어 시각을 서버(/music/api/lrc-free)에 보내 원문과 맞추고 검증·저장.
 * 과금 방지: 하루 9,000 뉴런(무료 10,000) 하드 상한, 예약 → 실사용 기록, 실패도 예상치로 센다, 10분 넘는 곡은 보내지 않는다.
 * 배포: npx wrangler deploy --config <절대경로>/workers/lrc-free/wrangler.toml
 */
import { DAILY_NEURON_CAP, MAX_AUDIO_SEC, dayKeyUTC, withBudget, type BudgetStore } from '../../../src/lib/lyricsSync/budget'

interface Env {
  AI: { run: (model: string, input: unknown) => Promise<any> }
  DB: D1Database
  TRACKS: R2Bucket
  SERVER_URL: string
  LRC_FREE_TOKEN: string
}

const MODEL = '@cf/openai/whisper-large-v3-turbo'
const JOBS_PER_RUN = 3
/** 이 간격 안에 다시 깨우면 건너뛴다(겹쳐 돌지 않게) */
const MIN_GAP_MS = 50_000

class D1BudgetStore implements BudgetStore {
  constructor(private db: D1Database) {}
  async reserve(day: string, est: number, cap: number) {
    await this.db.prepare('INSERT OR IGNORE INTO ai_budget (day, used, reserved) VALUES (?, 0, 0)').bind(day).run()
    // 한 문장으로 확인과 예약을 함께 한다(동시 실행에도 합이 상한을 넘지 않는다)
    const r = await this.db.prepare('UPDATE ai_budget SET reserved = reserved + ?1 WHERE day = ?2 AND used + reserved + ?1 <= ?3').bind(est, day, cap).run()
    return (r.meta?.changes ?? 0) === 1
  }
  async commit(day: string, est: number, actual: number) {
    await this.db.prepare('UPDATE ai_budget SET used = used + ?1, reserved = MAX(0, reserved - ?2) WHERE day = ?3').bind(actual, est, day).run()
  }
  async usage(day: string) {
    const r = await this.db.prepare('SELECT used, reserved FROM ai_budget WHERE day = ?').bind(day).first<{ used: number; reserved: number }>()
    return r ?? { used: 0, reserved: 0 }
  }
}

async function api(env: Env, method: string, path: string, body?: unknown) {
  const res = await fetch(env.SERVER_URL.replace(/\/+$/, '') + path, {
    method, headers: { 'x-lrc-free-token': env.LRC_FREE_TOKEN, 'Content-Type': 'application/json', 'User-Agent': 'cookiemusic-lrc-free/1' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { status: res.status, data: (await res.json().catch(() => ({}))) as any }
}

/** 음원 바이트 — 공개 CDN 주소면 R2 에서 바로, 아니면(서명 주소) 그대로 받는다 */
async function audioOf(env: Env, url: string): Promise<ArrayBuffer | null> {
  const u = new URL(url)
  if (u.hostname.startsWith('cookiemusic-cdn.')) {
    const obj = await env.TRACKS.get(decodeURIComponent(u.pathname.replace(/^\/+/, '')))
    return obj ? await obj.arrayBuffer() : null
  }
  const res = await fetch(url, { headers: { 'User-Agent': 'cookiemusic-lrc-free/1' } })
  return res.ok ? await res.arrayBuffer() : null
}

function toBase64(buf: ArrayBuffer): string {
  // nodejs_compat 의 Buffer 는 네이티브 인코딩이라 CPU 시간이 짧다
  return (globalThis as any).Buffer.from(buf).toString('base64')
}

async function runOnce(env: Env, probe?: string): Promise<Record<string, unknown>> {
  const log: Record<string, unknown> = {}
  if (!probe) log.sweep = (await api(env, 'POST', '/api/lrc-free', { action: 'sweep' })).data
  const store = new D1BudgetStore(env.DB)
  const day = dayKeyUTC()
  const before = await store.usage(day)
  if (before.used + before.reserved >= DAILY_NEURON_CAP - 50) return { ...log, stop: 'daily-cap', usage: before }
  // probe=<곡 id>: 운영 검증용 — 결과가 있는 곡도 계산만 하고 저장하지 않는다(상한은 똑같이 센다)
  const { data } = await api(env, 'GET', probe ? `/api/lrc-free?probe=${encodeURIComponent(probe)}` : `/api/lrc-free?limit=${JOBS_PER_RUN}`)
  const jobs: any[] = Array.isArray(data?.jobs) ? data.jobs : []
  const done: unknown[] = []
  for (const j of jobs) {
    const buf = await audioOf(env, String(j.audio_url))
    if (!buf) { done.push({ id: j.id, error: 'audio' }); continue }
    // 길이 상한 추정: 곡 정보 길이와 파일 크기(128kbps 가정) 중 큰 값 — 짧게 잡아 상한을 넘기지 않게
    const sec = Math.max(Number(j.duration) || 0, buf.byteLength / 16000)
    if (sec > MAX_AUDIO_SEC) { done.push({ id: j.id, skip: 'too-long' }); continue }
    const prompt = j.kind !== 'audit' ? String((j.lines as string[]).join(' ')).slice(0, 400) : undefined
    let r: { value: any; neurons: number } | null
    try {
      r = await withBudget(store, sec, async () => {
        const out = await env.AI.run(MODEL, { audio: toBase64(buf), condition_on_previous_text: false, ...(prompt ? { initial_prompt: prompt } : {}) })
        return { value: out, neurons: out?.usage?.neurons ?? null }
      })
    } catch (e) {
      done.push({ id: j.id, error: String((e as Error)?.message || e) })
      continue
    }
    if (!r) { done.push({ id: j.id, stop: 'daily-cap' }); break } // 오늘 몫을 다 씀 — 다음 날로
    const words = (r.value?.segments ?? []).flatMap((s: any) => (s.words ?? []).map((w: any) => ({ word: String(w.word ?? ''), start: Number(w.start), end: Number(w.end) })))
    const res = await api(env, 'POST', '/api/lrc-free', { song_id: j.id, kind: j.kind, words, neurons: r.neurons })
    await env.DB.prepare('INSERT INTO runs (at, song_id, kind, neurons, result) VALUES (?, ?, ?, ?, ?)')
      .bind(new Date().toISOString(), j.id, j.kind, r.neurons, JSON.stringify(res.data).slice(0, 500)).run()
    done.push({ id: j.id, kind: j.kind, neurons: r.neurons, res: res.data })
  }
  return { ...log, jobs: done, usage: await store.usage(day) }
}

/** 마지막 실행에서 MIN_GAP_MS 가 지났을 때만 이번 실행 자리를 잡는다(한 문장, 원자적) */
async function takeSlot(env: Env): Promise<boolean> {
  const now = Date.now()
  await env.DB.prepare("INSERT OR IGNORE INTO meta (k, v) VALUES ('last_run', '0')").run()
  const r = await env.DB.prepare("UPDATE meta SET v = ?1 WHERE k = 'last_run' AND CAST(v AS INTEGER) <= ?2").bind(String(now), now - MIN_GAP_MS).run()
  return (r.meta?.changes ?? 0) === 1
}

export default {
  // 깨우기: POST /run (x-lrc-free-token) — 요청이 끝날 때까지 기다리며 최대 3곡을 처리한다
  // 상태 확인만(무엇도 부르지 않는다): GET /status
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url)
    if (url.pathname === '/run' && req.method === 'POST') {
      if (!env.LRC_FREE_TOKEN || req.headers.get('x-lrc-free-token') !== env.LRC_FREE_TOKEN) return new Response('unauthorized', { status: 401 })
      if (!(await takeSlot(env))) return Response.json({ skipped: 'busy' }, { status: 202 })
      const probe = url.searchParams.get('probe') || undefined
      try { return Response.json(await runOnce(env, probe)) } catch (e) { return Response.json({ error: String((e as Error)?.message || e) }, { status: 500 }) }
    }
    if (url.pathname === '/status') {
      const day = dayKeyUTC()
      const usage = await new D1BudgetStore(env.DB).usage(day)
      return Response.json({ day, cap: DAILY_NEURON_CAP, ...usage })
    }
    return new Response('not found', { status: 404 })
  },
}
