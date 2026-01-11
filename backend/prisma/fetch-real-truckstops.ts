/**
 * Fetch real truck stops and rest areas from OpenStreetMap via Overpass API
 * This is free and contains crowd-sourced data for truck stops across the US
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';

// Fetch truck stops (fuel stations with truck/HGV facilities)
async function fetchTruckStops() {
  console.log('🚛 Fetching truck stops from OpenStreetMap...');
  
  // Overpass QL query for truck stops in the US
  // Looking for fuel stations with truck facilities
  const query = `
    [out:json][timeout:120];
    area["ISO3166-1"="US"][admin_level=2]->.usa;
    (
      node["amenity"="fuel"]["hgv"="yes"](area.usa);
      node["amenity"="fuel"]["brand"~"Pilot|Flying J|Love|TA |TravelCenters|Petro|Sapp Bros|Buc-ee",i](area.usa);
      way["amenity"="fuel"]["hgv"="yes"](area.usa);
      way["amenity"="fuel"]["brand"~"Pilot|Flying J|Love|TA |TravelCenters|Petro|Sapp Bros|Buc-ee",i](area.usa);
    );
    out center body;
  `;
  
  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    
    const data = await response.json() as { elements?: any[] };
    console.log(`   ✅ Found ${data.elements?.length || 0} truck stops`);
    return data.elements || [];
  } catch (error) {
    console.error('   ❌ Overpass fetch failed:', error);
    return [];
  }
}

// Fetch rest areas
async function fetchRestAreas() {
  console.log('🅿️ Fetching rest areas from OpenStreetMap...');
  
  const query = `
    [out:json][timeout:120];
    area["ISO3166-1"="US"][admin_level=2]->.usa;
    (
      node["highway"="rest_area"](area.usa);
      way["highway"="rest_area"](area.usa);
      node["highway"="services"](area.usa);
      way["highway"="services"](area.usa);
    );
    out center body;
  `;
  
  try {
    const response = await fetch(OVERPASS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });
    
    if (!response.ok) {
      throw new Error(`Overpass API error: ${response.status}`);
    }
    
    const data = await response.json() as { elements?: any[] };
    console.log(`   ✅ Found ${data.elements?.length || 0} rest areas`);
    return data.elements || [];
  } catch (error) {
    console.error('   ❌ Overpass fetch failed:', error);
    return [];
  }
}

// Get state from coordinates using simple bounding box lookup
function getStateFromCoords(lat: number, lon: number): string | null {
  // Simplified state lookup based on approximate bounding boxes
  const states: { code: string; minLat: number; maxLat: number; minLon: number; maxLon: number }[] = [
    { code: 'AL', minLat: 30.2, maxLat: 35.0, minLon: -88.5, maxLon: -84.9 },
    { code: 'AZ', minLat: 31.3, maxLat: 37.0, minLon: -114.8, maxLon: -109.0 },
    { code: 'AR', minLat: 33.0, maxLat: 36.5, minLon: -94.6, maxLon: -89.6 },
    { code: 'CA', minLat: 32.5, maxLat: 42.0, minLon: -124.5, maxLon: -114.1 },
    { code: 'CO', minLat: 37.0, maxLat: 41.0, minLon: -109.1, maxLon: -102.0 },
    { code: 'CT', minLat: 41.0, maxLat: 42.1, minLon: -73.7, maxLon: -71.8 },
    { code: 'DE', minLat: 38.5, maxLat: 39.8, minLon: -75.8, maxLon: -75.0 },
    { code: 'FL', minLat: 24.5, maxLat: 31.0, minLon: -87.6, maxLon: -80.0 },
    { code: 'GA', minLat: 30.4, maxLat: 35.0, minLon: -85.6, maxLon: -80.8 },
    { code: 'ID', minLat: 42.0, maxLat: 49.0, minLon: -117.2, maxLon: -111.0 },
    { code: 'IL', minLat: 37.0, maxLat: 42.5, minLon: -91.5, maxLon: -87.0 },
    { code: 'IN', minLat: 37.8, maxLat: 41.8, minLon: -88.1, maxLon: -84.8 },
    { code: 'IA', minLat: 40.4, maxLat: 43.5, minLon: -96.6, maxLon: -90.1 },
    { code: 'KS', minLat: 37.0, maxLat: 40.0, minLon: -102.1, maxLon: -94.6 },
    { code: 'KY', minLat: 36.5, maxLat: 39.1, minLon: -89.6, maxLon: -82.0 },
    { code: 'LA', minLat: 29.0, maxLat: 33.0, minLon: -94.0, maxLon: -89.0 },
    { code: 'ME', minLat: 43.0, maxLat: 47.5, minLon: -71.1, maxLon: -67.0 },
    { code: 'MD', minLat: 38.0, maxLat: 39.7, minLon: -79.5, maxLon: -75.0 },
    { code: 'MA', minLat: 41.2, maxLat: 42.9, minLon: -73.5, maxLon: -70.0 },
    { code: 'MI', minLat: 41.7, maxLat: 48.3, minLon: -90.4, maxLon: -82.4 },
    { code: 'MN', minLat: 43.5, maxLat: 49.4, minLon: -97.2, maxLon: -89.5 },
    { code: 'MS', minLat: 30.2, maxLat: 35.0, minLon: -91.7, maxLon: -88.1 },
    { code: 'MO', minLat: 36.0, maxLat: 40.6, minLon: -95.8, maxLon: -89.1 },
    { code: 'MT', minLat: 44.4, maxLat: 49.0, minLon: -116.1, maxLon: -104.0 },
    { code: 'NE', minLat: 40.0, maxLat: 43.0, minLon: -104.1, maxLon: -95.3 },
    { code: 'NV', minLat: 35.0, maxLat: 42.0, minLon: -120.0, maxLon: -114.0 },
    { code: 'NH', minLat: 42.7, maxLat: 45.3, minLon: -72.6, maxLon: -70.7 },
    { code: 'NJ', minLat: 39.0, maxLat: 41.4, minLon: -75.6, maxLon: -74.0 },
    { code: 'NM', minLat: 31.3, maxLat: 37.0, minLon: -109.1, maxLon: -103.0 },
    { code: 'NY', minLat: 40.5, maxLat: 45.0, minLon: -79.8, maxLon: -72.0 },
    { code: 'NC', minLat: 34.0, maxLat: 36.6, minLon: -84.3, maxLon: -75.5 },
    { code: 'ND', minLat: 45.9, maxLat: 49.0, minLon: -104.1, maxLon: -96.6 },
    { code: 'OH', minLat: 38.4, maxLat: 42.0, minLon: -84.8, maxLon: -80.5 },
    { code: 'OK', minLat: 33.6, maxLat: 37.0, minLon: -103.0, maxLon: -94.4 },
    { code: 'OR', minLat: 42.0, maxLat: 46.3, minLon: -124.6, maxLon: -116.5 },
    { code: 'PA', minLat: 39.7, maxLat: 42.3, minLon: -80.5, maxLon: -74.7 },
    { code: 'RI', minLat: 41.1, maxLat: 42.0, minLon: -71.9, maxLon: -71.1 },
    { code: 'SC', minLat: 32.0, maxLat: 35.2, minLon: -83.4, maxLon: -78.5 },
    { code: 'SD', minLat: 42.5, maxLat: 45.9, minLon: -104.1, maxLon: -96.4 },
    { code: 'TN', minLat: 35.0, maxLat: 36.7, minLon: -90.3, maxLon: -81.6 },
    { code: 'TX', minLat: 25.8, maxLat: 36.5, minLon: -106.6, maxLon: -93.5 },
    { code: 'UT', minLat: 37.0, maxLat: 42.0, minLon: -114.1, maxLon: -109.0 },
    { code: 'VT', minLat: 42.7, maxLat: 45.0, minLon: -73.4, maxLon: -71.5 },
    { code: 'VA', minLat: 36.5, maxLat: 39.5, minLon: -83.7, maxLon: -75.2 },
    { code: 'WA', minLat: 45.5, maxLat: 49.0, minLon: -124.8, maxLon: -116.9 },
    { code: 'WV', minLat: 37.2, maxLat: 40.6, minLon: -82.6, maxLon: -77.7 },
    { code: 'WI', minLat: 42.5, maxLat: 47.1, minLon: -92.9, maxLon: -86.8 },
    { code: 'WY', minLat: 41.0, maxLat: 45.0, minLon: -111.1, maxLon: -104.1 },
  ];
  
  for (const state of states) {
    if (lat >= state.minLat && lat <= state.maxLat && lon >= state.minLon && lon <= state.maxLon) {
      return state.code;
    }
  }
  return null;
}

// Detect brand from name/tags
function detectBrand(tags: any): string {
  const brand = tags.brand || tags.name || '';
  const brandLower = brand.toLowerCase();
  
  if (brandLower.includes('pilot') || brandLower.includes('flying j')) return 'Pilot';
  if (brandLower.includes("love's") || brandLower.includes('loves')) return "Love's";
  if (brandLower.includes('ta ') || brandLower.includes('travelcenter') || brandLower.includes('travel center')) return 'TA';
  if (brandLower.includes('petro')) return 'Petro';
  if (brandLower.includes('sapp')) return 'Sapp Bros';
  if (brandLower.includes('buc-ee') || brandLower.includes('bucee')) return "Buc-ee's";
  if (brandLower.includes('kwik')) return 'Kwik Trip';
  if (brandLower.includes('wawa')) return 'Wawa';
  if (brandLower.includes('sheetz')) return 'Sheetz';
  if (brandLower.includes('casey')) return "Casey's";
  if (brandLower.includes('maverick')) return 'Maverick';
  if (brandLower.includes('shell')) return 'Shell';
  if (brandLower.includes('chevron')) return 'Chevron';
  if (brandLower.includes('exxon') || brandLower.includes('mobil')) return 'Exxon';
  if (brandLower.includes('bp')) return 'BP';
  
  return tags.brand || 'Independent';
}

// Parse amenities from OSM tags
function parseAmenities(tags: any) {
  return {
    hasDiesel: tags.fuel?.diesel === 'yes' || tags['fuel:diesel'] === 'yes' || true, // Assume diesel for truck stops
    hasTruckParking: tags.hgv === 'yes' || tags.parking === 'yes' || true,
    hasRVParking: tags.caravan === 'yes' || tags['parking:caravan'] === 'yes' || false,
    hasRestrooms: tags.toilets === 'yes' || true,
    hasShowers: tags.shower === 'yes' || tags.showers === 'yes' || false,
    hasRestaurant: tags.restaurant === 'yes' || tags.food === 'yes' || false,
    hasStore: tags.shop === 'yes' || tags.convenience === 'yes' || true,
    hasPropane: tags.lpg === 'yes' || tags['fuel:lpg'] === 'yes' || false,
    hasDumpStation: tags.sanitary_dump_station === 'yes' || false,
  };
}

// Get lat/lon from element (handles nodes and ways)
function getCoords(element: any): { lat: number; lon: number } | null {
  if (element.lat && element.lon) {
    return { lat: element.lat, lon: element.lon };
  }
  if (element.center) {
    return { lat: element.center.lat, lon: element.center.lon };
  }
  return null;
}

async function seedRealTruckStops() {
  console.log('\n🚛 Starting real truck stop import...\n');
  
  const elements = await fetchTruckStops();
  
  if (elements.length === 0) {
    console.log('   No truck stops found, keeping existing data');
    return;
  }
  
  // Clear existing data
  console.log('   Clearing existing truck stops...');
  await prisma.gasStation.deleteMany({});
  
  let count = 0;
  let skipped = 0;
  
  for (const element of elements) {
    const coords = getCoords(element);
    if (!coords) {
      skipped++;
      continue;
    }
    
    const tags = element.tags || {};
    const state = getStateFromCoords(coords.lat, coords.lon);
    
    if (!state) {
      skipped++;
      continue;
    }
    
    const name = tags.name || `${detectBrand(tags)} Truck Stop`;
    const amenities = parseAmenities(tags);
    
    try {
      await prisma.gasStation.create({
        data: {
          name,
          brand: detectBrand(tags),
          address: tags['addr:street'] || tags.address || '',
          city: tags['addr:city'] || '',
          state,
          zipCode: tags['addr:postcode'] || '',
          latitude: coords.lat,
          longitude: coords.lon,
          interstate: tags.ref || null,
          exitNumber: tags.exit || null,
          ...amenities,
        },
      });
      count++;
    } catch (error) {
      // Skip duplicates or errors
      skipped++;
    }
  }
  
  console.log(`\n   ✅ Imported ${count} truck stops (skipped ${skipped})`);
}

async function seedRealRestAreas() {
  console.log('\n🅿️ Starting real rest area import...\n');
  
  const elements = await fetchRestAreas();
  
  if (elements.length === 0) {
    console.log('   No rest areas found, keeping existing data');
    return;
  }
  
  // Clear existing data
  console.log('   Clearing existing rest stops...');
  await prisma.restStop.deleteMany({});
  
  let count = 0;
  let skipped = 0;
  
  for (const element of elements) {
    const coords = getCoords(element);
    if (!coords) {
      skipped++;
      continue;
    }
    
    const tags = element.tags || {};
    const state = getStateFromCoords(coords.lat, coords.lon);
    
    if (!state) {
      skipped++;
      continue;
    }
    
    const name = tags.name || `${state} Rest Area`;
    
    try {
      await prisma.restStop.create({
        data: {
          name,
          state,
          latitude: coords.lat,
          longitude: coords.lon,
          interstate: tags.ref || tags.highway_ref || 'Unknown',
          direction: tags.direction || null,
          mileMarker: tags.distance ? parseInt(tags.distance) : null,
          hasRestrooms: tags.toilets === 'yes' || tags.amenity === 'toilets' || true,
          hasPicnicArea: tags.leisure === 'picnic_table' || tags.picnic_table === 'yes' || false,
          hasPetArea: tags.dog === 'yes' || false,
          hasVending: tags.vending === 'yes' || false,
          hasWifi: tags.internet_access === 'yes' || tags.wifi === 'yes' || false,
          hasRVParking: tags.caravan === 'yes' || false,
          hasDumpStation: tags.sanitary_dump_station === 'yes' || false,
          hasWater: tags.drinking_water === 'yes' || false,
          is24Hours: tags.opening_hours === '24/7' || true,
          notes: tags.description || null,
        },
      });
      count++;
    } catch (error) {
      skipped++;
    }
  }
  
  console.log(`\n   ✅ Imported ${count} rest areas (skipped ${skipped})`);
}

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('   FETCHING REAL TRUCK STOPS & REST AREAS');
  console.log('   Source: OpenStreetMap via Overpass API');
  console.log('═══════════════════════════════════════════════════\n');
  
  await seedRealTruckStops();
  await seedRealRestAreas();
  
  // Get final counts
  const truckCount = await prisma.gasStation.count();
  const restCount = await prisma.restStop.count();
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`   COMPLETE: ${truckCount} truck stops, ${restCount} rest areas`);
  console.log('═══════════════════════════════════════════════════\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
