import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import NodeID3 from 'node-id3'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1. Find the latest song with empty image_url and local audio_url
    const { data: songs, error: fetchError } = await supabase
      .from('song_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message, status: 'fetch_error' })
    }

    const targetSong = songs.find(s => !s.image_url && s.audio_url?.startsWith('audio/'))
    if (!targetSong) {
      return NextResponse.json({ 
        message: 'No uploaded song found without a thumbnail.', 
        songsChecked: songs.length,
        status: 'no_target' 
      })
    }

    // 2. Download the audio file from tracks bucket
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('tracks')
      .download(targetSong.audio_url)

    if (downloadError) {
      return NextResponse.json({ 
        error: downloadError.message, 
        songId: targetSong.id,
        songTitle: targetSong.title,
        audioUrl: targetSong.audio_url,
        status: 'download_error' 
      })
    }

    const buffer = Buffer.from(await data.arrayBuffer())
    const tags = NodeID3.read(buffer)

    if (!tags || !tags.image) {
      return NextResponse.json({
        message: `No embedded cover art found in MP3 file for "${targetSong.title}".`,
        songId: targetSong.id,
        tagsFound: tags ? Object.keys(tags) : null,
        status: 'no_embedded_art'
      })
    }

    // 3. Upload extracted image to avatars bucket
    const mimeType = tags.image.mime || 'image/jpeg'
    const fileExt = mimeType.split('/').pop() || 'jpg'
    const imageFileName = `${user.id}-extracted-cover-${crypto.randomUUID()}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(imageFileName, tags.image.imageBuffer, {
        contentType: mimeType
      })

    if (uploadError) {
      return NextResponse.json({ 
        error: uploadError.message, 
        status: 'upload_error' 
      })
    }

    const { data: publicUrlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(imageFileName)

    const finalImageUrl = publicUrlData?.publicUrl

    // 4. Update the database record
    const { error: updateError } = await supabase
      .from('song_history')
      .update({ image_url: finalImageUrl })
      .eq('id', targetSong.id)

    if (updateError) {
      return NextResponse.json({ 
        error: updateError.message, 
        status: 'update_error' 
      })
    }

    return NextResponse.json({
      status: 'success',
      message: `Successfully extracted and updated thumbnail for "${targetSong.title}".`,
      songId: targetSong.id,
      imageUrl: finalImageUrl,
      mimeType,
      imageSize: tags.image.imageBuffer.length
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, status: 'exception' })
  }
}
