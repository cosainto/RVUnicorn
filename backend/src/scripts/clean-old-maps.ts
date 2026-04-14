import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

cloudinary.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  console.log('Checking Cloudinary maps folder...');

  // Get all current map URLs from DB
  const linked = await prisma.campground.findMany({
    where: { campgroundMapUrl: { contains: 'cloudinary' } },
    select: { campgroundMapUrl: true },
  });
  const linkedUrls = new Set(linked.map((c: any) => c.campgroundMapUrl));
  console.log('Maps linked in DB:', linkedUrls.size);

  // List all resources in the maps folder
  let allResources: any[] = [];
  let nextCursor: string | undefined;

  try {
    do {
      const result: any = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'rvunicorn/campground-maps/',
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });
      allResources = allResources.concat(result.resources);
      nextCursor = result.next_cursor;
      await delay(500);
    } while (nextCursor);
  } catch (e: any) {
    console.log('Error listing:', e.error || e.message);
  }

  console.log('Total in Cloudinary maps folder:', allResources.length);

  // Find orphaned (not linked to any campground)
  const orphaned = allResources.filter(r => {
    return !linkedUrls.has(r.secure_url);
  });
  console.log('Orphaned (not linked):', orphaned.length);
  console.log('Kept (linked):', allResources.length - orphaned.length);

  if (orphaned.length === 0) {
    console.log('Nothing to delete!');
    return;
  }

  console.log('\nDeleting orphaned maps...');
  let deleted = 0;

  // Delete in batches of 100
  for (let i = 0; i < orphaned.length; i += 100) {
    const batch = orphaned.slice(i, i + 100);
    const publicIds = batch.map((r: any) => r.public_id);

    try {
      // Try image type first
      await cloudinary.api.delete_resources(publicIds, { resource_type: 'image' });
      deleted += publicIds.length;
    } catch {
      // Try raw type (PDFs)
      try {
        await cloudinary.api.delete_resources(publicIds, { resource_type: 'raw' });
        deleted += publicIds.length;
      } catch {}
    }

    console.log('  Deleted ' + Math.min(i + 100, orphaned.length) + '/' + orphaned.length);
    await delay(500);
  }

  console.log('\nDone! Deleted ' + deleted + ' orphaned maps');
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
