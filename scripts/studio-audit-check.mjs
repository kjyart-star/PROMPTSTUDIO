// Offline regression tests: no provider calls, production data, or credits.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
function load(file, mocks = {}, globals = {}) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const exports = {}
  vm.runInNewContext(code, { exports, require: name => name in mocks ? mocks[name] : require(name),
    console, URL, URLSearchParams, Request, Response, Buffer, process, crypto: globalThis.crypto, ...globals }, { filename: file })
  return exports
}
const responseMock = { NextResponse: { json: (body, init) => Response.json(body, init) } }
const parent = { id: 'history', user_id: 'owner', suno_task_id: 'task', status: 'processing', title: 'Track' }
function fixture({ row = { ...parent }, authenticated = true, failVariation = false, empty = false, complete = false } = {}) {
  const rows = new Map(row ? [[row.id, row]] : [])
  let providerCalls = 0
  let writes = 0
  let fail = failVariation
  const supabase = {
    auth: { getUser: async () => ({ data: { user: authenticated ? { id: 'owner' } : null } }) },
    from() {
      let operation = 'select', values, filters = []
      const run = () => {
        if (operation === 'upsert') {
          if (fail) { fail = false; return { error: { message: 'simulated outage' } } }
          if (!rows.has(values.id)) rows.set(values.id, { ...values })
          writes++
          return { error: null }
        }
        const found = [...rows.values()].find(item => filters.every(([key, value]) => item[key] === value))
        if (operation === 'update' && found) { Object.assign(found, values); writes++ }
        return { data: found ? { ...found } : null, error: null }
      }
      const chain = {
        select: () => chain, eq: (key, value) => { filters.push([key, value]); return chain },
        maybeSingle: async () => run(), single: async () => run(),
        update: value => { operation = 'update'; values = value; return chain },
        upsert: (value, options) => { assert.equal(options.ignoreDuplicates, true); operation = 'upsert'; values = value; return chain },
        then: (resolve, reject) => Promise.resolve(run()).then(resolve, reject),
      }
      return chain
    },
  }
  if (complete && row) row.status = 'completed'
  const route = load('src/app/api/suno/status/route.ts', {
    'next/server': responseMock,
    '@/lib/supabase/server': { createClient: async () => supabase },
    '@supabase/supabase-js': { createClient: () => ({ storage: { from: () => ({ upload: async () => ({ error: null }), getPublicUrl: () => ({ data: { publicUrl: 'https://cdn.test/cover.png' } }) }) } }) },
    '@/lib/suno/channel': { getSunoStatus: async () => { providerCalls++; return { ok: true, state: 'succeeded', results: empty ? [] : [{ audio_url: 'https://cdn.test/1.mp3' }, { audio_url: 'https://cdn.test/2.mp3' }] } } },
  }, { fetch: async () => new Response('audio', { headers: { 'content-type': 'audio/mpeg' } }) })
  return { rows, get providerCalls() { return providerCalls }, get writes() { return writes },
    get: (task = 'task') => route.GET(new Request(`https://test/music/api/suno/status?historyId=history&taskId=${task}`)) }
}
let passed = 0
async function test(name, fn) { await fn(); passed++; console.log(`✓ ${name}`) }

await test('anonymous status does not call provider', async () => {
  const f = fixture({ authenticated: false }); assert.equal((await f.get()).status, 401); assert.equal(f.providerCalls, 0)
})
await test('missing history does not call provider or write storage', async () => {
  const f = fixture({ row: null }); assert.equal((await f.get()).status, 404); assert.equal(f.providerCalls, 0)
})
await test('another user history is rejected', async () => {
  const f = fixture({ row: { ...parent, user_id: 'other' } }); assert.equal((await f.get()).status, 404); assert.equal(f.providerCalls, 0)
})
await test('mismatched task is rejected before provider lookup', async () => {
  const f = fixture(); assert.equal((await f.get('other-task')).status, 404); assert.equal(f.providerCalls, 0)
})
await test('completed history bypasses provider', async () => {
  const f = fixture({ complete: true }); assert.equal((await f.get()).status, 200); assert.equal(f.providerCalls, 0)
})
await test('empty provider results never complete history', async () => {
  const f = fixture({ empty: true }); assert.equal((await f.get()).status, 502); assert.equal(f.rows.get('history').status, 'processing')
})
await test('all variations persist before completion', async () => {
  const f = fixture(); assert.equal((await f.get()).status, 200); assert.equal(f.rows.size, 2); assert.equal(f.rows.get('history').status, 'completed')
})
await test('variation save failure remains retryable without losing second song', async () => {
  const f = fixture({ failVariation: true }); assert.equal((await f.get()).status, 500)
  assert.equal(f.rows.get('history').status, 'processing')
  assert.equal((await f.get()).status, 200); assert.equal(f.rows.size, 2)
})
await test('simultaneous status polls never duplicate variations', async () => {
  const f = fixture(); await Promise.all([f.get(), f.get(), f.get()]); assert.equal(f.rows.size, 2)
  const extra = [...f.rows.keys()].find(id => id !== 'history')
  assert.match(extra, /^[a-f0-9]{8}-[a-f0-9]{4}-5[a-f0-9]{3}-a[a-f0-9]{3}-[a-f0-9]{12}$/)
})

