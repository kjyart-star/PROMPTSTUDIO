const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function run() {
  const url = `https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/song_history?select=id,title,likes(count),play_events(count)&limit=5`
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const data = await res.json()
    console.log('Query result:', res.status, JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}
run()
