import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase.from('profiles').update({ is_admin: true }).eq('email', 'kjyart@gmail.com').select()
  console.log("Updated admin status:", JSON.stringify({data, error}, null, 2))
}
run()
