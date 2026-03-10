const { PrismaClient } = require('@prisma/client');
const https = require('https');

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

// All chains we want to collect
const CHAINS = [
  // Retail
  { name: 'Walmart', category: 'RETAIL', query: 'Walmart Supercenter', hasFuel: true, is24Hours: true },
  { name: "Sam's Club", category: 'RETAIL', query: "Sam's Club" },
  { name: 'Costco', category: 'RETAIL', query: 'Costco Wholesale' },
  { name: 'Meijer', category: 'RETAIL', query: 'Meijer', is24Hours: true },
  { name: 'Tractor Supply Company', category: 'FARM_RANCH', query: 'Tractor Supply Company' },
  // Outdoor / RV
  { name: "Cabela's", category: 'OUTDOOR_RETAIL', query: "Cabela's" },
  { name: 'Bass Pro Shops', category: 'OUTDOOR_RETAIL', query: 'Bass Pro Shops' },
  { name: 'Camping World', category: 'OUTDOOR_RETAIL', query: 'Camping World' },
  // Restaurants
  { name: 'Cracker Barrel', category: 'RESTAURANT', query: 'Cracker Barrel Old Country Store', hasFood: true },
  { name: "Denny's", category: 'RESTAURANT', query: "Denny's Restaurant", hasFood: true, is24Hours: true },
  { name: 'Golden Corral', category: 'RESTAURANT', query: 'Golden Corral', hasFood: true },
  // Truck Stops
  { name: 'Pilot Travel Center', category: 'TRUCK_STOP', query: 'Pilot Travel Center', hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
  { name: 'Flying J', category: 'TRUCK_STOP', query: 'Flying J Travel Center', hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
  { name: "Love's Travel Stop", category: 'TRUCK_STOP', query: "Love's Travel Stop", hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
  { name: 'TA Travel Center', category: 'TRUCK_STOP', query: 'TA Travel Center', hasFuel: true, hasFood: true, hasShowers: true, is24Hours: true },
  { name: 'Petro Travel Center', category: 'TRUCK_STOP', query: 'Petro Travel Center', hasFuel: true, hasShowers: true, is24Hours: true },
  { name: "Sapp Bros", category: 'TRUCK_STOP', query: 'Sapp Bros Travel Center', hasFuel: true, hasShowers: true, is24Hours: true },
  { name: "Buc-ee's", category: 'GAS_STATION', query: "Buc-ee's", hasFuel: true, hasFood: true, is24Hours: true },
  // Farm & Ranch
  { name: 'Rural King', category: 'FARM_RANCH', query: 'Rural King' },
  { name: 'Fleet Farm', category: 'FARM_RANCH', query: 'Fleet Farm' },
  // Hardware
  { name: 'Home Depot', category: 'HARDWARE', query: 'The Home Depot' },
  { name: "Lowe's", category: 'HARDWARE', query: "Lowe's Home Improvement" },
  { name: 'Menards', category: 'HARDWARE', query: 'Menards' },
];

// Grid of US cities to search around (covers major highway corridors)
const US_GRID = [
  // Northeast
  { lat: 42.36, lng: -71.06, label: 'Boston' },
  { lat: 40.71, lng: -74.01, label: 'NYC' },
  { lat: 39.95, lng: -75.17, label: 'Philadelphia' },
  { lat: 38.91, lng: -77.04, label: 'DC' },
  { lat: 43.05, lng: -76.15, label: 'Syracuse' },
  { lat: 44.48, lng: -73.21, label: 'Burlington VT' },
  // Southeast
  { lat: 35.23, lng: -80.84, label: 'Charlotte' },
  { lat: 33.75, lng: -84.39, label: 'Atlanta' },
  { lat: 30.33, lng: -81.66, label: 'Jacksonville' },
  { lat: 25.77, lng: -80.19, label: 'Miami' },
  { lat: 27.95, lng: -82.46, label: 'Tampa' },
  { lat: 30.69, lng: -88.04, label: 'Mobile' },
  { lat: 35.15, lng: -90.05, label: 'Memphis' },
  { lat: 36.17, lng: -86.78, label: 'Nashville' },
  { lat: 38.25, lng: -85.76, label: 'Louisville' },
  { lat: 39.10, lng: -84.51, label: 'Cincinnati' },
  // Midwest
  { lat: 41.88, lng: -87.63, label: 'Chicago' },
  { lat: 44.98, lng: -93.27, label: 'Minneapolis' },
  { lat: 41.60, lng: -93.61, label: 'Des Moines' },
  { lat: 39.10, lng: -94.58, label: 'Kansas City' },
  { lat: 38.63, lng: -90.20, label: 'St Louis' },
  { lat: 43.05, lng: -89.40, label: 'Madison' },
  { lat: 41.66, lng: -83.56, label: 'Toledo' },
  { lat: 41.50, lng: -81.69, label: 'Cleveland' },
  { lat: 40.44, lng: -79.99, label: 'Pittsburgh' },
  { lat: 42.33, lng: -83.05, label: 'Detroit' },
  { lat: 43.05, lng: -76.15, label: 'Rochester' },
  // South Central
  { lat: 29.76, lng: -95.37, label: 'Houston' },
  { lat: 30.27, lng: -97.74, label: 'Austin' },
  { lat: 29.42, lng: -98.49, label: 'San Antonio' },
  { lat: 32.78, lng: -96.80, label: 'Dallas' },
  { lat: 35.47, lng: -97.52, label: 'Oklahoma City' },
  { lat: 36.15, lng: -95.99, label: 'Tulsa' },
  { lat: 32.30, lng: -90.18, label: 'Jackson MS' },
  { lat: 30.45, lng: -91.19, label: 'Baton Rouge' },
  { lat: 29.95, lng: -90.07, label: 'New Orleans' },
  // Mountain West
  { lat: 39.74, lng: -104.99, label: 'Denver' },
  { lat: 35.68, lng: -105.94, label: 'Santa Fe' },
  { lat: 35.08, lng: -106.65, label: 'Albuquerque' },
  { lat: 31.76, lng: -106.49, label: 'El Paso' },
  { lat: 40.76, lng: -111.89, label: 'Salt Lake City' },
  { lat: 43.62, lng: -116.20, label: 'Boise' },
  { lat: 46.60, lng: -112.03, label: 'Helena' },
  { lat: 47.67, lng: -117.43, label: 'Spokane' },
  { lat: 44.06, lng: -103.23, label: 'Rapid City' },
  { lat: 46.88, lng: -102.79, label: 'Bismarck' },
  { lat: 43.54, lng: -96.73, label: 'Sioux Falls' },
  { lat: 41.26, lng: -95.94, label: 'Omaha' },
  { lat: 37.69, lng: -97.34, label: 'Wichita' },
  { lat: 44.32, lng: -105.50, label: 'Gillette WY' },
  { lat: 42.86, lng: -106.32, label: 'Casper WY' },
  // Southwest
  { lat: 33.45, lng: -112.07, label: 'Phoenix' },
  { lat: 32.22, lng: -110.97, label: 'Tucson' },
  { lat: 36.17, lng: -115.14, label: 'Las Vegas' },
  { lat: 34.05, lng: -118.24, label: 'Los Angeles' },
  { lat: 32.72, lng: -117.16, label: 'San Diego' },
  { lat: 37.34, lng: -121.89, label: 'San Jose' },
  { lat: 37.77, lng: -122.42, label: 'San Francisco' },
  { lat: 38.58, lng: -121.49, label: 'Sacramento' },
  { lat: 36.75, lng: -119.77, label: 'Fresno' },
  // Northwest
  { lat: 47.61, lng: -122.33, label: 'Seattle' },
  { lat: 45.52, lng: -122.68, label: 'Portland' },
  { lat: 44.94, lng: -123.03, label: 'Salem' },
  { lat: 44.05, lng: -121.31, label: 'Bend' },
  // Alaska / Hawaii skipped for now
];

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function googleSearch(query, lat, lng) {
  return new Promise((resolve, reject) => {
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=80000&key=${GOOGLE_API_KEY}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    }).on('error', reject);
  });
}

function parseAddress(components) {
  let street = '', city = '', state = '', zip = '';
  for (const c of (components || [])) {
    if (c.types.includes('street_number') || c.types.includes('route')) street += c.long_name + ' ';
    if (c.types.includes('locality')) city = c.long_name;
    if (c.types.includes('administrative_area_level_1')) state = c.short_name;
    if (c.types.includes('postal_code')) zip = c.long_name;
  }
  return { street: street.trim(), city, state, zip };
}

async function collectChain(chain, gridPoint) {
  try {
    const result = await googleSearch(chain.query, gridPoint.lat, gridPoint.lng);
    if (!result.results) return 0;

    let count = 0;
    for (const place of result.results) {
      if (!place.geometry?.location) continue;
      const { lat, lng } = place.geometry.location;
      const addr = parseAddress(place.address_components);

      // Skip if already exists
      const existing = await prisma.freeOvernightSpot.findFirst({
        where: { googlePlaceId: place.place_id }
      });
      if (existing) continue;

      await prisma.freeOvernightSpot.create({
        data: {
          name: place.name,
          chain: chain.name,
          category: chain.category,
          address: place.formatted_address,
          city: addr.city || null,
          state: addr.state || null,
          zip: addr.zip || null,
          latitude: lat,
          longitude: lng,
          is24Hours: chain.is24Hours || false,
          hasFuel: chain.hasFuel || false,
          hasFood: chain.hasFood || false,
          hasShowers: chain.hasShowers || false,
          allowsRvs: true,
          verified: false,
          googlePlaceId: place.place_id,
          rating: place.rating || null,
          sourceData: JSON.stringify({ name: place.name, vicinity: place.vicinity, types: place.types }),
        }
      });
      count++;
    }
    return count;
  } catch (e) {
    if (e.message?.includes('OVER_QUERY_LIMIT')) {
      console.log('Rate limited, waiting 2s...');
      await sleep(2000);
    }
    return 0;
  }
}

async function main() {
  console.log('Starting overnight spot collection...');
  let total = 0;

  for (const chain of CHAINS) {
    console.log(`\n📍 Collecting ${chain.name}...`);
    let chainCount = 0;
    for (const point of US_GRID) {
      const count = await collectChain(chain, point);
      chainCount += count;
      total += count;
      if (count > 0) process.stdout.write(`  +${count} near ${point.label} `);
      await sleep(150); // ~6 req/sec, well under Google's 50/sec limit
    }
    console.log(`\n  Total for ${chain.name}: ${chainCount}`);
  }

  const finalCount = await prisma.freeOvernightSpot.count();
  console.log(`\n✅ Done! Total overnight spots in DB: ${finalCount}`);
  await prisma.$disconnect();
}

main().catch(console.error);
