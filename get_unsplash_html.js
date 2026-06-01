const https = require('https');

function fetchPhotos(query) {
  return new Promise((resolve) => {
    https.get(`https://unsplash.com/s/photos/${encodeURIComponent(query)}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        // Look for "photo-XXXXXXX-XXXXXXX" pattern
        const matches = [...data.matchAll(/photo-[0-9]{10,13}-[a-z0-9]+/g)];
        if (matches.length > 0) {
          // get the first unique match
          resolve([...new Set(matches.map(m => m[0]))].slice(0, 3));
        } else {
          resolve([]);
        }
      });
    }).on('error', () => resolve([]));
  });
}

async function run() {
  const q = ['hip-hop', 'rnb', 'city-neon', 'trot-music', 'blues-music', 'country-music', 'latin-dance', 'reggae', 'funk-music', 'podcast'];
  for (const query of q) {
    const ids = await fetchPhotos(query);
    console.log(`${query}: ${ids.join(', ')}`);
  }
}
run();
