import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();

async function run() {
  let sys = await p.user.findFirst({ where: { username: 'rvunicorn-system' } });
  if (sys === null) {
    sys = await p.user.create({
      data: {
        email: 'system@rvunicorn.com',
        username: 'rvunicorn-system',
        firstName: 'RVUnicorn',
        lastName: 'System',
        password: 'SYSTEM_NO_LOGIN_' + Date.now(),
      },
    });
    console.log('Created system user:', sys.id);
  } else {
    console.log('System user exists:', sys.id);
  }

  const camps = await p.campground.findMany({
    where: { NOT: { imageUrl: null } },
    select: { id: true, imageUrl: true },
  });
  console.log('Campgrounds with imageUrl:', camps.length);

  let count = 0;
  let skipped = 0;
  for (const c of camps) {
    try {
      await p.campgroundPhoto.create({
        data: {
          campgroundId: c.id,
          userId: sys.id,
          imageUrl: c.imageUrl as string,
          status: 'APPROVED',
        },
      });
      count++;
      if (count % 2000 === 0) console.log('  Inserted:', count);
    } catch {
      skipped++;
    }
  }
  console.log('Done! Inserted:', count, 'Skipped:', skipped);
  await p.$disconnect();
}
run();
