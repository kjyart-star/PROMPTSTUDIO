const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/user_roles?select=*'
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
    console.log('User roles in DB:', data)
  } catch (err) {
    console.error('Error:', err)
  }
}
check()
