const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
(async () => {
  const userId = 'cmlpeyk82005s3qause3sws7y';
  const events = await prisma.event.findMany({
    where: {
      OR: [{ organizerId: userId }, { attendees: { some: { userId } } }],
    },
    select: {
      id: true, title: true, startDate: true, endDate: true,
      campground: { select: { name: true, state: true } },
    },
    orderBy: { startDate: 'desc' },
    take: 10,
  });
  console.log('Today:', new Date().toISOString());
  events.forEach(e => console.log(e.title, '|', e.startDate?.toISOString()?.split('T')[0], '→', e.endDate?.toISOString()?.split('T')[0], '|', e.campground?.name));
  await prisma.$disconnect();
})();
