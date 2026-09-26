import { NextResponse } from 'next/server'
import { createClient as createAdminClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { getSunoStatus } from '@/lib/suno/channel'
import { createHash } from 'node:crypto'

/**
 * 스토리지 쓰기 전용 클라이언트.
 *
 * 생성 결과는 `tracks`(비공개) 버킷에 넣는데, 그 버킷은 관리자만 쓰도록 정책이 걸려 있어
 * 사용자 세션 클라이언트로는 업로드가 막힌다. 서버에서만 도는 경로이므로 서비스 키를 쓴다.
 */
function storageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createAdminClient(url, key)
}

/**
 * 외부 CDN 의 결과물을 우리 스토리지로 옮긴다.
 *
 * `mode: 'path'` 는 비공개 `tracks` 버킷용이라 **경로만** 돌려준다 — 재생은
 * `/api/tracks/signed-url` 이 서명해서 내보낸다(업로드 경로와 같은 규칙).
 * `mode: 'publicUrl'` 는 공개 버킷(커버 이미지)용이다.
 *
 * 실패하면 원본 URL 을 그대로 돌려주되 **에러를 삼키지 않고 남긴다** — 예전에는 존재하지도
 * 않는 버킷(`audio_uploads`)에 올리려다 조용히 실패해서, 음원이 계속 외부 CDN 을 가리켰다.
 */
async function uploadToStorage(
  supabase: any,
  url: string,
  bucketName: string,
  filePath: string,
  mode: 'path' | 'publicUrl' = 'publicUrl'
): Promise<string> {
  if (!url) return ''
  try {
    const res = await fetch(url)
    if (!res.ok) {
      console.error(`Failed to download file from URL: ${url}`)
      return url
    }
    const contentType = res.headers.get('content-type') || 'application/octet-stream'
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    const { error } = await supabase.storage
      .from(bucketName)
      .upload(filePath, buffer, {
        upsert: true,
        contentType: contentType
      })

    if (error) {
      console.error(`Failed to upload ${filePath} to ${bucketName}:`, error)
      return url
    }

    if (mode === 'path') return filePath

    const { data: { publicUrl } } = supabase.storage
      .from(bucketName)
      .getPublicUrl(filePath)

    return publicUrl
  } catch (err) {
    console.error(`Error uploading file from ${url} to storage:`, err)
    return url
  }
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const taskId = searchParams.get('taskId')
    const historyId = searchParams.get('historyId')

    if (!taskId || !historyId) {
      return NextResponse.json({ error: 'taskId and historyId are required' }, { status: 400 })
    }

    // Authorize BEFORE looking up the provider task or using privileged storage.
    const { data: originalItem, error: historyError } = await supabase
      .from('song_history').select('*').eq('id', historyId).eq('user_id', user.id).maybeSingle()
    if (historyError) return NextResponse.json({ error: 'History lookup failed' }, { status: 500 })
    if (!originalItem || originalItem.suno_task_id !== taskId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }
    if (originalItem.status === 'completed') {
      return NextResponse.json({ status: 'completed', audio_url: originalItem.audio_url, image_url: originalItem.image_url })
    }

    // 접수한 그 채널에만 묻는다 — 작업 id 의 접두사가 길을 정한다.
    // 접두사가 없는 id 는 2채널 이전에 만들어진 것이라 APIPASS 로 간다.
    const outcome = await getSunoStatus(taskId)

    if (!outcome.ok) {
      return NextResponse.json({ error: outcome.message }, { status: 400 })
    }

    if (outcome.state === 'succeeded') {
      // Extract the first generated audio and image
      const resultsArr = outcome.results
      if (!resultsArr.length || resultsArr.some(result => !result.audio_url)) {
        return NextResponse.json({ error: 'Provider returned incomplete audio results' }, { status: 502 })
      }
      const mockAudioUrl = resultsArr[0]?.audio_url || ''
      const mockImageUrl = resultsArr[0]?.image_url || ''

      // 생성 결과를 우리 스토리지로 옮긴다 — 외부 CDN 링크가 사라져도 곡이 남게.
      const storage = storageClient()
      let finalAudioUrl = mockAudioUrl
      let finalImageUrl = mockImageUrl

      if (mockAudioUrl) {
        finalAudioUrl = await uploadToStorage(storage, mockAudioUrl, 'tracks', `audio/${historyId}.mp3`, 'path')
      }
      if (mockImageUrl) {
        finalImageUrl = await uploadToStorage(storage, mockImageUrl, 'avatars', `suno_covers/${user.id}/${historyId}.png`)
      }

      if (resultsArr.length > 0) {
        resultsArr[0].audio_url = finalAudioUrl
        resultsArr[0].image_url = finalImageUrl
      }

      // If there are multiple variations (Suno normally generates 2 tracks), insert them as separate entries
      if (resultsArr.length > 1 && originalItem) {
        for (let i = 1; i < resultsArr.length; i++) {
          const extraAudio = resultsArr[i]?.audio_url || ''
          const extraImage = resultsArr[i]?.image_url || ''
          if (extraAudio) {
            // Stable primary key makes concurrent polls/retries idempotent without a migration.
            const hash = createHash('sha256').update(`${user.id}:${historyId}:${taskId}:${i}`).digest('hex')
            const extraId = `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`
            const finalExtraAudio = await uploadToStorage(storage, extraAudio, 'tracks', `audio/${extraId}.mp3`, 'path')
            const finalExtraImage = extraImage
              ? await uploadToStorage(storage, extraImage, 'avatars', `suno_covers/${user.id}/${extraId}.png`)
              : ''

            resultsArr[i].audio_url = finalExtraAudio
            resultsArr[i].image_url = finalExtraImage

            const { error: variationError } = await supabase.from('song_history').upsert({
              id: extraId,
              user_id: user.id,
              title: originalItem.title + ` (v${i + 1})`,
              prompt: originalItem.prompt || '',
              lyrics: originalItem.lyrics || '',
              notes: originalItem.notes || '',
              form: originalItem.form || {},
              suno_task_id: taskId,
              status: 'completed',
              audio_url: finalExtraAudio,
              image_url: finalExtraImage,
              is_published: false
            }, { onConflict: 'id', ignoreDuplicates: true })
            if (variationError) {
              return NextResponse.json({ error: 'Could not save all generated tracks. Retry status lookup.' }, { status: 500 })
            }
          }
        }
      }

      // Only mark the parent complete after EVERY variation has been saved.
      const { data: saved, error } = await supabase.from('song_history')
        .update({ status: 'completed', audio_url: finalAudioUrl, image_url: finalImageUrl })
        .eq('id', historyId).eq('user_id', user.id).eq('suno_task_id', taskId)
        .select('id').maybeSingle()
      if (error || !saved) return NextResponse.json({ error: 'Could not save generated track' }, { status: 500 })

      return NextResponse.json({
        status: 'completed',
        audio_url: finalAudioUrl,
        image_url: finalImageUrl,
        results: resultsArr
      })
    } else if (outcome.state === 'failed') {
      // Update database row to failed to avoid being stuck in processing
      await supabase
        .from('song_history')
        .update({ status: 'failed' })
        .eq('id', historyId)
        .eq('user_id', user.id)

      return NextResponse.json({ status: 'failed', message: outcome.message })
    } else {
      return NextResponse.json({ status: 'processing', state: outcome.message })
    }
  } catch (err: any) {
    console.error('API GET suno/status error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
