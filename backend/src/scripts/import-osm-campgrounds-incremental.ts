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
    sanitary_dump_station?: string;
    [key: string]: any;
  };
}

interface OverpassResponse {
  elements: OSMElement[];
}

// US States with smaller bounding boxes
const regions = [
  // West Coast
  { name: 'California - North', state: 'California', bbox: '(39.5,-124,42,-119.5)' },
  { name: 'California - Central', state: 'California', bbox: '(36,-122,39.5,-117)' },
  { name: 'California - South', state: 'California', bbox: '(32.5,-121,36,-114)' },
  { name: 'Oregon - West', state: 'Oregon', bbox: '(42,-124.6,46,-121)' },
  { name: 'Oregon - East', state: 'Oregon', bbox: '(42,-121,46,-116.5)' },
  { name: 'Washington - West', state: 'Washington', bbox: '(45.5,-124.8,49,-120.5)' },
  { name: 'Washington - East', state: 'Washington', bbox: '(45.5,-120.5,49,-116.9)' },
  
  // Mountain West
  { name: 'Idaho - North', state: 'Idaho', bbox: '(45,-117,49,-111)' },
  { name: 'Idaho - South', state: 'Idaho', bbox: '(42,-117,45,-111)' },
  { name: 'Montana - West', state: 'Montana', bbox: '(44.5,-116,49,-110)' },
  { name: 'Montana - East', state: 'Montana', bbox: '(44.5,-110,49,-104)' },
  { name: 'Wyoming', state: 'Wyoming', bbox: '(41,-111,45,-104)' },
  { name: 'Colorado - West', state: 'Colorado', bbox: '(37,-109,41,-105.5)' },
  { name: 'Colorado - East', state: 'Colorado', bbox: '(37,-105.5,41,-102)' },
  { name: 'Utah', state: 'Utah', bbox: '(37,-114,42,-109)' },
  { name: 'Nevada', state: 'Nevada', bbox: '(35,-120,42,-114)' },
  { name: 'Arizona - North', state: 'Arizona', bbox: '(34.5,-114.8,37,-109)' },
  { name: 'Arizona - South', state: 'Arizona', bbox: '(31,-114.8,34.5,-109)' },
  { name: 'New Mexico', state: 'New Mexico', bbox: '(31.3,-109,37,-103)' },
  
  // Southwest
  { name: 'Texas - West', state: 'Texas', bbox: '(31.8,-106.6,36.5,-100)' },
  { name: 'Texas - East', state: 'Texas', bbox: '(25.8,-100,36.5,-93.5)' },
  { name: 'Oklahoma', state: 'Oklahoma', bbox: '(33.6,-103,37,-94.4)' },
  
  // Plains
  { name: 'North Dakota', state: 'North Dakota', bbox: '(45.9,-104,49,-96.6)' },
  { name: 'South Dakota', state: 'South Dakota', bbox: '(42.5,-104.1,46,-96.4)' },
  { name: 'Nebraska', state: 'Nebraska', bbox: '(40,-104,43,-95.3)' },
  { name: 'Kansas', state: 'Kansas', bbox: '(37,-102.1,40,-94.6)' },
  
  // Midwest
  { name: 'Minnesota', state: 'Minnesota', bbox: '(43.5,-97.2,49,-89.5)' },
  { name: 'Wisconsin', state: 'Wisconsin', bbox: '(42.5,-92.9,47,-86.2)' },
  { name: 'Iowa', state: 'Iowa', bbox: '(40.4,-96.6,43.5,-90.1)' },
  { name: 'Missouri', state: 'Missouri', bbox: '(36,-95.8,40.6,-89.1)' },
  { name: 'Illinois', state: 'Illinois', bbox: '(37,-91.5,42.5,-87.5)' },
  { name: 'Indiana', state: 'Indiana', bbox: '(37.8,-88,41.8,-84.8)' },
  { name: 'Michigan - Lower', state: 'Michigan', bbox: '(41.7,-87,45.8,-82.4)' },
  { name: 'Michigan - Upper', state: 'Michigan', bbox: '(45.1,-90.4,48.3,-83.4)' },
  { name: 'Ohio', state: 'Ohio', bbox: '(38.4,-84.8,42,-80.5)' },
  
  // South
  { name: 'Arkansas', state: 'Arkansas', bbox: '(33,-94.6,36.5,-89.6)' },
  { name: 'Louisiana', state: 'Louisiana', bbox: '(28.9,-94,33,-88.8)' },
  { name: 'Mississippi', state: 'Mississippi', bbox: '(30.2,-91.7,35,-88.1)' },
  { name: 'Alabama', state: 'Alabama', bbox: '(30.2,-88.5,35,-84.9)' },
  { name: 'Tennessee', state: 'Tennessee', bbox: '(35,-90.3,36.7,-81.6)' },
  { name: 'Kentucky', state: 'Kentucky', bbox: '(36.5,-89.6,39.1,-81.9)' },
  { name: 'West Virginia', state: 'West Virginia', bbox: '(37.2,-82.6,40.6,-77.7)' },
  { name: 'Virginia', state: 'Virginia', bbox: '(36.5,-83.7,39.5,-75.2)' },
  { name: 'Georgia', state: 'Georgia', bbox: '(30.4,-85.6,35,-80.8)' },
  { name: 'South Carolina', state: 'South Carolina', bbox: '(32,-83.4,35.2,-78.5)' },
  { name: 'North Carolina', state: 'North Carolina', bbox: '(33.8,-84.3,36.6,-75.4)' },
  { name: 'Florida - North', state: 'Florida', bbox: '(29.5,-87.6,31,-79.9)' },
  { name: 'Florida - Central', state: 'Florida', bbox: '(27.6,-82.7,29.5,-79.9)' },
  { name: 'Florida - South', state: 'Florida', bbox: '(24.5,-81.8,27.6,-80)' },
  
  // Northeast
  { name: 'Maryland', state: 'Maryland', bbox: '(37.9,-79.5,39.7,-75)' },
  { name: 'Delaware', state: 'Delaware', bbox: '(38.4,-75.8,39.8,-75)' },
  { name: 'Pennsylvania', state: 'Pennsylvania', bbox: '(39.7,-80.5,42,-74.7)' },
  { name: 'New Jersey', state: 'New Jersey', bbox: '(38.9,-75.6,41.4,-73.9)' },
  { name: 'New York - West', state: 'New York', bbox: '(42,-79.8,45,-76)' },
  { name: 'New York - East', state: 'New York', bbox: '(40.5,-76,45,-71.8)' },
  { name: 'Connecticut', state: 'Connecticut', bbox: '(41,-73.7,42.1,-71.8)' },
  { name: 'Rhode Island', state: 'Rhode Island', bbox: '(41.1,-71.9,42.1,-71.1)' },
  { name: 'Massachusetts', state: 'Massachusetts', bbox: '(41.2,-73.5,42.9,-69.9)' },
  { name: 'Vermont', state: 'Vermont', bbox: '(42.7,-73.4,45.1,-71.5)' },
  { name: 'New Hampshire', state: 'New Hampshire', bbox: '(42.7,-72.6,45.3,-70.6)' },
  { name: 'Maine', state: 'Maine', bbox: '(43,-71.1,47.5,-66.9)' },
  
  // Canada
  { name: 'British Columbia - South', state: 'British Columbia', bbox: '(48,-139,52,-114)' },
  { name: 'British Columbia - North', state: 'British Columbia', bbox: '(52,-135,60,-120)' },
  { name: 'Alberta - South', state: 'Alberta', bbox: '(49,-120,53,-110)' },
  { name: 'Alberta - North', state: 'Alberta', bbox: '(53,-120,60,-110)' },
  { name: 'Saskatchewan', state: 'Saskatchewan', bbox: '(49,-110,60,-101.4)' },
  { name: 'Manitoba', state: 'Manitoba', bbox: '(49,-102,60,-88.9)' },
  { name: 'Ontario - West', state: 'Ontario', bbox: '(42,-95.2,51.5,-84)' },
  { name: 'Ontario - East', state: 'Ontario', bbox: '(42,-84,51.5,-74.3)' },
  { name: 'Quebec - West', state: 'Quebec', bbox: '(45,-79.8,51.2,-71.2)' },
  { name: 'Quebec - East', state: 'Quebec', bbox: '(45,-71.2,51.2,-56.8)' },
  { name: 'New Brunswick', state: 'New Brunswick', bbox: '(44.6,-69.1,48.1,-63.7)' },
  { name: 'Nova Scotia', state: 'Nova Scotia', bbox: '(43.4,-66.3,47.1,-59.7)' },
  { name: 'Prince Edward Island', state: 'Prince Edward Island', bbox: '(46,-64.4,47,-62)' },
  { name: 'Newfoundland', state: 'Newfoundland and Labrador', bbox: '(46.6,-59.5,51.6,-52.6)' },
];

