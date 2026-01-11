import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

interface OSMElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: {
    name?: string;
    'addr:city'?: string;
    'addr:state'?: string;
    'addr:country'?: string;
    phone?: string;
    website?: string;
    email?: string;
    description?: string;
    toilets?: string;
    shower?: string;
    drinking_water?: string;
    electricity?: string;
    internet_access?: string;
    'internet_access:fee'?: string;
    sanitary_dump_station?: string;
    fee?: string;
    capacity?: string;
    [key: string]: any;
  };
}

interface Region {
  name: string;
  state: string;
  bbox: string;
}

interface Progress {
  completedRegions: string[];
  totalImported: number;
  lastRun: string;
  skippedLowQuality: number;
}

const PROGRESS_FILE = path.join(__dirname, 'import-progress-quality.json');

// Comprehensive list of US states and Canadian provinces broken into smaller regions
const regions: Region[] = [
  // CALIFORNIA (broken into 4 regions due to size)
  { name: 'Northern California', state: 'California', bbox: '39,-124,42,-119' },
  { name: 'Bay Area California', state: 'California', bbox: '37,-123,39,-121' },
  { name: 'Central California', state: 'California', bbox: '35,-122,37,-118' },
  { name: 'Southern California', state: 'California', bbox: '32.5,-121,35,-114' },
  
  // TEXAS (broken into 4 regions)
  { name: 'North Texas', state: 'Texas', bbox: '33,-103,37,-94' },
  { name: 'East Texas', state: 'Texas', bbox: '29.5,-95,33,-93.5' },
  { name: 'Central Texas', state: 'Texas', bbox: '29,-100,32,-95' },
  { name: 'South Texas', state: 'Texas', bbox: '25.8,-100,29.5,-96' },
  
  // FLORIDA
  { name: 'North Florida', state: 'Florida', bbox: '29.5,-87.5,31,-80' },
  { name: 'Central Florida', state: 'Florida', bbox: '27.5,-82.7,29.5,-80' },
  { name: 'South Florida', state: 'Florida', bbox: '24.5,-81.8,27.5,-80' },
  
  // NORTHEAST
  { name: 'Maine', state: 'Maine', bbox: '43,-71,48,-66.9' },
  { name: 'New Hampshire', state: 'New Hampshire', bbox: '42.7,-72.6,45.3,-70.6' },
  { name: 'Vermont', state: 'Vermont', bbox: '42.7,-73.5,45.1,-71.5' },
  { name: 'Massachusetts', state: 'Massachusetts', bbox: '41.2,-73.5,42.9,-69.9' },
  { name: 'Rhode Island', state: 'Rhode Island', bbox: '41.1,-71.9,42.1,-71.1' },
  { name: 'Connecticut', state: 'Connecticut', bbox: '40.9,-73.7,42.1,-71.8' },
  { name: 'New York', state: 'New York', bbox: '40.4,-79.8,45.1,-71.8' },
  { name: 'New Jersey', state: 'New Jersey', bbox: '38.9,-75.6,41.4,-73.9' },
  { name: 'Pennsylvania', state: 'Pennsylvania', bbox: '39.7,-80.5,42.3,-74.7' },
  
  // MID-ATLANTIC
  { name: 'Delaware', state: 'Delaware', bbox: '38.4,-75.8,39.9,-74.9' },
  { name: 'Maryland', state: 'Maryland', bbox: '37.9,-79.5,39.7,-75' },
  { name: 'Virginia', state: 'Virginia', bbox: '36.5,-83.7,39.5,-75.2' },
  { name: 'West Virginia', state: 'West Virginia', bbox: '37.2,-82.7,40.7,-77.7' },
  
  // SOUTHEAST
  { name: 'North Carolina', state: 'North Carolina', bbox: '33.8,-84.4,36.6,-75.4' },
  { name: 'South Carolina', state: 'South Carolina', bbox: '32,-83.4,35.2,-78.5' },
  { name: 'Georgia', state: 'Georgia', bbox: '30.3,-85.7,35.1,-80.8' },
  { name: 'Alabama', state: 'Alabama', bbox: '30.1,-88.5,35.1,-84.9' },
  { name: 'Mississippi', state: 'Mississippi', bbox: '30.1,-91.7,35.1,-88.1' },
  { name: 'Louisiana', state: 'Louisiana', bbox: '28.9,-94.1,33.1,-88.8' },
  { name: 'Tennessee', state: 'Tennessee', bbox: '34.9,-90.4,36.7,-81.6' },
  { name: 'Kentucky', state: 'Kentucky', bbox: '36.5,-89.6,39.2,-81.9' },
  
  // MIDWEST
  { name: 'Ohio', state: 'Ohio', bbox: '38.4,-84.9,42,-80.5' },
  { name: 'Indiana', state: 'Indiana', bbox: '37.7,-88.1,41.8,-84.8' },
  { name: 'Illinois', state: 'Illinois', bbox: '36.9,-91.6,42.6,-87.5' },
  { name: 'Michigan', state: 'Michigan', bbox: '41.6,-90.5,48.3,-82.4' },
  { name: 'Wisconsin', state: 'Wisconsin', bbox: '42.4,-92.9,47.3,-86.2' },
  { name: 'Minnesota', state: 'Minnesota', bbox: '43.4,-97.3,49.4,-89.5' },
  { name: 'Iowa', state: 'Iowa', bbox: '40.3,-96.7,43.6,-90.1' },
  { name: 'Missouri', state: 'Missouri', bbox: '35.9,-95.8,40.6,-89.1' },
  
  // GREAT PLAINS
  { name: 'North Dakota', state: 'North Dakota', bbox: '45.9,-104.1,49,-96.5' },
  { name: 'South Dakota', state: 'South Dakota', bbox: '42.4,-104.1,46,-96.4' },
  { name: 'Nebraska', state: 'Nebraska', bbox: '39.9,-104.1,43.1,-95.3' },
  { name: 'Kansas', state: 'Kansas', bbox: '36.9,-102.1,40.1,-94.6' },
  { name: 'Oklahoma', state: 'Oklahoma', bbox: '33.6,-103,37.1,-94.4' },
  { name: 'Arkansas', state: 'Arkansas', bbox: '33,-94.7,36.6,-89.6' },
  
  // MOUNTAIN WEST
  { name: 'Montana', state: 'Montana', bbox: '44.3,-116.1,49.1,-104' },
  { name: 'Idaho', state: 'Idaho', bbox: '41.9,-117.3,49.1,-111' },
  { name: 'Wyoming', state: 'Wyoming', bbox: '40.9,-111.1,45.1,-104' },
  { name: 'Colorado', state: 'Colorado', bbox: '36.9,-109.1,41.1,-102' },
  { name: 'Utah', state: 'Utah', bbox: '36.9,-114.1,42.1,-109' },
  { name: 'Nevada', state: 'Nevada', bbox: '35,-120,42,-114' },
  
  // SOUTHWEST
  { name: 'Arizona', state: 'Arizona', bbox: '31.3,-114.9,37.1,-109' },
  { name: 'New Mexico', state: 'New Mexico', bbox: '31.3,-109.1,37.1,-103' },
  
  // PACIFIC NORTHWEST
  { name: 'Washington West', state: 'Washington', bbox: '45.5,-124.8,49,-120' },
  { name: 'Washington East', state: 'Washington', bbox: '45.5,-120,49,-116.9' },
  { name: 'Oregon West', state: 'Oregon', bbox: '41.9,-124.6,46.3,-120' },
  { name: 'Oregon East', state: 'Oregon', bbox: '41.9,-120,46.3,-116.5' },
  
  // ALASKA
  { name: 'Alaska South', state: 'Alaska', bbox: '51,-170,61,-130' },
  { name: 'Alaska North', state: 'Alaska', bbox: '61,-170,71.5,-130' },
  
  // HAWAII
  { name: 'Hawaii', state: 'Hawaii', bbox: '18.9,-160,22.3,-154.8' },
  
  // CANADA - WESTERN
  { name: 'British Columbia South', state: 'British Columbia', bbox: '48,-139,52,-114' },
  { name: 'British Columbia North', state: 'British Columbia', bbox: '52,-139,60,-114' },
  { name: 'Alberta', state: 'Alberta', bbox: '49,-120,60,-110' },
  { name: 'Saskatchewan', state: 'Saskatchewan', bbox: '49,-110,60,-101.4' },
  { name: 'Manitoba', state: 'Manitoba', bbox: '49,-102,60,-88.9' },
  
  // CANADA - CENTRAL
  { name: 'Ontario West', state: 'Ontario', bbox: '41.6,-95.2,51,-80' },
  { name: 'Ontario East', state: 'Ontario', bbox: '41.6,-80,51.6,-74.3' },
  { name: 'Quebec West', state: 'Quebec', bbox: '45,-79.8,51,-71' },
  { name: 'Quebec East', state: 'Quebec', bbox: '45,-71,51.6,-57' },
  
  // CANADA - ATLANTIC
  { name: 'New Brunswick', state: 'New Brunswick', bbox: '44.5,-69.1,48.1,-63.7' },
  { name: 'Nova Scotia', state: 'Nova Scotia', bbox: '43.3,-66.4,47.1,-59.7' },
  { name: 'Prince Edward Island', state: 'Prince Edward Island', bbox: '45.9,-64.5,47.1,-61.9' },
  { name: 'Newfoundland and Labrador', state: 'Newfoundland and Labrador', bbox: '46.6,-67.8,60.4,-52.6' },
  
  // CANADA - TERRITORIES
  { name: 'Yukon', state: 'Yukon', bbox: '60,-141,69.6,-123.8' },
  { name: 'Northwest Territories', state: 'Northwest Territories', bbox: '60,-136.5,78,-102' },
  { name: 'Nunavut', state: 'Nunavut', bbox: '60,-120,83,-61' },
];

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    const data = fs.readFileSync(PROGRESS_FILE, 'utf-8');
    return JSON.parse(data);
  }
  return {
    completedRegions: [],
    totalImported: 0,
    lastRun: '',
    skippedLowQuality: 0
  };
}

