import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient() as any;

// YOU NEED TO ADD YOUR API KEY HERE!
const RIDB_API_KEY = '0df4c4d6-1be3-4f76-99b0-0ab0a676a8fa';

const BASE_URL = 'https://ridb.recreation.gov/api/v1';
const REQUESTS_PER_MINUTE = 50; // API rate limit
const DELAY_MS = (60 * 1000) / REQUESTS_PER_MINUTE; // ~1.2 seconds between requests

interface Progress {
  totalImported: number;
  lastOffset: number;
  completed: boolean;
  lastRun: string;
}

const PROGRESS_FILE = path.join(__dirname, 'ridb-progress.json');

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return {
    totalImported: 0,
    lastOffset: 0,
    completed: false,
    lastRun: ''
  };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchFacilities(offset: number = 0, limit: number = 50): Promise<any> {
  try {
    const response = await axios.get(`${BASE_URL}/facilities`, {
      headers: {
        'apikey': RIDB_API_KEY,
        'accept': 'application/json'
      },
      params: {
        offset,
        limit,
        activity: 'CAMPING' // Filter for camping facilities
      }
    });

    return response.data;
  } catch (error: any) {
    if (error.response?.status === 429) {
      console.log('  ⏱️  Rate limited, waiting 60 seconds...');
      await delay(60000);
      return fetchFacilities(offset, limit);
    }
    throw error;
  }
}

function parseAmenities(facility: any): string[] {
  const amenities: string[] = [];
  
  const activities = facility.ACTIVITY || [];
  const facilityActivities = activities.map((a: any) => a.ActivityName?.toUpperCase() || '');

  // Map common activities to amenities
  if (facilityActivities.includes('CAMPING')) amenities.push('CAMPING');
  if (facilityActivities.includes('SWIMMING')) amenities.push('POOL');
  if (facilityActivities.includes('FISHING')) amenities.push('FISHING');
  if (facilityActivities.includes('HIKING')) amenities.push('TRAILS');
  if (facilityActivities.includes('BOATING')) amenities.push('BOAT_LAUNCH');
  if (facilityActivities.includes('BEACH')) amenities.push('BEACH');

  // Check facility description for common amenities
  const desc = (facility.FacilityDescription || '').toLowerCase();
  if (desc.includes('electric')) amenities.push('ELECTRIC_HOOKUPS');
  if (desc.includes('water')) amenities.push('WATER_HOOKUPS');
  if (desc.includes('sewer')) amenities.push('SEWER_HOOKUPS');
  if (desc.includes('shower')) amenities.push('SHOWERS');
  if (desc.includes('restroom') || desc.includes('bathroom')) amenities.push('RESTROOMS');
  if (desc.includes('wifi') || desc.includes('internet')) amenities.push('WIFI');
  if (desc.includes('dump')) amenities.push('DUMP_STATION');
  if (desc.includes('laundry')) amenities.push('LAUNDRY');
  if (desc.includes('store')) amenities.push('CAMP_STORE');
  if (desc.includes('playground')) amenities.push('PLAYGROUND');

  return [...new Set(amenities)]; // Remove duplicates
}

function getState(facility: any): string {
  // Try to get state from address
  const addresses = facility.FACILITYADDRESS || [];
  if (addresses.length > 0) {
    const state = addresses[0].AddressStateCode;
    if (state) return state;
  }

  // Fallback: try to extract from facility name or description
  return 'Unknown';
}

