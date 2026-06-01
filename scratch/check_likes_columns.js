const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = 'https://qdldfwzygnxlstxqojtq.supabase.co'
const supabaseServiceKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  // Try selecting from user_playlists table to see columns
  const { data: cols, error: err } = await supabase
    .from('user_playlists')
    .select('*')
    .limit(1)
  console.log('user_playlists cols:', cols, err)
}
run()
