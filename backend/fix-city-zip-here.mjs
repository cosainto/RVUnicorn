import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();
const HERE_API_KEY = process.env.HERE_API_KEY;
const DELAY = 50; // HERE allows much faster requests
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(lat, lon) {
  const url = `https://revgeocode.search.hereapi.com/v1/revgeocode?at=${lat},${lon}&lang=en-US&apiKey=${HERE_API_KEY}`;
  const r = await fetch(url);
  if (!r.ok) return null;
  const d = await r.json();
  const addr = d.items?.[0]?.address;
  if (!addr) return null;
  return {
    city: addr.city || addr.town || addr.village || null,
    zipCode: addr.postalCode || null,
    state: addr.stateCode || null,
  };
}

async function main() {
  const campgrounds = await prisma.campground.findMany({
    where: {
      AND: [
        { city: { contains: ' ' } },
        { latitude: { not: null } },
        { longitude: { not: null } },
      ]
    },
    select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, zipCode: true }
  });

  console.log(`Fixing ${campgrounds.length} campgrounds with HERE API...`);
  let fixed = 0, failed = 0;

  for (let i = 0; i < campgrounds.length; i++) {
    const cg = campgrounds[i];
    try {
      const geo = await geocode(cg.latitude, cg.longitude);
      if (geo?.city) {
        await prisma.campground.update({
          where: { id: cg.id },
          data: {
            city: geo.city,
            ...(geo.zipCode && !cg.zipCode ? { zipCode: geo.zipCode } : {}),
          }
        });
        fixed++;
        if (fixed % 500 === 0) console.log(`Progress: ${fixed}/${campgrounds.length} fixed`);
      } else {
        failed++;
        if (failed % 100 === 0) console.log(`Failed so far: ${failed}`);
      }
    } catch (e) {
      failed++;
      console.error(`Failed ${cg.name}:`, e.message);
    }
    await sleep(DELAY);
  }

  console.log(`Done! Fixed: ${fixed}, Failed: ${failed}`);
  await prisma.$disconnect();
}

main();
