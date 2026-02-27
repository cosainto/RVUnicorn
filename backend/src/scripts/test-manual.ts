import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
async function main() {
  const result = await p.$queryRaw`SELECT column_name FROM information_schema.columns WHERE table_name = 'RVModel' AND column_name = 'manualUrl'`;
  console.log('manualUrl column:', result);

  const make = await p.rVMake.findFirst({
    where: { name: { contains: 'coach', mode: 'insensitive' } },
    include: { _count: { select: { models: true } } }
  });
  console.log('Coachmen make:', JSON.stringify(make, null, 2));

  if (make) {
    try {
      const db = p as any;
      const test = await db.rVModel.create({
        data: { makeId: make.id, name: 'TEST_MANUAL_MODEL', type: 'Travel Trailer', features: [], manualUrl: 'https://test.com/manual.pdf' }
      });
      console.log('Test create SUCCESS:', test.id);
      await db.rVModel.delete({ where: { id: test.id } });
      console.log('Cleanup done');
    } catch (e: any) {
      console.log('Test create FAILED:', e.message);
    }
  }

  await p.$disconnect();
}
main();
