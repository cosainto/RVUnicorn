/**
 * RVUnicorn — Upload local PDFs to Cloudinary & update DB manualUrl
 * Run: npx tsx src/scripts/upload-manuals-cloudinary.ts
 */

import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();
const db = prisma as any;

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PDF_DIR = path.join(process.cwd(), 'downloads', 'coachmen-forestriver');

async function main() {
  console.log('☁️  Uploading Coachmen PDFs to Cloudinary');
  console.log('══════════════════════════════════════════════════════');

  // Get all local:/ entries in DB
  const models = await db.rVModel.findMany({
    where: { manualUrl: { startsWith: 'local:' } },
    select: { id: true, name: true, manualUrl: true },
  });

  console.log(`Found ${models.length} models with local PDF paths\n`);

  let uploaded = 0;
  let failed = 0;
  let notFound = 0;

  for (const model of models) {
    const localPath = model.manualUrl.replace('local:', '');

    if (!fs.existsSync(localPath)) {
      // Try finding by filename in PDF_DIR
      const filename = path.basename(localPath);
      const altPath = path.join(PDF_DIR, filename);
      if (!fs.existsSync(altPath)) {
        console.log(`   ⚠️  Not found: ${filename}`);
        notFound++;
        continue;
      }
      // Use altPath
      Object.assign(model, { resolvedPath: altPath });
    } else {
      Object.assign(model, { resolvedPath: localPath });
    }

    const resolvedPath = (model as any).resolvedPath;
    const publicId = `rv-manuals/coachmen/${path.basename(resolvedPath, '.pdf')}`;

    try {
      console.log(`   ⬆️  ${path.basename(resolvedPath)}`);
      const result = await cloudinary.uploader.upload(resolvedPath, {
        resource_type: 'raw',
        public_id: publicId,
        overwrite: false,
        folder: 'rv-manuals/coachmen',
      });

      // Update DB with the Cloudinary URL
      await db.rVModel.update({
        where: { id: model.id },
        data: { manualUrl: result.secure_url },
      });

      console.log(`      ✅ → ${result.secure_url.slice(0, 70)}...`);
      uploaded++;
    } catch (e: any) {
      // If already exists on Cloudinary, fetch the URL
      if (e.message?.includes('already exists')) {
        const url = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/raw/upload/rv-manuals/coachmen/${path.basename(resolvedPath, '.pdf')}`;
        await db.rVModel.update({ where: { id: model.id }, data: { manualUrl: url } });
        console.log(`      ♻️  Already exists, URL saved`);
        uploaded++;
      } else {
        console.error(`      ❌ Failed: ${e.message}`);
        failed++;
      }
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n══════════════════════════════════════════════════════');
  console.log(`✅ Done!`);
  console.log(`   Uploaded: ${uploaded}`);
  console.log(`   Failed:   ${failed}`);
  console.log(`   Missing:  ${notFound}`);

  // Show sample of updated URLs
  const sample = await db.rVModel.findMany({
    where: { manualUrl: { startsWith: 'https://res.cloudinary.com' } },
    select: { name: true, manualUrl: true },
    take: 5,
  });
  console.log('\nSample updated URLs:');
  sample.forEach((m: any) => console.log(`   ${m.name}: ${m.manualUrl.slice(0, 70)}...`));

  await prisma.$disconnect();
}

main().catch(e => {
  console.error('Fatal:', e);
  prisma.$disconnect();
  process.exit(1);
});
