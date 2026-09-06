/**
 * Suno 를 부르는 길 — **채널 두 개, 겉모습 하나.** 서버 전용.
 *
 * 왜 둘인가(2026-09-06 대표 결정) — "API 키를 뮤직 스튜디오에 kie 도 추가하는 방법으로
 * 2채널로 진행." 재판매 채널이 하루아침에 사라진 사례가 있어서, Suno 공급 경로를
 * APIPASS 와 kie.ai 로 이중화한다. **모델은 바꾸지 않는다. Suno 그대로다.**
 *
 * 이 파일이 하는 일은 세 가지뿐이다.
 *   ① 두 공급사의 서로 다른 요청·응답을 우리 형태 하나로 맞춘다(아래 SunoTrack 등).
 *   ② 접수(createTask)가 실패하면 **다른 채널로 한 번** 넘어간다.
 *   ③ 작업 id 에 채널 접두사를 붙여(`apipass:xxx` · `kie:xxx`) 상태 조회가 제 채널로 간다.
 *      접두사가 없는 id 는 2채널 이전에 만들어진 것이라 apipass 로 본다.
 *
 * **재시도는 접수까지다.** 접수가 된 뒤 생성이 실패한 건(status fail) 다시 시도하지 않는다 —
 * 그 시점엔 공급사 크레딧이 이미 빠졌고, 우리 크레딧 환불 경로도 접수 성공을 기준으로
 * 짜여 있다. 여기서 몰래 한 번 더 만들면 돈이 두 번 나간다.
 *
 * 출처(2026-09-06 문서 확인):
 *   APIPASS  https://apipass.dev/model/suno/suno_generate · /suno_cover
 *   kie.ai   https://docs.kie.ai/suno-api/generate-music · /upload-and-cover-audio
 *            https://docs.kie.ai/suno-api/get-music-details
 */
import { providerCredential, type SunoProviderId } from '@/lib/suite/provider'
import type { SunoModelVersion } from '@/lib/suno/versions'

export type SunoChannelId = SunoProviderId
export type SunoTaskKind = 'generate' | 'cover'

/** 채널을 시도하는 순서. 앞이 실패하면 뒤로 한 번 넘어간다. */
const CHANNEL_ORDER: SunoChannelId[] = ['apipass', 'kie']

/** 접수 요청 하나가 이 시간을 넘기면 실패로 보고 다음 채널로 넘어간다. */
const CREATE_TIMEOUT_MS = 20_000
const STATUS_TIMEOUT_MS = 15_000

// ── 우리 내부 정규 형태 ──────────────────────────────────────────────────────

/** 두 채널이 똑같이 받는 입력. 화면에서 온 값은 라우트가 여기까지 다듬어서 넘긴다. */
export interface SunoCreateInput {
  modelVersion: SunoModelVersion
  prompt: string
  style: string
  title: string
  customMode: boolean
  instrumental: boolean
  vocalGender?: 'm' | 'f'
  negativeTags?: string
  styleWeight: number
  weirdnessConstraint: number
  audioWeight: number
  /** kind 가 'cover' 일 때만 쓴다. 원본 음원 주소. */
  audioUrl?: string
}

/**
 * 결과 한 곡. **필드 이름을 snake_case 로 둔 이유**는 지금 화면·라우트가
 * `audio_url` · `image_url` 을 읽고 있어서다 — 채널을 늘리려고 화면을 건드리지 않는다.
 */
export interface SunoTrack {
  audio_url: string
  image_url: string
  title?: string
  duration?: number
  [extra: string]: unknown
}

export type SunoTaskState = 'processing' | 'succeeded' | 'failed'

export type SunoCreateOutcome =
  | { ok: true; taskRef: string; channel: SunoChannelId }
  | { ok: false; message: string; attempts: SunoAttempt[] }

export type SunoStatusOutcome =
  | { ok: true; channel: SunoChannelId; state: SunoTaskState; results: SunoTrack[]; message?: string }
  | { ok: false; channel: SunoChannelId; message: string }

/** 어느 채널을 왜 못 썼는지. 로그에만 쓴다(사용자에게는 한 문장으로 말한다). */
export interface SunoAttempt {
  channel: SunoChannelId
  reason: string
}

