import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

// US State bounding boxes (approximate) - [minLat, maxLat, minLng, maxLng]
const STATE_BOUNDS: Record<string, [number, number, number, number]> = {
  'AL': [30.22, 35.01, -88.47, -84.89],
  'AK': [51.21, 71.39, -179.15, 179.77],
  'AZ': [31.33, 37.00, -114.81, -109.04],
  'AR': [33.00, 36.50, -94.62, -89.64],
  'CA': [32.53, 42.01, -124.41, -114.13],
  'CO': [36.99, 41.00, -109.05, -102.04],
  'CT': [40.95, 42.05, -73.73, -71.79],
  'DE': [38.45, 39.84, -75.79, -75.05],
  'FL': [24.40, 31.00, -87.63, -80.03],
  'GA': [30.36, 35.00, -85.61, -80.84],
  'HI': [18.91, 22.24, -160.25, -154.81],
  'ID': [41.99, 49.00, -117.24, -111.04],
  'IL': [36.97, 42.51, -91.51, -87.02],
  'IN': [37.77, 41.76, -88.10, -84.78],
  'IA': [40.37, 43.50, -96.64, -90.14],
  'KS': [36.99, 40.00, -102.05, -94.59],
  'KY': [36.50, 39.15, -89.57, -81.96],
  'LA': [28.93, 33.02, -94.04, -88.82],
  'ME': [43.06, 47.46, -71.08, -66.95],
  'MD': [37.91, 39.72, -79.49, -75.05],
  'MA': [41.24, 42.89, -73.50, -69.93],
  'MI': [41.70, 48.19, -90.42, -82.12],
  'MN': [43.50, 49.38, -97.24, -89.49],
  'MS': [30.17, 35.00, -91.66, -88.10],
  'MO': [35.99, 40.61, -95.77, -89.10],
  'MT': [44.36, 49.00, -116.05, -104.04],
  'NE': [40.00, 43.00, -104.05, -95.31],
  'NV': [35.00, 42.00, -120.01, -114.04],
  'NH': [42.70, 45.31, -72.56, -70.70],
  'NJ': [38.93, 41.36, -75.56, -73.89],
  'NM': [31.33, 37.00, -109.05, -103.00],
  'NY': [40.50, 45.02, -79.76, -71.86],
  'NC': [33.84, 36.59, -84.32, -75.46],
  'ND': [45.94, 49.00, -104.05, -96.55],
  'OH': [38.40, 42.33, -84.82, -80.52],
  'OK': [33.62, 37.00, -103.00, -94.43],
  'OR': [41.99, 46.29, -124.57, -116.46],
  'PA': [39.72, 42.27, -80.52, -74.69],
  'RI': [41.15, 42.02, -71.86, -71.12],
  'SC': [32.03, 35.22, -83.35, -78.54],
  'SD': [42.48, 45.95, -104.06, -96.44],
  'TN': [34.98, 36.68, -90.31, -81.65],
  'TX': [25.84, 36.50, -106.65, -93.51],
  'UT': [36.99, 42.00, -114.05, -109.04],
  'VT': [42.73, 45.02, -73.44, -71.46],
  'VA': [36.54, 39.47, -83.68, -75.24],
  'WA': [45.54, 49.00, -124.85, -116.92],
  'WV': [37.20, 40.64, -82.64, -77.72],
  'WI': [42.49, 47.08, -92.89, -86.25],
  'WY': [40.99, 45.01, -111.06, -104.05],
  'DC': [38.79, 38.99, -77.12, -76.91],
  // US Territories
  'PR': [17.88, 18.52, -67.95, -65.22],
  'VI': [17.62, 18.42, -65.08, -64.56],
  'GU': [13.23, 13.65, 144.62, 144.96],
  'AS': [-14.38, -14.16, -170.83, -169.41],
};

function getStateFromCoordinates(lat: number, lng: number): string {
  // Check each state's bounding box
  for (const [state, [minLat, maxLat, minLng, maxLng]] of Object.entries(STATE_BOUNDS)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      return state;
    }
  }
  
  // If no match, return Unknown
  return 'Unknown';
}

// More precise check using a scoring system (for overlapping bounding boxes)
function getBestStateMatch(lat: number, lng: number): string {
  const matches: { state: string; score: number }[] = [];
  
  for (const [state, [minLat, maxLat, minLng, maxLng]] of Object.entries(STATE_BOUNDS)) {
    if (lat >= minLat && lat <= maxLat && lng >= minLng && lng <= maxLng) {
      // Calculate how centered the point is in the bounding box
      const latCenter = (minLat + maxLat) / 2;
      const lngCenter = (minLng + maxLng) / 2;
      const latRange = maxLat - minLat;
      const lngRange = maxLng - minLng;
      
      // Score based on distance from center (normalized)
      const latScore = 1 - Math.abs(lat - latCenter) / (latRange / 2);
      const lngScore = 1 - Math.abs(lng - lngCenter) / (lngRange / 2);
      const score = (latScore + lngScore) / 2;
      
      matches.push({ state, score });
    }
  }
  
  if (matches.length === 0) {
    return 'Unknown';
  }
  
  // Return the state with the highest score
  matches.sort((a, b) => b.score - a.score);
  return matches[0].state;
}

async function fixCampgroundStates() {
  console.log('🔧 Fixing Campground State Codes\n');
  
  // Get all campgrounds with Unknown state
  const campgrounds = await prisma.campground.findMany({
    where: {
      state: 'Unknown'
    },
    select: {
      id: true,
      name: true,
      latitude: true,
      longitude: true
    }
  });
  
  console.log(`📊 Found ${campgrounds.length} campgrounds with Unknown state\n`);
  
  if (campgrounds.length === 0) {
    console.log('✅ All campgrounds already have state codes!');
    await prisma.$disconnect();
    return;
  }
  
  let updated = 0;
  let stillUnknown = 0;
  const stateCounts: Record<string, number> = {};
  
  // Process in batches of 100
  const batchSize = 100;
  for (let i = 0; i < campgrounds.length; i += batchSize) {
    const batch = campgrounds.slice(i, i + batchSize);
    
    console.log(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(campgrounds.length / batchSize)}...`);
    
    for (const campground of batch) {
      if (campground.latitude && campground.longitude) {
        const state = getBestStateMatch(campground.latitude, campground.longitude);
        
        if (state !== 'Unknown') {
          // Update the campground
          await prisma.campground.update({
            where: { id: campground.id },
            data: { 
              state,
              location: state // Also update location field
            }
          });
          
          updated++;
          stateCounts[state] = (stateCounts[state] || 0) + 1;
        } else {
          stillUnknown++;
          console.log(`  ⚠️  Could not determine state for: ${campground.name} (${campground.latitude}, ${campground.longitude})`);
        }
      } else {
        stillUnknown++;
      }
    }
  }
  
  console.log('\n✅ Update Complete!\n');
  console.log(`📊 Statistics:`);
  console.log(`   - Updated: ${updated}`);
  console.log(`   - Still Unknown: ${stillUnknown}`);
  console.log(`\n📍 Campgrounds by State:`);
  
  // Sort by count descending
  const sortedStates = Object.entries(stateCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20); // Top 20
  
  for (const [state, count] of sortedStates) {
    console.log(`   ${state}: ${count}`);
  }
  
  await prisma.$disconnect();
}

fixCampgroundStates().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
