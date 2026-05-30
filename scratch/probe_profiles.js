const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/profiles?limit=1'
const url2 = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/announcements?limit=1'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function probe() {
  try {
    const res = await fetch(url, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } })
    const data = await res.json()
    console.log('Columns in profiles:', data[0] ? Object.keys(data[0]) : 'No data')
    
    const res2 = await fetch(url2, { headers: { 'apikey': apiKey, 'Authorization': `Bearer ${apiKey}` } })
    const data2 = await res2.json()
    if (res2.status !== 200) {
      console.log('Error announcements:', data2)
    } else {
      console.log('Columns in announcements:', data2[0] ? Object.keys(data2[0]) : 'No data')
    }
  } catch (err) {
    console.error('Error:', err)
  }
}
probe()
