const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
p.campground.findMany({
  select: { id: true, name: true, description: true },
  take: 5,
  orderBy: { name: 'asc' }
}).then(camps => {
  camps.forEach(c => {
    const desc = c.description || '';
    const hasHitch = desc.includes('Hitch');
    const sentences = desc.split(/[.!?]+/).filter(s => s.trim().length > 10).length;
    const wouldInclude = !desc || (!hasHitch && sentences < 7);
    console.log(c.name, '| hasHitch:', hasHitch, '| sentences:', sentences, '| wouldInclude:', wouldInclude);
  });
  p.$disconnect();
});
