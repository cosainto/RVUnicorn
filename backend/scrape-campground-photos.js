/**
 * Campground Photo Scraper
 * Scrapes images from campground websites and uploads to Cloudinary
 * 
 * Usage: node scrape-campground-photos.js [--limit=100] [--dry-run]
 */

const { PrismaClient } = require('@prisma/client');
const puppeteer = require('puppeteer');
const cloudinary = require('cloudinary').v2;
const https = require('https');
const http = require('http');
const { URL } = require('url');

const prisma = new PrismaClient();

// Configuration
const HITCH_USER_ID = 'cmlq1oay20000vu0dzojou39b';
const MIN_IMAGE_WIDTH = 400;  // Minimum width to consider
const MIN_IMAGE_HEIGHT = 300; // Minimum height to consider
const MAX_PHOTOS_PER_CAMPGROUND = 8;
const TIMEOUT_MS = 30000;

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'dy6eetmh7',
  api_key: process.env.CLOUDINARY_API_KEY || '333927774328418',
  api_secret: process.env.CLOUDINARY_API_SECRET || '9phbOjjX2YxVI43orwmWdoiCvew'
});

// Patterns to exclude (logos, icons, social media, etc.)
const EXCLUDE_PATTERNS = [
  /logo/i,
  /icon/i,
  /favicon/i,
  /sprite/i,
  /button/i,
  /avatar/i,
  /badge/i,
  /banner-ad/i,
  /advertisement/i,
  /facebook/i,
  /twitter/i,
  /instagram/i,
  /youtube/i,
  /pinterest/i,
  /linkedin/i,
  /google/i,
  /yelp/i,
  /tripadvisor/i,
  /payment/i,
  /visa/i,
  /mastercard/i,
  /paypal/i,
  /ssl/i,
  /secure/i,
  /trust/i,
  /widget/i,
  /pixel/i,
  /tracking/i,
  /analytics/i,
  /\.gif$/i,
  /\.svg$/i,
  /data:image/i,
  /placeholder/i,
  /loading/i,
  /spinner/i,
  /arrow/i,
  /chevron/i,
  /close/i,
  /menu/i,
  /search/i,
  /1x1/i,
  /spacer/i,
];

// Patterns that suggest good campground photos
const INCLUDE_PATTERNS = [
  /campground/i,
  /campsite/i,
  /cabin/i,
  /rv/i,
  /tent/i,
  /site/i,
  /lodge/i,
  /pool/i,
  /lake/i,
  /river/i,
  /trail/i,
  /nature/i,
  /outdoor/i,
  /park/i,
  /view/i,
  /scenic/i,
  /gallery/i,
  /photo/i,
  /image/i,
  /hero/i,
  /banner/i,
  /slide/i,
  /feature/i,
];

/**
 * Check if URL should be excluded
 */
function shouldExcludeUrl(url) {
  return EXCLUDE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Check if campground URL is too generic (just a homepage)
 * We want specific campground pages, not generic site homepages
 */
function isGenericHomepage(url) {
  if (!url) return true;
  
  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname;
    
    // Generic homepages to skip
    const genericDomains = [
      'recreation.gov',
      'fs.usda.gov',
      'nps.gov',
      'blm.gov',
      'fws.gov',
      'usace.army.mil',
    ];
    
    // Check if it's just the homepage of a generic domain
    const isGenericDomain = genericDomains.some(d => parsed.hostname.includes(d));
    const isHomepage = pathname === '/' || pathname === '' || pathname === '/index.html';
    
    if (isGenericDomain && isHomepage) {
      return true;
    }
    
    // Check for old/broken recreation.gov links (they redirect to homepage)
    if (parsed.hostname.includes('recreation.gov') && pathname.includes('campgroundDetails.do')) {
      return true; // Old format URLs that no longer work
    }
    
    // Must have a meaningful path for government sites
    if (isGenericDomain && pathname.split('/').filter(Boolean).length < 2) {
      return true;
    }
    
    return false;
  } catch (e) {
    return true; // Invalid URL
  }
}

/**
 * Check if URL looks like a good campground photo
 */
function isLikelyGoodPhoto(url) {
  return INCLUDE_PATTERNS.some(pattern => pattern.test(url));
}

/**
 * Get image dimensions via HTTP HEAD or by downloading
 */
async function getImageInfo(imageUrl) {
  return new Promise((resolve) => {
    try {
      const url = new URL(imageUrl);
      const protocol = url.protocol === 'https:' ? https : http;
      
      const req = protocol.get(imageUrl, { timeout: 10000 }, (res) => {
        const contentType = res.headers['content-type'] || '';
        const contentLength = parseInt(res.headers['content-length'] || '0', 10);
        
        // Must be an image
        if (!contentType.startsWith('image/')) {
          resolve(null);
          return;
        }
        
        // Skip very small files (likely icons)
        if (contentLength > 0 && contentLength < 10000) {
          resolve(null);
          return;
        }
        
        resolve({
          url: imageUrl,
          contentType,
          contentLength,
          // We'll estimate this is a valid image if it passes other checks
          valid: true
        });
        
        res.destroy();
      });
      
      req.on('error', () => resolve(null));
      req.on('timeout', () => {
        req.destroy();
        resolve(null);
      });
    } catch (e) {
      resolve(null);
    }
  });
}