function saveProgress(progress: Progress): void {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// QUALITY VALIDATION FUNCTIONS
function isValidName(name: string | undefined): boolean {
  if (!name) return false;
  
  // Reject numbered names like "#1", "#2", etc.
  if (/^#\d+$/.test(name.trim())) return false;
  
  // Reject single character names
  if (name.trim().length < 2) return false;
  
  // Reject names that are just numbers
  if (/^\d+$/.test(name.trim())) return false;
  
  // Reject generic names
  const genericNames = ['campground', 'camping', 'site', 'camp', 'rv park', 'park'];
  if (genericNames.includes(name.toLowerCase().trim())) return false;
  
  return true;
}

function isValidCoordinates(lat: number | undefined, lon: number | undefined): boolean {
  if (lat === undefined || lon === undefined) return false;
  
  // Basic sanity check for North America
  if (lat < 24 || lat > 83) return false; // Covers US and Canada latitude range
  if (lon < -170 || lon > -50) return false; // Covers US and Canada longitude range
  
  return true;
}

function hasMinimumQuality(element: OSMElement): boolean {
  const name = element.tags?.name;
  const lat = element.lat || element.center?.lat;
  const lon = element.lon || element.center?.lon;
  
  // Must have valid name
  if (!isValidName(name)) return false;
  
  // Must have valid coordinates
  if (!isValidCoordinates(lat, lon)) return false;
  
  return true;
}

async function fetchCampgroundsForRegion(bbox: string, regionName: string): Promise<OSMElement[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["tourism"="camp_site"](${bbox});
      node["tourism"="caravan_site"](${bbox});
      way["tourism"="camp_site"](${bbox});
      way["tourism"="caravan_site"](${bbox});
      relation["tourism"="camp_site"](${bbox});
      relation["tourism"="caravan_site"](${bbox});
    );
    out center;
  `;

  try {
    console.log(`  Fetching data from OpenStreetMap...`);
    const response = await axios.post(
      'https://overpass-api.de/api/interpreter',
      query,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 90000
      }
    );

    const elements = response.data.elements || [];
    console.log(`  Found ${elements.length} total campgrounds`);
    
    // Filter for quality
    const qualityElements = elements.filter(hasMinimumQuality);
    console.log(`  ${qualityElements.length} passed quality filters`);
    console.log(`  ${elements.length - qualityElements.length} rejected (low quality)`);
    
    return qualityElements;
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.response?.status === 504) {
      console.log(`  ⏱️  Timeout - region too large, will skip for now`);
      return [];
    }
    console.error(`  Error fetching region: ${error.message}`);
    return [];
  }
}

function parseAmenities(tags: any): string[] {
  const amenities: string[] = [];

  if (tags.toilets === 'yes') amenities.push('RESTROOMS');
  if (tags.shower === 'yes' || tags.showers === 'yes') amenities.push('SHOWERS');
  if (tags.drinking_water === 'yes') amenities.push('DRINKING_WATER');
  if (tags.electricity === 'yes' || tags['electricity:hookup'] === 'yes') amenities.push('ELECTRIC_HOOKUPS');
  if (tags.internet_access === 'yes' || tags.internet_access === 'wlan') {
    if (tags['internet_access:fee'] !== 'yes') {
      amenities.push('WIFI');
    }
  }
  if (tags.sanitary_dump_station === 'yes') amenities.push('DUMP_STATION');
  if (tags.fee === 'no') amenities.push('FREE');
  if (tags.shop || tags.kiosk) amenities.push('CAMP_STORE');
  if (tags.restaurant || tags.food) amenities.push('RESTAURANT');
  if (tags.playground === 'yes') amenities.push('PLAYGROUND');
  if (tags.laundry === 'yes') amenities.push('LAUNDRY');
  if (tags.beach_access === 'yes' || tags.natural === 'beach') amenities.push('BEACH');
  if (tags.swimming_pool === 'yes' || tags.pool === 'yes') amenities.push('POOL');

  return amenities;
}

async function importCampground(element: OSMElement, defaultState: string): Promise<boolean> {
  try {
    const name = element.tags?.name;
    if (!name) return false;

    const lat = element.lat || element.center?.lat;
    const lon = element.lon || element.center?.lon;
    if (!lat || !lon) return false;

    const slug = name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 100);

    // Check if already exists
    const existing = await prisma.campground.findFirst({
      where: {
        OR: [
          { slug },
          {
            AND: [
              { name },
              { latitude: lat },
              { longitude: lon }
            ]
          }
        ]
      }
    });

    if (existing) {
      return false; // Skip duplicate
    }

    const city = element.tags?.['addr:city'] || element.tags?.['addr:town'] || 'Unknown';
    const state = element.tags?.['addr:state'] || defaultState;
    const location = `${city}, ${state}`;
    const amenities = parseAmenities(element.tags || {});

    await prisma.campground.create({
      data: {
        name,
        slug,
        location,
        state,
        latitude: lat,
        longitude: lon,
        amenities,
        description: element.tags?.description || `${name} in ${location}`,
        phone: element.tags?.phone,
        website: element.tags?.website,
        email: element.tags?.email,
      }
    });

    return true;
  } catch (error: any) {
    // Silently skip errors (likely duplicates or validation issues)
    return false;
  }
}

async function main() {
  console.log('🏕️  QUALITY-FILTERED OSM Campground Import');
  console.log('📊 This will import only HIGH-QUALITY campgrounds with:');
  console.log('   ✅ Real names (not numbered)');
  console.log('   ✅ Valid coordinates');
  console.log('   ✅ Minimum required data');
  console.log('');

  const progress = loadProgress();
  console.log(`📍 Progress: ${progress.completedRegions.length}/${regions.length} regions completed`);
  console.log(`✅ Total imported so far: ${progress.totalImported}`);
  console.log(`⏭️  Skipped low quality: ${progress.skippedLowQuality}`);
  console.log('');

  const remainingRegions = regions.filter(r => !progress.completedRegions.includes(r.name));

  if (remainingRegions.length === 0) {
    console.log('✅ All regions already completed!');
    console.log(`📊 Final Stats:`);
    console.log(`   - Total campgrounds imported: ${progress.totalImported}`);
    console.log(`   - Total low-quality skipped: ${progress.skippedLowQuality}`);
    await prisma.$disconnect();
    return;
  }

  console.log(`🚀 Starting import of ${remainingRegions.length} remaining regions...`);
  console.log('💡 This can be stopped anytime (Ctrl+C) and resumed later');
  console.log('');

  let sessionImported = 0;
  let sessionSkipped = 0;

  for (let i = 0; i < remainingRegions.length; i++) {
    const region = remainingRegions[i];
    console.log(`\n[${i + 1}/${remainingRegions.length}] Processing: ${region.name}`);

    const elements = await fetchCampgroundsForRegion(region.bbox, region.name);
    
    const lowQualityCount = elements.length;
    
    let imported = 0;
    for (const element of elements) {
      const success = await importCampground(element, region.state);
      if (success) {
        imported++;
        sessionImported++;
        if (imported % 10 === 0) {
          process.stdout.write(`  Imported: ${imported}/${elements.length}\r`);
        }
      }
    }

    console.log(`  ✅ Imported ${imported} high-quality campgrounds from ${region.name}`);

    // Mark region as complete
    progress.completedRegions.push(region.name);
    progress.totalImported += imported;
    progress.skippedLowQuality += lowQualityCount;
    progress.lastRun = new Date().toISOString();
    saveProgress(progress);

    // Wait 3 seconds between regions to be nice to the API
    if (i < remainingRegions.length - 1) {
      console.log('  ⏳ Waiting 3 seconds...');
      await delay(3000);
    }
  }

  console.log('\n\n✅ Import Session Complete!');
  console.log(`📊 Session Stats:`);
  console.log(`   - Regions processed: ${remainingRegions.length}`);
  console.log(`   - Campgrounds imported: ${sessionImported}`);
  console.log(`   - Low-quality skipped: ${sessionSkipped}`);
  console.log(`\n📊 Total Stats:`);
  console.log(`   - Total regions completed: ${progress.completedRegions.length}/${regions.length}`);
  console.log(`   - Total campgrounds in database: ${progress.totalImported}`);
  console.log(`   - Total low-quality skipped: ${progress.skippedLowQuality}`);

  await prisma.$disconnect();
}

main().catch(console.error);