function downloadFixture({ signedStatus = 200, downloadStatus = 200 } = {}) {
  const calls = []; let clicked = false
  class MockURL extends URL { static createObjectURL() { return 'blob:download' } static revokeObjectURL() {} }
  const base = load('src/lib/basePath.ts')
  const module = load('src/lib/studio/downloadTrack.ts', { '../basePath': base }, {
    URL: MockURL, setTimeout: () => 0,
    document: { createElement: () => ({ click: () => { clicked = true }, remove() {} }), body: { appendChild() {} } },
    fetch: async url => { calls.push(url); return url.includes('signed-url') ? Response.json({ signedUrl: 'https://cdn.test/signed.mp3' }, { status: signedStatus }) : new Response('audio', { status: downloadStatus }) },
  })
  return { ...module, calls, get clicked() { return clicked } }
}
await test('private download signs first, then uses music base path', async () => {
  const f = downloadFixture(); await f.downloadStudioTrack('audio/private.mp3', '한글 & 제목', 'https://cdn.test/cover.png')
  assert.match(f.calls[0], /^\/music\/api\/tracks\/signed-url\?/)
  assert.match(f.calls[1], /^\/music\/api\/download\?/); assert.equal(f.clicked, true)
})
await test('public URL download does not attempt private signing', async () => {
  const f = downloadFixture(); await f.downloadStudioTrack('https://cdn.test/song.mp3', 'Song'); assert.equal(f.calls.length, 1)
})
await test('denied signing never downloads', async () => {
  const f = downloadFixture({ signedStatus: 403 }); await assert.rejects(() => f.downloadStudioTrack('audio/private.mp3', 'Song')); assert.equal(f.clicked, false)
})
await test('download error is not saved as an MP3', async () => {
  const f = downloadFixture({ downloadStatus: 500 }); await assert.rejects(() => f.downloadStudioTrack('https://cdn.test/song.mp3', 'Song')); assert.equal(f.clicked, false)
})
for (const [name, history, expected, file] of [
  ['missing history never charges credits', null, 404, 'generate'],
  ['already submitted history never charges twice', { id: 'history', suno_task_id: 'existing-task' }, 200, 'generate'],
  ['already submitted cover never charges twice', { id: 'history', suno_task_id: 'existing-task' }, 200, 'cover/generate'],
  ['cover submission in progress cannot resubmit', { id: 'history', suno_task_id: null }, 409, 'cover/generate'],
]) {
  await test(name, async () => {
    let charged = false
    const client = {
      auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
      from: table => {
        const chain = { select: () => chain, eq: () => chain,
          single: async () => ({ data: { is_banned: false } }),
          maybeSingle: async () => ({ data: table === 'song_history' ? history : null, error: null }) }
        return chain
      },
    }
    const route = load(`src/app/api/suno/${file}/route.ts`, {
      'next/server': responseMock,
      '@/lib/supabase/server': { createClient: async () => client },
      '@/lib/auth/aiGate': { requireAiAccess: async () => ({ ok: true }) },
      '@/lib/credits/suite': { spendCredits: async () => { charged = true; throw Error('Unexpected charge') } },
      '@/lib/suite/provider': {}, '@/lib/suno/channel': {}, '@/lib/suno/versions': {},
    })
    const response = await route.POST(new Request('https://test/music/api/suno/generate', { method: 'POST', body: JSON.stringify({ historyId: 'history', audioUrl: 'https://cdn.test/source.mp3' }) }))
    assert.equal(response.status, expected); assert.equal(charged, false)
  })
}
await test('cover status resolves only owned history and delegates durable persistence', async () => {
  let delegated = false
  const client = {
    auth: { getUser: async () => ({ data: { user: { id: 'owner' } } }) },
    from: () => {
      const chain = { select: () => chain, eq: (key, value) => { if (key === 'user_id') assert.equal(value, 'owner'); return chain },
        order: () => chain, limit: async () => ({ data: [{ id: 'cover-history' }] }),
        then: resolve => Promise.resolve({ data: [{ id: 'cover-track', audio_url: 'audio/saved.mp3' }] }).then(resolve) }
      return chain
    },
  }
  const route = load('src/app/api/suno/cover/status/route.ts', {
    'next/server': responseMock, '@/lib/supabase/server': { createClient: async () => client },
    '@/app/api/suno/status/route': { GET: async request => { delegated = true; assert.equal(new URL(request.url).searchParams.get('historyId'), 'cover-history'); return Response.json({ status: 'completed' }) } },
  })
  const response = await route.GET(new Request('https://test/music/api/suno/cover/status?taskId=cover-task'))
  assert.equal(response.status, 200); assert.equal(delegated, true)
  assert.equal((await response.json()).results[0].audio_url, 'audio/saved.mp3')
})
console.log(`${passed} studio regression checks passed (offline).`)
