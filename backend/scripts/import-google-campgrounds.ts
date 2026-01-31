import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

// Grid covering continental US
const US_GRID = [
  { lat: 47.6, lng: -122.3 }, { lat: 45.5, lng: -122.7 }, { lat: 37.8, lng: -122.4 },
  { lat: 34.0, lng: -118.2 }, { lat: 32.7, lng: -117.2 }, { lat: 36.1, lng: -115.2 },
  { lat: 33.4, lng: -112.1 }, { lat: 35.1, lng: -106.6 }, { lat: 31.8, lng: -106.4 },
  { lat: 32.2, lng: -110.9 }, { lat: 39.7, lng: -105.0 }, { lat: 40.8, lng: -111.9 },
  { lat: 43.6, lng: -116.2 }, { lat: 46.9, lng: -110.4 }, { lat: 44.4, lng: -110.6 },
  { lat: 41.9, lng: -87.6 }, { lat: 44.9, lng: -93.3 }, { lat: 39.1, lng: -94.6 },
  { lat: 41.3, lng: -96.0 }, { lat: 43.0, lng: -89.4 }, { lat: 42.3, lng: -83.0 },
  { lat: 39.8, lng: -86.2 }, { lat: 39.1, lng: -84.5 }, { lat: 41.5, lng: -81.7 },
  { lat: 29.8, lng: -95.4 }, { lat: 32.8, lng: -96.8 }, { lat: 29.4, lng: -98.5 },
  { lat: 30.3, lng: -97.7 }, { lat: 36.2, lng: -86.8 }, { lat: 33.8, lng: -84.4 },
  { lat: 30.3, lng: -81.7 }, { lat: 25.8, lng: -80.2 }, { lat: 28.5, lng: -81.4 },
  { lat: 27.9, lng: -82.5 }, { lat: 30.0, lng: -90.1 }, { lat: 32.8, lng: -79.9 },
  { lat: 35.2, lng: -80.8 }, { lat: 35.8, lng: -78.6 }, { lat: 36.9, lng: -76.3 },
  { lat: 40.7, lng: -74.0 }, { lat: 39.9, lng: -75.2 }, { lat: 42.4, lng: -71.1 },
  { lat: 38.9, lng: -77.0 }, { lat: 40.4, lng: -80.0 }, { lat: 43.0, lng: -78.9 },
  { lat: 42.7, lng: -73.7 }, { lat: 44.3, lng: -69.8 }, { lat: 43.2, lng: -71.5 },
  { lat: 44.5, lng: -73.2 }, { lat: 38.8, lng: -104.8 }, { lat: 35.0, lng: -111.0 },
  { lat: 36.8, lng: -119.8 }, { lat: 39.5, lng: -119.8 }, { lat: 47.0, lng: -120.5 },
  { lat: 44.0, lng: -121.5 }, { lat: 37.0, lng: -109.0 }, { lat: 34.5, lng: -92.3 },
  { lat: 38.3, lng: -85.8 }, { lat: 35.5, lng: -97.5 }, { lat: 41.2, lng: -104.8 },
  { lat: 46.8, lng: -100.8 }, { lat: 44.4, lng: -98.2 }, { lat: 40.8, lng: -96.7 },
  { lat: 37.7, lng: -99.3 }, { lat: 32.4, lng: -86.3 }, { lat: 32.3, lng: -90.2 },
  { lat: 34.7, lng: -92.3 }, { lat: 39.0, lng: -80.5 }, { lat: 37.5, lng: -77.5 },
  { lat: 36.1, lng: -79.8 },
];

interface PlaceResult {
  place_id: string;
  name: string;
  geometry: { location: { lat: number; lng: number } };
  vicinity?: string;
  formatted_address?: string;
  rating?: number;
  user_ratings_total?: number;
  photos?: { photo_reference: string }[];
  types?: string[];
}