const PROGRESS_FILE = path.join(__dirname, 'import-progress.json');
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Progress {
  completedRegions: string[];
  totalImported: number;
  lastRun: string;
}

function loadProgress(): Progress {
  if (fs.existsSync(PROGRESS_FILE)) {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf-8'));
  }
  return { completedRegions: [], totalImported: 0, lastRun: '' };
}

function saveProgress(progress: Progress) {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

async function fetchCampgroundsForRegion(bbox: string, regionName: string): Promise<OSMElement[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["tourism"="camp_site"]${bbox};
      node["tourism"="caravan_site"]${bbox};
    );
    out center;
  `;

  try {
    console.log(`  Fetching campgrounds for ${regionName}...`);
    const response = await axios.post<OverpassResponse>(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 60000,
      }
    );

    console.log(`  ✅ Found ${response.data.elements.length} campgrounds`);
    return response.data.elements;
  } catch (error: any) {
    console.error(`  ❌ Error fetching ${regionName}:`, error.message);
    return [];
  }
}

function parseAmenities(tags: any): string[] {
  const amenities: string[] = [];
  if (tags.toilets === 'yes') amenities.push('RESTROOMS');
  if (tags.shower === 'yes') amenities.push('SHOWERS');
  if (tags.drinking_water === 'yes') amenities.push('WATER');
  if (tags.electricity === 'yes') amenities.push('ELECTRIC_HOOKUPS');
  if (tags.internet_access === 'yes' || tags.internet_access === 'wlan') amenities.push('WIFI');
  if (tags.sanitary_dump_station === 'yes') amenities.push('DUMP_STATION');
  if (tags.swimming_pool === 'yes') amenities.push('POOL');
  if (tags.playground === 'yes') amenities.push('PLAYGROUND');
  if (tags.restaurant === 'yes') amenities.push('RESTAURANT');
  if (tags.shop === 'yes' || tags.shop) amenities.push('CAMP_STORE');
  if (tags.bbq === 'yes') amenities.push('FIRE_PITS');
  if (tags.picnic_table === 'yes') amenities.push('PICNIC_TABLES');
  return amenities;
}

function createSlug(name: string, state?: string, id?: number): string {
  const parts = [name];
  if (state) parts.push(state);
  
  let slug = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (id) slug = `${slug}-${id}`;
  return slug.substring(0, 100);
}

async function importCampground(element: OSMElement, regionState: string): Promise<boolean> {
  try {
    const tags = element.tags || {};
    const name = tags.name;
    
    if (!name) return false;

    let lat: number | undefined;
    let lon: number | undefined;

    if (element.lat && element.lon) {
      lat = element.lat;
      lon = element.lon;
    } else if (element.center) {
      lat = element.center.lat;
      lon = element.center.lon;
    }

    if (!lat || !lon) return false;

    const locationParts: string[] = [];
    if (tags['addr:city']) locationParts.push(tags['addr:city']);
    const state = tags['addr:state'] || regionState;
    if (state) locationParts.push(state);
    const location = locationParts.join(', ') || `${regionState}`;

    const slug = createSlug(name, state, element.id);

    const existing = await prisma.campground.findFirst({
      where: { name, state: state || undefined },
    });

    if (existing) return false;

    const amenities = parseAmenities(tags);

    await prisma.campground.create({
      data: {
        name,
        location,
        state: state || undefined,
        description: tags.description || `Campground in ${location}`,
        latitude: lat,
        longitude: lon,
        amenities,
        websiteUrl: tags.website,
        businessPhone: tags.phone,
        businessEmail: tags.email,
      },
    });

    return true;
  } catch (error: any) {
    if (!error.message.includes('Unique constraint')) {
      console.error(`    ❌ Error importing campground:`, error.message);
    }
    return false;
  }
}

async function main() {
  console.log('🏕️  Starting Incremental OSM Campground Import');
  console.log(`📊 Total regions to process: ${regions.length}\n`);

  const progress = loadProgress();
  const remainingRegions = regions.filter(r => !progress.completedRegions.includes(r.name));

  console.log(`✅ Already completed: ${progress.completedRegions.length} regions`);
  console.log(`📍 Remaining: ${remainingRegions.length} regions`);
  console.log(`📊 Total imported so far: ${progress.totalImported}\n`);

  if (remainingRegions.length === 0) {
    console.log('🎉 All regions already imported!');
    return;
  }

  let sessionImported = 0;

  for (let i = 0; i < remainingRegions.length; i++) {
    const region = remainingRegions[i];
    console.log(`\n[${i + 1}/${remainingRegions.length}] Processing: ${region.name}`);

    const elements = await fetchCampgroundsForRegion(region.bbox, region.name);
    
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

    console.log(`  ✅ Imported ${imported} new campgrounds from ${region.name}`);

    // Mark region as complete
    progress.completedRegions.push(region.name);
    progress.totalImported += imported;
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
  console.log(`   - Regions processed this session: ${remainingRegions.length}`);
  console.log(`   - Campgrounds imported this session: ${sessionImported}`);
  console.log(`   - Total regions completed: ${progress.completedRegions.length}/${regions.length}`);
  console.log(`   - Total campgrounds in database: ${progress.totalImported}`);

  await prisma.$disconnect();
}

main().catch(console.error);
