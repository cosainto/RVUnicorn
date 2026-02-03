// ============================================
// DISCOVER CAMPGROUND SITE MAPS
// Scrapes campground websites for park/site maps
// Checks Recreation.gov, common URL patterns
// Run: DATABASE_URL="..." npx ts-node scripts/discover-campground-maps.ts
// ============================================

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const GOOGLE_API_KEY = 'AIzaSyDjozGrpxhprpPOF2aktbZi051sDyqTXSk';

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

// ---- FETCH HELPERS ----
async function fetchHtml(url: string, timeout = 12000): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      },
      redirect: 'follow',
    });
    clearTimeout(timer);
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('image/') || ct.includes('application/pdf')) return null;
    return await res.text();
  } catch { return null; }
}

async function checkUrl(url: string, timeout = 8000): Promise<{ ok: boolean; finalUrl: string; contentType: string }> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const res = await fetch(url, {
      method: 'HEAD',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' },
      redirect: 'follow',
    });
    clearTimeout(timer);
    return { ok: res.ok, finalUrl: res.url, contentType: res.headers.get('content-type') || '' };
  } catch {
    return { ok: false, finalUrl: url, contentType: '' };
  }
}

function resolveUrl(base: string, relative: string): string {
  try {
    if (relative.startsWith('http://') || relative.startsWith('https://')) return relative;
    if (relative.startsWith('//')) return 'https:' + relative;
    return new URL(relative, base).href;
  } catch { return relative; }
}

function getOrigin(url: string): string {
  try { return new URL(url).origin; } catch { return url; }
}

// ---- MAP SCORING ----
// We want actual campground SITE LAYOUT maps, not Google Maps embeds or directions

const MAP_IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.pdf', '.bmp'];

function isImageOrPdf(url: string): boolean {
  const lower = url.toLowerCase().split('?')[0].split('#')[0];
  return MAP_IMAGE_EXTS.some(ext => lower.endsWith(ext));
}

interface MapCandidate {
  url: string;
  score: number;
  type: 'image' | 'pdf' | 'page';
  source: string;
}

function scoreCandidate(url: string, text: string): number {
  const u = url.toLowerCase();
  const t = (text || '').toLowerCase();
  const both = u + ' ' + t;
  let score = 0;

  // ---- STRONG POSITIVE signals (these are campground layout maps) ----
  if (/campground[\s_-]?map/i.test(both)) score += 60;
  if (/camp[\s_-]?map/i.test(both)) score += 55;
  if (/site[\s_-]?map/i.test(both) && !/sitemap\.xml/i.test(u)) score += 50;
  if (/park[\s_-]?map/i.test(both)) score += 45;
  if (/facility[\s_-]?map/i.test(both)) score += 45;
  if (/resort[\s_-]?map/i.test(both)) score += 40;
  if (/property[\s_-]?map/i.test(both)) score += 40;
  if (/rv[\s_-]?park[\s_-]?map/i.test(both)) score += 55;
  if (/campsite[\s_-]?map/i.test(both)) score += 60;
  if (/layout[\s_-]?map/i.test(both)) score += 50;
  if (/trail[\s_-]?map/i.test(both)) score += 30;
  if (/area[\s_-]?map/i.test(both)) score += 25;
  if (/map[\s_-]?of[\s_-]?(the[\s_-]*)?(campground|park|resort|camp|sites)/i.test(both)) score += 55;

  // Image/PDF bonus
  if (isImageOrPdf(u)) score += 15;
  if (u.endsWith('.pdf')) score += 10; // PDFs are usually high quality maps

  // ---- NEGATIVE signals ----
  if (/sitemap\.xml/i.test(u)) return -100;
  if (/google\.com\/maps/i.test(u)) return -100;
  if (/maps\.google/i.test(u)) return -100;
  if (/goo\.gl\/maps/i.test(u)) return -100;
  if (/directions/i.test(both)) return -50;
  if (/weather/i.test(both)) score -= 30;
  if (/favicon/i.test(u)) return -100;
  if (/logo/i.test(u) && !/map/i.test(u)) return -50;
  if (/icon/i.test(u) && !/map/i.test(u)) return -50;
  if (/thumbnail/i.test(u)) score -= 20;
  if (/banner/i.test(u) && !/map/i.test(u)) score -= 20;
  if (/avatar/i.test(u)) return -50;
  if (/social/i.test(u)) return -50;
  if (/(facebook|twitter|instagram|youtube|pinterest)/i.test(u)) return -100;

  return score;
}

