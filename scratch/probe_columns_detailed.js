const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function probeColumn(column) {
  const url = `https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/song_history?select=${column}&limit=1`
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    const data = await res.json()
    console.log(`Column '${column}' probe:`, res.status, data)
  } catch (err) {
    console.error(`Column '${column}' error:`, err)
  }
}

async function run() {
  await probeColumn('plays')
  await probeColumn('like_count')
}
run()
