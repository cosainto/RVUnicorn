const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const BATCH_SIZE = 20;
const DELAY_MS = 500;
const TIMEOUT_MS = 10000;

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function scrapeImage(url) {
  try {
    // Normalize URL
    if (!url.startsWith('http')) url = 'https://' + url;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    
    const resp = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    clearTimeout(timeout);
    
    if (!resp.ok) return null;
    
    const html = await resp.text();
    
    // Priority 1: og:image
    let match = html.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i);
    if (!match) match = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i);
    
    // Priority 2: twitter:image
    if (!match) match = html.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
    if (!match) match = html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i);
    
    // Priority 3: First large image (hero image patterns)
    if (!match) {
      // Look for common hero image patterns
      const heroPatterns = [
        /<img[^>]*class=["'][^"']*hero[^"']*["'][^>]*src=["']([^"']+)["']/i,
        /<img[^>]*class=["'][^"']*banner[^"']*["'][^>]*src=["']([^"']+)["']/i,
        /<img[^>]*class=["'][^"']*header[^"']*["'][^>]*src=["']([^"']+)["']/i,
        /<img[^>]*class=["'][^"']*cover[^"']*["'][^>]*src=["']([^"']+)["']/i,
        /<img[^>]*class=["'][^"']*featured[^"']*["'][^>]*src=["']([^"']+)["']/i,
      ];
      for (const pattern of heroPatterns) {
        match = html.match(pattern);
        if (match) break;
      }
    }
    
    // Priority 4: First reasonably-sized image (skip tiny icons/logos)
    if (!match) {
      const imgMatches = html.matchAll(/<img[^>]*src=["']([^"']+)["'][^>]*/gi);
      for (const m of imgMatches) {
        const src = m[1];
        // Skip tiny images, icons, logos, tracking pixels
        if (src.includes('logo') || src.includes('icon') || src.includes('favicon') ||
            src.includes('pixel') || src.includes('tracking') || src.includes('badge') ||
            src.includes('.svg') || src.includes('1x1') || src.includes('spacer') ||
            src.includes('spinner') || src.includes('loading') ||
            src.length < 10) continue;
        
        // Check for size hints
        const widthMatch = m[0].match(/width=["']?(\d+)/i);
        if (widthMatch && parseInt(widthMatch[1]) < 200) continue;
        
        match = [null, src];
        break;
      }
    }
    
    if (!match || !match[1]) return null;
    
    let imageUrl = match[1];
    
    // Make absolute URL
    if (imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    } else if (imageUrl.startsWith('/')) {
      const base = new URL(url);
      imageUrl = base.origin + imageUrl;
    } else if (!imageUrl.startsWith('http')) {
      const base = new URL(url);
      imageUrl = base.origin + '/' + imageUrl;
    }
    
    // Validate the image URL works
    try {
      const imgResp = await fetch(imageUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      const contentType = imgResp.headers.get('content-type') || '';
      if (!imgResp.ok || (!contentType.includes('image') && !contentType.includes('octet'))) {
        return null;
      }
    } catch {
      // Can't validate, still try it
    }
    
    return imageUrl;
  } catch (err) {
    return null;
  }
}

async function main() {
  const total = await prisma.campground.count({ where: { imageUrl: null, websiteUrl: { not: null } } });
  console.log(`\n🌐 Found ${total} campgrounds with websites but no image\n`);
  
  if (total === 0) return;

  let processed = 0, updated = 0, failed = 0;
  const startTime = Date.now();

  while (true) {
    const batch = await prisma.campground.findMany({
      where: { imageUrl: null, websiteUrl: { not: null } },
      select: { id: true, name: true, state: true, websiteUrl: true },
      take: BATCH_SIZE,
    });

    if (batch.length === 0) break;

    for (const camp of batch) {
      processed++;
      const imageUrl = await scrapeImage(camp.websiteUrl);
      
      if (imageUrl) {
        await prisma.campground.update({
          where: { id: camp.id },
          data: { imageUrl },
        });
        updated++;
        console.log(`  ✅ ${camp.name} (${camp.state || '?'})`);
      } else {
        // Set imageUrl to empty string so we don't retry
        await prisma.campground.update({
          where: { id: camp.id },
          data: { imageUrl: '' },
        });
        failed++;
        console.log(`  ❌ ${camp.name} (${camp.state || '?'})`);
      }

      if (processed % 100 === 0) {
        const elapsed = (Date.now() - startTime) / 1000;
        const rate = processed / elapsed;
        const remaining = (total - processed) / rate;
        console.log(`\n📊 ${processed}/${total} | ✅ ${updated} | ❌ ${failed} | ⏱️ ${Math.round(remaining / 60)}min left\n`);
      }

      await sleep(DELAY_MS);
    }
  }

  // Clean up empty strings (set back to null for ones we couldn't find)
  await prisma.campground.updateMany({
    where: { imageUrl: '' },
    data: { imageUrl: null },
  });

  const elapsed = Math.round((Date.now() - startTime) / 1000);
  console.log(`\n${'='.repeat(50)}`);
  console.log(`🏕️  WEBSITE SCRAPE COMPLETE (${Math.floor(elapsed / 60)}m ${elapsed % 60}s)`);
  console.log(`   ✅ Found images: ${updated}`);
  console.log(`   ❌ No image found: ${failed}`);
  console.log(`${'='.repeat(50)}\n`);

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
