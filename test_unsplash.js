const https = require('https');

const urls = [
  // Hip Hop
  'https://images.unsplash.com/photo-1508973379184-7510e1ebd4f5',
  // Hip Hop Alternative (Boombox)
  'https://images.unsplash.com/photo-1605648819077-80bebbff6bda',
  // Hip Hop Alternative (DJ)
  'https://images.unsplash.com/photo-1516280440502-1249b2824982',
  // R&B (Singer)
  'https://images.unsplash.com/photo-1493225457124-ca8e3f28ea30',
  // City Pop (Neon city)
  'https://images.unsplash.com/photo-1514565131-fce0801e5785',
  'https://images.unsplash.com/photo-1519501025264-65ba15a82390',
  // Trot (Microphone/Stage)
  'https://images.unsplash.com/photo-1516280440502-1249b2824982', // duplicated?
  'https://images.unsplash.com/photo-1520446266423-6daca2383be1', // existing trot
  'https://images.unsplash.com/photo-1478737270239-2f02b77fc618',
  // Blues (Guitar)
  'https://images.unsplash.com/photo-1510915361894-db8b60106cb1',
  // Country (Acoustic guitar/nature)
  'https://images.unsplash.com/photo-1485688537659-33b68019e13d',
  // Latin (Dancing)
  'https://images.unsplash.com/photo-1532585223067-1eb2e5d95655',
  // Funk Soul (Brass/Band)
  'https://images.unsplash.com/photo-1511192336575-5a79af67a629', // jazz existing
  'https://images.unsplash.com/photo-1522863602463-afebb88d5918',
  // Folk
  'https://images.unsplash.com/photo-1471478331149-c72f17e33c73',
  // Reggae
  'https://images.unsplash.com/photo-1511192336575-5a79af67a629', // jazz
  'https://images.unsplash.com/photo-1520872655787-83d8e5f29910',
  // Podcasts
  'https://images.unsplash.com/photo-1589903308904-1010c2294adc'
];

urls.forEach(u => {
  https.get(u, (res) => {
    console.log(`${u} -> ${res.statusCode}`);
  }).on('error', (e) => {
    console.error(e);
  });
});
