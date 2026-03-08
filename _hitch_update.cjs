
const { PrismaClient } = require('./backend/node_modules/@prisma/client');
const p = new PrismaClient();
const updates = JSON.parse(process.argv[2]);
async function main() {
  let count = 0;
  for (const { id, description } of updates) {
    await p.campground.update({ where: { id }, data: { description } });
    count++;
  }
  console.log('Saved ' + count + ' campgrounds');
  await p.$disconnect();
}
main().catch(e => { console.error(e.message); process.exit(1); });
