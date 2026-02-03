// ============================================
// CLEANUP CAMPGROUNDS - Remove Non-Campgrounds
// Scans all entries and deletes false positives
// Run: DATABASE_URL="..." npx ts-node scripts/cleanup-new-campgrounds.ts
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ---- STRICT EXCLUSION PATTERNS ----
const DELETE_PATTERNS = [
  // Mobile/manufactured homes
  /mobile home/i, /manufactured home/i, /mobile park(?!.*camp)/i,
  /mobile village/i, /mobile estate/i, /mobile manor/i,
  /manufactured communit/i, /mobile communit/i,
  
  // Trailer parks (not campgrounds)
  /^(?!.*camp).*trailer park/i, /^(?!.*camp).*trailer court/i,
  /^(?!.*camp).*trailer estate/i, /^(?!.*camp).*trailer village/i,
  
  // Residential
  /apartment/i, /condo(?:minium)?/i, /senior living/i,
  /assisted living/i, /nursing home/i, /retirement communit/i,
  /senior communit/i, /55\+/i, /adult communit/i,
  /townhome/i, /town home/i, /townhouse/i,
  /subdivis/i, /housing/i,
  
  // Storage
  /self.?storage/i, /mini.?storage/i, /storage unit/i,
  /storage facilit/i, /^storage /i,
  
  // Auto/truck
  /car wash/i, /car dealer/i, /auto dealer/i, /truck stop/i,
  /tire shop/i, /auto repair/i, /auto body/i, /truck repair/i,
  
  // Hotels/motels (without camping)
  /^(?!.*camp)(?!.*rv).*\bhotel\b/i,
  /^(?!.*camp)(?!.*rv).*\bmotel\b/i,
  /^(?!.*camp)(?!.*rv).*\binn\b(?!.*camp)/i,
  /^(?!.*camp)(?!.*rv).*\bsuites\b/i,
  
  // Commercial
  /real estate/i, /property management/i, /realt(?:y|or)/i,
  /insurance/i, /law office/i, /attorney/i, /lawyer/i,
  /accounting/i, /bank(?:ing)?/i, /credit union/i,
  
  // Religious
  /^church /i, /^(?!.*camp).*\bchurch\b/i,
  /cemetery/i, /funeral/i, /memorial garden/i,
  
  // Shopping/food
  /strip mall/i, /shopping center/i, /shopping plaza/i,
  /grocery/i, /supermarket/i, /walmart/i,
  /restaurant(?!.*camp)/i, /fast food/i,
  /gas station/i, /convenience store(?!.*camp)/i,
  
  // Office/industrial
  /office\s*(space|building|park|complex)/i,
  /warehouse/i, /industrial/i, /factory/i,
  /business park/i, /business center/i,
  
  // Medical
  /hospital/i, /medical center/i, /clinic(?!.*camp)/i,
  /dental/i, /doctor/i, /pharmacy/i,
  
  // Education (not camps)
  /^(?!.*camp).*\bschool\b/i, /university(?!.*camp)/i,
  /college(?!.*camp)/i, /academy(?!.*camp)/i,
  
  // Government (not parks)
  /city hall/i, /courthouse/i, /post office/i, /fire station/i,
  /police station/i, /dmv/i,
  
  // Pet-only
  /pet boarding/i, /dog kennel/i, /veterinar/i, /animal hospital/i,
  /doggy daycare/i, /pet hotel/i,
  
  // Sports venues (not campgrounds)
  /^(?!.*camp).*golf course/i, /^(?!.*camp).*country club/i,
  /bowling/i, /skating rink/i, /movie theater/i, /cinema/i,
  
  // Day use only / not overnight
  /splash pad/i, /water park(?!.*camp)/i, /amusement park(?!.*camp)/i,
  /theme park(?!.*camp)/i, /zoo(?!.*camp)/i, /aquarium/i,
  /museum(?!.*camp)/i,
];

// ---- SUSPECT PATTERNS (review manually) ----
const SUSPECT_PATTERNS = [
  /permanently closed/i,
  /temporarily closed/i,
  /closed/i,
  /no longer/i,
];