/** 둘 다 못 쓸 때 사용자에게 보이는 문구. 내부 사정은 로그에만 남긴다. */
export const SUNO_UNAVAILABLE_MESSAGE =
  '지금은 음악을 만들 수 없습니다. 잠시 뒤 다시 시도해 주세요.'

// ── 공통 도구 ────────────────────────────────────────────────────────────────

/** 채널 호출 실패. 접수 단계에서 나면 다음 채널로 넘어가는 신호가 된다. */
class ChannelError extends Error {
  channel: SunoChannelId
  status: number
  constructor(channel: SunoChannelId, status: number, message: string) {
    super(message)
    this.channel = channel
    this.status = status
  }
}

const trimEnd = (url: string) => url.replace(/\/+$/, '')

/** 모의 서버로 갈아 끼울 수 있게 주소를 환경변수로 뺀다(검증 때 외부 호출 없이 흐름을 본다). */
const BASE_URL: Record<SunoChannelId, () => string> = {
  apipass: () => trimEnd(process.env.APIPASS_BASE_URL || 'https://api.apipass.dev/api/v1'),
  kie: () => trimEnd(process.env.KIE_BASE_URL || 'https://api.kie.ai/api/v1'),
}

/**
 * JSON 한 번 주고받기. 시간이 넘거나 본문이 JSON 이 아니면 ChannelError 다.
 * 상태 코드는 그대로 실어 보낸다 — 부르는 쪽이 인증·잔액·과부하를 구분해 로그에 남긴다.
 */
async function callChannel(
  channel: SunoChannelId,
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<{ status: number; body: any }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, cache: 'no-store' })
    let body: any = null
    try {
      body = await res.json()
    } catch {
      throw new ChannelError(channel, res.status, `응답이 JSON 이 아닙니다(status=${res.status}).`)
    }
    return { status: res.status, body }
  } catch (err) {
    if (err instanceof ChannelError) throw err
    const aborted = err instanceof Error && err.name === 'AbortError'
    throw new ChannelError(channel, 0, aborted ? '응답이 없어 시간이 초과됐습니다.' : '네트워크 실패')
  } finally {
    clearTimeout(timer)
  }
}

