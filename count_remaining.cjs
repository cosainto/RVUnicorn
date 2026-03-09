const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
p.campground.findMany({
  select: { description: true },
}).then(camps => {
  const needsHitch = camps.filter(c => {
    if (!c.description) return true;
    if (c.description.includes('Hitch')) return false;
    const s = c.description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return s.length < 7;
  });
  console.log('Needs Hitch description:', needsHitch.length);
  p.$disconnect();
});
