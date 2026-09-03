/**
 * cookiemusic-cdn — R2 버킷 `cookiemusic-tracks` 의 음원을 공개로 스트리밍한다.
 *
 * GET /<key>  → R2 오브젝트를 스트리밍. Range 헤더를 지키므로 206 부분 응답이 나가고,
 *               브라우저 <audio> 가 통째 다운로드 없이 탐색·재생할 수 있다.
 * 키는 uuid 라 내용이 바뀌지 않는다 → immutable 로 1년 캐시하고 Cache API 에 올려서
 * 반복 재생이 R2 를 다시 때리지 않게 한다.
 */

interface Env {
  TRACKS: R2Bucket;
}

/** 허용 오리진 — 운영 도메인과 로컬 개발 서버만 (openai-relay 워커와 같은 규칙) */
const ALLOWED_ORIGIN =
  /^https:\/\/([a-z0-9-]+\.)*cookieplay\.app$|^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

const CACHE_CONTROL = 'public, max-age=31536000, immutable';

/** Cache API 에 올릴 최대 크기. 그보다 크면 매번 R2 에서 스트리밍한다. */
const MAX_CACHEABLE_BYTES = 100 * 1024 * 1024;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  wav: 'audio/wav',
  flac: 'audio/flac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
};

function corsHeaders(origin: string | null): Headers {
  const headers = new Headers();
  if (origin && ALLOWED_ORIGIN.test(origin)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('vary', 'Origin');
  }
  headers.set(
    'access-control-expose-headers',
    'Content-Length, Content-Range, Accept-Ranges, ETag, X-Cdn-Cache',
  );
  return headers;
}

function contentTypeFor(key: string, meta?: R2HTTPMetadata): string {
  if (meta?.contentType) return meta.contentType;
  const ext = key.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_BY_EXT[ext] ?? 'application/octet-stream';
}

/** `bytes=0-1023` / `bytes=500-` / `bytes=-1024` 를 R2Range 로. 문법이 틀리면 null(=전체). */
function parseRange(
  header: string,
  size: number,
): { r2: R2Range; start: number; end: number } | 'unsatisfiable' | null {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return null;
  const [, rawStart, rawEnd] = m;

  if (rawStart === '' && rawEnd === '') return null;

  if (rawStart === '') {
    // suffix range: 마지막 N 바이트
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

function baseHeaders(key: string, obj: R2Object, origin: string | null): Headers {
  const headers = corsHeaders(origin);
  headers.set('content-type', contentTypeFor(key, obj.httpMetadata));
  headers.set('etag', obj.httpEtag);
  headers.set('accept-ranges', 'bytes');
  headers.set('cache-control', CACHE_CONTROL);
  return headers;
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const origin = request.headers.get('origin');
    const url = new URL(request.url);
    const key = decodeURIComponent(url.pathname.replace(/^\/+/, ''));

    if (request.method === 'OPTIONS') {
      const headers = corsHeaders(origin);
      headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
      headers.set('access-control-allow-headers', 'range, content-type');
      headers.set('access-control-max-age', '86400');
      return new Response(null, { status: 204, headers });
    }

    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const headers = corsHeaders(origin);
      headers.set('allow', 'GET, HEAD, OPTIONS');
      return new Response('Method Not Allowed', { status: 405, headers });
    }

    if (!key) {
      return new Response('Not Found', { status: 404, headers: corsHeaders(origin) });
    }

    // HEAD 는 캐시를 타지 않는다 — 마이그레이션 스크립트가 존재·크기 확인에 쓴다.
    if (request.method === 'HEAD') {
      const head = await env.TRACKS.head(key);
      if (!head) {
        return new Response(null, { status: 404, headers: corsHeaders(origin) });
      }
      const headers = baseHeaders(key, head, origin);
      headers.set('content-length', String(head.size));
      return new Response(null, { status: 200, headers });
    }

    const cache = caches.default;
    const cacheKey = new Request(url.toString(), { method: 'GET' });

    // Cache API 는 캐시된 전체 응답에 Range 를 적용해 206 으로 돌려준다.
    const cached = await cache.match(request);
    if (cached) {
      const headers = new Headers(cached.headers);
      for (const [k, v] of corsHeaders(origin)) headers.set(k, v);
      headers.set('x-cdn-cache', 'HIT');
      return new Response(cached.body, { status: cached.status, headers });
    }

    const rangeHeader = request.headers.get('range');

    if (rangeHeader) {
      const head = await env.TRACKS.head(key);
      if (!head) {
        return new Response('Not Found', { status: 404, headers: corsHeaders(origin) });
      }
      const parsed = parseRange(rangeHeader, head.size);

      if (parsed === 'unsatisfiable') {
        const headers = corsHeaders(origin);
        headers.set('content-range', `bytes */${head.size}`);
        return new Response(null, { status: 416, headers });
      }

      if (parsed) {
        const part = await env.TRACKS.get(key, { range: parsed.r2 });
        if (!part) {
          return new Response('Not Found', { status: 404, headers: corsHeaders(origin) });
        }
        // 다음 요청부터는 캐시에서 나가도록 전체 오브젝트를 백그라운드로 채운다.
        ctx.waitUntil(populateCache(env, cache, cacheKey, key, head));
        const headers = baseHeaders(key, part, origin);
        headers.set('content-length', String(parsed.end - parsed.start + 1));
        headers.set('content-range', `bytes ${parsed.start}-${parsed.end}/${head.size}`);
        headers.set('x-cdn-cache', 'MISS');
        return new Response(part.body, { status: 206, headers });
      }
      // parsed === null → 문법이 이상한 Range. 전체 응답으로 떨어진다.
    }

    const obj = await env.TRACKS.get(key);
    if (!obj) {
      return new Response('Not Found', { status: 404, headers: corsHeaders(origin) });
    }

    const headers = baseHeaders(key, obj, origin);
    headers.set('content-length', String(obj.size));

    const response = new Response(obj.body, { status: 200, headers });
    if (obj.size <= MAX_CACHEABLE_BYTES) {
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    const out = new Headers(headers);
    out.set('x-cdn-cache', 'MISS');
    return new Response(response.body, { status: 200, headers: out });
  },
};

/** 전체 오브젝트를 캐시에 올린다(Range 미스 뒤 백그라운드용). */
async function populateCache(
  env: Env,
  cache: Cache,
  cacheKey: Request,
  key: string,
  head: R2Object,
): Promise<void> {
  if (head.size > MAX_CACHEABLE_BYTES) return;
  if (await cache.match(cacheKey)) return;
  const full = await env.TRACKS.get(key);
  if (!full) return;
  const headers = baseHeaders(key, full, null);
  headers.set('content-length', String(full.size));
  await cache.put(cacheKey, new Response(full.body, { status: 200, headers }));
}