async function importFacility(facility: any): Promise<boolean> {
  try {
    const name = facility.FacilityName;
    if (!name || name.trim().length === 0) {
      return false; // Skip facilities without names
    }

    const lat = facility.FacilityLatitude;
    const lon = facility.FacilityLongitude;
    if (!lat || !lon) {
      return false; // Skip facilities without coordinates
    }

    // Create slug from facility name
    const slug = `${name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 80)}-${facility.FacilityID}`;

    // Check if already exists
    const existing = await prisma.campground.findFirst({
      where: {
        name: name,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon)
      }
    });

    if (existing) {
      return false; // Skip duplicate
    }

    // Get address info
    const addresses = facility.FACILITYADDRESS || [];
    const address = addresses[0] || {};
    const city = address.City || address.AddressCity || 'Unknown';
    const state = getState(facility);
    const location = city !== 'Unknown' ? `${city}, ${state}` : state;

    const amenities = parseAmenities(facility);
    const description = facility.FacilityDescription || `${name} - Federal recreation area`;

    await prisma.campground.create({
      data: {
        name,
        // slug removed,
        location,
        state,
        latitude: parseFloat(lat),
        longitude: parseFloat(lon),
        amenities,
        description: description.substring(0, 1000), // Limit description length

      }
    });

    return true;
  } catch (error: any) {
    console.error(`  Error importing ${facility.FacilityName}:`, error.message);
    return false;
  }
}

async function main() {
  console.log('🏕️  Recreation.gov (RIDB) Campground Import');
  console.log('');

  // Check API key
  if (RIDB_API_KEY === ('YOUR_API_KEY_HERE' as string)) {
    console.error('❌ ERROR: You need to add your API key!');
    console.error('');
    console.error('Steps:');
    console.error('1. Sign up at https://ridb.recreation.gov');
    console.error('2. Get your API key from the API docs portal');
    console.error('3. Edit this file and replace YOUR_API_KEY_HERE with your key');
    console.error('');
    process.exit(1);
  }

  const progress = loadProgress();
  
  if (progress.completed) {
    console.log('✅ Import already completed!');
    console.log(`📊 Total campgrounds imported: ${progress.totalImported}`);
    console.log('');
    console.log('To re-import, delete the ridb-progress.json file.');
    await prisma.$disconnect();
    return;
  }

  console.log(`📍 Progress: ${progress.totalImported} campgrounds imported so far`);
  console.log(`🚀 Starting from offset: ${progress.lastOffset}`);
  console.log('💡 This can be stopped anytime (Ctrl+C) and resumed later');
  console.log('');

  let offset = progress.lastOffset;
  let hasMore = true;
  let sessionImported = 0;

  while (hasMore) {
    console.log(`\n📥 Fetching facilities ${offset} to ${offset + 50}...`);

    try {
      const data = await fetchFacilities(offset, 50);
      const facilities = data.RECDATA || [];
      const total = data.METADATA?.RESULTS?.TOTAL_COUNT || 0;

      console.log(`  Found ${facilities.length} facilities (${offset}/${total} total)`);

      if (facilities.length === 0) {
        hasMore = false;
        break;
      }

      let imported = 0;
      for (const facility of facilities) {
        const success = await importFacility(facility);
        if (success) {
          imported++;
          sessionImported++;
          progress.totalImported++;
        }
      }

      console.log(`  ✅ Imported ${imported} new campgrounds from this batch`);

      // Update progress
      offset += 50;
      progress.lastOffset = offset;
      progress.lastRun = new Date().toISOString();
      saveProgress(progress);

      // Check if we've reached the end
      if (offset >= total) {
        hasMore = false;
        progress.completed = true;
        saveProgress(progress);
      }

      // Rate limiting delay
      if (hasMore) {
        console.log(`  ⏳ Waiting ${Math.round(DELAY_MS / 1000)} seconds (rate limit)...`);
        await delay(DELAY_MS);
      }

    } catch (error: any) {
      console.error(`\n❌ Error fetching facilities:`, error.message);
      console.error('Saving progress and exiting. Run again to resume.');
      saveProgress(progress);
      break;
    }
  }

  console.log('\n\n✅ Import Complete!');
  console.log(`📊 Final Stats:`);
  console.log(`   - Total campgrounds imported: ${progress.totalImported}`);
  console.log(`   - Campgrounds this session: ${sessionImported}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
