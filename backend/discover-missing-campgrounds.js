// ============================================================
// DISCOVER MISSING CAMPGROUNDS
// Scrapes Hipcamp and The Dyrt to find campgrounds NOT in RVUnicorn
// Only extracts: name, address, state, campground's own website URL
// Run: cd ~/Downloads/kindletribe-mvp/backend && node discover-missing-campgrounds.js
// Options:
//   --state=CA        (run a single state)
//   --source=hipcamp  (hipcamp only)
//   --source=dyrt     (dyrt only)
//   --skip-to=NH      (skip to a specific state)
// ============================================================

const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

require('dotenv').config();

const prisma = new PrismaClient();
const delay = (ms) => new Promise(r => setTimeout(r, ms));

// State mappings
const STATES = {
  'AL': 'alabama', 'AK': 'alaska', 'AZ': 'arizona', 'AR': 'arkansas',
  'CA': 'california', 'CO': 'colorado', 'CT': 'connecticut', 'DE': 'delaware',
  'FL': 'florida', 'GA': 'georgia', 'HI': 'hawaii', 'ID': 'idaho',
  'IL': 'illinois', 'IN': 'indiana', 'IA': 'iowa', 'KS': 'kansas',
  'KY': 'kentucky', 'LA': 'louisiana', 'ME': 'maine', 'MD': 'maryland',
  'MA': 'massachusetts', 'MI': 'michigan', 'MN': 'minnesota', 'MS': 'mississippi',
  'MO': 'missouri', 'MT': 'montana', 'NE': 'nebraska', 'NV': 'nevada',
  'NH': 'new-hampshire', 'NJ': 'new-jersey', 'NM': 'new-mexico', 'NY': 'new-york',
  'NC': 'north-carolina', 'ND': 'north-dakota', 'OH': 'ohio', 'OK': 'oklahoma',
  'OR': 'oregon', 'PA': 'pennsylvania', 'RI': 'rhode-island', 'SC': 'south-carolina',
  'SD': 'south-dakota', 'TN': 'tennessee', 'TX': 'texas', 'UT': 'utah',
  'VT': 'vermont', 'VA': 'virginia', 'WA': 'washington', 'WV': 'west-virginia',
  'WI': 'wisconsin', 'WY': 'wyoming'
};

// Output directory
const OUTPUT_DIR = path.join(__dirname, 'discovered-campgrounds');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// Normalize name for comparison (lowercase, strip common words, etc.)
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\b(campground|camping|camp|rv|park|resort|recreation|area|national|state|forest|county)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Check if a campground name is similar enough to consider a match
function isSimilar(name1, name2) {
  const n1 = normalizeName(name1);
  const n2 = normalizeName(name2);
  
  // Exact normalized match
  if (n1 === n2) return true;
  
  // One contains the other
  if (n1.includes(n2) || n2.includes(n1)) return true;
  
  // Check word overlap (if 70%+ words match)
  const words1 = n1.split(' ').filter(w => w.length > 2);
  const words2 = n2.split(' ').filter(w => w.length > 2);
  if (words1.length === 0 || words2.length === 0) return false;
  
  const overlap = words1.filter(w => words2.includes(w)).length;
  const maxLen = Math.max(words1.length, words2.length);
  return overlap / maxLen >= 0.7;
}

// Load existing campgrounds for a state
async function loadExistingCampgrounds(stateCode) {
  const campgrounds = await prisma.campground.findMany({
    where: { state: stateCode },
    select: { name: true, location: true, websiteUrl: true }
  });
  return campgrounds;
}

