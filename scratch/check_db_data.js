const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const env = {};
envFile.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) env[key.trim()] = values.join('=').trim().replace(/['"]/g, '');
});

const supabase = createClient(env['NEXT_PUBLIC_SUPABASE_URL'], env['NEXT_PUBLIC_SUPABASE_ANON_KEY']);

async function check() {
  try {
    const { data: albums, error: err1 } = await supabase.from('albums').select('*');
    console.log('--- albums ---', err1 ? err1 : albums);

    const { data: userPlaylists, error: err2 } = await supabase.from('user_playlists').select('*');
    console.log('--- user_playlists ---', err2 ? err2 : userPlaylists);

    const { data: playlists, error: err3 } = await supabase.from('playlists').select('*');
    console.log('--- playlists ---', err3 ? err3 : playlists);
  } catch (e) {
    console.error(e);
  }
}
check();
