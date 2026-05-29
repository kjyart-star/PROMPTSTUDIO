import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const SAMPLE_SONGS = [
  {
    title: "Neon City Nights",
    prompt: "A retro synthwave track about driving through a futuristic cyberpunk city",
    lyrics: "Neon lights reflecting on the glass\\nSpeeding through the future, moving fast\\nDigital dreams and electric hearts\\nThis is where the real life starts",
    audio_url: "https://actions.google.com/sounds/v1/alarms/digital_watch_alarm_long.ogg",
    image_url: "https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=500&q=60",
    is_published: true
  },
  {
    title: "Acoustic Sunrise",
    prompt: "Calm acoustic indie folk song about waking up early in a cabin",
    lyrics: "Coffee brewing on the wooden stove\\nMorning mist is lifting from the grove\\nBirds are singing melodies so clear\\nGlad to have another morning here",
    audio_url: "https://actions.google.com/sounds/v1/water/waves_crashing_on_rock_beach.ogg",
    image_url: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?auto=format&fit=crop&w=500&q=60",
    is_published: false
  },
  {
    title: "Galactic Bass",
    prompt: "Heavy electronic dubstep track with alien sound effects",
    lyrics: "[Instrumental Drop]\\nBass Cannon Activated\\n[Wub Wub Wub]",
    audio_url: "https://actions.google.com/sounds/v1/science_fiction/spaceship_engine.ogg",
    image_url: "https://images.unsplash.com/photo-1614730321146-b6fa6a46bcb4?auto=format&fit=crop&w=500&q=60",
    is_published: true
  },
  {
    title: "Midnight Jazz Club",
    prompt: "Smooth jazz with a prominent saxophone solo",
    lyrics: "[Smooth Saxophone Solo]\\nSnap your fingers to the beat",
    audio_url: "https://actions.google.com/sounds/v1/foley/footsteps_on_wet_pavement.ogg",
    image_url: "https://images.unsplash.com/photo-1415201364774-f6f0bb35f28f?auto=format&fit=crop&w=500&q=60",
    is_published: false
  },
  {
    title: "Summer Pop Anthem",
    prompt: "Upbeat K-pop style song about hanging out with friends at the beach",
    lyrics: "Sun is shining, we are feeling fine\\nSummer breeze is yours and it is mine\\nDancing in the sand until the night\\nEverything is gonna be alright",
    audio_url: "https://actions.google.com/sounds/v1/crowds/stadium_cheer.ogg",
    image_url: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=500&q=60",
    is_published: true
  }
]

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Insert 5 samples
    const inserts = SAMPLE_SONGS.map(song => ({
      ...song,
      user_id: user.id
    }))

    const { error } = await supabase.from('song_history').insert(inserts)

    if (error) {
      console.error('Seed Error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: '5 Sample songs created successfully!' })
  } catch (err: any) {
    console.error('API seed error:', err)
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
  }
}
