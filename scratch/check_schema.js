const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/'
const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function check() {
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': apiKey
      }
    })
    const data = await res.json()
    console.log('Keys in data:', Object.keys(data))
    if (data.definitions) {
      console.log('Definitions (Tables):', Object.keys(data.definitions))
    } else {
      console.log('Data:', data)
    }
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
