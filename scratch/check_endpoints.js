const baseUrl = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

const tables = ['song_history', 'tracks', 'albums', 'artists', 'chart_snapshots', 'likes', 'system_settings', 'system_guides', 'profiles', 'user_playlists']

async function check() {
  for (const table of tables) {
    try {
      const res = await fetch(`${baseUrl}/${table}?select=count`, {
        headers: {
          'apikey': apiKey,
          'Authorization': `Bearer ${apiKey}`,
          'Prefer': 'count=exact'
        }
      })
      if (res.ok) {
        const countHeader = res.headers.get('content-range')
        console.log(`Table '${table}': OK, Content-Range: ${countHeader}`)
        // Let's get top 2 rows
        const dataRes = await fetch(`${baseUrl}/${table}?limit=2`, {
          headers: {
            'apikey': apiKey,
            'Authorization': `Bearer ${apiKey}`
          }
        })
        const data = await dataRes.json()
        console.log(`Table '${table}' sample:`, JSON.stringify(data, null, 2))
      } else {
        const err = await res.json()
        console.log(`Table '${table}': Failed, Status: ${res.status}, Error:`, err)
      }
    } catch (e) {
      console.log(`Table '${table}': Error:`, e.message)
    }
  }
}
check()
