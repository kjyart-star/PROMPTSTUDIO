#!/usr/bin/env node
/**
 * Supabase Storage 버킷 `tracks` → Cloudflare R2 버킷 `cookiemusic-tracks` 복사.
 *
 * 원칙
 *  - 추가만 한다. Supabase 에서는 아무것도 지우지 않는다.
 *  - 파일을 통째로 메모리에 올리지 않는다. 서명 URL 응답 본문을 임시 파일로 스트리밍한 뒤
 *    `wrangler r2 object put --file` 로 올리고 즉시 임시 파일을 지운다.
 *    (R2 S3 토큰이 없어 @aws-sdk 경로는 쓸 수 없다. OAuth 로 로그인된 wrangler 만 가능.)
 *  - 멱등하다. 이미 R2 에 같은 크기로 있는 키는 건너뛴다. 중간에 끊겨도 다시 돌리면 이어간다.
 *  - 복사 뒤 R2 오브젝트 크기가 Supabase metadata.size 와 같은지 확인한다.
 *
 * 존재·크기 확인은 CDN 워커(HEAD)로 한다. wrangler 에는 r2 object list 가 없고,
 * 워커는 HEAD 를 캐시하지 않으므로 항상 R2 의 현재 상태를 본다.
 *
 * 실행:  node scripts/migrate-tracks-to-r2.mjs [--dry-run] [--limit N]
 */

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createWriteStream } from 'node:fs'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const execFileAsync = promisify(execFile)

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SUPABASE_BUCKET = 'tracks'
const SUPABASE_PREFIX = 'audio'
const R2_BUCKET = 'cookiemusic-tracks'
const WRANGLER_CONFIG = path.join(REPO_ROOT, 'workers/music-cdn/wrangler.toml')
const CDN_BASE = process.env.R2_PUBLIC_BASE || 'https://cookiemusic-cdn.kjyart.workers.dev'

const DRY_RUN = process.argv.includes('--dry-run')
const LIMIT = (() => {
  const i = process.argv.indexOf('--limit')
  return i !== -1 ? Number(process.argv[i + 1]) : Infinity
})()

/** .env.local 에서 자격증명을 읽는다. 값은 절대 출력하지 않는다. */
function loadEnv() {
  const out = { ...process.env }
  const envPath = path.join(REPO_ROOT, '.env.local')
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/)
      if (m && !process.env[m[1]]) out[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  }
  const url = out.NEXT_PUBLIC_SUPABASE_URL
  const key = out.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 찾지 못했습니다 (.env.local)')
  }
  return { url, key }
}

/** R2 에 있는지 + 크기. 없으면 null. */
async function headR2(key) {
  const res = await fetch(`${CDN_BASE}/${key}`, { method: 'HEAD' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`HEAD ${key} → ${res.status}`)
  return { size: Number(res.headers.get('content-length')) }
}

async function listSupabaseObjects(sb) {
  const rows = []
  for (let offset = 0; ; ) {
    const { data, error } = await sb.storage
      .from(SUPABASE_BUCKET)
      .list(SUPABASE_PREFIX, { limit: 100, offset })
    if (error) throw new Error(`list 실패: ${error.message}`)
    if (!data?.length) break
    for (const o of data) {
      if (o.id === null) continue // 하위 폴더
      rows.push({
        key: `${SUPABASE_PREFIX}/${o.name}`,
        size: Number(o.metadata?.size ?? 0),
        contentType: o.metadata?.mimetype || 'audio/mpeg',
      })
    }
    offset += data.length
    if (data.length < 100) break
  }
  return rows
}

/** 서명 URL 본문을 임시 파일로 스트리밍한다. 메모리에 올리지 않는다. */
async function downloadToTemp(sb, key) {
  const { data, error } = await sb.storage.from(SUPABASE_BUCKET).createSignedUrl(key, 600)
  if (error || !data?.signedUrl) throw new Error(`서명 URL 실패: ${error?.message ?? 'unknown'}`)

  const res = await fetch(data.signedUrl)
  if (!res.ok || !res.body) throw new Error(`다운로드 실패 ${res.status}`)

  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'r2mig-')), path.basename(key))
  await pipeline(Readable.fromWeb(res.body), createWriteStream(tmp))
  return tmp
}

async function putToR2(key, tmp, contentType) {
  await execFileAsync(
    'npx',
    [
      'wrangler', 'r2', 'object', 'put', `${R2_BUCKET}/${key}`,
      '--file', tmp,
      '--content-type', contentType,
      '--remote',
      '--config', WRANGLER_CONFIG,
    ],
    { cwd: REPO_ROOT, maxBuffer: 8 * 1024 * 1024 },
  )
}

async function main() {
  const { url, key: serviceKey } = loadEnv()
  const sb = createClient(url, serviceKey, { auth: { persistSession: false } })

  const objects = await listSupabaseObjects(sb)
  const totalBytes = objects.reduce((a, o) => a + o.size, 0)
  console.log(`Supabase ${SUPABASE_BUCKET}/${SUPABASE_PREFIX}: ${objects.length}개 / ${totalBytes} bytes`)
  console.log(`대상 R2: ${R2_BUCKET} (확인 경로 ${CDN_BASE})`)
  if (DRY_RUN) console.log('*** dry-run: 업로드하지 않습니다 ***')

  let copied = 0, skipped = 0, failed = 0, copiedBytes = 0
  const failures = []
  let n = 0

  for (const obj of objects) {
    if (++n > LIMIT) break
    const label = `[${n}/${Math.min(objects.length, LIMIT)}] ${obj.key}`

    try {
      const existing = await headR2(obj.key)
      if (existing && existing.size === obj.size) {
        skipped++
        continue
      }
      if (existing) {
        console.log(`${label} 크기 불일치(R2 ${existing.size} ≠ ${obj.size}) → 다시 올림`)
      }
      if (DRY_RUN) {
        console.log(`${label} 복사 예정 (${obj.size} bytes)`)
        copied++
        continue
      }

      const tmp = await downloadToTemp(sb, obj.key)
      try {
        const local = fs.statSync(tmp).size
        if (local !== obj.size) throw new Error(`다운로드 크기 불일치 ${local} ≠ ${obj.size}`)
        await putToR2(obj.key, tmp, obj.contentType)
      } finally {
        fs.rmSync(path.dirname(tmp), { recursive: true, force: true })
      }

      const verified = await headR2(obj.key)
      if (!verified || verified.size !== obj.size) {
        throw new Error(`검증 실패: R2 크기 ${verified?.size ?? 'none'} ≠ ${obj.size}`)
      }
      copied++
      copiedBytes += obj.size
      console.log(`${label} OK (${obj.size} bytes)`)
    } catch (err) {
      failed++
      failures.push(`${obj.key}: ${err.message}`)
      console.error(`${label} 실패 — ${err.message}`)
    }
  }

  console.log('')
  console.log(`복사 ${copied} / 건너뜀 ${skipped} / 실패 ${failed} — 이번에 올린 바이트 ${copiedBytes}`)
  if (failures.length) {
    console.log('실패 목록:')
    for (const f of failures) console.log('  - ' + f)
  }
  console.log('Supabase 에서는 아무것도 지우지 않았습니다.')
  process.exit(failed ? 1 : 0)
}

main().catch((err) => {
  console.error('중단:', err.message)
  process.exit(1)
})
