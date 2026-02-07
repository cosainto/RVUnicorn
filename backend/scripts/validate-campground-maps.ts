// ============================================
// VALIDATE CAMPGROUND MAP PDFs
// Checks each Cloudinary PDF to see if it's a real PDF
// or an HTML page / broken file uploaded with .pdf extension
// Nulls out broken ones
// Run: DATABASE_URL="..." npx ts-node scripts/validate-campground-maps.ts
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

interface ValidationResult {
  id: string;
  name: string;
  url: string;
  valid: boolean;
  reason: string;
  contentType?: string;
  firstBytes?: string;
}

async function checkPdf(url: string): Promise<{ valid: boolean; reason: string; contentType?: string; firstBytes?: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Range': 'bytes=0-512', // Only fetch first 512 bytes
      },
    });
    clearTimeout(timer);

    if (!res.ok && res.status !== 206) {
      return { valid: false, reason: `HTTP ${res.status}` };
    }

    const contentType = res.headers.get('content-type') || '';
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const firstBytes = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 100));

    // Check if it starts with %PDF (real PDF)
    if (firstBytes.startsWith('%PDF')) {
      return { valid: true, reason: 'Valid PDF', contentType, firstBytes: firstBytes.slice(0, 20) };
    }

    // Check if it's HTML
    if (firstBytes.toLowerCase().includes('<!doctype') || firstBytes.toLowerCase().includes('<html')) {
      return { valid: false, reason: 'HTML page saved as PDF', contentType, firstBytes: firstBytes.slice(0, 50) };
    }

    // Check if it's an image (JPEG starts with FF D8, PNG starts with 89 50 4E 47)
    if (bytes[0] === 0xFF && bytes[1] === 0xD8) {
      return { valid: false, reason: 'JPEG saved as PDF', contentType };
    }
    if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
      return { valid: false, reason: 'PNG saved as PDF', contentType };
    }

    // Check content-type header
    if (contentType.includes('text/html')) {
      return { valid: false, reason: 'Content-Type is text/html', contentType, firstBytes: firstBytes.slice(0, 50) };
    }

    if (contentType.includes('application/pdf')) {
      return { valid: true, reason: 'Content-Type says PDF', contentType, firstBytes: firstBytes.slice(0, 20) };
    }

    // Unknown - mark as suspicious
    return { valid: false, reason: `Unknown format: ${firstBytes.slice(0, 30)}`, contentType, firstBytes: firstBytes.slice(0, 50) };

  } catch (err: any) {
    return { valid: false, reason: `Fetch error: ${err.message}` };
  }
}

async function main() {
  console.log('🔍 CAMPGROUND MAP PDF VALIDATOR');
  console.log('================================\n');

  // Get all Cloudinary PDFs
  const campgrounds = await prisma.campground.findMany({
    where: {
      campgroundMapUrl: {
        contains: 'cloudinary',
        endsWith: '.pdf',
      },
    },
    select: { id: true, name: true, campgroundMapUrl: true },
  });

  console.log(`Found ${campgrounds.length} Cloudinary PDFs to validate\n`);

  let valid = 0;
  let invalid = 0;
  const invalidResults: ValidationResult[] = [];

  for (let i = 0; i < campgrounds.length; i++) {
    const cg = campgrounds[i];
    const url = cg.campgroundMapUrl!;

    const result = await checkPdf(url);

    if (result.valid) {
      valid++;
      process.stdout.write(`✅ [${i + 1}/${campgrounds.length}] ${cg.name}\n`);
    } else {
      invalid++;
      invalidResults.push({
        id: cg.id,
        name: cg.name,
        url,
        valid: false,
        reason: result.reason,
        contentType: result.contentType,
        firstBytes: result.firstBytes,
      });
      process.stdout.write(`❌ [${i + 1}/${campgrounds.length}] ${cg.name} — ${result.reason}\n`);
    }

    // Rate limit - don't hammer Cloudinary
    if (i % 10 === 0) await delay(200);
  }

  console.log('\n================================');
  console.log(`✅ Valid PDFs: ${valid}`);
  console.log(`❌ Invalid PDFs: ${invalid}`);

  if (invalidResults.length > 0) {
    // Show breakdown of reasons
    const reasons: { [key: string]: number } = {};
    invalidResults.forEach(r => {
      reasons[r.reason] = (reasons[r.reason] || 0) + 1;
    });
    console.log('\n📊 Breakdown of invalid reasons:');
    Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .forEach(([reason, count]) => {
        console.log(`   ${count}x ${reason}`);
      });

    // Ask to clean up
    console.log(`\n🧹 Nulling out ${invalidResults.length} broken PDF URLs...`);
    
    const ids = invalidResults.map(r => r.id);
    const updated = await prisma.campground.updateMany({
      where: { id: { in: ids } },
      data: { campgroundMapUrl: null },
    });

    console.log(`✅ Cleaned ${updated.count} broken map URLs`);
  }

  // Also clean up external links that are clearly not maps
  console.log('\n🧹 Cleaning up junk external links...');
  const junkCleaned = await prisma.campground.updateMany({
    where: {
      campgroundMapUrl: {
        not: { contains: 'cloudinary' },
      },
      OR: [
        { campgroundMapUrl: { endsWith: '/sitemap' } },
        { campgroundMapUrl: { endsWith: '/site-map' } },
        { campgroundMapUrl: { contains: 'koa.com/sitemap' } },
        { campgroundMapUrl: { contains: 'recreation.gov' } },
        { campgroundMapUrl: { equals: '' } },
      ],
    },
    data: { campgroundMapUrl: null },
  });
  console.log(`✅ Cleaned ${junkCleaned.count} junk external links`);

  // Final count
  const remaining = await prisma.campground.count({
    where: { campgroundMapUrl: { not: null } },
  });
  console.log(`\n📊 Final: ${remaining} campgrounds with valid map URLs`);

  await prisma.$disconnect();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
