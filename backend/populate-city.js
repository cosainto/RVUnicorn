/**
 * RVUnicorn — Add & Populate City Field
 * =======================================
 * 1. Assumes `city String?` has been added to schema and pushed
 * 2. Populates city from existing `location` field where possible
 * 3. Uses Google Places API to fill remaining gaps
 *
 * Run: node populate-city.js
 * Test: node populate-city.js --limit=50 --no-google
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();
const delay = (ms) => new Promise(r => setTimeout(r, ms));

const args = process.argv.slice(2);
const LIMIT = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '99999');
const NO_GOOGLE = args.includes('--no-google');
const GOOGLE_KEY = process.env.GOOGLE_MAPS_API_KEY;

// ─── Extract city from location string ────────────────────────────────────────
// location examples: "WY", "Disney, OK", "Lake George, NY", "Rocky Mountain National Park"
function extractCityFromLocation(location, state) {
  if (!location) return null;
  
  // If location is just the state code, no city info
  if (location.trim() === state?.trim()) return null;
  if (location.trim().length === 2 && location.trim() === location.trim().toUpperCase()) return null;
  
  // If location contains a comma, take everything before the last comma
  if (location.includes(',')) {
    const parts = location.split(',');
    const city = parts[0].trim();
    return city || null;
  }
  
  // If location doesn't contain the state, it might just be a city/area name
  if (state && !location.includes(state)) {
    return location.trim();
  }
  
  return null;
}

// ─── Get city from Google Places ──────────────────────────────────────────────
async function getCityFromGoogle(name, state, lat, lng) {
  if (!GOOGLE_KEY || NO_GOOGLE) return null;
  
  try {
    // Use reverse geocoding from coordinates if available
    if (lat && lng) {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_KEY}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (data.results?.[0]) {
        for (const result of data.results) {
          const cityComp = result.address_components?.find(c => 
            c.types.includes('locality') || c.types.includes('administrative_area_level_3')
          );
          if (cityComp) return cityComp.long_name;
        }
      }
    }
    
    // Fallback: text search
    const query = encodeURIComponent(`${name} campground ${state}`);
    const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${query}&key=${GOOGLE_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.results?.[0]?.formatted_address) {
      const addr = data.results[0].formatted_address;
      const parts = addr.split(',');
      if (parts.length >= 2) return parts[0].trim();
    }
  } catch (e) {}
  
  return null;
}

async function main() {
  console.log('🏙️  RVUnicorn City Field Populator');
  console.log('===================================');
  if (NO_GOOGLE) console.log('ℹ️  Google Places disabled');
  if (!GOOGLE_KEY && !NO_GOOGLE) console.log('⚠️  No GOOGLE_MAPS_API_KEY — will only use location field');

  // Count what we're working with
  const total = await prisma.campground.count();
  const withCity = await prisma.campground.count({ where: { city: { not: null } } });
  const noCity = total - withCity;
  console.log(`📊 Total: ${total} | With city: ${withCity} | Need city: ${noCity}\n`);

  // Phase 1: Extract city from existing location field
  console.log('Phase 1: Extracting from location field...');
  const campgrounds = await prisma.campground.findMany({
    where: { city: null },
    select: { id: true, name: true, state: true, location: true, latitude: true, longitude: true },
    take: LIMIT,
  });

  let fromLocation = 0, fromGoogle = 0, skipped = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const c = campgrounds[i];
    const pct = Math.round(((i + 1) / campgrounds.length) * 100);

    // Try extracting from location first (free, fast)
    const cityFromLocation = extractCityFromLocation(c.location, c.state);
    
    if (cityFromLocation) {
      await prisma.campground.update({
        where: { id: c.id },
        data: { city: cityFromLocation },
      });
      fromLocation++;
      if (i % 500 === 0) process.stdout.write(`\r  [${pct}%] From location: ${fromLocation}`);
      continue;
    }

    // Try Google Places for the rest
    if (GOOGLE_KEY && !NO_GOOGLE) {
      const city = await getCityFromGoogle(c.name, c.state, c.latitude, c.longitude);
      if (city) {
        await prisma.campground.update({
          where: { id: c.id },
          data: { city },
        });
        fromGoogle++;
        process.stdout.write(`\r  [${pct}%] Google: ${fromGoogle} | Location: ${fromLocation}`);
        await delay(50); // respect rate limits
      } else {
        skipped++;
      }
    } else {
      skipped++;
    }
  }

  console.log(`\n\n✅ From location field: ${fromLocation}`);
  console.log(`✅ From Google Places:  ${fromGoogle}`);
  console.log(`⚠️  No city found:       ${skipped}`);
  
  const finalWithCity = await prisma.campground.count({ where: { city: { not: null } } });
  console.log(`\n📊 Final: ${finalWithCity}/${total} campgrounds have city (${Math.round(finalWithCity/total*100)}%)`);

  await prisma.$disconnect();
}

main().catch(console.error);