/**
 * Scrape images from a website using Puppeteer
 */
async function scrapeImages(browser, websiteUrl) {
  const page = await browser.newPage();
  const images = [];
  
  try {
    // Set a reasonable viewport
    await page.setViewport({ width: 1920, height: 1080 });
    
    // Set user agent to look like a real browser
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Navigate to the page
    await page.goto(websiteUrl, { 
      waitUntil: 'networkidle2',
      timeout: TIMEOUT_MS 
    });
    
    // Wait a bit for lazy-loaded images
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight / 2);
    });
    await new Promise(r => setTimeout(r, 2000));
    
    // Extract all images
    const imageData = await page.evaluate((minWidth, minHeight) => {
      const imgs = [];
      
      // Get all img tags
      document.querySelectorAll('img').forEach(img => {
        const src = img.src || img.dataset.src || img.dataset.lazySrc;
        if (src && src.startsWith('http')) {
          imgs.push({
            src,
            width: img.naturalWidth || img.width || 0,
            height: img.naturalHeight || img.height || 0,
            alt: img.alt || '',
            isVisible: img.offsetParent !== null
          });
        }
      });
      
      // Get background images from divs
      document.querySelectorAll('[style*="background-image"]').forEach(el => {
        const style = el.getAttribute('style') || '';
        const match = style.match(/url\(['"]?([^'")\s]+)['"]?\)/);
        if (match && match[1] && match[1].startsWith('http')) {
          imgs.push({
            src: match[1],
            width: el.offsetWidth || 0,
            height: el.offsetHeight || 0,
            alt: '',
            isVisible: true
          });
        }
      });
      
      // Get images from picture/source elements
      document.querySelectorAll('source[srcset]').forEach(source => {
        const srcset = source.srcset;
        // Get the largest image from srcset
        const urls = srcset.split(',').map(s => s.trim().split(' ')[0]);
        urls.forEach(url => {
          if (url && url.startsWith('http')) {
            imgs.push({
              src: url,
              width: 0,
              height: 0,
              alt: '',
              isVisible: true
            });
          }
        });
      });
      
      return imgs;
    }, MIN_IMAGE_WIDTH, MIN_IMAGE_HEIGHT);
    
    // Filter and deduplicate
    const seenUrls = new Set();
    
    for (const img of imageData) {
      // Skip if we've seen this URL
      if (seenUrls.has(img.src)) continue;
      seenUrls.add(img.src);
      
      // Skip excluded patterns
      if (shouldExcludeUrl(img.src)) continue;
      
      // Prioritize images that look like campground photos
      const priority = isLikelyGoodPhoto(img.src) || isLikelyGoodPhoto(img.alt) ? 1 : 0;
      
      images.push({
        url: img.src,
        width: img.width,
        height: img.height,
        alt: img.alt,
        priority
      });
    }
    
    // Sort by priority (good photos first), then by size
    images.sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (b.width * b.height) - (a.width * a.height);
    });
    
  } catch (error) {
    console.error(`  Error scraping ${websiteUrl}: ${error.message}`);
  } finally {
    await page.close();
  }
  
  return images;
}

/**
 * Upload image to Cloudinary
 */
async function uploadToCloudinary(imageUrl, campgroundId, index) {
  try {
    const result = await cloudinary.uploader.upload(imageUrl, {
      folder: `campgrounds/${campgroundId}`,
      public_id: `scraped_${index}_${Date.now()}`,
      resource_type: 'image',
      timeout: 60000,
      transformation: [
        { width: 1920, height: 1080, crop: 'limit' }, // Limit max size
        { quality: 'auto:good' },
        { fetch_format: 'auto' }
      ]
    });
    
    return result.secure_url;
  } catch (error) {
    console.error(`  Failed to upload ${imageUrl}: ${error.message}`);
    return null;
  }
}

/**
 * Main scraping function
 */
