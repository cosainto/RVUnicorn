const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
p.campground.findMany({
  select: { id: true, name: true, description: true },
}).then(camps => {
  const short = camps.filter(c => {
    if (!c.description) return true;
    const sentences = c.description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    return sentences.length < 7;
  });
  console.log('Total:', camps.length);
  console.log('Under 7 sentences:', short.length);
  const sample = short.slice(0,3).map(c => ({
    name: c.name,
    desc: c.description ? c.description.slice(0,150) : null,
    sentences: c.description ? c.description.split(/[.!?]+/).filter(s => s.trim().length > 10).length : 0
  }));
  console.log('Sample:', JSON.stringify(sample, null, 2));
  p.$disconnect();
});
