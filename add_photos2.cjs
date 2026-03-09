const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const https = require('https');
const crypto = require('crypto');

const prisma = new PrismaClient();
const GOOGLE_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';
const CLOUDINARY_CLOUD = 'dy6eetmh7';
const CLOUDINARY_API_KEY = '333927774328418';
const CLOUDINARY_API_SECRET = '9phbOjjX2YxVI43orwmWdoiCvew';
const FOUNDER_ID = 'cmlpeyk82005s3qause3sws7y';

const CAMPGROUNDS = [
  { name: 'Pacific Shores Motorcoach Resort', state: 'OR', query: 'Pacific Shores Motorcoach Resort Newport Oregon' },
  { name: 'Buffalo Crossing RV Park', state: 'MT', query: 'Buffalo Crossing RV Park West Yellowstone Montana' },
  { name: 'The Vineyards of Fredericksburg RV Park', state: 'TX', query: 'Vineyards of Fredericksburg RV Park Texas' },
];

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });
}

async function getPhotosViaTextSearch(query) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_KEY}`;
  const result = await fetchJson(url);
  if (!result.results?.length) return [];
  const placeId = result.results[0].place_id;
  console.log(`  Place ID: ${placeId}`);
  const detail = await fetchJson(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_KEY}`);
  const photos = detail.result?.photos || [];
  console.log(`  Found ${photos.length} photos`);
  return photos.slice(0, 8).map(p =>
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photo_reference}&key=${GOOGLE_KEY}`
  );
}

async function uploadToCloudinary(photoUrl) {
  const finalUrl = await new Promise((resolve, reject) => {
    https.get(photoUrl, res => {
      resolve(res.statusCode >= 300 && res.headers.location ? res.headers.location : photoUrl);
      res.resume();
    }).on('error', reject);
  });

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = crypto.createHash('sha1').update(`timestamp=${timestamp}${CLOUDINARY_API_SECRET}`).digest('hex');
  const boundary = '----FB' + Math.random().toString(36).slice(2);
  const body = Buffer.from([
    `--${boundary}\r\nContent-Disposition: form-data; name="timestamp"\r\n\r\n${timestamp}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${CLOUDINARY_API_KEY}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="signature"\r\n\r\n${signature}`,
    `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\n\r\n${finalUrl}`,
    `--${boundary}--`,
  ].join('\r\n'));

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  for (const cg of CAMPGROUNDS) {
    console.log(`\nProcessing: ${cg.name}`);
    const camp = await prisma.campground.findFirst({ where: { name: cg.name, state: cg.state } });
    if (!camp) { console.log('  Not found in DB'); continue; }

    const photoUrls = await getPhotosViaTextSearch(cg.query);
    if (!photoUrls.length) { console.log('  No photos found'); continue; }

    let added = 0;
    for (const url of photoUrls) {
      try {
        const result = await uploadToCloudinary(url);
        if (!result.secure_url) { console.log('  Failed:', result.error?.message); continue; }
        await prisma.campgroundPhoto.create({
          data: { campgroundId: camp.id, userId: FOUNDER_ID, imageUrl: result.secure_url, caption: cg.name, status: 'APPROVED' }
        });
        added++;
        console.log(`  ✓ Photo ${added}`);
        await new Promise(r => setTimeout(r, 500));
      } catch(e) { console.log('  Error:', e.message); }
    }
    console.log(`  Added ${added} photos`);
  }
  await prisma.$disconnect();
  console.log('\nDone!');
}

main().catch(e => { console.error(e); process.exit(1); });
