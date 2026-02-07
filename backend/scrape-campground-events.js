const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// System user ID for scraped events
const SYSTEM_USER_ID = 'cmjzxinqu00001auvffzsyutl'; // Your user ID as fallback

async function fetchRecGovEvents(facilityId) {
  try {
    const url = `https://www.recreation.gov/api/camps/campgrounds/${facilityId}/events`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'RVUnicorn/1.0 (contact@rvunicorn.com)',
      }
    });
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.events || data || [];
  } catch (error) {
    return [];
  }
}

// Extract facility ID from recreation.gov URL
function extractFacilityId(url) {
  if (!url) return null;
  
  // Pattern: /campgrounds/232447 or /camping/campgrounds/232447
  const match = url.match(/campgrounds\/(\d+)/i);
  if (match) return match[1];
  
  // Pattern: parkId=232447
  const parkIdMatch = url.match(/parkId=(\d+)/i);
  if (parkIdMatch) return parkIdMatch[1];
  
  return null;
}

async function main() {
  console.log('Fetching Recreation.gov campgrounds...');
  
  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { contains: 'recreation.gov' }
    },
    select: {
      id: true,
      name: true,
      websiteUrl: true,
    }
  });
  
  console.log(`Found ${campgrounds.length} Recreation.gov campgrounds`);
  
  let totalEvents = 0;
  let processed = 0;
  let errors = 0;
  
  for (const campground of campgrounds) {
    processed++;
    const facilityId = extractFacilityId(campground.websiteUrl);
    
    if (!facilityId) {
      continue;
    }
    
    try {
      const events = await fetchRecGovEvents(facilityId);
      
      for (const event of events) {
        // Only get events from April 2026 onwards
        const startDate = new Date(event.start_date || event.startDate);
        if (startDate < new Date('2026-04-01') || startDate > new Date('2026-12-31')) {
          continue;
        }
        
        // Check if event already exists
        const existing = await prisma.campgroundEvent.findFirst({
          where: {
            campgroundId: campground.id,
            title: event.title || event.name,
            startDate: startDate
          }
        });
        
        if (existing) continue;
        
        // Create the event
        await prisma.campgroundEvent.create({
          data: {
            campgroundId: campground.id,
            createdById: SYSTEM_USER_ID,
            title: event.title || event.name || 'Campground Event',
            description: event.description || event.details || null,
            startDate: startDate,
            endDate: event.end_date || event.endDate ? new Date(event.end_date || event.endDate) : null,
            location: event.location || campground.name,
            tags: event.tags || [],
          }
        });
        
        totalEvents++;
      }
      
      if (events.length > 0) {
        console.log(`[${processed}/${campgrounds.length}] ${campground.name}: ${events.length} events`);
      }
      
      // Rate limiting
      await new Promise(r => setTimeout(r, 100));
    } catch (error) {
      errors++;
      console.error(`Error for ${campground.name}:`, error.message);
    }
  }
  
  console.log(`\nDone! Created ${totalEvents} events from ${processed} campgrounds. Errors: ${errors}`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
