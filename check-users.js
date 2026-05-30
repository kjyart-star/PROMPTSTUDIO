import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.auth.admin.listUsers()
  if (error) console.log("Error:", error)
  else console.log(JSON.stringify(data.users.map(u => ({id: u.id, email: u.email})), null, 2))
}
run()