// ============================================================
// HIPCAMP SCRAPER
// ============================================================
async function scrapeHipcamp(browser, stateCode, stateName, existing) {
  const results = [];
  const baseUrl = `https://www.hipcamp.com/en-US/d/united-states/${stateName}/camping/all`;
  
  console.log(`  [Hipcamp] Loading ${stateName}...`);
  
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });
    
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Scroll to load more results (Hipcamp lazy-loads)
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrolls = 30; // Cap at ~30 scrolls to avoid infinite loops
    
    while (scrollAttempts < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1500);
      scrollAttempts++;
      
      if (scrollAttempts % 5 === 0) {
        const count = await page.evaluate(() => 
          document.querySelectorAll('[data-testid="listing-card"], a[href*="/land/"], a[href*="/campground/"]').length
        );
        console.log(`    Scrolled ${scrollAttempts}x, found ${count} listings so far...`);
      }
    }
    
    // Extract campground data
    const listings = await page.evaluate(() => {
      const items = [];
      
      // Try multiple selector strategies
      const cards = document.querySelectorAll('[data-testid="listing-card"], [class*="ListingCard"], [class*="listing-card"]');
      
      if (cards.length > 0) {
        cards.forEach(card => {
          const linkEl = card.querySelector('a[href*="/land/"], a[href*="/campground/"]');
          const nameEl = card.querySelector('h2, h3, [class*="title"], [class*="name"]');
          const locationEl = card.querySelector('[class*="location"], [class*="address"], [class*="subtitle"]');
          
          if (nameEl) {
            items.push({
              name: nameEl.textContent.trim(),
              address: locationEl ? locationEl.textContent.trim() : '',
              hipcampUrl: linkEl ? linkEl.href : ''
            });
          }
        });
      }
      
      // Fallback: grab all links that look like campground listings
      if (items.length === 0) {
        const links = document.querySelectorAll('a[href*="/land/"], a[href*="/campground/"]');
        const seen = new Set();
        links.forEach(link => {
          const href = link.href;
          if (seen.has(href)) return;
          seen.add(href);
          
          // Get the text content, try to find a name
          const text = link.textContent.trim();
          if (text && text.length > 3 && text.length < 200) {
            // Try to find nearby location text
            const parent = link.closest('[class*="card"], [class*="listing"], article, li');
            let address = '';
            if (parent) {
              const locEl = parent.querySelector('[class*="location"], [class*="address"], [class*="subtitle"], [class*="city"]');
              if (locEl) address = locEl.textContent.trim();
            }
            
            items.push({
              name: text.split('\n')[0].trim(),
              address: address,
              hipcampUrl: href
            });
          }
        });
      }
      
      return items;
    });
    
    console.log(`    Found ${listings.length} raw listings on Hipcamp`);
    
    // Filter out duplicates and check against existing
    const seen = new Set();
    for (const listing of listings) {
      if (!listing.name || listing.name.length < 3) continue;
      
      const key = normalizeName(listing.name);
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Check if already in RVUnicorn
      const alreadyExists = existing.some(e => isSimilar(e.name, listing.name));
      
      if (!alreadyExists) {
        results.push({
          name: listing.name,
          address: listing.address,
          state: stateCode,
          sourceUrl: listing.hipcampUrl,
          source: 'hipcamp'
        });
      }
    }
    
    console.log(`    ${results.length} NEW campgrounds not in RVUnicorn`);
    
  } catch (err) {
    console.log(`    [Hipcamp] Error for ${stateName}: ${err.message}`);
  } finally {
    if (page) await page.close();
  }
  
  return results;
}

