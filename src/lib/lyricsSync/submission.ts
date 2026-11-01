/**
 * 가사 싱크 제출 형식 — 웹과 앞으로 만들 앱(iOS·Android)이 같은 API·같은 서버 검증을 쓴다(순수 TS).
 *
 * 제출: POST /api/song-lrc-auto  { song_id, v, lrc: [{ t, text, end?, conf? }], client, engine, model }
 *   - lrc 는 원문 가사 줄(alignLineTexts)과 줄 수·글이 같아야 하고, 시작 초가 단조 증가, 곡 길이 안(validateAutoLrc).
 *   - 곡 주인 결과는 바로 공개, 남의 공개 곡은 다른 사람 결과와 1초 안에서 일치(lrcAgree)할 때 공개.
 *   - 앱의 온디바이스 엔진(whisper.cpp·Core ML·NNAPI 등)도 같은 형식으로 내면 같은 검증을 거친다.
 * 읽기: GET /api/lyrics-sync/{songId} (ETag) — 재생 쪽은 이 시간표를 표시만 한다.
 */

export const CLIENT_KINDS = ['web', 'ios', 'android'] as const;
export type ClientKind = (typeof CLIENT_KINDS)[number];
export const ENGINES = ['transformers.js', 'whisper.cpp', 'coreml', 'nnapi', 'onnxruntime', 'workers-ai'] as const;
export type Engine = (typeof ENGINES)[number];

export interface ClientInfo { client: ClientKind; engine: Engine; model: string }

/** 제출 본문의 클라이언트 정보를 검사한다. 없거나 틀리면 웹 기본값(옛 웹 클라이언트 호환) */
export function clientInfoOf(body: any, fallbackModel: string): ClientInfo {
  const client = CLIENT_KINDS.includes(body?.client) ? (body.client as ClientKind) : 'web';
  const engine = ENGINES.includes(body?.engine) ? (body.engine as Engine) : 'transformers.js';
  const raw = typeof body?.model === 'string' ? body.model.trim() : '';
  const model = /^[a-z0-9][a-z0-9._:-]{1,63}$/i.test(raw) ? raw : fallbackModel;
  return { client, engine, model };
}

/** 저장할 정렬기 이름 — 웹 기본(transformers.js)은 모델 이름 그대로, 그 밖은 「클라이언트/엔진/모델」 */
export function modelTagOf(info: ClientInfo): string {
  return info.client === 'web' && info.engine === 'transformers.js' ? info.model : `${info.client}/${info.engine}/${info.model}`;
}
