const https = require('https');

const queries = [
  'hip hop', 'rnb music', 'city neon', 'singer stage',
  'blues guitar', 'country music acoustic', 'latin dance',
  'reggae music', 'funk band', 'podcast microphone'
];

async function fetchImage(query) {
  return new Promise((resolve) => {
    https.get(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(query)}&per_page=1`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.results[0].id);
        } catch(e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  for (const q of queries) {
    const id = await fetchImage(q);
    console.log(`${q}: ${id}`);
  }
}

run();