// ============================================================
// THE DYRT SCRAPER
// ============================================================
async function scrapeDyrt(browser, stateCode, stateName, existing) {
  const results = [];
  const fullStateName = stateName.replace(/-/g, '-');
  const baseUrl = `https://thedyrt.com/camping/${fullStateName}`;
  
  console.log(`  [The Dyrt] Loading ${stateName}...`);
  
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 900 });
    
    await page.goto(baseUrl, { waitUntil: 'networkidle2', timeout: 30000 });
    await delay(2000);
    
    // Scroll to load more
    let previousHeight = 0;
    let scrollAttempts = 0;
    const maxScrolls = 30;
    
    while (scrollAttempts < maxScrolls) {
      const currentHeight = await page.evaluate(() => document.body.scrollHeight);
      if (currentHeight === previousHeight) break;
      
      previousHeight = currentHeight;
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await delay(1500);
      scrollAttempts++;
      
      // Check for "Load More" or "Show More" buttons
      const loadedMore = await page.evaluate(() => {
        const buttons = [...document.querySelectorAll('button, a')];
        const loadMoreBtn = buttons.find(b => 
          /load more|show more|see more|view more/i.test(b.textContent)
        );
        if (loadMoreBtn) {
          loadMoreBtn.click();
          return true;
        }
        return false;
      });
      
      if (loadedMore) await delay(2000);
      
      if (scrollAttempts % 5 === 0) {
        const count = await page.evaluate(() =>
          document.querySelectorAll('a[href*="/camping/"][href*="/campground/"], a[href*="/camping/"][href*="/rv-park/"], [class*="campground"], [class*="CampgroundCard"]').length
        );
        console.log(`    Scrolled ${scrollAttempts}x, found ${count} listings so far...`);
      }
    }
    
    // Extract campground data
    const listings = await page.evaluate(() => {
      const items = [];
      const seen = new Set();
      
      // The Dyrt uses links like /camping/state/campground-name
      const links = document.querySelectorAll('a[href*="/camping/"]');
      
      links.forEach(link => {
        const href = link.href;
        
        // Filter to actual campground detail pages (has 3+ path segments after /camping/)
        const pathMatch = href.match(/\/camping\/[^/]+\/([^/]+)/);
        if (!pathMatch) return;
        
        // Skip category pages, search pages, etc.
        if (/\/(all|rv-parks|tent|cabins|glamping|free|state-park|national)$/i.test(href)) return;
        
        if (seen.has(href)) return;
        seen.add(href);
        
        // Find the campground name
        const parent = link.closest('[class*="card"], [class*="listing"], [class*="Campground"], article, li, div');
        let name = '';
        let address = '';
        
        if (parent) {
          const nameEl = parent.querySelector('h2, h3, h4, [class*="title"], [class*="name"]');
          const locEl = parent.querySelector('[class*="location"], [class*="address"], [class*="city"], [class*="subtitle"]');
          if (nameEl) name = nameEl.textContent.trim();
          if (locEl) address = locEl.textContent.trim();
        }
        
        if (!name) {
          name = link.textContent.trim().split('\n')[0].trim();
        }
        
        if (name && name.length > 3 && name.length < 200) {
          items.push({
            name: name,
            address: address,
            dyrtUrl: href
          });
        }
      });
      
      return items;
    });
    
    console.log(`    Found ${listings.length} raw listings on The Dyrt`);
    
    // Filter out duplicates and check against existing
    const seen = new Set();
    for (const listing of listings) {
      if (!listing.name || listing.name.length < 3) continue;
      
      const key = normalizeName(listing.name);
      if (seen.has(key)) continue;
      seen.add(key);
      
      // Check if already in RVUnicorn
      const alreadyExists = existing.some(e => isSimilar(e.name, listing.name));
      
      if (!alreadyExists) {
        results.push({
          name: listing.name,
          address: listing.address,
          state: stateCode,
          sourceUrl: listing.dyrtUrl,
          source: 'dyrt'
        });
      }
    }
    
    console.log(`    ${results.length} NEW campgrounds not in RVUnicorn`);
    
  } catch (err) {
    console.log(`    [The Dyrt] Error for ${stateName}: ${err.message}`);
  } finally {
    if (page) await page.close();
  }
  
  return results;
}

