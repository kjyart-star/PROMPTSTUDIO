import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const API_KEY = process.env.APIPASS_API_KEY

async function uploadToStorage(supabase: any, url: string, bucketName: string, filePath: string): Promise<string> {
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
    if (!API_KEY) {
      return NextResponse.json({ error: 'Server API key configuration missing' }, { status: 500 })
    }

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

    const response = await fetch(`https://api.apipass.dev/api/v1/jobs/recordInfo?taskId=${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`
      }
    })

    const data = await response.json()

    if (response.ok && data.code === 200) {
       const state = data.data.state // queuing, generating, success, fail
        if (state === 'success') {
          // Extract the first generated audio and image
          const results = data.data.resultJson?.data
          let mockAudioUrl = ''
          let mockImageUrl = ''
          if (Array.isArray(results) && results.length > 0) {
             mockAudioUrl = results[0]?.audio_url || ''
             mockImageUrl = results[0]?.image_url || ''
          } else if (results) {
             mockAudioUrl = results.audio_url || ''
             mockImageUrl = results.image_url || ''
          }

          // Get the original history item to copy its metadata for extra variations
          const { data: originalItem } = await supabase
            .from('song_history')
            .select('*')
            .eq('id', historyId)
            .eq('user_id', user.id)
            .single()

          const resultsArr = Array.isArray(results) ? results : [results].filter(Boolean)

          // If already completed, bypass DB updates to prevent duplicate variation entries
          if (originalItem && originalItem.status === 'completed') {
             return NextResponse.json({
               status: 'completed',
               audio_url: originalItem.audio_url,
               image_url: originalItem.image_url,
               results: resultsArr
             })
          }

          // Upload first variation to our own storage (under user's ID folder to comply with policies)
          let finalAudioUrl = mockAudioUrl
          let finalImageUrl = mockImageUrl

          if (mockAudioUrl) {
            finalAudioUrl = await uploadToStorage(supabase, mockAudioUrl, 'audio_uploads', `${user.id}/suno_audio/${historyId}.mp3`)
          }
          if (mockImageUrl) {
            finalImageUrl = await uploadToStorage(supabase, mockImageUrl, 'audio_uploads', `${user.id}/suno_covers/${historyId}.png`)
          }

          if (resultsArr.length > 0) {
            resultsArr[0].audio_url = finalAudioUrl
            resultsArr[0].image_url = finalImageUrl
          }

          // Update the first variation (original row)
          const { error } = await supabase
            .from('song_history')
            .update({
              status: 'completed',
              audio_url: finalAudioUrl,
              image_url: finalImageUrl
            })
            .eq('id', historyId)
            .eq('user_id', user.id)

          if (error) {
             return NextResponse.json({ error: error.message }, { status: 500 })
          }

          // If there are multiple variations (Suno normally generates 2 tracks), insert them as separate entries
          if (resultsArr.length > 1 && originalItem) {
            for (let i = 1; i < resultsArr.length; i++) {
              const extraAudio = resultsArr[i]?.audio_url || ''
              const extraImage = resultsArr[i]?.image_url || ''
              if (extraAudio) {
                const extraId = crypto.randomUUID()
                const finalExtraAudio = await uploadToStorage(supabase, extraAudio, 'audio_uploads', `${user.id}/suno_audio/${extraId}.mp3`)
                const finalExtraImage = extraImage 
                  ? await uploadToStorage(supabase, extraImage, 'audio_uploads', `${user.id}/suno_covers/${extraId}.png`) 
                  : ''

                resultsArr[i].audio_url = finalExtraAudio
                resultsArr[i].image_url = finalExtraImage

                await supabase.from('song_history').insert({
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
                })
              }
            }
          }

          return NextResponse.json({
            status: 'completed',
            audio_url: finalAudioUrl,
            image_url: finalImageUrl,
            results: resultsArr
          })
       } else if (state === 'fail') {
          // Update database row to failed to avoid being stuck in processing
          await supabase
            .from('song_history')
            .update({ status: 'failed' })
            .eq('id', historyId)
            .eq('user_id', user.id)

          return NextResponse.json({ status: 'failed', message: data.data.failMsg })
       } else {
          return NextResponse.json({ status: 'processing', state: state })
       }
    } else {
       return NextResponse.json({ error: data.message || 'Apipass API Error' }, { status: 400 })
    }
  } catch (err: any) {
    console.error('API GET suno/status error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
