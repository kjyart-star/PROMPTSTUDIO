const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/chart_snapshots?select=*&order=period_date.desc,rank.asc&limit=10'
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
    console.log('Chart snapshots in DB:', JSON.stringify(data, null, 2))
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
