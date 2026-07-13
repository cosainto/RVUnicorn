/**
 * Seed Places from OpenStreetMap Overpass API.
 * Cursor-batched, resumable, rate-limited.
 *
 * Usage:
 *   TEST_CELLS=5 node scripts/seed-places-osm.js   # test with 5 cells
 *   node scripts/seed-places-osm.js                 # full run
 *
 * Resumes from last completed cell (writes progress to seed-places-progress.json).
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();
const PROGRESS_FILE = path.join(__dirname, 'seed-places-progress.json');
const SUMMARY_FILE = path.join(__dirname, 'seed-places-summary.json');
const CELL_SIZE = 0.36; // ~25 miles
const RADIUS_METERS = 40234; // 25 miles in meters
// Primary and fallback Overpass API servers
const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const TEST_CELLS = parseInt(process.env.TEST_CELLS || '0');

// ── Category mapping: OSM tags → RVUnicorn category ──
const RADIUS_RESTAURANT = 16093; // 10 miles for high-density categories
const CATEGORY_QUERIES = [
  {
    category: 'RESTAURANT',
    query: `node["amenity"~"restaurant|cafe|fast_food"](around:${RADIUS_RESTAURANT},{LAT},{LNG});`,
  },
  {
    category: 'HIKING_TRAIL',
    query: `way["highway"="path"]["sac_scale"](around:${RADIUS_METERS},{LAT},{LNG});relation["route"="hiking"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'ATTRACTION',
    query: `node["tourism"~"attraction|theme_park"](around:${RADIUS_METERS},{LAT},{LNG});node["leisure"="water_park"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'SCENIC_OVERLOOK',
    query: `node["tourism"="viewpoint"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'MUSEUM',
    query: `node["tourism"="museum"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'VISITOR_CENTER',
    query: `node["tourism"="information"]["information"="office"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'OUTFITTER',
    query: `node["shop"~"outdoor|sports"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'CAMP_STORE',
    query: `node["shop"~"convenience|general"](around:${RADIUS_RESTAURANT},{LAT},{LNG});`,
  },
  {
    category: 'RV_SERVICE',
    query: `node["shop"="car_repair"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'LANDMARK',
    query: `node["historic"](around:${RADIUS_METERS},{LAT},{LNG});node["tourism"="artwork"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
  {
    category: 'OVERNIGHT_STOP',
    query: `node["tourism"~"caravan_site|motel|hostel"](around:${RADIUS_METERS},{LAT},{LNG});`,
  },
];

// ── Helpers ──

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function normalize(name) {
  return (name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function httpFetch(url, postData) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const mod = parsed.protocol === 'https:' ? https : http;
    const body = postData ? `data=${encodeURIComponent(postData)}` : null;
    const opts = {
      method: body ? 'POST' : 'GET',
      headers: {
        'User-Agent': 'RVUnicorn/1.0 (https://www.rvunicorn.com; contact@rvunicorn.com)',
        'Accept': 'application/json',
        ...(body ? {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        } : {}),
      },
    };
    const req = mod.request(parsed, opts, (res) => {
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    if (body) req.write(body);
    req.end();
  });
}

async function overpassQuery(query, retries = 3) {
  const fullQuery = `[out:json][timeout:60];(${query});out body center 200;`;

  for (let attempt = 0; attempt < retries; attempt++) {
    const baseUrl = OVERPASS_URLS[attempt % OVERPASS_URLS.length];
    try {
      const res = await httpFetch(baseUrl, fullQuery);
      if (res.status === 200) {
        return JSON.parse(res.data);
      }
      if (res.status === 429 || res.status === 504 || res.status === 503) {
        const wait = Math.pow(2, attempt + 1) * 5000;
        console.log(`    Rate limited (${res.status}), waiting ${wait / 1000}s...`);
        await sleep(wait);
        continue;
      }
      console.error(`    Overpass error ${res.status}:`, res.data.slice(0, 200));
    } catch (e) {
      console.error(`    Overpass fetch error (${baseUrl.split('/')[2]}):`, e.message);
      if (attempt < retries - 1) await sleep(3000);
    }
  }
  return null;
}

function extractAddress(tags) {
  return {
    address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null,
    city: tags['addr:city'] || null,
    state: tags['addr:state'] || null,
    zip: tags['addr:postcode'] || null,
  };
}

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Main ──

async function main() {
  // Load progress
  let progress = {};
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); } catch {}
  let summary = {};
  try { summary = JSON.parse(fs.readFileSync(SUMMARY_FILE, 'utf8')); } catch {}

  // Build grid cells from campground coordinates
  const campgrounds = await prisma.campground.findMany({
    where: { latitude: { not: null }, longitude: { not: null } },
    select: { latitude: true, longitude: true },
  });

  const cellSet = new Set();
  for (const c of campgrounds) {
    const cellLat = Math.round(c.latitude / CELL_SIZE) * CELL_SIZE;
    const cellLng = Math.round(c.longitude / CELL_SIZE) * CELL_SIZE;
    cellSet.add(`${cellLat.toFixed(2)},${cellLng.toFixed(2)}`);
  }

  let cells = Array.from(cellSet).map(s => {
    const [lat, lng] = s.split(',').map(Number);
    return { lat, lng, key: s };
  });

  if (TEST_CELLS > 0) {
    cells = cells.slice(0, TEST_CELLS);
    console.log(`TEST MODE: processing ${TEST_CELLS} cells only`);
  }

  console.log(`Total cells: ${cells.length}, already done: ${Object.keys(progress).length}`);

  let totalCreated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let ci = 0; ci < cells.length; ci++) {
    const cell = cells[ci];
    if (progress[cell.key]) {
      continue; // Already processed
    }

    console.log(`\n[${ci + 1}/${cells.length}] Cell ${cell.key} (${cell.lat}, ${cell.lng})`);
    const cellSummary = {};

    for (const catDef of CATEGORY_QUERIES) {
      const query = catDef.query.replace(/{LAT}/g, cell.lat).replace(/{LNG}/g, cell.lng);
      const result = await overpassQuery(query);

      if (!result || !result.elements) {
        console.log(`  ${catDef.category}: ERROR`);
        cellSummary[catDef.category] = { found: 0, created: 0, skipped: 0, error: true };
        totalErrors++;
        continue;
      }

      let elements = result.elements.filter(e => e.tags?.name);

      // RV_SERVICE: filter by name containing RV-related keywords
      if (catDef.category === 'RV_SERVICE') {
        elements = elements.filter(e => {
          const name = (e.tags.name || '').toLowerCase();
          return /\brv\b|caravan|trailer|motorhome|camper/.test(name);
        });
      }

      // Cap at 200 nearest per category per cell
      if (elements.length > 200) {
        elements.sort((a, b) => {
          const latA = a.lat || a.center?.lat || 0;
          const lngA = a.lon || a.center?.lon || 0;
          const latB = b.lat || b.center?.lat || 0;
          const lngB = b.lon || b.center?.lon || 0;
          return distanceMeters(cell.lat, cell.lng, latA, lngA) - distanceMeters(cell.lat, cell.lng, latB, lngB);
        });
        elements = elements.slice(0, 200);
      }

      let created = 0;
      let skipped = 0;

      for (const el of elements) {
        const name = el.tags.name;
        if (!name || name.length < 2) { skipped++; continue; }

        const lat = el.lat || el.center?.lat;
        const lng = el.lon || el.center?.lon;
        if (!lat || !lng) { skipped++; continue; }

        const osmId = `osm-${el.type}-${el.id}`;

        // Check for existing place with same osmId
        try {
          const existing = await prisma.place.findFirst({
            where: { googlePlaceId: osmId },
            select: { id: true },
          });
          if (existing) { skipped++; continue; }
        } catch {}

        // Dedup: check for normalized-similar name within 500m
        try {
          const nearby = await prisma.place.findMany({
            where: {
              latitude: { gte: lat - 0.005, lte: lat + 0.005 },
              longitude: { gte: lng - 0.005, lte: lng + 0.005 },
            },
            select: { name: true, latitude: true, longitude: true },
          });
          const normalizedName = normalize(name);
          const hasDupe = nearby.some(n =>
            normalize(n.name) === normalizedName &&
            distanceMeters(lat, lng, n.latitude, n.longitude) < 500
          );
          if (hasDupe) { skipped++; continue; }
        } catch {}

        // Also check against campgrounds
        try {
          const nearCampgrounds = await prisma.campground.findMany({
            where: {
              latitude: { gte: lat - 0.005, lte: lat + 0.005 },
              longitude: { gte: lng - 0.005, lte: lng + 0.005 },
            },
            select: { name: true, latitude: true, longitude: true },
          });
          const normalizedName = normalize(name);
          const hasCampDupe = nearCampgrounds.some(c =>
            normalize(c.name) === normalizedName &&
            distanceMeters(lat, lng, c.latitude, c.longitude) < 500
          );
          if (hasCampDupe) { skipped++; continue; }
        } catch {}

        const addr = extractAddress(el.tags);

        try {
          await prisma.place.create({
            data: {
              name,
              category: catDef.category,
              latitude: lat,
              longitude: lng,
              address: addr.address,
              city: addr.city,
              state: addr.state,
              zip: addr.zip,
              website: el.tags.website || el.tags['contact:website'] || null,
              googlePlaceId: osmId, // Reuse this unique field for OSM dedup
              status: 'ACTIVE',
            },
          });
          created++;
          totalCreated++;
        } catch (e) {
          if (e.code === 'P2002') { skipped++; } // Unique constraint — duplicate
          else { console.error(`    Create error:`, e.message?.slice(0, 100)); totalErrors++; }
        }
      }

      console.log(`  ${catDef.category}: ${elements.length} found, ${created} created, ${skipped} skipped`);
      cellSummary[catDef.category] = { found: elements.length, created, skipped };
      totalSkipped += skipped;

      // Rate limit: sleep between category queries
      await sleep(1500);
    }

    // Mark cell complete
    progress[cell.key] = { completedAt: new Date().toISOString(), summary: cellSummary };
    summary[cell.key] = cellSummary;
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
    fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2));

    // Sleep between cells
    await sleep(2000);
  }

  console.log(`\n═══════════════════════════════════`);
  console.log(`COMPLETE`);
  console.log(`Created: ${totalCreated}`);
  console.log(`Skipped: ${totalSkipped}`);
  console.log(`Errors: ${totalErrors}`);
  console.log(`═══════════════════════════════════`);
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); }).finally(() => prisma.$disconnect());
