/**
 * Backfill missing zip codes for OvernightStop records
 * and city/state/zip for NearbyExperience records
 * using Google Geocoding API reverse lookup from lat/lng.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

if (!GOOGLE_KEY) {
  console.error('GOOGLE_MAPS_API_KEY not set');
  process.exit(1);
}

interface GeoResult {
  city?: string;
  state?: string;
  zip?: string;
}

async function reverseGeocode(lat: number, lng: number): Promise<GeoResult> {
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}&result_type=street_address|locality|postal_code`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) return {};
  const data: any = await res.json();
  const results = data.results || [];

  let city = '';
  let state = '';
  let zip = '';

  for (const result of results) {
    for (const comp of result.address_components || []) {
      if (!city && comp.types.includes('locality')) city = comp.long_name;
      if (!state && comp.types.includes('administrative_area_level_1')) state = comp.short_name;
      if (!zip && comp.types.includes('postal_code')) zip = comp.long_name;
    }
    if (city && state && zip) break;
  }

  return { city: city || undefined, state: state || undefined, zip: zip || undefined };
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function backfillOvernightStops() {
  const stops = await prisma.overnightStop.findMany({
    where: { zip: null },
    select: { id: true, name: true, latitude: true, longitude: true, city: true, state: true },
  });

  console.log(`\n=== OvernightStop: ${stops.length} records missing zip ===`);
  let updated = 0;
  let failed = 0;

  for (let i = 0; i < stops.length; i++) {
    const s = stops[i];
    try {
      const geo = await reverseGeocode(s.latitude, s.longitude);
      if (geo.zip) {
        const updateData: any = { zip: geo.zip };
        // Also fill city/state if missing
        if (!s.city && geo.city) updateData.city = geo.city;
        if (!s.state && geo.state) updateData.state = geo.state;
        await prisma.overnightStop.update({ where: { id: s.id }, data: updateData });
        updated++;
      } else {
        failed++;
      }
      if ((i + 1) % 50 === 0) {
        console.log(`  Progress: ${i + 1}/${stops.length} (${updated} updated, ${failed} no zip found)`);
      }
      // Rate limit: ~20 QPS
      await sleep(50);
    } catch (err: any) {
      failed++;
      console.error(`  Error on ${s.name}: ${err.message}`);
      await sleep(200);
    }
  }

  console.log(`OvernightStop done: ${updated} updated, ${failed} failed out of ${stops.length}`);
}

async function backfillNearbyExperiences() {
  const exps = await prisma.nearbyExperience.findMany({
    where: { OR: [{ city: null }, { state: null }, { zip: null }] },
    select: { id: true, name: true, latitude: true, longitude: true, address: true },
  });

  console.log(`\n=== NearbyExperience: ${exps.length} records missing city/state/zip ===`);
  let updated = 0;

  for (const e of exps) {
    if (!e.latitude || !e.longitude) {
      console.log(`  Skipping ${e.name}: no lat/lng`);
      continue;
    }
    try {
      const geo = await reverseGeocode(e.latitude, e.longitude);
      const updateData: any = {};
      if (geo.city) updateData.city = geo.city;
      if (geo.state) updateData.state = geo.state;
      if (geo.zip) updateData.zip = geo.zip;
      if (Object.keys(updateData).length > 0) {
        await prisma.nearbyExperience.update({ where: { id: e.id }, data: updateData });
        updated++;
        console.log(`  Updated ${e.name}: ${geo.city}, ${geo.state} ${geo.zip}`);
      }
      await sleep(50);
    } catch (err: any) {
      console.error(`  Error on ${e.name}: ${err.message}`);
    }
  }

  console.log(`NearbyExperience done: ${updated} updated out of ${exps.length}`);
}

async function main() {
  console.log('Starting zip code backfill...');
  await backfillOvernightStops();
  await backfillNearbyExperiences();
  console.log('\nBackfill complete!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
