const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/profiles?select=*&limit=5'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function check() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`
      }
    })
    console.log('Status code:', res.status)
    const data = await res.json()
    console.log('Profiles returned (unauthenticated):', data)
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
