const apiKey = 'sb_publishable_U6hlom2lANKeWHRBGb2RXw_wVn_2iw-'

async function check() {
  const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/rpc/exec_sql'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: 'SELECT 1;' })
    })
    const data = await res.json()
    console.log('exec_sql RPC check result:', res.status, data)
  } catch (err) {
    console.error('Error:', err)
  }
}

async function check2() {
  const url = 'https://qdldfwzygnxlstxqojtq.supabase.co/rest/v1/rpc/run_sql'
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sql: 'SELECT 1;' })
    })
    const data = await res.json()
    console.log('run_sql RPC check result:', res.status, data)
  } catch (err) {
    console.error('Error:', err)
  }
}

async function run() {
  await check()
  await check2()
}
run()
