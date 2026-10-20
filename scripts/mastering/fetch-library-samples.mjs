#!/usr/bin/env node
/**
 * 마스터링 템플릿 품질 검사용 샘플 곡 받기 — 읽기 전용(SELECT·download 만, 쓰기·삭제 호출 없음).
 *
 * 대표(관리자) 보관함(song_history)에서 장르(style)가 서로 다른 완료 곡을 골라
 * 음원을 tracks 버킷에서 내려받고, ffmpeg 로 48kHz 스테레오 32bit float WAV 로 푼다.
 * 결과물은 repo 밖 폴더에 둔다 — repo 에 넣지 말 것.
 *
 *   node scripts/mastering/fetch-library-samples.mjs <출력폴더> [곡 수=5] [--list]
 *
 * 환경 변수: .env.local 의 NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (값은 출력하지 않는다)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const listOnly = args.includes('--list')
const pos = args.filter(a => !a.startsWith('--'))
const outDir = resolve(pos[0] ?? './samples')
const want = Number(pos[1] ?? 5)

function loadEnv() {
  for (const p of ['.env.local', '../../../.env.local']) {
    if (!existsSync(p)) continue
    for (const line of readFileSync(p, 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
    }
  }
}
loadEnv()
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) { console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 없습니다'); process.exit(1) }
const sb = createClient(url, key, { auth: { persistSession: false } })

/** 스타일 문자열 → 대략 장르 묶음 (서로 다른 곡을 고르기 위한 것) */
const BUCKETS = [
  ['ballad', /ballad|발라드/i], ['hiphop', /hip.?hop|rap|trap|힙합|랩/i], ['edm', /edm|house|techno|electro|club|dance|댄스/i],
  ['rock', /rock|metal|punk|band|록|메탈/i], ['acoustic', /acoustic|folk|jazz|piano|어쿠스틱|재즈|피아노/i],
  ['cinematic', /cinematic|orchestra|ost|epic|classical|오케스트라|클래식/i], ['rnb', /r&b|rnb|soul|소울/i],
  ['lofi', /lo.?fi|ambient|chill|로파이/i], ['trot', /trot|트로트/i], ['pop', /pop|팝|k-?pop/i],
]
const bucketOf = s => (BUCKETS.find(([, re]) => re.test(s)) ?? ['other'])[0]

const { data: admins, error: e1 } = await sb.from('profiles').select('id').eq('is_admin', true)
if (e1) { console.error('profiles 조회 실패', e1.message); process.exit(1) }
const ids = (admins ?? []).map(a => a.id)
const { data: rows, error: e2 } = await sb.from('song_history').select('*').in('user_id', ids).order('created_at', { ascending: false }).limit(500)
if (e2) { console.error('song_history 조회 실패', e2.message); process.exit(1) }
// 이미 마스터링한 결과물은 원본 샘플로 쓰지 않는다
const songs = (rows ?? []).filter(r => r.audio_url && (r.status ?? 'completed') === 'completed' && !/마스터링|master/i.test(r.title ?? ''))
const styleOf = r => [r.genre, r.style, r.tags, typeof r.prompt === 'string' ? r.prompt.slice(0, 300) : '', r.title].filter(v => typeof v === 'string' && v).join(' ')
console.log(`관리자 ${ids.length}명, 완료 곡 ${songs.length}곡 (열: ${rows?.[0] ? Object.keys(rows[0]).join(',') : '-'})`)

const picked = [], seen = new Set()
for (const r of songs) {
  const b = bucketOf(styleOf(r))
  if (seen.has(b)) continue
  seen.add(b); picked.push({ r, b })
  if (picked.length >= want) break
}
for (const { r, b } of picked) console.log(`[${b}] ${r.id}  ${r.title ?? '(제목 없음)'}  — ${styleOf(r).slice(0, 80)}`)
if (listOnly) process.exit(0)

mkdirSync(outDir, { recursive: true })
const manifest = []
for (const { r, b } of picked) {
  let buf
  if (/^https?:/.test(r.audio_url)) {
    const res = await fetch(r.audio_url)
    if (!res.ok) { console.warn(`받기 실패 ${r.id} ${res.status}`); continue }
    buf = Buffer.from(await res.arrayBuffer())
  } else {
    const { data, error } = await sb.storage.from('tracks').download(r.audio_url)
    if (error) { console.warn(`받기 실패 ${r.id} ${error.message}`); continue }
    buf = Buffer.from(await data.arrayBuffer())
  }
  const ext = (r.audio_url.match(/\.(\w{2,4})(?:\?|$)/)?.[1] ?? 'mp3').toLowerCase()
  const raw = join(outDir, `${b}-${r.id}.${ext}`), wav = join(outDir, `${b}-${r.id}.wav`)
  writeFileSync(raw, buf)
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', raw, '-ac', '2', '-ar', '48000', '-c:a', 'pcm_f32le', wav])
  manifest.push({ id: r.id, title: r.title ?? '', bucket: b, style: styleOf(r).slice(0, 120), file: `${b}-${r.id}.wav` })
  console.log(`저장 ${wav}`)
}
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2))
console.log(`${manifest.length}곡 → ${outDir}`)
