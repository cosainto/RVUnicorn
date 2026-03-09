const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
p.campground.findMany({
  select: { id: true, name: true, description: true },
  take: 16000,
  skip: 0,
  orderBy: { name: 'asc' }
}).then(async camps => {
  const short = camps.filter(c => {
    if (!c.description) return true;
    if (c.description.includes('Hitch')) return false;
    const s = c.description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return s.length < 7;
  });
  console.log('Total fetched:', camps.length);
  console.log('Short non-Hitch:', short.length);
  if (short.length > 0) {
    console.log('First one:', short[0].name, '|', short[0].description?.slice(0, 80));
  }
  await p.$disconnect();
});
