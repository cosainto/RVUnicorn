/**
 * Seed well-known RV-friendly overnight stop chains using Google Places Text Search API.
 *
 * Usage:  npx ts-node src/scripts/seedOvernightChains.ts
 *
 * Searches major US metro regions for each chain to get broad coverage.
 * Creates OvernightStop records with chain, stopType, placeId, lat/lng.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY || process.env.GOOGLE_API_KEY || '';
const GOOGLE_BASE = 'https://maps.googleapis.com/maps/api/place';

interface ChainConfig {
  query: string;
  chain: string;
  stopType: string; // RETAIL | FUEL_CENTER | REST_AREA
}

const CHAINS: ChainConfig[] = [
  { query: 'Cracker Barrel Old Country Store', chain: 'CRACKER_BARREL', stopType: 'RETAIL' },
  { query: "Love's Travel Stop", chain: 'LOVES', stopType: 'FUEL_CENTER' },
  { query: 'Flying J Travel Center', chain: 'FLYING_J', stopType: 'FUEL_CENTER' },
  { query: 'Pilot Travel Center', chain: 'PILOT', stopType: 'FUEL_CENTER' },
  { query: 'TA Travel Center TravelCenters of America', chain: 'TA', stopType: 'FUEL_CENTER' },
  { query: 'Walmart Supercenter', chain: 'WALMART', stopType: 'RETAIL' },
  { query: 'Cabelas store', chain: 'CABELAS', stopType: 'RETAIL' },
  { query: 'Bass Pro Shops', chain: 'BASS_PRO', stopType: 'RETAIL' },
];

// Major US regions — lat/lng centers with wide radius to cover the country
const REGIONS = [
  { name: 'Northeast', lat: 41.2, lng: -73.2, radius: 300000 },
  { name: 'Southeast', lat: 33.7, lng: -84.4, radius: 400000 },
  { name: 'Midwest', lat: 41.9, lng: -87.6, radius: 400000 },
  { name: 'South Central', lat: 32.8, lng: -96.8, radius: 400000 },
  { name: 'Mountain West', lat: 39.7, lng: -105.0, radius: 500000 },
  { name: 'Pacific Northwest', lat: 47.6, lng: -122.3, radius: 300000 },
  { name: 'California', lat: 36.8, lng: -119.4, radius: 400000 },
  { name: 'Florida', lat: 28.5, lng: -81.4, radius: 300000 },
  { name: 'Great Plains', lat: 41.3, lng: -96.0, radius: 400000 },
  { name: 'Mid-Atlantic', lat: 38.9, lng: -77.0, radius: 300000 },
];

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)); }

async function searchPlaces(query: string, lat: number, lng: number, radius: number): Promise<any[]> {
  const url = `${GOOGLE_BASE}/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=${radius}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();

  let results = data.results || [];

  // Follow next_page_token if available (up to 1 page — 40 total results)
  if (data.next_page_token) {
    await sleep(2000); // Google requires delay before using page token
    const nextUrl = `${GOOGLE_BASE}/textsearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_API_KEY}`;
    const nextRes = await fetch(nextUrl);
    const nextData = await nextRes.json();
    results = results.concat(nextData.results || []);
  }

  return results;
}

function extractState(addressComponents: any[], formattedAddress: string): string {
  // Try to extract state from formatted address (e.g., "123 Main St, City, TX 12345, USA")
  const match = formattedAddress.match(/,\s*([A-Z]{2})\s+\d{5}/);
  if (match) return match[1];
  // Fallback: try common pattern
  const parts = formattedAddress.split(',').map(p => p.trim());
  for (const part of parts) {
    const stateMatch = part.match(/^([A-Z]{2})\s+\d{5}$/);
    if (stateMatch) return stateMatch[1];
  }
  return '';
}

function extractCity(formattedAddress: string): string {
  // "123 Main St, City Name, TX 12345, USA" → "City Name"
  const parts = formattedAddress.split(',').map(p => p.trim());
  if (parts.length >= 3) return parts[parts.length - 3];
  if (parts.length >= 2) return parts[0];
  return '';
}

async function main() {
  if (!GOOGLE_API_KEY) {
    console.error('No Google API key found. Set GOOGLE_MAPS_API_KEY, GOOGLE_PLACES_API_KEY, or GOOGLE_API_KEY');
    process.exit(1);
  }

  console.log('🌙 Seeding overnight stop chains...\n');

  const seenPlaceIds = new Set<string>();
  const stats: Record<string, number> = {};

  for (const chain of CHAINS) {
    stats[chain.chain] = 0;
    console.log(`\n🔍 Searching for ${chain.query}...`);

    for (const region of REGIONS) {
      try {
        const results = await searchPlaces(chain.query, region.lat, region.lng, region.radius);

        for (const place of results) {
          const placeId = place.place_id;
          if (!placeId || seenPlaceIds.has(placeId)) continue;
          seenPlaceIds.add(placeId);

          const lat = place.geometry?.location?.lat;
          const lng = place.geometry?.location?.lng;
          if (!lat || !lng) continue;

          const address = place.formatted_address || place.vicinity || '';
          const state = extractState([], address);
          const city = extractCity(address);

          // Skip if no state (probably outside US)
          if (!state) continue;

          // Upsert by placeId to avoid duplicates
          try {
            await prisma.overnightStop.upsert({
              where: { id: placeId }, // Use placeId as a dedup key via unique check below
              create: {
                name: place.name || chain.query,
                address,
                city: city || null,
                state,
                latitude: lat,
                longitude: lng,
                stopType: chain.stopType,
                chain: chain.chain,
                placeId,
                allowsRvs: true,
                isVerified: false,
              },
              update: {}, // No-op if exists
            });
            stats[chain.chain]++;
          } catch (e: any) {
            // Handle duplicate — try findFirst by placeId
            const existing = await prisma.overnightStop.findFirst({ where: { placeId } });
            if (!existing) {
              // Not a placeId duplicate, create without upsert
              try {
                await prisma.overnightStop.create({
                  data: {
                    name: place.name || chain.query,
                    address,
                    city: city || null,
                    state,
                    latitude: lat,
                    longitude: lng,
                    stopType: chain.stopType,
                    chain: chain.chain,
                    placeId,
                    allowsRvs: true,
                    isVerified: false,
                  },
                });
                stats[chain.chain]++;
              } catch {
                // Skip on any error
              }
            }
          }
        }

        console.log(`  ${region.name}: +${results.length} results`);
        await sleep(500); // Rate limit between region searches
      } catch (err: any) {
        console.error(`  ${region.name}: Error — ${err.message}`);
      }
    }

    console.log(`  ✅ ${chain.chain}: ${stats[chain.chain]} locations seeded`);
    await sleep(1000); // Rate limit between chains
  }

  // Final count
  const totalCount = await prisma.overnightStop.count();
  console.log('\n───────────────────────────────────────');
  console.log('🌙 Seeding complete!\n');
  console.log('Per chain:');
  for (const [chain, count] of Object.entries(stats)) {
    console.log(`  ${chain}: ${count}`);
  }
  console.log(`\n  TOTAL in database: ${totalCount}`);
  console.log('───────────────────────────────────────');

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
