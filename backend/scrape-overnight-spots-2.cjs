const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const CHAINS = [
  { name: 'Flying J', category: 'TRUCK_STOP', query: 'Flying J Travel Center', hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
  { name: 'Sapp Bros', category: 'TRUCK_STOP', query: 'Sapp Bros Travel Center', hasFuel: true, hasShowers: true, is24Hours: true },
  { name: 'Kwik Trip', category: 'GAS_STATION', query: 'Kwik Trip', hasFuel: true, hasFood: true, is24Hours: true },
  { name: 'Maverik', category: 'GAS_STATION', query: 'Maverik Adventure First Stop', hasFuel: true, hasFood: true, is24Hours: true },
  { name: 'Sheetz', category: 'GAS_STATION', query: 'Sheetz', hasFuel: true, hasFood: true, is24Hours: true },
  { name: 'Wawa', category: 'GAS_STATION', query: 'Wawa', hasFuel: true, hasFood: true, is24Hours: true },
  { name: "Casey's", category: 'GAS_STATION', query: "Casey's General Store", hasFuel: true, hasFood: true },
  { name: 'Speedway', category: 'GAS_STATION', query: 'Speedway Gas Station', hasFuel: true, is24Hours: true },
  { name: 'Gander Outdoors', category: 'OUTDOOR_RETAIL', query: 'Gander Outdoors' },
  { name: 'Rural King', category: 'FARM_RANCH', query: 'Rural King Store' },
  { name: 'Bomgaars', category: 'FARM_RANCH', query: 'Bomgaars' },
  { name: 'Farm Fleet', category: 'FARM_RANCH', query: "Blain's Farm and Fleet" },
  { name: 'Orscheln', category: 'FARM_RANCH', query: 'Orscheln Farm Home' },
  { name: 'Wilco Farm', category: 'FARM_RANCH', query: 'Wilco Farm Store' },
  { name: 'Ace Hardware', category: 'HARDWARE', query: 'Ace Hardware' },
  { name: "Culver's", category: 'RESTAURANT', query: "Culver's Restaurant", hasFood: true },
  { name: 'Waffle House', category: 'RESTAURANT', query: 'Waffle House', hasFood: true, is24Hours: true },
  { name: 'IHOP', category: 'RESTAURANT', query: 'IHOP Restaurant', hasFood: true },
  { name: 'Elks Lodge', category: 'LODGE', query: 'Elks Lodge' },
  { name: 'Moose Lodge', category: 'LODGE', query: 'Moose Lodge' },
  { name: 'American Legion', category: 'LODGE', query: 'American Legion Post' },
  { name: 'VFW Post', category: 'LODGE', query: 'VFW Post Veterans' },
  { name: 'Kroger', category: 'GROCERY', query: 'Kroger Marketplace' },
  { name: 'Albertsons', category: 'GROCERY', query: 'Albertsons Grocery' },
  { name: 'WinCo Foods', category: 'GROCERY', query: 'WinCo Foods' },
  { name: 'Wegmans', category: 'GROCERY', query: 'Wegmans Food Markets' },
  { name: 'HEB', category: 'GROCERY', query: 'HEB Grocery' },
  { name: 'Hy-Vee', category: 'GROCERY', query: 'Hy-Vee Grocery' },
  { name: 'Target', category: 'RETAIL', query: 'Target Store' },
];

const US_GRID = [
  { lat: 42.36, lng: -71.06 }, { lat: 40.71, lng: -74.01 }, { lat: 39.95, lng: -75.17 },
  { lat: 38.91, lng: -77.04 }, { lat: 43.05, lng: -76.15 }, { lat: 35.23, lng: -80.84 },
  { lat: 33.75, lng: -84.39 }, { lat: 30.33, lng: -81.66 }, { lat: 25.77, lng: -80.19 },
  { lat: 27.95, lng: -82.46 }, { lat: 30.69, lng: -88.04 }, { lat: 35.15, lng: -90.05 },
  { lat: 36.17, lng: -86.78 }, { lat: 38.25, lng: -85.76 }, { lat: 39.10, lng: -84.51 },
  { lat: 41.88, lng: -87.63 }, { lat: 44.98, lng: -93.27 }, { lat: 41.60, lng: -93.61 },
  { lat: 39.10, lng: -94.58 }, { lat: 38.63, lng: -90.20 }, { lat: 43.05, lng: -89.40 },
  { lat: 41.50, lng: -81.69 }, { lat: 40.44, lng: -79.99 }, { lat: 42.33, lng: -83.05 },
  { lat: 29.76, lng: -95.37 }, { lat: 30.27, lng: -97.74 }, { lat: 29.42, lng: -98.49 },
  { lat: 32.78, lng: -96.80 }, { lat: 35.47, lng: -97.52 }, { lat: 36.15, lng: -95.99 },
  { lat: 39.74, lng: -104.99 }, { lat: 35.08, lng: -106.65 }, { lat: 40.76, lng: -111.89 },
  { lat: 43.62, lng: -116.20 }, { lat: 46.60, lng: -112.03 }, { lat: 47.67, lng: -117.43 },
  { lat: 44.06, lng: -103.23 }, { lat: 46.88, lng: -102.79 }, { lat: 43.54, lng: -96.73 },
  { lat: 41.26, lng: -95.94 }, { lat: 37.69, lng: -97.34 }, { lat: 33.45, lng: -112.07 },
  { lat: 32.22, lng: -110.97 }, { lat: 36.17, lng: -115.14 }, { lat: 34.05, lng: -118.24 },
  { lat: 32.72, lng: -117.16 }, { lat: 37.77, lng: -122.42 }, { lat: 38.58, lng: -121.49 },
  { lat: 47.61, lng: -122.33 }, { lat: 45.52, lng: -122.68 }, { lat: 44.05, lng: -121.31 },
  { lat: 44.94, lng: -123.03 }, { lat: 41.66, lng: -83.56 }, { lat: 36.75, lng: -119.77 },
  { lat: 44.32, lng: -105.50 }, { lat: 42.86, lng: -106.32 }, { lat: 35.68, lng: -105.94 },
  { lat: 31.76, lng: -106.49 }, { lat: 30.45, lng: -91.19 }, { lat: 29.95, lng: -90.07 },
  { lat: 32.30, lng: -90.18 }, { lat: 43.05, lng: -76.15 }, { lat: 44.48, lng: -73.21 },
];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function googleSearch(query, lat, lng) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=80000&key=${GOOGLE_API_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(e); } });
    }).on('error', reject);
  });
}