// ---- POSITIVE PATTERNS (keep these) ----
const KEEP_PATTERNS = [
  /campground/i, /camping/i, /campsite/i,
  /rv park/i, /rv resort/i, /rv camp/i,
  /koa/i, /jellystone/i, /yogi bear/i,
  /thousand trails/i, /encore/i, /sun outdoors/i,
  /state park/i, /national park/i, /national forest/i,
  /glamping/i, /glamp/i,
  /tent site/i, /tent camping/i,
  /fish camp/i, /horse camp/i, /group camp/i,
  /recreation area/i, /rec area/i,
  /county park/i, /regional park/i,
  /wilderness/i, /primitive camp/i,
  /cabin.*rent/i, /yurt/i,
  /camp resort/i, /outdoor resort/i,
  /travel park/i, /travel resort/i,
  /overnight.*park/i,
  /boondock/i,
];

function shouldDelete(name: string, description?: string | null): { delete: boolean; reason: string } {
  const text = (name + ' ' + (description || '')).trim();
  
  // Check delete patterns
  for (const pattern of DELETE_PATTERNS) {
    if (pattern.test(name)) {
      // But if the name also matches a keep pattern, don't delete
      const hasKeep = KEEP_PATTERNS.some(kp => kp.test(name));
      if (!hasKeep) {
        return { delete: true, reason: `Matches exclusion: ${pattern}` };
      }
    }
  }
  
  return { delete: false, reason: '' };
}

function isSuspect(name: string): boolean {
  return SUSPECT_PATTERNS.some(p => p.test(name));
}

async function main() {
  console.log('==============================================');
  console.log('  CLEANUP CAMPGROUNDS');
  console.log('  Remove non-campground entries');
  console.log('==============================================\n');

  const allCampgrounds = await prisma.campground.findMany({
    select: { id: true, name: true, state: true, description: true, location: true },
  });

  console.log(`Scanning ${allCampgrounds.length} campgrounds...\n`);

  const toDelete: { id: string; name: string; state: string; reason: string }[] = [];
  const suspects: { id: string; name: string; state: string }[] = [];
  let scanned = 0;

  for (const camp of allCampgrounds) {
    scanned++;
    
    const result = shouldDelete(camp.name, camp.description);
    if (result.delete) {
      toDelete.push({ id: camp.id, name: camp.name, state: camp.state || '??', reason: result.reason });
    } else if (isSuspect(camp.name)) {
      suspects.push({ id: camp.id, name: camp.name, state: camp.state || '??' });
    }
  }

  console.log(`Scanned: ${scanned}`);
  console.log(`To delete: ${toDelete.length}`);
  console.log(`Suspect (not deleting): ${suspects.length}\n`);

  // Show what we're deleting
  if (toDelete.length > 0) {
    console.log('--- DELETING ---');
    for (const item of toDelete) {
      console.log(`  ❌ ${item.name} (${item.state}) — ${item.reason}`);
    }

    // Actually delete
    console.log(`\nDeleting ${toDelete.length} entries...`);
    const deleteIds = toDelete.map(d => d.id);
    
    // Delete in batches of 100
    for (let i = 0; i < deleteIds.length; i += 100) {
      const batch = deleteIds.slice(i, i + 100);
      await prisma.campground.deleteMany({
        where: { id: { in: batch } },
      });
      console.log(`  Deleted batch ${Math.floor(i/100) + 1} (${Math.min(i + 100, deleteIds.length)}/${deleteIds.length})`);
    }

    console.log(`✅ Deleted ${toDelete.length} non-campground entries`);
  }

  // Show suspects
  if (suspects.length > 0) {
    console.log('\n--- SUSPECT (kept, review manually) ---');
    for (const item of suspects.slice(0, 50)) {
      console.log(`  ⚠️  ${item.name} (${item.state})`);
    }
    if (suspects.length > 50) {
      console.log(`  ... and ${suspects.length - 50} more`);
    }
  }

  // Final count
  const finalCount = await prisma.campground.count();
  console.log(`\n--- FINAL ---`);
  console.log(`Total campgrounds: ${finalCount}`);

  // State counts
  const stateCounts = await prisma.campground.groupBy({
    by: ['state'],
    _count: { id: true },
    orderBy: { _count: { id: 'desc' } },
  });

  console.log('\n--- Top 10 States ---');
  for (const s of stateCounts.slice(0, 10)) {
    console.log(`  ${s.state}: ${s._count.id}`);
  }
}

main().catch(console.error).finally(() => process.exit());
