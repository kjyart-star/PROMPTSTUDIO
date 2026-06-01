const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/user_playlists?limit=1'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function probe() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const data = await res.json()
    if (data && data.length > 0) {
      console.log('Columns in user_playlists:', Object.keys(data[0]))
    } else {
      console.log('No data found in user_playlists')
    }
  } catch (err) {
    console.error('Error:', err)
  }
}
probe()
