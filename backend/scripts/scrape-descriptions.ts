import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fetchWithTimeout(url: string, timeout = 8000): Promise<string | null> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    clearTimeout(timeoutId);
    if (!response.ok) return null;
    return await response.text();
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

function extractDescription(html: string, name: string): string | null {
  // Try meta description first
  const metaMatch = html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  
  // Try og:description
  const ogMatch = html.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i);
  
  // Try to find about/description sections
  const aboutPatterns = [
    /<div[^>]*class=["'][^"']*about[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<section[^>]*class=["'][^"']*about[^"']*["'][^>]*>([\s\S]*?)<\/section>/gi,
    /<div[^>]*id=["']about["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<p[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/p>/gi,
    /<div[^>]*class=["'][^"']*description[^"']*["'][^>]*>([\s\S]*?)<\/div>/gi,
    /<article[^>]*>([\s\S]*?)<\/article>/gi,
  ];
  
  let bestContent = '';
  
  // Check meta descriptions
  if (metaMatch?.[1] && metaMatch[1].length > 50) {
    bestContent = metaMatch[1];
  }
  if (ogMatch?.[1] && ogMatch[1].length > bestContent.length) {
    bestContent = ogMatch[1];
  }
  
  // Try content patterns
  for (const pattern of aboutPatterns) {
    const matches = html.matchAll(pattern);
    for (const match of matches) {
      const text = stripHtml(match[1]);
      if (text.length > bestContent.length && text.length < 5000) {
        // Make sure it's relevant (contains campground-related words or the name)
        const lower = text.toLowerCase();
        const nameLower = name.toLowerCase().split(' ')[0];
        if (lower.includes('camp') || lower.includes('rv') || lower.includes('site') || 
            lower.includes('tent') || lower.includes('hookup') || lower.includes(nameLower) ||
            lower.includes('acre') || lower.includes('park') || lower.includes('resort')) {
          bestContent = text;
        }
      }
    }
  }
  
  // Try to find main content area with paragraphs
  if (bestContent.length < 100) {
    const mainContent = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i)
      || html.match(/<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
      || html.match(/<div[^>]*class=["'][^"']*main[^"']*["'][^>]*>([\s\S]*?)<\/div>/i);
    
    if (mainContent) {
      // Extract paragraphs
      const paragraphs: string[] = [];
      const pMatches = mainContent[1].matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi);
      for (const p of pMatches) {
        const text = stripHtml(p[1]).trim();
        if (text.length > 30 && text.length < 1000) {
          paragraphs.push(text);
        }
        if (paragraphs.join(' ').length > 500) break;
      }
      if (paragraphs.length > 0) {
        const combined = paragraphs.join('\n\n');
        if (combined.length > bestContent.length) {
          bestContent = combined;
        }
      }
    }
  }
  
  // Clean up and validate
  bestContent = bestContent.trim();
  if (bestContent.length < 50) return null;
  if (bestContent.length > 3000) bestContent = bestContent.substring(0, 3000) + '...';
  
  return bestContent;
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

async function scrapeCampground(campground: { id: string; name: string; websiteUrl: string }): Promise<boolean> {
  const html = await fetchWithTimeout(campground.websiteUrl);
  if (!html) return false;
  
  const description = extractDescription(html, campground.name);
  if (!description) return false;
  
  await prisma.campground.update({
    where: { id: campground.id },
    data: { description }
  });
  
  return true;
}

async function main() {
  const campgrounds = await prisma.campground.findMany({
    where: { 
      description: null,
      NOT: { websiteUrl: null }
    },
    select: { id: true, name: true, websiteUrl: true, state: true }
  });
  
  console.log(`Found ${campgrounds.length} campgrounds to scrape`);
  
  let found = 0;
  let miss = 0;
  let errors = 0;
  
  for (let i = 0; i < campgrounds.length; i++) {
    const c = campgrounds[i];
    
    try {
      const timeout = new Promise<boolean>((_, reject) => 
        setTimeout(() => reject(new Error('timeout')), 25000)
      );
      
      const result = await Promise.race([
        scrapeCampground(c as any),
        timeout
      ]);
      
      if (result) {
        found++;
        console.log(`[${i + 1}] ${c.name} (${c.state}) YES`);
      } else {
        miss++;
      }
    } catch (e) {
      errors++;
    }
    
    if ((i + 1) % 100 === 0) {
      console.log(`=== ${i + 1}/${campgrounds.length} found=${found} miss=${miss} err=${errors} ===`);
    }
  }
  
  console.log('\nDONE');
  console.log(`Found: ${found}`);
  console.log(`Miss: ${miss}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
