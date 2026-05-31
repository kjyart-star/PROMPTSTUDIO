const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
});
const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);
async function test() {
  const { data } = await supabase.from('artists').select('*').eq('name', 'neo');
  console.log('Channel by name:', data);
  
  const { data: data2 } = await supabase.from('artists').select('*').eq('owner_user_id', 'cb590d8b-7944-4543-b6fd-ae517de687df');
  console.log('Channels by owner:', data2);
}
test();
