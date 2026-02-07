const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const prisma = new PrismaClient();

const MAPS_DIR = path.join(__dirname, 'campground-maps');

// Create maps directory if it doesn't exist
if (!fs.existsSync(MAPS_DIR)) {
  fs.mkdirSync(MAPS_DIR, { recursive: true });
}

function getExtension(url) {
  const match = url.match(/\.(pdf|jpg|jpeg|png|gif)(\?|$)/i);
  return match ? match[1].toLowerCase() : 'pdf';
}

function downloadFile(url, filepath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    
    const request = protocol.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
      },
      timeout: 30000
    }, (response) => {
      // Handle redirects
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        downloadFile(response.headers.location, filepath).then(resolve).catch(reject);
        return;
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}`));
        return;
      }
      
      const fileStream = fs.createWriteStream(filepath);
      response.pipe(fileStream);
      
      fileStream.on('finish', () => {
        fileStream.close();
        resolve(true);
      });
      
      fileStream.on('error', (err) => {
        fs.unlink(filepath, () => {});
        reject(err);
      });
    });
    
    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function main() {
  console.log('Fetching campgrounds with map URLs...');
  
  const campgrounds = await prisma.campground.findMany({
    where: {
      campgroundMapUrl: { not: null },
      OR: [
        { campgroundMapUrl: { endsWith: '.pdf' } },
        { campgroundMapUrl: { endsWith: '.jpg' } },
        { campgroundMapUrl: { endsWith: '.jpeg' } },
        { campgroundMapUrl: { endsWith: '.png' } },
        { campgroundMapUrl: { endsWith: '.gif' } },
        { campgroundMapUrl: { contains: '.pdf?' } },
        { campgroundMapUrl: { contains: '.jpg?' } },
        { campgroundMapUrl: { contains: '.jpeg?' } },
        { campgroundMapUrl: { contains: '.png?' } },
      ]
    },
    select: { id: true, name: true, campgroundMapUrl: true },
  });
  
  console.log(`Found ${campgrounds.length} campgrounds with downloadable maps`);
  
  let success = 0;
  let failed = 0;
  const errors = [];
  
  for (let i = 0; i < campgrounds.length; i++) {
    const camp = campgrounds[i];
    const ext = getExtension(camp.campgroundMapUrl);
    const filename = `${camp.id}.${ext}`;
    const filepath = path.join(MAPS_DIR, filename);
    
    // Skip if already downloaded
    if (fs.existsSync(filepath)) {
      console.log(`[${i + 1}/${campgrounds.length}] SKIP (exists): ${camp.id}`);
      success++;
      continue;
    }
    
    try {
      await downloadFile(camp.campgroundMapUrl, filepath);
      console.log(`[${i + 1}/${campgrounds.length}] OK: ${camp.id} - ${camp.name.substring(0, 40)}`);
      success++;
      
      // Small delay to be nice to servers
      await new Promise(r => setTimeout(r, 200));
    } catch (err) {
      console.log(`[${i + 1}/${campgrounds.length}] FAIL: ${camp.id} - ${err.message}`);
      errors.push({ id: camp.id, name: camp.name, url: camp.campgroundMapUrl, error: err.message });
      failed++;
    }
  }
  
  console.log(`\nDone! Success: ${success}, Failed: ${failed}`);
  console.log(`Maps saved to: ${MAPS_DIR}`);
  
  // Save error log
  if (errors.length > 0) {
    fs.writeFileSync(
      path.join(MAPS_DIR, 'download-errors.json'),
      JSON.stringify(errors, null, 2)
    );
    console.log(`Error log saved to: ${path.join(MAPS_DIR, 'download-errors.json')}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
