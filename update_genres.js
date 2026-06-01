const fs = require('fs');

const file = 'src/lib/constants.ts';
let code = fs.readFileSync(file, 'utf8');

const newImages = {
  'K-Pop': '1516450360452-9312f5e86fc7',
  'Pop': '1511671782779-c97d3d27a1d4',
  'Hip Hop': '1508973379184-7510e1ebd4f5',
  'R&B': '1493225457224-ca8e3f28ea30',
  'Dance': '1545128485-c400e7702796',
  'Electronic': '1470225620780-dba8ba36b745',
  'Rock': '1498038432885-c6f3f1b912ee',
  'Indie Rock': '1459749411175-04bf5292ceea',
  'J-Pop': '1542051841857-5f90071e7989',
  'City Pop': '1503756234508-e4e06d95379b',
  'Jazz': '1511192336575-5a79af67a629',
  'Classical': '1507838153414-b4b713384a76',
  'Ambient': '1500462918059-b1a0cb512f1d',
  'Chill': '1499810631641-541e76d678a2',
  'Soundtrack': '1485846234645-a62644f84728',
  'Animation': '1541562232579-512a21360020',
  'Trot': '1520446266423-6daca2383be1',
  'Blues': '1460036521480-15b7db573fbb',
  'Country': '1508925341258-0ce0f62bd938',
  'Latin': '1504609774034-c4a04eeb9501',
  'Afrobeats': '1528605105345-5344ea20e269',
  'Shoegaze': '1499914485622-a88fac536970',
  'Experimental': '1590602847861-f357a9332bbc',
  'Alternative': '1501386761578-eac5c94b800a',
  'Folk': '1498038432885-c6f3f1b912ee',
  'House': '1514525253161-7a46d19cd819',
  'Punk': '1506157786151-b8491531f063',
  'Reggae': '1514525253161-7a46d19cd819',
  'Hyperpop': '1618005182384-a83a8bd57fbe',
  'Metal': '1524368535928-5b5e00ddc76b',
  'Funk Soul': '1528605248648-fb22064df199',
  'Gospel': '1510915228340-29c85a43dcfe',
  'Podcasts': '1590602847861-f357a9332bbc',
  'Other': '1518609878373-06d740f60d8b'
};

for (const [name, id] of Object.entries(newImages)) {
  const regex = new RegExp(`({ name: '${name}',.*?)image: '.*?'(.*?})`, 'g');
  code = code.replace(regex, `$1image: 'https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=200&h=200&q=80'$2`);
}

fs.writeFileSync(file, code);
console.log('Updated constants.ts');
