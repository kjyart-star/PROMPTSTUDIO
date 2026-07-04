import { NextRequest, NextResponse } from 'next/server'
import NodeID3 from 'node-id3'
import { createClient } from '@/lib/supabase/server'
import { assertSafeUrl } from '@/lib/security/ssrf'

export async function GET(request: NextRequest) {
  // Require an authenticated session — this endpoint proxies server-side
  // fetches, so it must never be callable anonymously.
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const fileUrl = searchParams.get('url')
  const imageUrl = searchParams.get('image')
  let filename = searchParams.get('filename') || 'track.mp3'

  // Ensure filename has .mp3 extension if not present
  if (!filename.toLowerCase().endsWith('.mp3')) {
    filename = `${filename}.mp3`
  }

  if (!fileUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // SSRF guard: reject non-http(s) and any URL resolving to an internal IP.
  let safeFileUrl: URL
  try {
    safeFileUrl = await assertSafeUrl(fileUrl)
  } catch {
    return NextResponse.json({ error: 'Invalid or disallowed url' }, { status: 400 })
  }

  try {
    // 1. Fetch Audio file
    const audioRes = await fetch(safeFileUrl, { redirect: 'error' })
    if (!audioRes.ok) {
      throw new Error(`Failed to fetch audio file: ${audioRes.statusText}`)
    }
    const audioArrayBuffer = await audioRes.arrayBuffer()
    let audioBuffer = Buffer.from(audioArrayBuffer)

    // 2. Fetch Image file if provided
    if (imageUrl) {
      try {
        const safeImageUrl = await assertSafeUrl(imageUrl)
        const imageRes = await fetch(safeImageUrl, { redirect: 'error' })
        if (imageRes.ok) {
          const imageArrayBuffer = await imageRes.arrayBuffer()
          const imageBuffer = Buffer.from(imageArrayBuffer)
          const mimeType = imageRes.headers.get('Content-Type') || 'image/jpeg'

          // Write ID3 Tags with Album Art (APIC frame)
          const tags = {
            title: filename.replace(/\.mp3$/i, ''),
            image: {
              mime: mimeType,
              type: {
                id: 3, // Cover (front)
                name: 'front cover'
              },
              description: 'Album Art',
              imageBuffer: imageBuffer
            }
          }

          audioBuffer = Buffer.from(NodeID3.write(tags, audioBuffer))
        }
      } catch (imgError) {
        console.error('Failed to embed album art:', imgError)
        // Non-blocking: continue without image embedding if image fetch fails
      }
    }

    const headers = new Headers()
    const safeFilename = encodeURIComponent(filename)
    headers.set('Content-Disposition', `attachment; filename="${safeFilename}"; filename*=UTF-8''${safeFilename}`)
    headers.set('Content-Type', 'audio/mpeg')
    headers.set('Content-Length', audioBuffer.length.toString())

    return new NextResponse(audioBuffer, {
      status: 200,
      headers
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json({ error: 'Failed to download file' }, { status: 500 })
  }
}
