const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qdldfwzygnxlstxqojtq.supabase.co'
const supabaseKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

const supabase = createClient(supabaseUrl, supabaseKey)

async function test() {
  console.log('--- Testing user_playlists join with profiles ---')
  const { data: pData, error: pErr } = await supabase
    .from('user_playlists')
    .select('*, profiles(is_banned)')
    .limit(2)
  if (pErr) {
    console.error('user_playlists join error:', pErr)
  } else {
    console.log('user_playlists join success:', pData)
  }

  console.log('--- Testing song_history join with profiles ---')
  const { data: sData, error: sErr } = await supabase
    .from('song_history')
    .select('*, profiles(is_banned)')
    .limit(2)
  if (sErr) {
    console.error('song_history join error:', sErr)
  } else {
    console.log('song_history join success:', sData)
  }
}

test()
