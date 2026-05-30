import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function run() {
  const { data, error } = await supabase.from('profiles').select('*').eq('display_name', 'neo')
  console.log(JSON.stringify({data, error}, null, 2))
}
run()
