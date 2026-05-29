const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/song_history?select=id,title,is_published'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function check() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const data = await res.json()
    console.log('Songs in DB:', data)
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
