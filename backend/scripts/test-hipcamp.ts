import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      }
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function main() {
  const url = 'https://www.hipcamp.com/en-US/campground/united-states/wyoming/snyder-guard-station-56yzce06';
  
  console.log('Fetching:', url);
  
  const html = await fetchPage(url);
  
  if (!html) {
    console.log('Failed to fetch');
    return;
  }
  
  console.log('HTML length:', html.length);
  
  // Extract og:image
  const imgMatch = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                   html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
  console.log('\nImage:', imgMatch ? imgMatch[1] : 'Not found');
  
  // Extract description
  const descMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
  console.log('\nDescription:', descMatch ? descMatch[1].slice(0, 200) + '...' : 'Not found');
  
  // Check for amenities in full HTML
  const lowerHtml = html.toLowerCase();
  const amenities: string[] = [];
  
  const checks = [
    { keyword: 'campfire', amenity: 'fire_rings' },
    { keyword: 'fire ring', amenity: 'fire_rings' },
    { keyword: 'fire pit', amenity: 'fire_rings' },
    { keyword: 'picnic', amenity: 'picnic_tables' },
    { keyword: 'toilet', amenity: 'restrooms' },
    { keyword: 'restroom', amenity: 'restrooms' },
    { keyword: 'outhouse', amenity: 'vault_toilets' },
    { keyword: 'vault toilet', amenity: 'vault_toilets' },
    { keyword: 'pets allowed', amenity: 'pet_friendly' },
    { keyword: 'dog', amenity: 'pet_friendly' },
    { keyword: 'hiking', amenity: 'hiking' },
    { keyword: 'fishing', amenity: 'fishing' },
    { keyword: 'wifi', amenity: 'wifi' },
    { keyword: 'shower', amenity: 'showers' },
    { keyword: 'swimming', amenity: 'swimming' },
    { keyword: 'lake', amenity: 'waterfront' },
    { keyword: 'river', amenity: 'waterfront' },
    { keyword: 'potable water', amenity: 'water_available' },
    { keyword: 'drinking water', amenity: 'water_available' },
  ];
  
  for (const check of checks) {
    if (lowerHtml.includes(check.keyword) && !amenities.includes(check.amenity)) {
      amenities.push(check.amenity);
    }
  }
  
  console.log('\nAmenities found:', amenities);
  
  // Now update the actual campground
  const camp = await prisma.campground.findFirst({
    where: { name: { contains: 'SNYDER GUARD STATION' } }
  });
  
  if (camp) {
    console.log('\nFound campground:', camp.name, camp.id);
    
    const updateData: any = {};
    
    if (imgMatch) updateData.imageUrl = imgMatch[1];
    if (descMatch) updateData.description = descMatch[1].slice(0, 500);
    if (amenities.length > 0) {
      updateData.amenities = [...new Set([...(camp.amenities || []), ...amenities])];
    }
    
    // Set boolean fields
    if (lowerHtml.includes('toilet') || lowerHtml.includes('restroom')) updateData.hasRestrooms = true;
    if (lowerHtml.includes('shower')) updateData.hasShowers = true;
    if (lowerHtml.includes('wifi')) updateData.hasWifi = true;
    if (lowerHtml.includes('pets allowed') || lowerHtml.includes('dogs allowed')) updateData.isPetFriendly = true;
    if (lowerHtml.includes('lake') || lowerHtml.includes('river') || lowerHtml.includes('creek')) updateData.isWaterfront = true;
    
    await prisma.campground.update({
      where: { id: camp.id },
      data: updateData
    });
    
    console.log('\n✅ Updated campground with:');
    console.log(updateData);
    console.log('\nSource: ' + url);
  } else {
    console.log('\nCampground not found in database');
  }
}

main().catch(console.error).finally(() => process.exit());
