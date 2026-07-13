/**
 * End-to-end upload test against PRODUCTION.
 * Mimics exactly what the frontend uploadMedia.ts does.
 *
 * Usage: node scripts/test-upload.js
 */

const https = require('https');
const http = require('http');
const crypto = require('crypto');

const BACKEND = 'https://rvunicorn-production.up.railway.app';
const WILL_ID = 'cmlpeyk82005s3qause3sws7y';
const TRIP_ID = 'cmqpwzbtj000weyy8wb89hofv';
const JWT_SECRET = 'your-super-secret-jwt-key-change-this-to-something-secure';

// Generate a valid JWT (same as backend auth)
function makeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    userId: WILL_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${sig}`;
}

// Simple fetch helper
function request(url, opts = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(parsed, {
      method: opts.method || 'GET',
      headers: opts.headers || {},
    }, (res) => {
      let body = '';
      res.on('data', (d) => body += d);
      res.on('end', () => {
        resolve({ status: res.statusCode, headers: res.headers, body });
      });
    });
    req.on('error', reject);
    req.setTimeout(30000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (opts.body) req.write(opts.body);
    req.end();
  });
}

// Generate a test JPEG (valid minimal JFIF)
function makeTestJpeg() {
  // Minimal valid JPEG: SOI + APP0 (JFIF) + DQT + SOF0 + DHT + SOS + image data + EOI
  // This creates a valid 1x1 red pixel JPEG
  return Buffer.from([
    0xFF, 0xD8, // SOI
    0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, // APP0
    0xFF, 0xDB, 0x00, 0x43, 0x00, // DQT
    0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09, 0x09, 0x08, 0x0A, 0x0C, 0x14,
    0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12, 0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A,
    0x1C, 0x1C, 0x20, 0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29, 0x2C,
    0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32, 0x3C, 0x2E, 0x33, 0x34, 0x32,
    0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00, // SOF0 1x1
    0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00, 0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08, 0x09, 0x0A, 0x0B, // DHT
    0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03, 0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04,
    0x04, 0x00, 0x00, 0x01, 0x7D, 0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41,
    0x06, 0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08, 0x23, 0x42, 0xB1,
    0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72, 0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19,
    0x1A, 0x25, 0x26, 0x27, 0x28, 0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44,
    0x45, 0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59, 0x5A, 0x63, 0x64,
    0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75, 0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84,
    0x85, 0x86, 0x87, 0x88, 0x89, 0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2,
    0xA3, 0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6, 0xB7, 0xB8, 0xB9,
    0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9, 0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7,
    0xD8, 0xD9, 0xDA, 0xE1, 0xE2, 0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3,
    0xF4, 0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, // DHT AC
    0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00, 0x7B, 0x94, 0x11, 0x00, // SOS
    0xFF, 0xD9, // EOI
  ]);
}

async function main() {
  const token = makeJwt();
  console.log('TOKEN:', token.slice(0, 30) + '...');

  // ── STAGE 1: Sign ──
  console.log('\n── STAGE 1: GET /api/upload/sign ──');
  const folder = `rvunicorn/trip-photos/${TRIP_ID}`;
  const signRes = await request(`${BACKEND}/api/upload/sign?folder=${encodeURIComponent(folder)}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  console.log('Status:', signRes.status);
  console.log('Body:', signRes.body);
  if (signRes.status !== 200) {
    console.error('FAILED at SIGN stage');
    process.exit(1);
  }
  const signData = JSON.parse(signRes.body);
  console.log('OK — signature:', signData.signature?.slice(0, 20) + '...');

  // ── STAGE 2: Upload to Cloudinary ──
  // Build multipart form EXACTLY like the frontend XHR does
  console.log('\n── STAGE 2: POST to Cloudinary ──');
  const boundary = '----FormBoundary' + crypto.randomBytes(8).toString('hex');
  const jpegData = makeTestJpeg();

  const parts = [];
  const addField = (name, value) => {
    parts.push(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`);
  };
  // These fields MUST match uploadMedia.ts exactly:
  // file, api_key, timestamp, signature, folder — nothing else
  addField('api_key', signData.apiKey);
  addField('timestamp', String(signData.timestamp));
  addField('signature', signData.signature);
  addField('folder', signData.folder);

  const fileHeader = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`;
  const fileFooter = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    ...parts.map(p => Buffer.from(p)),
    Buffer.from(fileHeader),
    jpegData,
    Buffer.from(fileFooter),
  ]);

  const cloudRes = await request(`https://api.cloudinary.com/v1_1/${signData.cloudName}/image/upload`, {
    method: 'POST',
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
    body,
  });
  console.log('Status:', cloudRes.status);
  console.log('Body:', cloudRes.body.slice(0, 500));
  if (cloudRes.status !== 200) {
    console.error('FAILED at CLOUDINARY stage');
    process.exit(1);
  }
  const cloudData = JSON.parse(cloudRes.body);
  console.log('OK — URL:', cloudData.secure_url);
  console.log('OK — public_id:', cloudData.public_id);

  // ── STAGE 3: Save to backend ──
  console.log('\n── STAGE 3: POST /api/upload/trip/:tripId/save-photo ──');
  const saveBody = JSON.stringify({
    url: cloudData.secure_url,
    publicId: cloudData.public_id,
    caption: 'E2E test photo — delete me',
  });
  const saveRes = await request(`${BACKEND}/api/upload/trip/${TRIP_ID}/save-photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: saveBody,
  });
  console.log('Status:', saveRes.status);
  console.log('Body:', saveRes.body);
  if (saveRes.status !== 200) {
    console.error('FAILED at RECORD stage');
    process.exit(1);
  }
  const saveData = JSON.parse(saveRes.body);
  console.log('OK — photoId:', saveData.photoId);

  // ── STAGE 4: Verify photo exists ──
  console.log('\n── STAGE 4: Verify photo in database ──');
  console.log('Photo URL:', cloudData.secure_url);
  console.log('Photo ID:', saveData.photoId);

  console.log('\n══════════════════════════════════');
  console.log('ALL STAGES PASSED');
  console.log('══════════════════════════════════');
  console.log('Test photo URL:', cloudData.secure_url);
  console.log('Photo record ID:', saveData.photoId);
  console.log('\nTo clean up: delete photo record', saveData.photoId);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
