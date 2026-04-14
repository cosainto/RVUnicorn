import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

const RIDB_API_KEY = process.env.RIDB_API_KEY || '0df4c4d6-1be3-4f76-99b0-0ab0a676a8fa';
const BASE_URL = 'https://ridb.recreation.gov/api/v1';

interface RIDBFacility {
  FacilityID: string;
  FacilityName: string;
  FacilityDescription: string;
  FacilityTypeDescription: string;
  FacilityLatitude: number;
  FacilityLongitude: number;
  FacilityAdaAccess: string;
  GEOJSON: any;
  FacilityPhone?: string;
  FacilityEmail?: string;
  FacilityReservationURL?: string;
  FacilityDirections?: string;
  Reservable?: boolean;
  Enabled?: boolean;
  FACILITYADDRESS?: Array<{
    FacilityAddressType: string;
    FacilityStreetAddress1: string;
    FacilityStreetAddress2?: string;
    FacilityStreetAddress3?: string;
    City: string;
    AddressStateCode: string;
    PostalCode: string;
    AddressCountryCode: string;
  }>;
}

async function fetchFacilityDetails(facilityId: string): Promise<RIDBFacility | null> {
  try {
    const url = `${BASE_URL}/facilities/${facilityId}?apikey=${RIDB_API_KEY}&full=true`;
    const response = await fetch(url);
    if (!response.ok) return null;
    return await response.json() as any;
  } catch {
    return null;
  }
}

async function fetchCampgrounds(offset: number = 0, limit: number = 50): Promise<{ data: RIDBFacility[], total: number }> {
  const url = `${BASE_URL}/facilities?limit=${limit}&offset=${offset}&apikey=${RIDB_API_KEY}&activity=CAMPING&full=true`;
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  const data: any = await response.json() as any;
  return {
    data: data.RECDATA || [],
    total: data.METADATA?.RESULTS?.TOTAL_COUNT || 0
  };
}

function getAddressInfo(facility: RIDBFacility): { location: string, state: string | null, street: string | null } {
  if (facility.FACILITYADDRESS && facility.FACILITYADDRESS.length > 0) {
    const addr = facility.FACILITYADDRESS[0];
    const city = addr.City || '';
    const state = addr.AddressStateCode || null;
    const street = addr.FacilityStreetAddress1 || null;
    const zip = addr.PostalCode || '';
    
    // Build location string
    const locationParts = [];
    if (city) locationParts.push(city);
    if (state) locationParts.push(state);
    if (zip) locationParts.push(zip);
    
    const location = locationParts.length > 0 ? locationParts.join(', ') : 'USA';
    
    return { location, state, street };
  }
  return { location: 'USA', state: null, street: null };
}

async function updateCampgrounds() {
  console.log('🏕️ Updating Campground Location Data...\n');
  
  let offset = 0;
  const limit = 50;
  let totalUpdated = 0;
  let totalSkipped = 0;
  
  // First, get total count
  const initial = await fetchCampgrounds(0, 1);
  const totalAvailable = initial.total;
  console.log(`📊 Total campgrounds available: ${totalAvailable}\n`);
  
  while (true) {
    try {
      console.log(`Fetching campgrounds ${offset} to ${offset + limit}...`);
      const { data: facilities } = await fetchCampgrounds(offset, limit);
      
      if (facilities.length === 0) {
        console.log('No more campgrounds to fetch.');
        break;
      }
      
      for (const facility of facilities) {
        if (!facility.FacilityName) continue;
        
        const name = facility.FacilityName.trim();
        const { location, state, street } = getAddressInfo(facility);
        
        // Find existing campground by name
        const existing = await prisma.campground.findFirst({
          where: { name: name }
        });
        
        if (existing) {
          // Update with better location data
          await prisma.campground.update({
            where: { id: existing.id },
            data: {
              location: location !== 'USA' ? location : existing.location,
              state: state || existing.state,
              latitude: facility.FacilityLatitude || existing.latitude,
              longitude: facility.FacilityLongitude || existing.longitude,
            }
          });
          totalUpdated++;
        } else {
          // Create new
          await prisma.campground.create({
            data: {
              name,
              location,
              state,
              description: facility.FacilityDescription?.substring(0, 5000) || null,
              latitude: facility.FacilityLatitude || null,
              longitude: facility.FacilityLongitude || null,
              amenities: [],
            }
          });
          totalUpdated++;
        }
        
        if (totalUpdated % 100 === 0) {
          console.log(`✅ Updated ${totalUpdated} campgrounds...`);
        }
      }
      
      offset += limit;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Stop after 6000 for safety
      if (offset >= 6000) {
        console.log('Reached 6000 limit, stopping.');
        break;
      }
      
    } catch (error: any) {
      console.error('Error fetching batch:', error);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log('\n🎉 Update Complete!');
  console.log(`✅ Updated: ${totalUpdated}`);
  
  // Show sample of updated data
  const samples = await prisma.campground.findMany({
    where: { state: { not: null } },
    take: 5,
    select: { name: true, location: true, state: true }
  });
  console.log('\n📍 Sample campgrounds with location data:');
  samples.forEach((s: any) => console.log(`  - ${s.name}: ${s.location}, ${s.state}`));
}

updateCampgrounds()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
