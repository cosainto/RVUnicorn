import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient() as any;

interface Progress {
  processedCount: number;
  lastId: string;
  completed: boolean;
}

const PROGRESS_FILE = path.join(__dirname, 'geocode-progress.json');
const DELAY_MS = 1100; // Nominatim requires 1 request per second

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return {
    processedCount: 0,
    lastId: '',
    completed: false
  };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function reverseGeocode(lat: number, lon: number): Promise<{ state: string; city: string } | null> {
  try {
    const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
      params: {
        lat,
        lon,
        format: 'json'
      },
      headers: {
        'User-Agent': 'KindleTribe/1.0'
      },
      timeout: 10000
    });

    const address = response.data.address || {};
    const state = address.state || address['ISO3166-2-lvl4']?.split('-')[1] || 'Unknown';
    const city = address.city || address.town || address.village || address.county || '';

    return { state, city };
  } catch (error: any) {
    console.error(`  Geocoding error: ${error.message}`);
    return null;
  }
}

async function main() {
  console.log('🗺️  Updating Campground States via Reverse Geocoding');
  console.log('');

  const progress = loadProgress();

  if (progress.completed) {
    console.log('✅ Update already completed!');
    console.log(`📊 Total campgrounds processed: ${progress.processedCount}`);
    await prisma.$disconnect();
    return;
  }

  // Get total count
  const total = await prisma.campground.count({
    where: {
      state: 'Unknown'
    }
  });

  console.log(`📍 Found ${total} campgrounds needing state updates`);
  console.log(`📍 Already processed: ${progress.processedCount}`);
  console.log(`⏱️  Estimated time: ~${Math.round((total - progress.processedCount) / 60)} minutes`);
  console.log('💡 This can be stopped anytime (Ctrl+C) and resumed later');
  console.log('');

  let processedThisSession = 0;
  let hasMore = true;

  while (hasMore) {
    // Fetch batch of 50 campgrounds
    const campgrounds = await prisma.campground.findMany({
      where: {
        state: 'Unknown',
        ...(progress.lastId ? { id: { gt: progress.lastId } } : {})
      },
      take: 50,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        latitude: true,
        longitude: true,
        location: true
      }
    });

    if (campgrounds.length === 0) {
      hasMore = false;
      progress.completed = true;
      saveProgress(progress);
      break;
    }

    console.log(`\n📥 Processing batch of ${campgrounds.length} campgrounds...`);

    for (const campground of campgrounds) {
      if (!campground.latitude || !campground.longitude) {
        console.log(`  ⏭️  Skipping ${campground.name} (no coordinates)`);
        progress.lastId = campground.id;
        progress.processedCount++;
        continue;
      }

      const geocodeResult = await reverseGeocode(campground.latitude, campground.longitude);

      if (geocodeResult) {
        const { state, city } = geocodeResult;
        const newLocation = city ? `${city}, ${state}` : state;

        await prisma.campground.update({
          where: { id: campground.id },
          data: {
            state,
            location: newLocation
          }
        });

        console.log(`  ✅ ${campground.name} → ${state}`);
        processedThisSession++;
      } else {
        console.log(`  ❌ Failed to geocode ${campground.name}`);
      }

      progress.lastId = campground.id;
      progress.processedCount++;
      saveProgress(progress);

      // Rate limiting - 1 request per second
      await delay(DELAY_MS);
    }

    console.log(`  Progress: ${progress.processedCount}/${total} (${Math.round((progress.processedCount / total) * 100)}%)`);
  }

  console.log('\n\n✅ State Update Complete!');
  console.log(`📊 Final Stats:`);
  console.log(`   - Total campgrounds processed: ${progress.processedCount}`);
  console.log(`   - Updated this session: ${processedThisSession}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