// ---- STRATEGY 1: Scrape homepage for map links & images ----
function findMapsInHtml(html: string, baseUrl: string): MapCandidate[] {
  const candidates: MapCandidate[] = [];

  // Find <a> links with map-related text or URLs
  const linkRe = /<a\s+[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    const linkText = m[2].replace(/<[^>]*>/g, '').trim();
    if (!href || href === '#' || href.startsWith('javascript:') || href.startsWith('mailto:')) continue;

    const fullUrl = resolveUrl(baseUrl, href);
    const score = scoreCandidate(fullUrl, linkText);
    if (score > 20) {
      const type = fullUrl.toLowerCase().endsWith('.pdf') ? 'pdf' : (isImageOrPdf(fullUrl) ? 'image' : 'page');
      candidates.push({ url: fullUrl, score, type, source: 'link' });
    }
  }

  // Find <img> tags with map-related alt/src
  const imgRe = /<img\s+[^>]*>/gi;
  while ((m = imgRe.exec(html)) !== null) {
    const tag = m[0];
    const srcMatch = tag.match(/src\s*=\s*["']([^"']+)["']/i);
    const altMatch = tag.match(/alt\s*=\s*["']([^"']*?)["']/i);
    if (!srcMatch) continue;

    const src = srcMatch[1].trim();
    const alt = altMatch ? altMatch[1] : '';
    const fullUrl = resolveUrl(baseUrl, src);
    const score = scoreCandidate(fullUrl, alt);
    if (score > 20) {
      candidates.push({ url: fullUrl, score: score + 5, type: 'image', source: 'img' });
    }
  }

  // Find <embed> or <object> with PDF maps
  const embedRe = /<(?:embed|object|iframe)\s+[^>]*(?:src|data)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = embedRe.exec(html)) !== null) {
    const src = m[1].trim();
    const fullUrl = resolveUrl(baseUrl, src);
    if (fullUrl.toLowerCase().includes('.pdf') || fullUrl.toLowerCase().includes('map')) {
      const score = scoreCandidate(fullUrl, 'embedded map');
      if (score > 10) {
        candidates.push({ url: fullUrl, score: score + 10, type: 'pdf', source: 'embed' });
      }
    }
  }

  return candidates;
}

// ---- STRATEGY 2: Try common map page paths ----
async function tryCommonPaths(websiteUrl: string): Promise<MapCandidate[]> {
  const origin = getOrigin(websiteUrl);
  const candidates: MapCandidate[] = [];

  // Most common paths for campground maps
  const paths = [
    '/map', '/maps', '/map/',
    '/campground-map', '/campground-map/', '/campground-map.html',
    '/park-map', '/park-map/', '/park-map.html',
    '/site-map', '/site-map/', // careful: not sitemap.xml
    '/camp-map', '/camp-map/',
    '/facility-map', '/resort-map',
    '/map.pdf', '/campground-map.pdf', '/park-map.pdf', '/site-map.pdf',
    '/camp-map.pdf', '/images/map.pdf',
    '/images/campground-map.jpg', '/images/park-map.jpg',
    '/images/map.jpg', '/images/map.png',
    '/images/campground-map.png', '/images/site-map.png',
    '/wp-content/uploads/campground-map.pdf',
    '/wp-content/uploads/park-map.pdf',
    '/media/campground-map.pdf',
  ];

  // Only check the first 10 most likely paths to save time
  const priorityPaths = paths.slice(0, 10);

  for (const path of priorityPaths) {
    const testUrl = origin + path;
    const result = await checkUrl(testUrl);
    if (result.ok) {
      const ct = result.contentType.toLowerCase();
      let type: 'image' | 'pdf' | 'page' = 'page';
      if (ct.includes('pdf') || testUrl.endsWith('.pdf')) type = 'pdf';
      else if (ct.includes('image/')) type = 'image';

      const score = scoreCandidate(testUrl, path) + 10; // Bonus for direct hit
      if (score > 15) {
        candidates.push({ url: result.finalUrl, score, type, source: 'common-path' });
      }
    }
    await delay(50);
  }

  return candidates;
}