// ============================================================
// STEP 2: Visit each discovered campground's source page to get
// the campground's OWN website URL (not Hipcamp/Dyrt URL)
// ============================================================
async function enrichWithWebsiteUrl(browser, campground) {
  let page;
  try {
    page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    await page.goto(campground.sourceUrl, { waitUntil: 'networkidle2', timeout: 20000 });
    await delay(1500);
    
    const data = await page.evaluate(() => {
      const result = { websiteUrl: null, address: null };
      
      // Look for external website links
      const allLinks = [...document.querySelectorAll('a')];
      
      // Common patterns for "visit website" links
      const websiteLink = allLinks.find(a => {
        const text = (a.textContent || '').toLowerCase();
        const href = (a.href || '').toLowerCase();
        
        // Match "website", "visit site", "official site" type links
        if (/visit\s*(website|site)|official\s*(website|site)|campground\s*website|park\s*website|view\s*website/i.test(text)) return true;
        if (/^website$/i.test(text.trim())) return true;
        
        // Match external links that aren't social media or booking
        if (href && !href.includes('hipcamp.com') && !href.includes('thedyrt.com') &&
            !href.includes('facebook.com') && !href.includes('instagram.com') &&
            !href.includes('twitter.com') && !href.includes('youtube.com') &&
            !href.includes('google.com/maps') && !href.includes('recreation.gov') &&
            !href.includes('reserveamerica') && !href.includes('campspot') &&
            !href.includes('javascript:') && !href.includes('#') &&
            (text.includes('website') || text.includes('site'))) {
          return true;
        }
        
        return false;
      });
      
      if (websiteLink && websiteLink.href) {
        result.websiteUrl = websiteLink.href;
      }
      
      // Also try to get a better address
      const addressEl = document.querySelector('[class*="address"], [class*="location"], [itemprop="address"]');
      if (addressEl) {
        result.address = addressEl.textContent.trim();
      }
      
      return result;
    });
    
    if (data.websiteUrl) campground.websiteUrl = data.websiteUrl;
    if (data.address && data.address.length > campground.address.length) {
      campground.address = data.address;
    }
    
  } catch (err) {
    // Skip enrichment errors silently
  } finally {
    if (page) await page.close();
  }
  
  return campground;
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('🏕️  Discover Missing Campgrounds');
  console.log('================================\n');
  
  // Parse args
  const args = process.argv.slice(2);
  let targetState = null;
  let sourceFilter = null; // 'hipcamp', 'dyrt', or null (both)
  let skipTo = null;
  let enrichWebsites = true;
  
  for (const arg of args) {
    if (arg.startsWith('--state=')) targetState = arg.split('=')[1].toUpperCase();
    if (arg.startsWith('--source=')) sourceFilter = arg.split('=')[1].toLowerCase();
    if (arg.startsWith('--skip-to=')) skipTo = arg.split('=')[1].toUpperCase();
    if (arg === '--no-enrich') enrichWebsites = false;
  }
  
  // Get current DB stats
  const totalCampgrounds = await prisma.campground.count();
  console.log(`📊 Current RVUnicorn DB: ${totalCampgrounds} campgrounds\n`);
  
  // Determine which states to process
  let stateEntries = Object.entries(STATES);
  
  if (targetState) {
    if (!STATES[targetState]) {
      console.error(`Invalid state: ${targetState}`);
      process.exit(1);
    }
    stateEntries = [[targetState, STATES[targetState]]];
  }
  
  if (skipTo) {
    const idx = stateEntries.findIndex(([code]) => code === skipTo);
    if (idx > 0) {
      stateEntries = stateEntries.slice(idx);
      console.log(`⏭️  Skipping to ${skipTo}\n`);
    }
  }
  
  // Launch browser
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  const allDiscovered = [];
  const progressFile = path.join(OUTPUT_DIR, 'progress.json');
  
  // Load previous progress if exists
  let completedStates = [];
  if (fs.existsSync(progressFile)) {
    try {
      const progress = JSON.parse(fs.readFileSync(progressFile, 'utf8'));
      completedStates = progress.completedStates || [];
      console.log(`📂 Resuming from previous run (${completedStates.length} states completed)\n`);
    } catch (e) {}
  }
  
  for (const [stateCode, stateName] of stateEntries) {
    // Skip already completed states (unless targeting a specific state)
    if (!targetState && completedStates.includes(stateCode)) {
      console.log(`⏭️  ${stateCode} already completed, skipping`);
      continue;
    }
    
    console.log(`\n🔍 ${stateCode} (${stateName})`);
    console.log('─'.repeat(40));
    
    // Load existing campgrounds for this state
    const existing = await loadExistingCampgrounds(stateCode);
    console.log(`  📁 ${existing.length} campgrounds already in RVUnicorn`);
    
    let stateResults = [];
    
    // Scrape Hipcamp
    if (!sourceFilter || sourceFilter === 'hipcamp') {
      const hipcampResults = await scrapeHipcamp(browser, stateCode, stateName, existing);
      stateResults.push(...hipcampResults);
    }
    
    // Scrape The Dyrt
    if (!sourceFilter || sourceFilter === 'dyrt') {
      // Also check against Hipcamp results to avoid inter-source dupes
      const existingPlusHipcamp = [...existing, ...stateResults.map(r => ({ name: r.name }))];
      const dyrtResults = await scrapeDyrt(browser, stateCode, stateName, existingPlusHipcamp);
      stateResults.push(...dyrtResults);
    }
    
    // Enrich with actual website URLs by visiting each source page
    if (enrichWebsites && stateResults.length > 0) {
      console.log(`  🌐 Enriching ${stateResults.length} campgrounds with website URLs...`);
      
      for (let i = 0; i < stateResults.length; i++) {
        stateResults[i] = await enrichWithWebsiteUrl(browser, stateResults[i]);
        
        if ((i + 1) % 10 === 0) {
          const withUrl = stateResults.filter(r => r.websiteUrl).length;
          console.log(`    ${i + 1}/${stateResults.length} enriched (${withUrl} with website URLs)`);
        }
        
        await delay(500); // Be respectful
      }
      
      const withUrl = stateResults.filter(r => r.websiteUrl).length;
      console.log(`    ${withUrl}/${stateResults.length} have their own website URL`);
    }
    
    allDiscovered.push(...stateResults);
    
    // Save per-state results
    if (stateResults.length > 0) {
      const stateFile = path.join(OUTPUT_DIR, `${stateCode}.json`);
      fs.writeFileSync(stateFile, JSON.stringify(stateResults, null, 2));
    }
    
    // Update progress
    completedStates.push(stateCode);
    fs.writeFileSync(progressFile, JSON.stringify({
      completedStates,
      lastUpdated: new Date().toISOString(),
      totalDiscovered: allDiscovered.length
    }, null, 2));
    
    console.log(`  ✅ ${stateCode}: ${stateResults.length} new campgrounds discovered`);
    
    // Rate limiting between states
    await delay(3000);
  }
  
  await browser.close();
  
  // ============================================================
  // FINAL OUTPUT: Combined CSV and JSON
  // ============================================================
  
  // Deduplicate across all states
  const deduped = [];
  const seenNames = new Set();
  for (const camp of allDiscovered) {
    const key = `${camp.state}-${normalizeName(camp.name)}`;
    if (!seenNames.has(key) && camp.websiteUrl) {
      seenNames.add(key);
      deduped.push(camp);
    }
  }
  
  // Save combined JSON
  const jsonFile = path.join(OUTPUT_DIR, 'all-discovered.json');
  fs.writeFileSync(jsonFile, JSON.stringify(deduped, null, 2));
  
  // Save CSV
  const csvFile = path.join(OUTPUT_DIR, 'all-discovered.csv');
  const csvHeader = 'name,address,state,websiteUrl,sourceUrl,source\n';
  const csvRows = deduped.map(c => {
    const escape = (s) => `"${(s || '').replace(/"/g, '""')}"`;
    return [escape(c.name), escape(c.address), escape(c.state), escape(c.websiteUrl || ''), escape(c.sourceUrl), escape(c.source)].join(',');
  }).join('\n');
  fs.writeFileSync(csvFile, csvHeader + csvRows);
  
  // Print summary
  console.log('\n\n====================================================');
  console.log('🏁 DISCOVERY COMPLETE');
  console.log('====================================================');
  console.log(`Total new campgrounds found: ${deduped.length}`);
  
  const withWebsite = deduped.filter(c => c.websiteUrl).length;
  const fromHipcamp = deduped.filter(c => c.source === 'hipcamp').length;
  const fromDyrt = deduped.filter(c => c.source === 'dyrt').length;
  
  console.log(`  From Hipcamp: ${fromHipcamp}`);
  console.log(`  From The Dyrt: ${fromDyrt}`);
  console.log(`  With own website URL: ${withWebsite}`);
  
  // Per-state breakdown
  console.log('\nPer-state breakdown:');
  const byState = {};
  deduped.forEach(c => {
    byState[c.state] = (byState[c.state] || 0) + 1;
  });
  Object.entries(byState)
    .sort((a, b) => b[1] - a[1])
    .forEach(([state, count]) => {
      console.log(`  ${state}: ${count} new`);
    });
  
  console.log(`\n📁 Results saved to:`);
  console.log(`  JSON: ${jsonFile}`);
  console.log(`  CSV:  ${csvFile}`);
  console.log(`  Per-state files: ${OUTPUT_DIR}/[STATE].json`);
  
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