interface ApiResponse {
  status: string;
  error_message?: string;
  results?: PlaceResult[];
  next_page_token?: string;
}

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function searchNearbyPlaces(lat: number, lng: number, type: string, radius: number = 50000): Promise<PlaceResult[]> {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radius}&type=${type}&key=${GOOGLE_API_KEY}`;
  
  const response = await fetch(url);
  const data = await response.json() as ApiResponse;
  
  if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
    console.error(`API Error: ${data.status} - ${data.error_message || ''}`);
    return [];
  }
  
  let results: PlaceResult[] = data.results || [];
  
  if (data.next_page_token) {
    await delay(2000);
    const nextUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${data.next_page_token}&key=${GOOGLE_API_KEY}`;
    const nextResponse = await fetch(nextUrl);
    const nextData = await nextResponse.json() as ApiResponse;
    results = [...results, ...(nextData.results || [])];
    
    if (nextData.next_page_token) {
      await delay(2000);
      const thirdUrl = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?pagetoken=${nextData.next_page_token}&key=${GOOGLE_API_KEY}`;
      const thirdResponse = await fetch(thirdUrl);
      const thirdData = await thirdResponse.json() as ApiResponse;
      results = [...results, ...(thirdData.results || [])];
    }
  }
  
  return results;
}

function normalizeString(str: string): string {
  return str.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/campground|camping|rvpark|park|resort|camp/g, '');
}

function extractState(address: string): string | null {
  const stateMatch = address.match(/,\s*([A-Z]{2})\s*\d{5}/) || 
                     address.match(/,\s*([A-Z]{2})(?:,|\s|$)/);
  return stateMatch ? stateMatch[1] : null;
}

function extractCity(address: string): string {
  const parts = address.split(',');
  if (parts.length >= 2) {
    return parts[parts.length - 3]?.trim() || parts[0].trim();
  }
  return parts[0].trim();
}

async function findExistingCampground(name: string, lat: number, lng: number, state: string | null) {
  const nearbyMatch = await prisma.campground.findFirst({
    where: {
      latitude: { gte: lat - 0.001, lte: lat + 0.001 },
      longitude: { gte: lng - 0.001, lte: lng + 0.001 },
    }
  });
  
  if (nearbyMatch) return nearbyMatch;
  
  const normalizedName = normalizeString(name);
  const allInState = await prisma.campground.findMany({
    where: state ? { state } : {},
    select: { id: true, name: true, imageUrl: true, latitude: true, longitude: true }
  });
  
  for (const camp of allInState) {
    const existingNormalized = normalizeString(camp.name);
    if (existingNormalized.includes(normalizedName) || normalizedName.includes(existingNormalized)) {
      return camp;
    }
  }
  
  return null;
}

function getPhotoUrl(photoReference: string): string {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

async function importCampgrounds(dryRun: boolean = true) {
  console.log('🏕️  Google Campgrounds Import Script');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no changes)' : 'LIVE IMPORT'}`);
  console.log('=====================================\n');
  
  const stats = {
    searched: 0,
    found: 0,
    newAdded: 0,
    updated: 0,
    skipped: 0,
    apiCalls: 0,
    estimatedCost: 0,
  };
  
  const seenPlaceIds = new Set<string>();
  const searchTypes = ['campground', 'rv_park'];
  
  for (const point of US_GRID) {
    console.log(`\n📍 Searching near ${point.lat.toFixed(2)}, ${point.lng.toFixed(2)}...`);
    
    for (const searchType of searchTypes) {
      stats.apiCalls++;
      const results = await searchNearbyPlaces(point.lat, point.lng, searchType);
      stats.searched++;
      
      for (const place of results) {
        if (seenPlaceIds.has(place.place_id)) continue;
        seenPlaceIds.add(place.place_id);
        
        stats.found++;
        
        const address = place.formatted_address || place.vicinity || '';
        const state = extractState(address);
        const city = extractCity(address);
        
        const existing = await findExistingCampground(
          place.name,
          place.geometry.location.lat,
          place.geometry.location.lng,
          state
        );
        
        if (existing) {
          const updates: { imageUrl?: string; latitude?: number; longitude?: number } = {};
          
          if (!existing.imageUrl && place.photos?.[0]) {
            updates.imageUrl = getPhotoUrl(place.photos[0].photo_reference);
          }
          if (!existing.latitude) updates.latitude = place.geometry.location.lat;
          if (!existing.longitude) updates.longitude = place.geometry.location.lng;
          
          if (Object.keys(updates).length > 0) {
            console.log(`  ✏️  Updating: ${place.name} (adding ${Object.keys(updates).join(', ')})`);
            if (!dryRun) {
              await prisma.campground.update({
                where: { id: existing.id },
                data: updates
              });
            }
            stats.updated++;
          } else {
            stats.skipped++;
          }
        } else {
          console.log(`  ➕ New: ${place.name} (${city}, ${state || 'Unknown'})`);
          
          if (!dryRun) {
            const imageUrl = place.photos?.[0] ? getPhotoUrl(place.photos[0].photo_reference) : null;
            
            await prisma.campground.create({
              data: {
                name: place.name,
                location: address || `${city}, ${state || ''}`,
                state: state || 'Unknown',
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                imageUrl,
                amenities: [],
                verificationStatus: 'UNCLAIMED',
              }
            });
          }
          stats.newAdded++;
        }
        
        await delay(100);
      }
      
      await delay(500);
    }
    
    await delay(1000);
    
    if (stats.searched % 20 === 0) {
      stats.estimatedCost = stats.apiCalls * 0.032;
      console.log(`\n📊 Progress: ${stats.searched}/${US_GRID.length * 2} searches`);
      console.log(`   Found: ${stats.found} | New: ${stats.newAdded} | Updated: ${stats.updated}`);
      console.log(`   API Calls: ${stats.apiCalls} | Est. Cost: $${stats.estimatedCost.toFixed(2)}`);
    }
  }
  
  stats.estimatedCost = stats.apiCalls * 0.032;
  
  console.log('\n=====================================');
  console.log('🏁 IMPORT COMPLETE');
  console.log('=====================================');
  console.log(`Grid Points Searched: ${US_GRID.length}`);
  console.log(`Total Places Found: ${stats.found}`);
  console.log(`New Campgrounds Added: ${stats.newAdded}`);
  console.log(`Existing Updated: ${stats.updated}`);
  console.log(`Skipped (no updates needed): ${stats.skipped}`);
  console.log(`API Calls Made: ${stats.apiCalls}`);
  console.log(`Estimated Cost: $${stats.estimatedCost.toFixed(2)}`);
  
  return stats;
}

const args = process.argv.slice(2);
const isLive = args.includes('--live');

importCampgrounds(!isLive)
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Import failed:', err);
    process.exit(1);
  });
