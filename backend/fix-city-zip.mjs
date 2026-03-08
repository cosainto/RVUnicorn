import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const DELAY = 1100; // Nominatim rate limit: 1 req/sec
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function geocode(lat, lon) {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;
  const r = await fetch(url, { headers: { 'User-Agent': 'RVUnicorn/1.0 support@rvunicorn.com' } });
  if (!r.ok) return null;
  const d = await r.json();
  return {
    city: d.address?.city || d.address?.town || d.address?.village || d.address?.hamlet || null,
    zipCode: d.address?.postcode || null,
  };
}

async function main() {
  // Only fix campgrounds with spaces in city (bad data) that have lat/lon
  const campgrounds = await prisma.campground.findMany({
    where: {
      AND: [
        { city: { contains: ' ' } },
        { latitude: { not: null } },
        { longitude: { not: null } },
      ]
    },
    select: { id: true, name: true, city: true, latitude: true, longitude: true, zipCode: true }
  });

  console.log(`Fixing ${campgrounds.length} campgrounds...`);
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
            ...(geo.zipCode && !cg.zipCode && { zipCode: geo.zipCode }),
          }
        });
        fixed++;
        if (fixed % 100 === 0) console.log(`Progress: ${fixed}/${campgrounds.length} fixed`);
      } else {
        failed++;
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
