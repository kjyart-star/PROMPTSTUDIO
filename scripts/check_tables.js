const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function check() {
  try {
    const tracksRes = await fetch(url + 'tracks?select=id,title,album_id', {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const tracks = await tracksRes.json()
    console.log('Tracks response:', tracks)

    const albumsRes = await fetch(url + 'albums?select=id,title,cover_url', {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const albums = await albumsRes.json()
    console.log('Albums response:', albums)
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