// ---- STRATEGY 3: Follow "map" subpage and scrape it ----
async function scrapeMapSubpage(url: string): Promise<MapCandidate[]> {
  const html = await fetchHtml(url);
  if (!html) return [];

  const candidates: MapCandidate[] = [];

  // Look for images on the map page (these are likely THE map)
  const imgRe = /<img\s+[^>]*src\s*=\s*["']([^"']+)["'][^>]*>/gi;
  let m;
  while ((m = imgRe.exec(html)) !== null) {
    const src = m[0];
    const srcUrl = m[1].trim();
    const altMatch = src.match(/alt\s*=\s*["']([^"']*?)["']/i);
    const alt = altMatch ? altMatch[1] : '';
    const fullUrl = resolveUrl(url, srcUrl);

    if (!isImageOrPdf(fullUrl)) continue;
    // Skip tiny images (icons, logos)
    const widthMatch = src.match(/width\s*=\s*["']?(\d+)/i);
    if (widthMatch && parseInt(widthMatch[1]) < 100) continue;

    // On a map subpage, any substantial image is likely a map
    let score = 30; // Base score for being on a map page
    score += scoreCandidate(fullUrl, alt);
    candidates.push({ url: fullUrl, score, type: 'image', source: 'map-subpage' });
  }

  // Look for embedded PDFs
  const embedRe = /<(?:embed|object|iframe)\s+[^>]*(?:src|data)\s*=\s*["']([^"']+)["'][^>]*>/gi;
  while ((m = embedRe.exec(html)) !== null) {
    const src = m[1].trim();
    const fullUrl = resolveUrl(url, src);
    if (fullUrl.includes('.pdf') || fullUrl.includes('map')) {
      candidates.push({ url: fullUrl, score: 60, type: 'pdf', source: 'map-subpage-embed' });
    }
  }

  // Look for direct PDF links
  const linkRe = /<a\s+[^>]*href\s*=\s*["']([^"']+\.pdf)["'][^>]*>/gi;
  while ((m = linkRe.exec(html)) !== null) {
    const href = m[1].trim();
    const fullUrl = resolveUrl(url, href);
    candidates.push({ url: fullUrl, score: 55, type: 'pdf', source: 'map-subpage-pdf' });
  }

  return candidates;
}

// ---- STRATEGY 4: Recreation.gov check ----
async function checkRecreationGov(campgroundName: string, state: string): Promise<MapCandidate | null> {
  // Search Recreation.gov for the campground
  const searchName = campgroundName
    .replace(/campground|camping|camp|rv park|rv resort/gi, '')
    .trim();

  const searchUrl = `https://ridb.recreation.gov/api/v1/facilities?query=${encodeURIComponent(searchName)}&state=${state}&limit=5&apikey=10873509-9b5c-4be7-a5c9-4a0c28b2df1c`;

  try {
    const res = await fetch(searchUrl);
    const data = await res.json() as any;
    if (data.RECDATA && data.RECDATA.length > 0) {
      for (const facility of data.RECDATA) {
        const facilityId = facility.FacilityID;
        // Recreation.gov has maps at predictable URLs
        const mapUrl = `https://www.recreation.gov/camping/campgrounds/${facilityId}/map`;
        // Check if the map page exists
        const check = await checkUrl(mapUrl);
        if (check.ok) {
          return { url: mapUrl, score: 70, type: 'page', source: 'recreation.gov' };
        }
      }
    }
  } catch {}
  return null;
}

// ---- STRATEGY 5: Check KOA, Thousand Trails, other chain-specific map URLs ----
function getChainMapUrl(campgroundName: string, websiteUrl?: string): MapCandidate | null {
  const lower = campgroundName.toLowerCase();
  const url = (websiteUrl || '').toLowerCase();

  // KOA campgrounds usually have /activities-map or similar
  if (lower.includes('koa') && websiteUrl) {
    const origin = getOrigin(websiteUrl);
    return { url: `${origin}/activities-map`, score: 40, type: 'page', source: 'koa-pattern' };
  }

  // Thousand Trails
  if (lower.includes('thousand trails') && websiteUrl) {
    const origin = getOrigin(websiteUrl);
    return { url: `${origin}/resort-map`, score: 40, type: 'page', source: 'tt-pattern' };
  }

  // Sun Outdoors / Encore
  if ((lower.includes('sun outdoors') || lower.includes('encore')) && websiteUrl) {
    const origin = getOrigin(websiteUrl);
    return { url: `${origin}/resort-map`, score: 40, type: 'page', source: 'sun-pattern' };
  }

  return null;
}

// ---- MAIN ----
async function main() {
  console.log('==============================================');
  console.log('  DISCOVER CAMPGROUND SITE MAPS');
  console.log('  Scraping 11,600+ campground websites');
  console.log('==============================================\n');

  // Get all campgrounds
  const campgrounds = await prisma.campground.findMany({
    select: {
      id: true,
      name: true,
      state: true,
      websiteUrl: true,
      campgroundMapUrl: true,
    },
    orderBy: { name: 'asc' },
  });

  console.log(`Total campgrounds: ${campgrounds.length}`);

  // Skip ones that already have a map
  const needMap = campgrounds.filter(c => !c.campgroundMapUrl);
  const withWebsite = needMap.filter(c => c.websiteUrl);
  const withoutWebsite = needMap.filter(c => !c.websiteUrl);

  console.log(`Already have map: ${campgrounds.length - needMap.length}`);
  console.log(`Need map (with website): ${withWebsite.length}`);
  console.log(`Need map (no website): ${withoutWebsite.length}\n`);

  let found = 0;
  let failed = 0;
  let errors = 0;
  const sourceStats: { [key: string]: number } = {};

  // Process campgrounds with websites first
  for (let i = 0; i < withWebsite.length; i++) {
    const camp = withWebsite[i];
    const website = camp.websiteUrl!;

    try {
      let allCandidates: MapCandidate[] = [];

      // Strategy 1: Scrape homepage
      const html = await fetchHtml(website);
      if (html) {
        const homepageMaps = findMapsInHtml(html, website);
        allCandidates.push(...homepageMaps);
      }
      await delay(100);

      // Strategy 2: Try common paths (only if nothing great found yet)
      const bestSoFar = allCandidates.reduce((max, c) => Math.max(max, c.score), 0);
      if (bestSoFar < 50) {
        const pathMaps = await tryCommonPaths(website);
        allCandidates.push(...pathMaps);
      }

      // Strategy 3: If we found map page links, follow them
      const pageLinks = allCandidates
        .filter(c => c.type === 'page' && c.score > 20)
        .sort((a, b) => b.score - a.score)
        .slice(0, 2); // Follow top 2 map pages

      for (const link of pageLinks) {
        const subCandidates = await scrapeMapSubpage(link.url);
        allCandidates.push(...subCandidates);
        await delay(100);
      }

      // Strategy 5: Chain-specific patterns
      const chainMap = getChainMapUrl(camp.name, website);
      if (chainMap) {
        const check = await checkUrl(chainMap.url);
        if (check.ok) allCandidates.push(chainMap);
      }

      // Pick the best candidate
      if (allCandidates.length > 0) {
        // Dedupe by URL
        const seen = new Set<string>();
        allCandidates = allCandidates.filter(c => {
          if (seen.has(c.url)) return false;
          seen.add(c.url);
          return true;
        });

        // Sort by score
        allCandidates.sort((a, b) => b.score - a.score);
        const best = allCandidates[0];

        if (best.score >= 25) {
          // Verify the URL actually works
          let finalUrl = best.url;
          if (best.type !== 'page' || best.score >= 40) {
            const verify = await checkUrl(best.url);
            if (verify.ok) {
              finalUrl = verify.finalUrl;
            } else {
              // URL doesn't work, try next candidate
              const next = allCandidates.find((c, idx) => idx > 0 && c.score >= 25);
              if (next) {
                const v2 = await checkUrl(next.url);
                if (v2.ok) finalUrl = v2.finalUrl;
                else { failed++; continue; }
              } else { failed++; continue; }
            }
          }

          await prisma.campground.update({
            where: { id: camp.id },
            data: { campgroundMapUrl: finalUrl },
          });

          found++;
          sourceStats[best.source] = (sourceStats[best.source] || 0) + 1;
          console.log(`  ✅ ${camp.name} (${camp.state}) — ${best.source} [score:${best.score}] ${best.type}`);
        } else {
          failed++;
        }
      } else {
        failed++;
      }

    } catch (err: any) {
      errors++;
    }

    // Progress every 200
    if ((i + 1) % 200 === 0) {
      console.log(`\n📊 Progress: ${i + 1}/${withWebsite.length} | Found: ${found} | No map: ${failed} | Errors: ${errors}\n`);
    }
  }

  // Process campgrounds WITHOUT websites — try Recreation.gov
  console.log(`\n--- Checking Recreation.gov for ${withoutWebsite.length} campgrounds without websites ---\n`);

  for (let i = 0; i < withoutWebsite.length; i++) {
    const camp = withoutWebsite[i];

    try {
      const recMap = await checkRecreationGov(camp.name, camp.state || '');
      if (recMap) {
        await prisma.campground.update({
          where: { id: camp.id },
          data: { campgroundMapUrl: recMap.url },
        });
        found++;
        sourceStats['recreation.gov'] = (sourceStats['recreation.gov'] || 0) + 1;
        console.log(`  ✅ ${camp.name} (${camp.state}) — recreation.gov`);
      }
      await delay(200); // Rate limit Recreation.gov
    } catch {}

    if ((i + 1) % 100 === 0) {
      console.log(`  Rec.gov progress: ${i + 1}/${withoutWebsite.length}`);
    }
  }

  // ---- FINAL STATS ----
  const totalWithMaps = await prisma.campground.count({ where: { campgroundMapUrl: { not: null } } });
  const total = await prisma.campground.count();

  console.log('\n==============================================');
  console.log('  COMPLETE');
  console.log('==============================================');
  console.log(`Maps found: ${found}`);
  console.log(`No map found: ${failed}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total with maps: ${totalWithMaps}/${total} (${((totalWithMaps/total)*100).toFixed(1)}%)`);
  console.log('\n--- Sources ---');
  for (const [source, count] of Object.entries(sourceStats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${source}: ${count}`);
  }
}

main().catch(console.error).finally(() => process.exit());
