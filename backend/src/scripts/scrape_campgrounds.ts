import { PrismaClient } from '@prisma/client';
import { v2 as cloudinary } from 'cloudinary';
import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const prisma = new PrismaClient() as any;

cloudinary.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// Download a URL to a temp file
async function downloadFile(url: string, dest: string): Promise<boolean> {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(dest);
    const req = proto.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      timeout: 15000,
    }, res => {
      if (res.statusCode !== 200) { file.close(); fs.unlink(dest, () => {}); resolve(false); return; }
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(true); });
    });
    req.on('error', () => { file.close(); fs.unlink(dest, () => {}); resolve(false); });
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

// Upload a local file to Cloudinary
async function uploadToCloudinary(filePath: string, folder: string, publicId: string): Promise<string | null> {
  try {
    const result = await cloudinary.uploader.upload(filePath, {
      folder: `rvunicorn/campgrounds/${folder}`,
      public_id: publicId,
      overwrite: false,
      resource_type: 'image',
    });
    return result.secure_url;
  } catch (e: any) {
    if (e.message?.includes('already exists')) {
      return `https://res.cloudinary.com/dy6eetmh7/image/upload/rvunicorn/campgrounds/${folder}/${publicId}`;
    }
    return null;
  }
}

// Fetch HTML from a URL
async function fetchHtml(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const proto = url.startsWith('https') ? https : http;
    let data = '';
    const req = proto.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      timeout: 15000,
    }, res => {
      if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        fetchHtml(res.headers.location as string).then(resolve);
        return;
      }
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

