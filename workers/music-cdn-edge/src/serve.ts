/**
 * cookiemusic-cdn 워커(`workers/music-cdn/src/index.ts`)와 같은 응답을 Pages Function 한 번으로 낸다.
 * 차이: Cache API 를 쓰지 않는다(Function 호출 수는 같고, R2 읽기는 무료 한도 안). 공개 음원이라 서명 없음.
 */
import { isPublicKey, type GateEnv } from './gate';

export interface Env extends GateEnv {
  TRACKS?: R2Bucket;
}

export const ALLOWED_ORIGIN = /^https:\/\/([a-z0-9-]+\.)*cookieplay\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg', m4a: 'audio/mp4', aac: 'audio/aac', wav: 'audio/wav', flac: 'audio/flac', ogg: 'audio/ogg', opus: 'audio/opus',
};

function corsHeaders(origin: string | null): Headers {
  const h = new Headers();
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    h.set('access-control-allow-origin', origin);
    h.set('vary', 'Origin');
  }
  h.set('access-control-expose-headers', 'Content-Length, Content-Range, Accept-Ranges, ETag');
  return h;
}

function baseHeaders(key: string, obj: R2Object, origin: string | null): Headers {
  const h = corsHeaders(origin);
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  h.set('content-type', obj.httpMetadata?.contentType || CONTENT_TYPE_BY_EXT[ext] || 'application/octet-stream');
  h.set('etag', obj.httpEtag);
  h.set('accept-ranges', 'bytes');
  h.set('cache-control', CACHE_CONTROL);
  return h;
}

function parseRange(header: string, size: number): { r2: R2Range; start: number; end: number } | 'unsatisfiable' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;
  if (rawStart === '' && rawEnd === '') return null;
  if (rawStart === '') {
    const suffix = Number(rawEnd);
    if (suffix <= 0) return 'unsatisfiable';
    const length = Math.min(suffix, size);
    return { r2: { suffix: length }, start: size - length, end: size - 1 };
  }
  const start = Number(rawStart);
  if (start >= size) return 'unsatisfiable';
  const end = rawEnd === '' ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (end < start) return 'unsatisfiable';
  return { r2: { offset: start, length: end - start + 1 }, start, end };
}

export async function handle(request: Request, env: Env): Promise<Response> {
  const origin = request.headers.get('origin');
  const colo = (request as Request & { cf?: { colo?: string } }).cf?.colo;
  const out = (res: Response): Response => {
    if (colo) res.headers.set('x-edge-colo', colo);
    return res;
  };
  if (request.method === 'OPTIONS') {
    const h = corsHeaders(origin);
    h.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
    h.set('access-control-allow-headers', 'range, if-none-match, if-range, content-type');
    h.set('access-control-max-age', '86400');
    return new Response(null, { status: 204, headers: h });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    const h = corsHeaders(origin);
    h.set('allow', 'GET, HEAD, OPTIONS');
    return new Response('Method Not Allowed', { status: 405, headers: h });
  }
  let key = '';
  try {
    key = decodeURIComponent(new URL(request.url).pathname.replace(/^\/+/, ''));
  } catch {
    /* 깨진 퍼센트 표기 */
  }
  const notFound = () => out(new Response('Not Found', { status: 404, headers: corsHeaders(origin) }));
  if (!key || key.includes('..') || !env.TRACKS) return notFound();
  const bucket = env.TRACKS;

  if (request.method === 'HEAD') {
    const head = await bucket.head(key);
    if (!head) return notFound();
    const h = baseHeaders(key, head, origin);
    h.set('content-length', String(head.size));
    return out(new Response(null, { status: 200, headers: h }));
  }

  // 비공개·정지 곡은 R2 를 열기 전에 404 (감사 M-7). HEAD 는 마이그레이션 스크립트의 존재 확인용이라 위에서 먼저 처리된다.
  if (!(await isPublicKey(key, env))) return notFound();

  let range = request.headers.get('range');
  const ifRange = request.headers.get('if-range');
  const ifNoneMatch = request.headers.get('if-none-match');
  if (range && ifRange) {
    const head = await bucket.head(key);
    if (!head) return notFound();
    if (ifRange !== head.httpEtag) range = null;
  }

  if (range) {
    const head = await bucket.head(key);
    if (!head) return notFound();
    const parsed = parseRange(range, head.size);
    if (parsed === 'unsatisfiable') {
      const h = corsHeaders(origin);
      h.set('content-range', `bytes */${head.size}`);
      return out(new Response(null, { status: 416, headers: h }));
    }
    if (parsed) {
      const part = await bucket.get(key, { range: parsed.r2 });
      if (!part) return notFound();
      const h = baseHeaders(key, part, origin);
      h.set('content-length', String(parsed.end - parsed.start + 1));
      h.set('content-range', `bytes ${parsed.start}-${parsed.end}/${head.size}`);
      return out(new Response(part.body, { status: 206, headers: h }));
    }
  }

  const obj = await bucket.get(key, ifNoneMatch ? { onlyIf: new Headers({ 'if-none-match': ifNoneMatch }) } : {});
  if (!obj) return notFound();
  if (ifNoneMatch && !('body' in obj && (obj as R2ObjectBody).body)) {
    return out(new Response(null, { status: 304, headers: baseHeaders(key, obj, origin) }));
  }
  const h = baseHeaders(key, obj, origin);
  h.set('content-length', String(obj.size));
  return out(new Response((obj as R2ObjectBody).body, { status: 200, headers: h }));
}
