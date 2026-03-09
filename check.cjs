const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
p.campground.count({
  where: {
    OR: [
      { description: null },
      { description: { not: { contains: 'Hitch' } } }
    ]
  }
}).then(n => { console.log('Non-Hitch campgrounds:', n); p.$disconnect(); });