// Extract image URLs from HTML
function extractImages(html: string, baseUrl: string): string[] {
  const urls: string[] = [];
  // og:image meta tags (best quality)
  const ogMatches = html.matchAll(/property=["']og:image["'][^>]*content=["']([^"']+)["']/gi);
  for (const m of ogMatches) urls.push(m[1]);
  // img src tags
  const imgMatches = html.matchAll(/<img[^>]+src=["']([^"']+\.(jpg|jpeg|png|webp)[^"']*)["']/gi);
  for (const m of imgMatches) {
    const src = m[1];
    if (src.startsWith('http')) urls.push(src);
    else if (src.startsWith('/')) {
      const base = new URL(baseUrl);
      urls.push(`${base.protocol}//${base.host}${src}`);
    }
  }
  // Filter out tiny images, icons, logos
  return [...new Set(urls)].filter(u =>
    !u.includes('logo') && !u.includes('icon') && !u.includes('favicon') &&
    !u.includes('thumb') && !u.includes('avatar') && !u.includes('placeholder') &&
    u.length < 500
  ).slice(0, 8);
}

const CAMPGROUNDS = [
  {
    name: 'The Vineyards of Fredericksburg',
    state: 'TX',
    website: 'https://www.thevineyardsrvpark.com',
    slug: 'vineyards-fredericksburg',
    googlePlaceId: 'ChIJf9kqJNvdXIYRHHqCasj7B1M',
  },
  {
    name: 'Alamogordo/White Sands KOA',
    state: 'NM',
    website: 'https://koa.com/campgrounds/alamogordo/',
    slug: 'alamogordo-koa',
  },
  {
    name: 'Zephyr Cove RV & Campsite',
    state: 'NV',
    website: 'https://www.zephyrcove.com/lodging/zephyr-cove-rv-campground',
    slug: 'zephyr-cove',
  },
  {
    name: 'Gateway Luxury RV Resort ',
    state: 'UT',
    website: 'https://www.gatewayluxuryrvresort.com/',
    slug: 'gateway-luxury-rv',
  },
  {
    name: 'Alpine Valley RV Resort',
    state: 'WY',
    website: 'https://alpinevalleyresortwy.com/',
    slug: 'alpine-valley-wy',
  },
  {
    name: 'Buffalo Crossing RV Park',
    state: 'MT',
    website: 'https://www.buffalocrossingrvpark.com',
    slug: 'buffalo-crossing',
  },
  {
    name: 'Stanley RV + Camp',
    state: 'ID',
    website: 'https://stanleyrv.com',
    slug: 'stanley-rv-camp',
  },
  {
    name: 'Columbia River RV Park',
    state: 'WA',
    website: 'https://www.columbiariverfrontrvpark.com/',
    slug: 'columbia-river-rv',
  },
  {
    name: 'Meredith Lodging Pacific Shores',
    state: 'OR',
    website: 'https://www.meredith-lodging.com/properties/pacific-shores/',
    slug: 'pacific-shores-newport',
  },
  {
    name: 'Lighthouse Cove RV Park',
    state: 'CA',
    website: 'https://lighthousecoverv.com/',
    slug: 'lighthouse-cove-rv',
  },
];

async function processCampground(cg: typeof CAMPGROUNDS[0]) {
  const record = await prisma.campground.findFirst({ where: { name: cg.name, state: cg.state } });
  if (!record) { console.log(`  ⚠️  Not found in DB: ${cg.name}`); return; }

  console.log(`\n📍 ${cg.name}`);
  const tmpDir = os.tmpdir();
  const updates: any = {};

  // Fetch website HTML
  console.log(`  Fetching ${cg.website}...`);
  const html = await fetchHtml(cg.website);

  if (!html) {
    console.log(`  ❌ Could not fetch website`);
    return;
  }

  // Extract and upload images
  const imageUrls = extractImages(html, cg.website);
  console.log(`  Found ${imageUrls.length} images`);

  let mainImageUploaded = !!record.imageUrl;
  let photoCount = 0;

  for (let i = 0; i < Math.min(imageUrls.length, 6); i++) {
    const url = imageUrls[i];
    const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
    const tmpFile = path.join(tmpDir, `cg_${cg.slug}_${i}.${ext}`);

    const downloaded = await downloadFile(url, tmpFile);
    if (!downloaded) continue;

    const stat = fs.statSync(tmpFile);
    if (stat.size < 10000) { fs.unlinkSync(tmpFile); continue; } // skip tiny files

    const cloudUrl = await uploadToCloudinary(tmpFile, cg.slug, `photo_${i}`);
    fs.unlinkSync(tmpFile);

    if (!cloudUrl) continue;

    // First good image becomes the main imageUrl
    if (!mainImageUploaded && i === 0) {
      updates.imageUrl = cloudUrl;
      mainImageUploaded = true;
      console.log(`  ✅ Main image uploaded`);
    }

    // Save as CampgroundPhoto
    await prisma.campgroundPhoto.upsert({
      where: { id: `${record.id}-scraped-${i}` },
      create: {
        id: `${record.id}-scraped-${i}`,
        campgroundId: record.id,
        userId: 'cmlpeyk82005s3qause3sws7y',
        imageUrl: cloudUrl,
        caption: `${cg.name} photo ${i + 1}`,
        status: 'APPROVED',
      },
      update: { imageUrl: cloudUrl },
    }).catch(() => {
      // If upsert fails due to unique constraint, just create
      return prisma.campgroundPhoto.create({
        data: {
          campgroundId: record.id,
          imageUrl: cloudUrl,
          caption: `${cg.name} photo ${i + 1}`,
          source: 'scraped',
        },
      }).catch(() => {});
    });

    photoCount++;
    await delay(500);
  }

  console.log(`  📸 ${photoCount} photos saved`);

  // Add Google Maps embed URL for map
  if (!record.campgroundMapUrl && record.latitude && record.longitude) {
    updates.campgroundMapUrl = `https://www.google.com/maps/embed/v1/place?key=AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk&q=${encodeURIComponent(cg.name + ' ' + cg.state)}&center=${record.latitude},${record.longitude}&zoom=15`;
    console.log(`  🗺️  Map URL set`);
  }

  // Update record
  if (Object.keys(updates).length > 0) {
    await prisma.campground.update({ where: { id: record.id }, data: updates });
    console.log(`  ✅ DB updated`);
  } else {
    console.log(`  ℹ️  No updates needed`);
  }

  await delay(1000);
}

async function main() {
  console.log('🏕️  Scraping Roberts trip campgrounds...\n');
  for (const cg of CAMPGROUNDS) {
    await processCampground(cg);
  }
  await prisma.$disconnect();
  console.log('\n✅ All done!');
}

main().catch(e => { console.error(e); process.exit(1); });
