/**
 * Admin endpoint to trigger the OSM place seeder from Railway.
 * POST /api/admin/seed-places — runs the seeder in-process.
 * Protected by a simple secret token.
 */
import { Router } from 'express';
import { prisma } from '../lib/prisma';

const router = Router();
const db = prisma as any;
const https = require('https');

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://z.overpass-api.de/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];
const CELL_SIZE = 0.36;
const RADIUS_METERS = 40234; // 25 miles
const RADIUS_RESTAURANT = 16093; // 10 miles for dense categories

const CATEGORY_QUERIES = [
  { category: 'RESTAURANT', query: `node["amenity"~"restaurant|cafe|fast_food"](around:${RADIUS_RESTAURANT},{LAT},{LNG});` },
  { category: 'HIKING_TRAIL', query: `way["highway"="path"]["sac_scale"](around:${RADIUS_METERS},{LAT},{LNG});relation["route"="hiking"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'ATTRACTION', query: `node["tourism"~"attraction|theme_park"](around:${RADIUS_METERS},{LAT},{LNG});node["leisure"="water_park"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'SCENIC_OVERLOOK', query: `node["tourism"="viewpoint"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'MUSEUM', query: `node["tourism"="museum"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'VISITOR_CENTER', query: `node["tourism"="information"]["information"="office"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'OUTFITTER', query: `node["shop"~"outdoor|sports"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'CAMP_STORE', query: `node["shop"~"convenience|general"](around:${RADIUS_RESTAURANT},{LAT},{LNG});` },
  { category: 'RV_SERVICE', query: `node["shop"="car_repair"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'LANDMARK', query: `node["historic"](around:${RADIUS_METERS},{LAT},{LNG});node["tourism"="artwork"](around:${RADIUS_METERS},{LAT},{LNG});` },
  { category: 'OVERNIGHT_STOP', query: `node["tourism"~"caravan_site|motel|hostel"](around:${RADIUS_METERS},{LAT},{LNG});` },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }
function normalize(name: string) { return (name || '').toLowerCase().replace(/[^a-z0-9]/g, ''); }

function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function httpFetch(url: string, postData: string): Promise<{ status: number; data: string }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = `data=${encodeURIComponent(postData)}`;
    const req = https.request(parsed, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
        'User-Agent': 'RVUnicorn/1.0 (https://www.rvunicorn.com)',
        'Accept': 'application/json',
      },
    }, (res: any) => {
      let data = '';
      res.on('data', (d: string) => data += d);
      res.on('end', () => resolve({ status: res.statusCode, data }));
    });
    req.on('error', reject);
    req.setTimeout(60000, () => { req.destroy(); reject(new Error('Timeout')); });
    req.write(body);
    req.end();
  });
}

async function overpassQuery(query: string, retries = 3): Promise<any> {
  const fullQuery = `[out:json][timeout:60];(${query});out body center 200;`;
  for (let attempt = 0; attempt < retries; attempt++) {
    const baseUrl = OVERPASS_URLS[attempt % OVERPASS_URLS.length];
    try {
      const res = await httpFetch(baseUrl, fullQuery);
      if (res.status === 200) return JSON.parse(res.data);
      if (res.status === 429 || res.status === 504 || res.status === 503) {
        await sleep(Math.pow(2, attempt + 1) * 5000);
        continue;
      }
    } catch {
      if (attempt < retries - 1) await sleep(3000);
    }
  }
  return null;
}

function extractAddress(tags: any) {
  return {
    address: [tags['addr:housenumber'], tags['addr:street']].filter(Boolean).join(' ') || null,
    city: tags['addr:city'] || null,
    state: tags['addr:state'] || null,
    zip: tags['addr:postcode'] || null,
  };
}

// In-memory progress tracking
let seedingActive = false;
let seedProgress = { cellsDone: 0, totalCells: 0, created: 0, skipped: 0, errors: 0, currentCell: '' };

router.get('/seed-places/status', (req, res) => {
  res.json({ active: seedingActive, ...seedProgress });
});

router.post('/seed-places', async (req, res) => {
  const token = req.headers['x-seed-token'] || req.query.token;
  if (token !== (process.env.SEED_TOKEN || 'rvunicorn-seed-2026')) {
    return res.status(403).json({ error: 'Invalid seed token' });
  }

  if (seedingActive) return res.json({ message: 'Seeder already running', ...seedProgress });

  // Start seeding in background
  seedingActive = true;
  seedProgress = { cellsDone: 0, totalCells: 0, created: 0, skipped: 0, errors: 0, currentCell: '' };
  res.json({ message: 'Seeder started', status: 'running' });

  // Run async
  (async () => {
    try {
      const campgrounds = await db.campground.findMany({
        where: { latitude: { not: null }, longitude: { not: null } },
        select: { latitude: true, longitude: true },
      });

      const cellSet = new Set<string>();
      for (const c of campgrounds) {
        const cellLat = Math.round(c.latitude / CELL_SIZE) * CELL_SIZE;
        const cellLng = Math.round(c.longitude / CELL_SIZE) * CELL_SIZE;
        cellSet.add(`${cellLat.toFixed(2)},${cellLng.toFixed(2)}`);
      }

      const cells = Array.from(cellSet).map(s => {
        const [lat, lng] = s.split(',').map(Number);
        return { lat, lng, key: s };
      });

      const batchSize = parseInt(req.query.batch as string) || cells.length;
      const startFrom = parseInt(req.query.start as string) || 0;
      const cellsToProcess = cells.slice(startFrom, startFrom + batchSize);
      seedProgress.totalCells = cellsToProcess.length;

      for (let ci = 0; ci < cellsToProcess.length; ci++) {
        const cell = cellsToProcess[ci];
        seedProgress.currentCell = cell.key;
        seedProgress.cellsDone = ci;

        for (const catDef of CATEGORY_QUERIES) {
          const query = catDef.query.replace(/{LAT}/g, String(cell.lat)).replace(/{LNG}/g, String(cell.lng));
          const result = await overpassQuery(query);

          if (!result?.elements) { seedProgress.errors++; continue; }

          let elements = result.elements.filter((e: any) => e.tags?.name);
          if (catDef.category === 'RV_SERVICE') {
            elements = elements.filter((e: any) => /\brv\b|caravan|trailer|motorhome|camper/i.test(e.tags.name));
          }
          if (elements.length > 200) elements = elements.slice(0, 200);

          for (const el of elements) {
            const name = el.tags.name;
            if (!name || name.length < 2) continue;
            const lat = el.lat || el.center?.lat;
            const lng = el.lon || el.center?.lon;
            if (!lat || !lng) continue;
            const osmId = `osm-${el.type}-${el.id}`;

            try {
              const existing = await db.place.findFirst({ where: { googlePlaceId: osmId }, select: { id: true } });
              if (existing) { seedProgress.skipped++; continue; }
            } catch {}

            try {
              const nearby = await db.place.findMany({
                where: { latitude: { gte: lat - 0.005, lte: lat + 0.005 }, longitude: { gte: lng - 0.005, lte: lng + 0.005 } },
                select: { name: true, latitude: true, longitude: true },
              });
              if (nearby.some((n: any) => normalize(n.name) === normalize(name) && distanceMeters(lat, lng, n.latitude, n.longitude) < 500)) {
                seedProgress.skipped++; continue;
              }
            } catch {}

            const addr = extractAddress(el.tags);
            try {
              await db.place.create({
                data: {
                  name, category: catDef.category, latitude: lat, longitude: lng,
                  address: addr.address, city: addr.city, state: addr.state, zip: addr.zip,
                  website: el.tags.website || el.tags['contact:website'] || null,
                  googlePlaceId: osmId, status: 'ACTIVE',
                },
              });
              seedProgress.created++;
            } catch (e: any) {
              if (e.code === 'P2002') seedProgress.skipped++;
              else seedProgress.errors++;
            }
          }
          await sleep(1500);
        }
        await sleep(2000);
      }
    } catch (e: any) {
      console.error('[Seeder] fatal:', e.message);
    } finally {
      seedingActive = false;
      console.log('[Seeder] Complete:', JSON.stringify(seedProgress));
    }
  })();
});

export default router;
