/**
 * RVUnicorn — Clean Old Cloudinary Folders
 * ==========================================
 * Deletes the ~2,000 old campground subfolders from Cloudinary
 * that reference campground IDs that no longer exist after DB reset.
 * 
 * Keeps the flat images in campgrounds/ (current imageUrl photos).
 * 
 * Run: npx tsx src/scripts/clean-cloudinary-folders.ts
 */

import { v2 as cloudinary } from 'cloudinary';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy6eetmh7',
  api_key: process.env.CLOUDINARY_API_KEY || '333927774328418',
  api_secret: process.env.CLOUDINARY_API_SECRET || '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function getAllSubfolders(): Promise<string[]> {
  const folders: string[] = [];
  let nextCursor: string | undefined;

  do {
    const result: any = await cloudinary.api.sub_folders('campgrounds', {
      max_results: 500,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });
    for (const f of result.folders) {
      folders.push(f.name);
    }
    nextCursor = result.next_cursor;
    await delay(200);
  } while (nextCursor);

  return folders;
}

async function deleteFolder(folderName: string): Promise<{ deleted: number }> {
  let totalDeleted = 0;
  let nextCursor: string | undefined;

  // First delete all resources in the folder
  do {
    const result: any = await cloudinary.api.resources({
      type: 'upload',
      prefix: `campgrounds/${folderName}/`,
      max_results: 100,
      ...(nextCursor ? { next_cursor: nextCursor } : {}),
    });

    if (result.resources.length === 0) break;

    const publicIds = result.resources.map((r: any) => r.public_id);
    
    // Delete in batches of 100
    if (publicIds.length > 0) {
      await cloudinary.api.delete_resources(publicIds);
      totalDeleted += publicIds.length;
    }

    nextCursor = result.next_cursor;
    await delay(200);
  } while (nextCursor);

  // Then delete the empty folder
  try {
    await cloudinary.api.delete_folder(`campgrounds/${folderName}`);
  } catch (e) {
    // Folder might already be gone
  }

  return { deleted: totalDeleted };
}

async function main() {
  console.log('\n' + '═'.repeat(60));
  console.log('  🗑️  Clean Old Cloudinary Folders');
  console.log('═'.repeat(60));

  // Step 1: Get current campground IDs
  console.log('\n📦 Step 1: Loading current campground IDs...');
  const currentIds = new Set(
    (await prisma.campground.findMany({ select: { id: true } })).map(c => c.id)
  );
  console.log(`  ${currentIds.size} campgrounds in database`);

  // Step 2: Get all subfolders
  console.log('\n📦 Step 2: Listing Cloudinary subfolders...');
  const allFolders = await getAllSubfolders();
  console.log(`  ${allFolders.length} subfolders found`);

  // Step 3: Identify orphaned folders
  const orphaned = allFolders.filter(f => !currentIds.has(f));
  const valid = allFolders.filter(f => currentIds.has(f));
  console.log(`  Orphaned (old IDs): ${orphaned.length}`);
  console.log(`  Still valid: ${valid.length}`);

  if (orphaned.length === 0) {
    console.log('\n  ✅ No orphaned folders to clean!');
    await prisma.$disconnect();
    return;
  }

  // Step 4: Delete orphaned folders
  console.log(`\n📦 Step 3: Deleting ${orphaned.length} orphaned folders...\n`);

  let totalPhotosDeleted = 0;
  let foldersDeleted = 0;
  let errors = 0;

  for (let i = 0; i < orphaned.length; i++) {
    const folder = orphaned[i];
    try {
      const result = await deleteFolder(folder);
      totalPhotosDeleted += result.deleted;
      foldersDeleted++;

      if ((i + 1) % 25 === 0 || i < 3) {
        console.log(`  🗑️  ${i + 1}/${orphaned.length} | Folders: ${foldersDeleted} | Photos: ${totalPhotosDeleted}`);
      }

      // Rate limit — Cloudinary admin API has limits
      await delay(500);
    } catch (e: any) {
      errors++;
      if (errors <= 5) {
        console.error(`  ⚠️ Error on ${folder}: ${e.message}`);
      }
      await delay(1000);
    }
  }

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  ✅ CLEANUP COMPLETE');
  console.log('═'.repeat(60));
  console.log(`  Folders deleted: ${foldersDeleted}`);
  console.log(`  Photos deleted: ${totalPhotosDeleted}`);
  console.log(`  Errors: ${errors}`);
  console.log(`  Estimated storage freed: ~${(totalPhotosDeleted * 0.5).toFixed(0)} MB`);
  console.log('');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Fatal error:', e);
  prisma.$disconnect();
  process.exit(1);
});