async function collectChain(chain, point) {
  try {
    const result = await googleSearch(chain.query, point.lat, point.lng);
    if (!result.results) return 0;
    let count = 0;
    for (const place of result.results) {
      if (!place.geometry?.location) continue;
      const { lat, lng } = place.geometry.location;
      const existing = await prisma.freeOvernightSpot.findFirst({ where: { googlePlaceId: place.place_id } });
      if (existing) continue;
      await prisma.freeOvernightSpot.create({
        data: {
          name: place.name, chain: chain.name, category: chain.category,
          address: place.formatted_address || null,
          latitude: lat, longitude: lng,
          is24Hours: chain.is24Hours || false, hasFuel: chain.hasFuel || false,
          hasFood: chain.hasFood || false, hasShowers: chain.hasShowers || false,
          allowsRvs: true, verified: false, googlePlaceId: place.place_id,
          rating: place.rating || null,
          sourceData: JSON.stringify({ name: place.name, vicinity: place.vicinity }),
        }
      });
      count++;
    }
    return count;
  } catch(e) {
    if (e.message?.includes('OVER_QUERY_LIMIT')) await sleep(2000);
    return 0;
  }
}

async function main() {
  console.log('Starting batch 2...');
  let total = 0;
  for (const chain of CHAINS) {
    console.log(`\n📍 ${chain.name}...`);
    let chainCount = 0;
    for (const point of US_GRID) {
      const count = await collectChain(chain, point);
      chainCount += count; total += count;
      if (count > 0) process.stdout.write(`+${count} `);
      await sleep(150);
    }
    console.log(`\n  ${chain.name}: ${chainCount}`);
  }
  const finalCount = await prisma.freeOvernightSpot.count();
  console.log(`\nTotal in DB: ${finalCount}`);
  await prisma.$disconnect();
}

main().catch(console.error);