async function scrapeCampgroundPhotos(options = {}) {
  const { limit = 100, dryRun = false, startFrom = null } = options;
  
  console.log('🏕️  Campground Photo Scraper');
  console.log('============================');
  console.log(`Mode: ${dryRun ? 'DRY RUN (no uploads)' : 'LIVE'}`);
  console.log(`Limit: ${limit} campgrounds`);
  console.log(`Max photos per campground: ${MAX_PHOTOS_PER_CAMPGROUND}`);
  console.log('');
  
  // Find campgrounds with websites that don't have many photos yet
  const campgrounds = await prisma.campground.findMany({
    where: {
      websiteUrl: { not: null },
      ...(startFrom ? { id: { gt: startFrom } } : {})
    },
    include: {
      _count: {
        select: { photos: true }
      }
    },
    orderBy: { name: 'desc' },
    take: limit
  });
  
  // Filter to campgrounds with fewer than MAX photos and non-generic URLs
  const campgroundsNeedingPhotos = campgrounds.filter(
    c => c._count.photos < MAX_PHOTOS_PER_CAMPGROUND && c.websiteUrl && !isGenericHomepage(c.websiteUrl)
  );
  
  // Count how many were filtered out
  const genericUrlCount = campgrounds.filter(
    c => c.websiteUrl && isGenericHomepage(c.websiteUrl)
  ).length;

  console.log(`Found ${campgrounds.length} campgrounds with websites`);
  console.log(`Skipped ${genericUrlCount} with generic/homepage URLs`);
  console.log(`${campgroundsNeedingPhotos.length} have specific URLs and need photos`);
  console.log('');
  
  if (campgroundsNeedingPhotos.length === 0) {
    console.log('No campgrounds need photos. Done!');
    return;
  }
  
  // Launch browser
  const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 120000, args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] });
  
  let totalPhotosAdded = 0;
  let campgroundsProcessed = 0;
  let errors = 0;
  
  try {
    for (const campground of campgroundsNeedingPhotos) {
      campgroundsProcessed++;
      const photosNeeded = MAX_PHOTOS_PER_CAMPGROUND - campground._count.photos;
      
      console.log(`\n[${campgroundsProcessed}/${campgroundsNeedingPhotos.length}] ${campground.name}`);
      console.log(`  URL: ${campground.websiteUrl}`);
      console.log(`  Current photos: ${campground._count.photos}, Need: ${photosNeeded}`);
      
      try {
        // Scrape images from website
        const images = await scrapeImages(browser, campground.websiteUrl);
        console.log(`  Found ${images.length} candidate images`);
        
        if (images.length === 0) {
          console.log('  ⚠️  No suitable images found');
          continue;
        }
        
        // Verify and upload top images
        let photosAdded = 0;
        
        for (const img of images) {
          if (photosAdded >= photosNeeded) break;
          
          // Verify image is accessible and large enough
          const info = await getImageInfo(img.url);
          if (!info || !info.valid) {
            continue;
          }
          
          console.log(`  📷 ${img.url.substring(0, 80)}...`);
          
          if (dryRun) {
            console.log('    [DRY RUN] Would upload this image');
            photosAdded++;
            continue;
          }
          
          // Upload to Cloudinary
          const cloudinaryUrl = await uploadToCloudinary(
            img.url, 
            campground.id, 
            photosAdded
          );
          
          if (!cloudinaryUrl) continue;
          
          // Create CampgroundPhoto record
          await prisma.campgroundPhoto.create({
            data: {
              campgroundId: campground.id,
              userId: HITCH_USER_ID,
              imageUrl: cloudinaryUrl,
              caption: img.alt || `Photo of ${campground.name}`,
              status: 'APPROVED' // Auto-approve scraped photos
            }
          });
          
          photosAdded++;
          totalPhotosAdded++;
          console.log(`    ✅ Uploaded (${photosAdded}/${photosNeeded})`);
        }
        
        console.log(`  Added ${photosAdded} photos`);
        
        // Small delay between campgrounds to be polite
        await new Promise(r => setTimeout(r, 1000));
        
      } catch (error) {
        console.error(`  ❌ Error: ${error.message}`);
        errors++;
      }
    }
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }
  
  console.log('\n============================');
  console.log('📊 Summary');
  console.log('============================');
  console.log(`Campgrounds processed: ${campgroundsProcessed}`);
  console.log(`Total photos added: ${totalPhotosAdded}`);
  console.log(`Errors: ${errors}`);
  
  if (campgroundsNeedingPhotos.length > 0) {
    const lastId = campgroundsNeedingPhotos[campgroundsNeedingPhotos.length - 1].id;
    console.log(`\nTo continue from where you left off, run:`);
    console.log(`node scrape-campground-photos.js --start-from=${lastId}`);
  }
}

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  limit: 100,
  dryRun: false,
  startFrom: null
};

for (const arg of args) {
  if (arg.startsWith('--limit=')) {
    options.limit = parseInt(arg.split('=')[1], 10);
  } else if (arg === '--dry-run') {
    options.dryRun = true;
  } else if (arg.startsWith('--start-from=')) {
    options.startFrom = arg.split('=')[1];
  }
}

// Run the scraper
scrapeCampgroundPhotos(options).catch(console.error);