const authHeaders = (key: string) => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${key}`,
})

const str = (v: unknown): string => (typeof v === 'string' ? v : '')

// ── 채널 ① APIPASS ──────────────────────────────────────────────────────────

const apipassChannel = {
  async createTask(kind: SunoTaskKind, input: SunoCreateInput, key: string): Promise<string> {
    // 필드 이름·값 범위는 APIPASS 문서를 따른다. 문서에 없는 필드는 보내지 않는다.
    const payload: Record<string, unknown> = {
      model_version: input.modelVersion,
      prompt: input.prompt,
      customMode: input.customMode,
      instrumental: input.instrumental,
      style: input.style,
      title: input.title,
      styleWeight: input.styleWeight,
      weirdnessConstraint: input.weirdnessConstraint,
      audioWeight: input.audioWeight,
    }
    if (input.vocalGender) payload.vocalGender = input.vocalGender
    if (input.negativeTags) payload.negativeTags = input.negativeTags
    if (kind === 'cover') payload.audioUrl = input.audioUrl

    const { status, body } = await callChannel(
      'apipass',
      `${BASE_URL.apipass()}/jobs/createTask`,
      {
        method: 'POST',
        headers: authHeaders(key),
        body: JSON.stringify({ model: kind === 'cover' ? 'suno/cover' : 'suno/generate', input: payload }),
      },
      CREATE_TIMEOUT_MS,
    )

    const taskId = str(body?.data?.taskId)
    if (status < 400 && Number(body?.code) === 200 && taskId) return taskId
    throw new ChannelError('apipass', status, str(body?.message) || `접수 실패(status=${status})`)
  },

  async getStatus(ref: string, key: string): Promise<SunoStatusOutcome> {
    const { status, body } = await callChannel(
      'apipass',
      `${BASE_URL.apipass()}/jobs/recordInfo?taskId=${encodeURIComponent(ref)}`,
      { method: 'GET', headers: authHeaders(key) },
      STATUS_TIMEOUT_MS,
    )
    if (status >= 400 || Number(body?.code) !== 200) {
      return { ok: false, channel: 'apipass', message: str(body?.message) || `조회 실패(status=${status})` }
    }

    const state = str(body?.data?.state) // queuing · generating · success · fail
    if (state === 'success') {
      const raw = body?.data?.resultJson?.data
      const list = Array.isArray(raw) ? raw : raw ? [raw] : []
      return { ok: true, channel: 'apipass', state: 'succeeded', results: list.map(normalizeApipassTrack) }
    }
    if (state === 'fail') {
      return { ok: true, channel: 'apipass', state: 'failed', results: [], message: str(body?.data?.failMsg) }
    }
    return { ok: true, channel: 'apipass', state: 'processing', results: [], message: state }
  },
}

function normalizeApipassTrack(row: any): SunoTrack {
  return {
    ...row,
    audio_url: str(row?.audio_url) || str(row?.audioUrl),
    image_url: str(row?.image_url) || str(row?.imageUrl),
    title: str(row?.title) || undefined,
    duration: typeof row?.duration === 'number' ? row.duration : undefined,
  }
}

// ── 채널 ② kie.ai ───────────────────────────────────────────────────────────

/**
 * kie 는 본문이 평평하다(APIPASS 처럼 input 으로 한 번 더 감싸지 않는다).
 * 모델 값 표기는 두 곳이 같아서(V5_5 · V4_5PLUS …) 그대로 넘긴다.
 *
 * callBackUrl 은 문서 표에 필수로 적혀 있지만 우리는 폴링으로 결과를 가져오므로 보내지
 * 않는다. kie 가 거부하는 계정이면 KIE_CALLBACK_URL 에 주소를 넣어 두면 그대로 실린다.
 */
const kieChannel = {
  async createTask(kind: SunoTaskKind, input: SunoCreateInput, key: string): Promise<string> {
    const payload: Record<string, unknown> = {
      model: input.modelVersion,
      prompt: input.prompt,
      customMode: input.customMode,
      instrumental: input.instrumental,
      style: input.style,
      title: input.title,
      styleWeight: input.styleWeight,
      weirdnessConstraint: input.weirdnessConstraint,
      audioWeight: input.audioWeight,
    }
    if (input.vocalGender) payload.vocalGender = input.vocalGender
    if (input.negativeTags) payload.negativeTags = input.negativeTags
    if (kind === 'cover') payload.uploadUrl = input.audioUrl

    const callBackUrl = (process.env.KIE_CALLBACK_URL ?? '').trim()
    if (callBackUrl) payload.callBackUrl = callBackUrl

    const path = kind === 'cover' ? '/generate/upload-cover' : '/generate'
    const { status, body } = await callChannel(
      'kie',
      `${BASE_URL.kie()}${path}`,
      { method: 'POST', headers: authHeaders(key), body: JSON.stringify(payload) },
      CREATE_TIMEOUT_MS,
    )

    const taskId = str(body?.data?.taskId)
    if (status < 400 && Number(body?.code) === 200 && taskId) return taskId
    throw new ChannelError('kie', status, str(body?.msg) || str(body?.message) || `접수 실패(status=${status})`)
  },

  async getStatus(ref: string, key: string): Promise<SunoStatusOutcome> {
    const { status, body } = await callChannel(
      'kie',
      `${BASE_URL.kie()}/generate/record-info?taskId=${encodeURIComponent(ref)}`,
      { method: 'GET', headers: authHeaders(key) },
      STATUS_TIMEOUT_MS,
    )
    if (status >= 400 || Number(body?.code) !== 200) {
      return { ok: false, channel: 'kie', message: str(body?.msg) || str(body?.message) || `조회 실패(status=${status})` }
    }

    const data = body?.data
    const state = str(data?.status)
    if (state === 'SUCCESS') {
      const list = Array.isArray(data?.response?.sunoData) ? data.response.sunoData : []
      return { ok: true, channel: 'kie', state: 'succeeded', results: list.map(normalizeKieTrack) }
    }
    // FIRST_SUCCESS 는 두 곡 중 하나만 끝난 상태다 — 다 끝날 때까지 기다린다.
    if (state === 'PENDING' || state === 'TEXT_SUCCESS' || state === 'FIRST_SUCCESS' || !state) {
      return { ok: true, channel: 'kie', state: 'processing', results: [], message: state || undefined }
    }
    // CREATE_TASK_FAILED · GENERATE_AUDIO_FAILED · SENSITIVE_WORD_ERROR · CALLBACK_EXCEPTION
    return {
      ok: true,
      channel: 'kie',
      state: 'failed',
      results: [],
      message: str(data?.errorMessage) || state,
    }
  },
}

/** kie 문서는 record-info 에서 snake_case 로 준다. 다른 표기로 오는 계정도 있어 둘 다 본다. */
function normalizeKieTrack(row: any): SunoTrack {
  return {
    ...row,
    audio_url: str(row?.audio_url) || str(row?.audioUrl) || str(row?.source_audio_url),
    image_url: str(row?.image_url) || str(row?.imageUrl) || str(row?.source_image_url),
    title: str(row?.title) || undefined,
    duration: typeof row?.duration === 'number' ? row.duration : undefined,
  }
}

const CHANNELS: Record<SunoChannelId, typeof apipassChannel> = {
  apipass: apipassChannel,
  kie: kieChannel,
}

// ── 바깥에서 쓰는 두 함수 ────────────────────────────────────────────────────

/**
 * 작업을 접수한다. 켜져 있고 키가 있는 채널을 순서대로 하나씩 시도해서
 * **처음 성공한 곳**을 쓴다. 앞이 실패하면 뒤로 한 번 넘어간다(채널이 둘이라 재시도도 한 번).
 *
 * 돌려주는 taskRef 에는 채널 접두사가 붙는다 — 이 값을 그대로 저장해 두면
 * 나중에 상태를 물을 때 제 채널로 간다.
 */
export async function createSunoTask(
  kind: SunoTaskKind,
  input: SunoCreateInput,
): Promise<SunoCreateOutcome> {
  const attempts: SunoAttempt[] = []

  for (const channel of CHANNEL_ORDER) {
    const cred = await providerCredential(channel)
    if (!cred.key) {
      attempts.push({ channel, reason: '키 없음' })
      continue
    }
    if (!cred.enabled) {
      attempts.push({ channel, reason: '사용 꺼짐' })
      continue
    }
    try {
      const ref = await CHANNELS[channel].createTask(kind, input, cred.key)
      if (attempts.length > 0) {
        console.warn(`[suno] ${channel} 로 넘어가 접수했습니다. 앞선 시도: ${describe(attempts)}`)
      }
      return { ok: true, taskRef: `${channel}:${ref}`, channel }
    } catch (err) {
      const reason = err instanceof ChannelError ? `${err.status || '-'} ${err.message}` : '알 수 없는 실패'
      attempts.push({ channel, reason })
    }
  }

  console.error(`[suno] 접수할 수 있는 채널이 없습니다: ${describe(attempts)}`)
  return { ok: false, message: SUNO_UNAVAILABLE_MESSAGE, attempts }
}

/** 작업 id 에서 채널을 읽는다. 접두사가 없으면 2채널 이전에 만든 것이라 apipass 다. */
export function parseTaskRef(taskRef: string): { channel: SunoChannelId; ref: string } {
  const sep = taskRef.indexOf(':')
  if (sep > 0) {
    const head = taskRef.slice(0, sep)
    if (head === 'apipass' || head === 'kie') {
      return { channel: head, ref: taskRef.slice(sep + 1) }
    }
  }
  return { channel: 'apipass', ref: taskRef }
}

/** 상태를 묻는다. 접수한 그 채널에만 묻는다 — 남의 작업 id 를 다른 곳에 물어도 소용없다. */
export async function getSunoStatus(taskRef: string): Promise<SunoStatusOutcome> {
  const { channel, ref } = parseTaskRef(taskRef)
  const cred = await providerCredential(channel)
  if (!cred.key) {
    return { ok: false, channel, message: SUNO_UNAVAILABLE_MESSAGE }
  }
  try {
    return await CHANNELS[channel].getStatus(ref, cred.key)
  } catch (err) {
    const message = err instanceof ChannelError ? err.message : '조회 실패'
    return { ok: false, channel, message }
  }
}

const describe = (attempts: SunoAttempt[]) =>
  attempts.map((a) => `${a.channel}(${a.reason})`).join(' · ')
