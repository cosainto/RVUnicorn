import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const all = await prisma.campground.findMany({
    select: { id: true, name: true, location: true, state: true }
  });
  
  const incomplete = all.filter(c => !c.location || c.location === '' || !c.location.includes(','));
  
  console.log('Sample campgrounds with incomplete location:\n');
  incomplete.slice(0, 50).forEach(c => console.log(`${c.name} | ${c.location || 'NULL'} | ${c.state}`));
  
  console.log('\nTotal with incomplete location:', incomplete.length);
}

main().catch(console.error).finally(() => process.exit());
