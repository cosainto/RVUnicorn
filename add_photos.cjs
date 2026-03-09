const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();
const GOOGLE_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';
const CLOUDINARY_CLOUD = 'dy6eetmh7';
const CLOUDINARY_API_KEY = '333927774328418';
const CLOUDINARY_API_SECRET = '9phbOjjX2YxVI43orwmWdoiCvew';
const FOUNDER_ID = 'cmlpeyk82005s3qause3sws7y';

const CAMPGROUNDS = [
  { name: 'Pacific Shores Motorcoach Resort', state: 'OR' },
  { name: 'Alpine Valley RV Resort', state: 'WY' },
  { name: 'Buffalo Crossing RV Park', state: 'MT' },
  { name: 'Zion Canyon Campground & RV Resort', state: 'UT' },
  { name: 'The Vineyards of Fredericksburg RV Park', state: 'TX' },
  { name: 'Grand Canyon Camper Village', state: 'AZ' },
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

function fetchBuffer(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchBuffer(res.headers.location).then(resolve).catch(reject);
      }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve({ buffer: Buffer.concat(chunks), contentType: res.headers['content-type'] }));
    }).on('error', reject);
  });
}

async function uploadToCloudinary(buffer, contentType, filename) {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = 'campgrounds';
  const sigStr = `folder=${folder}&timestamp=${timestamp}&upload_preset=ml_default${CLOUDINARY_API_SECRET}`;
  // Use unsigned upload with fetch URL instead
  return null; // fallback below
}

async function uploadViaFetchUrl(photoUrl) {
  const crypto = require('crypto');
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp, upload_preset: 'ml_default' };
  const sigStr = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&') + CLOUDINARY_API_SECRET;
  const signature = require('crypto').createHash('sha1').update(sigStr).digest('hex');

  const formData = `--boundary\r\nContent-Disposition: form-data; name="file"\r\n\r\n${photoUrl}\r\n--boundary\r\nContent-Disposition: form-data; name="timestamp"\r\n\r\n${timestamp}\r\n--boundary\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${CLOUDINARY_API_KEY}\r\n--boundary\r\nContent-Disposition: form-data; name="signature"\r\n\r\n${signature}\r\n--boundary--`;

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.cloudinary.com',
      path: `/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
      method: 'POST',
      headers: { 'Content-Type': 'multipart/form-data; boundary=boundary', 'Content-Length': Buffer.byteLength(formData) }
    };
    const req = https.request(options, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(formData);
    req.end();
  });
}

async function getGooglePhotos(name, lat, lng) {
  // Search for place
  const searchUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=100&keyword=${encodeURIComponent(name)}&key=${GOOGLE_KEY}`;
  const searchResult = await fetchJson(searchUrl);
  if (!searchResult.results?.length) {
    console.log(`  No Google Place found for ${name}`);
    return [];
  }
  const placeId = searchResult.results[0].place_id;
  console.log(`  Found Place ID: ${placeId}`);

  // Get place details with photos
  const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=photos&key=${GOOGLE_KEY}`;
  const detail = await fetchJson(detailUrl);
  const photos = detail.result?.photos || [];
  console.log(`  Found ${photos.length} photos`);
  return photos.slice(0, 8).map(p =>
    `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photo_reference=${p.photo_reference}&key=${GOOGLE_KEY}`
  );
}

async function main() {
  const crypto = require('crypto');

  for (const cg of CAMPGROUNDS) {
    console.log(`\nProcessing: ${cg.name}`);
    const camp = await prisma.campground.findFirst({ where: { name: cg.name, state: cg.state } });
    if (!camp) { console.log('  Not found in DB'); continue; }

    // Check existing photos
    const existing = await prisma.campgroundPhoto.count({ where: { campgroundId: camp.id } });
    if (existing >= 3) { console.log(`  Already has ${existing} photos, skipping`); continue; }

    const photoUrls = await getGooglePhotos(cg.name, camp.latitude, camp.longitude);
    if (!photoUrls.length) continue;

    let added = 0;
    for (const photoUrl of photoUrls) {
      try {
        // Upload to Cloudinary via signed upload
        // Follow Google redirect to get real image URL
        const finalUrl = await new Promise((resolve, reject) => {
          https.get(photoUrl, res => {
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
              resolve(res.headers.location);
            } else {
              resolve(photoUrl);
            }
            res.resume();
          }).on('error', reject);
        });

        const timestamp = Math.floor(Date.now() / 1000);
        const sigStr = `timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
        const signature = crypto.createHash('sha1').update(sigStr).digest('hex');

        // Upload URL directly to Cloudinary
        const boundary = '----FormBoundary' + Math.random().toString(36).slice(2);
        const parts = [
          `--${boundary}\r\nContent-Disposition: form-data; name="timestamp"\r\n\r\n${timestamp}`,
          `--${boundary}\r\nContent-Disposition: form-data; name="api_key"\r\n\r\n${CLOUDINARY_API_KEY}`,
          `--${boundary}\r\nContent-Disposition: form-data; name="signature"\r\n\r\n${signature}`,
          `--${boundary}\r\nContent-Disposition: form-data; name="file"\r\n\r\n${finalUrl}`,
          `--${boundary}--`,
        ];
        const body = Buffer.from(parts.join('\r\n'));

        const cloudResult = await new Promise((resolve, reject) => {
          const options = {
            hostname: 'api.cloudinary.com',
            path: `/v1_1/${CLOUDINARY_CLOUD}/image/upload`,
            method: 'POST',
            headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}`, 'Content-Length': body.length }
          };
          const req = https.request(options, res => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve(JSON.parse(data)));
          });
          req.on('error', reject);
          req.write(body);
          req.end();
        });

        if (!cloudResult.secure_url) { console.log('  Upload failed:', cloudResult.error?.message); continue; }

        await prisma.campgroundPhoto.create({
          data: {
            campgroundId: camp.id,
            userId: FOUNDER_ID,
            imageUrl: cloudResult.secure_url,
            caption: cg.name,
            status: 'APPROVED',
          }
        });
        added++;
        console.log(`  ✓ Photo ${added} uploaded`);
        await new Promise(r => setTimeout(r, 500));
      } catch(e) {
        console.log(`  Photo error: ${e.message}`);
      }
    }
    console.log(`  Added ${added} photos for ${cg.name}`);
  }

  await prisma.$disconnect();
  console.log('\nAll done!');
}

main().catch(e => { console.error(e); process.exit(1); });
