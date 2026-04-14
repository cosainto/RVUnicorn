import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

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
    'addr:postcode'?: string;
    phone?: string;
    website?: string;
    email?: string;
    description?: string;
    capacity?: string;
    fee?: string;
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

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Simplified approach - just get campgrounds without geographic filtering
async function fetchCampgrounds(limit = 10000, skip = 0): Promise<OSMElement[]> {
  const query = `
    [out:json][timeout:90];
    (
      node["tourism"="camp_site"];
      node["tourism"="caravan_site"];
    );
    out center ${limit};
  `;

  try {
    console.log(`Fetching campgrounds (limit: ${limit}, skip: ${skip})...`);
    const response = await axios.post<OverpassResponse>(
      'https://overpass-api.de/api/interpreter',
      `data=${encodeURIComponent(query)}`,
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 90000,
      }
    );

    console.log(`✅ Found ${response.data.elements.length} campgrounds`);
    return response.data.elements;
  } catch (error: any) {
    console.error(`❌ Error fetching campgrounds:`, error.message);
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

function createSlug(name: string, city?: string, state?: string, id?: number): string {
  const parts = [name];
  if (city) parts.push(city);
  if (state) parts.push(state);
  
  let slug = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

  if (id) {
    slug = `${slug}-${id}`;
  }

  return slug.substring(0, 100); // Limit length
}

async function importCampground(element: OSMElement): Promise<boolean> {
  try {
    const tags = element.tags || {};
    const name = tags.name;
    
    if (!name) {
      return false;
    }

    let lat: number | undefined;
    let lon: number | undefined;

    if (element.lat && element.lon) {
      lat = element.lat;
      lon = element.lon;
    } else if (element.center) {
      lat = element.center.lat;
      lon = element.center.lon;
    }

    if (!lat || !lon) {
      return false;
    }

    // Filter to only US and Canada based on coordinates
    // US: roughly lat 25-49, lon -125 to -67
    // Canada: roughly lat 42-70, lon -141 to -52
    const isUS = lat >= 25 && lat <= 49 && lon >= -125 && lon <= -67;
    const isCanada = lat >= 42 && lat <= 70 && lon >= -141 && lon <= -52;

    if (!isUS && !isCanada) {
      return false;
    }

    const locationParts: string[] = [];
    if (tags['addr:city']) locationParts.push(tags['addr:city']);
    if (tags['addr:state']) locationParts.push(tags['addr:state']);
    if (tags['addr:country']) locationParts.push(tags['addr:country']);
    const location = locationParts.join(', ') || 'Location TBD';

    const slug = createSlug(name, tags['addr:city'], tags['addr:state'], element.id);

    const existing = await prisma.campground.findUnique({
      where: { slug },
    });

    if (existing) {
      return false;
    }

    const amenities = parseAmenities(tags);

    await prisma.campground.create({
      data: {
        name,
        slug,
        location,
        state: tags['addr:state'] || undefined,
        description: tags.description || `Campground located in ${location}. Contact for more details.`,
        latitude: lat,
        longitude: lon,
        amenities,
        website: tags.website,
        phone: tags.phone,
        email: tags.email,
        smoresRating: 0,
      },
    });

    return true;
  } catch (error: any) {
    if (!error.message.includes('Unique constraint')) {
      console.error(`❌ Error importing ${element.id}:`, error.message);
    }
    return false;
  }
}

async function main() {
  console.log('🏕️  Starting OSM Campground Import');
  console.log('📍 Fetching worldwide campgrounds from OpenStreetMap...');
  console.log('🌎 Will filter to US & Canada by coordinates\n');

  const elements = await fetchCampgrounds();

  if (elements.length === 0) {
    console.log('❌ No campgrounds fetched. Exiting.');
    return;
  }

  console.log(`\n💾 Starting import to database...\n`);

  let imported = 0;
  let skipped = 0;
  let outOfRegion = 0;

  for (let i = 0; i < elements.length; i++) {
    const element = elements[i];
    
    const success = await importCampground(element);
    
    if (success) {
      imported++;
      if (element.tags?.name) {
        console.log(`✅ [${imported}] ${element.tags.name} - ${element.tags['addr:state'] || 'Unknown'}`);
      }
    } else {
      skipped++;
    }

    if ((i + 1) % 100 === 0) {
      console.log(`\n📈 Progress: ${i + 1}/${elements.length} (✅ ${imported} imported, ⏭️  ${skipped} skipped)\n`);
    }

    if (i % 10 === 0) {
      await delay(10);
    }
  }

  console.log('\n\n✅ Import Complete!');
  console.log(`📊 Final Stats:`);
  console.log(`   - Total fetched: ${elements.length}`);
  console.log(`   - Successfully imported: ${imported}`);
  console.log(`   - Skipped: ${skipped}`);
  console.log(`\n🎉 Your database now has ${imported} campgrounds!`);

  await prisma.$disconnect();
}

main()
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
