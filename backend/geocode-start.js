const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const prisma = new PrismaClient();
(async () => {
  // Geocode Elmhurst, Illinois using HERE API
  const address = 'Elmhurst, Illinois 60126';
  const apiKey = process.env.HERE_API_KEY;
  const url = `https://geocode.search.hereapi.com/v1/geocode?q=${encodeURIComponent(address)}&apiKey=${apiKey}`;
  const res = await fetch(url);
  const data = await res.json();
  const pos = data.items?.[0]?.position;
  console.log('Geocoded:', pos);

  if (pos) {
    // Update the trip plan with start coordinates
    const userId = 'cmlpeyk82005s3qause3sws7y';
    const plan = await prisma.tripPlan.findFirst({
      where: { 
        event: { 
          organizerId: userId,
          title: 'Disney Fort Wilderness'
        } 
      }
    });
    if (plan) {
      await prisma.tripPlan.update({
        where: { id: plan.id },
        data: { startLatitude: pos.lat, startLongitude: pos.lng }
      });
      console.log('✅ Updated start coordinates');
    }
  }
  await prisma.$disconnect();
})();
