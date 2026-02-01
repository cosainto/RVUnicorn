import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const unverified = await prisma.campground.findMany({
    where: {
      hasFullHookups: null,
      hasShowers: null,
      hasRestrooms: null,
      amenities: { isEmpty: true }
    },
    select: { id: true, name: true, state: true, location: true, websiteUrl: true, imageUrl: true },
    orderBy: { state: 'asc' }
  });

  console.log(`Unverified campgrounds: ${unverified.length}\n`);

  // Group by state
  const byState: { [key: string]: number } = {};
  let noImage = 0;
  let noWebsite = 0;

  for (const c of unverified) {
    const st = c.state || 'Unknown';
    byState[st] = (byState[st] || 0) + 1;
    if (!c.imageUrl) noImage++;
    if (!c.websiteUrl) noWebsite++;
  }

  console.log('By state:');
  Object.entries(byState).sort((a, b) => b[1] - a[1]).forEach(([s, n]) => console.log(`  ${s}: ${n}`));

  console.log(`\nWithout image: ${noImage}`);
  console.log(`Without website: ${noWebsite}`);

  console.log('\nSample names:');
  unverified.slice(0, 30).forEach(c => console.log(`  ${c.name} | ${c.state} | ${c.location || 'no location'}`));
}

main().catch(console.error).finally(() => process.exit());
