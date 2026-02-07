const { PrismaClient } = require('@prisma/client');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

require('dotenv').config();

const prisma = new PrismaClient();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const MAPS_DIR = path.join(__dirname, 'campground-maps');
const COMPRESSED_DIR = path.join(__dirname, 'campground-maps-compressed');
const MAX_SIZE_MB = 10; // Max file size to upload
const MAX_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;

// Create compressed directory
if (!fs.existsSync(COMPRESSED_DIR)) {
  fs.mkdirSync(COMPRESSED_DIR, { recursive: true });
}

function getFileSize(filepath) {
  return fs.statSync(filepath).size;
}

function compressPdf(inputPath, outputPath) {
  try {
    // Use Ghostscript to compress PDF
    execSync(`gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=/ebook -dNOPAUSE -dQUIET -dBATCH -sOutputFile="${outputPath}" "${inputPath}"`, { timeout: 120000 });
    return true;
  } catch (err) {
    console.log(`  Ghostscript failed: ${err.message}`);
    return false;
  }
}

function compressImage(inputPath, outputPath) {
  try {
    // Use ImageMagick/sips to resize
    const ext = path.extname(inputPath).toLowerCase();
    if (process.platform === 'darwin') {
      execSync(`sips -Z 2000 "${inputPath}" --out "${outputPath}"`, { timeout: 60000 });
    } else {
      execSync(`convert "${inputPath}" -resize 2000x2000\\> -quality 85 "${outputPath}"`, { timeout: 60000 });
    }
    return true;
  } catch (err) {
    console.log(`  Image compression failed: ${err.message}`);
    return false;
  }
}

async function uploadFile(filepath, campgroundId, retries = 3) {
  const ext = path.extname(filepath).toLowerCase();
  const isPdf = ext === '.pdf';
  
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const result = await new Promise((resolve, reject) => {
        const options = {
          folder: 'rvunicorn/campground-maps',
          public_id: campgroundId,
          resource_type: isPdf ? 'raw' : 'image',
          overwrite: true,
          timeout: 120000,
        };
        
        cloudinary.uploader.upload(filepath, options, (error, result) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
      return result;
    } catch (err) {
      if (attempt < retries && (err.message.includes('ECONNRESET') || err.message.includes('ETIMEDOUT'))) {
        console.log(`  Retry ${attempt}/${retries}...`);
        await new Promise(r => setTimeout(r, 2000 * attempt));
      } else {
        throw err;
      }
    }
  }
}

async function main() {
  console.log('Starting Cloudinary upload with compression...\n');
  
  const files = fs.readdirSync(MAPS_DIR).filter(f => 
    !f.startsWith('.') && !f.endsWith('.json') &&
    (f.endsWith('.pdf') || f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png') || f.endsWith('.gif'))
  );
  
  console.log(`Found ${files.length} map files to process\n`);
  
  let success = 0;
  let failed = 0;
  let skipped = 0;
  const errors = [];
  
  for (let i = 0; i < files.length; i++) {
    const filename = files[i];
    const campgroundId = filename.replace(/\.(pdf|jpg|jpeg|png|gif)$/i, '');
    const filepath = path.join(MAPS_DIR, filename);
    const compressedPath = path.join(COMPRESSED_DIR, filename);
    const ext = path.extname(filename).toLowerCase();
    const isPdf = ext === '.pdf';
    
    let fileToUpload = filepath;
    const originalSize = getFileSize(filepath);
    
    // Compress if too large
    if (originalSize > MAX_SIZE_BYTES) {
      console.log(`[${i + 1}/${files.length}] Compressing ${filename} (${(originalSize / 1024 / 1024).toFixed(1)}MB)...`);
      
      let compressed = false;
      if (isPdf) {
        compressed = compressPdf(filepath, compressedPath);
      } else {
        compressed = compressImage(filepath, compressedPath);
      }
      
      if (compressed && fs.existsSync(compressedPath)) {
        const newSize = getFileSize(compressedPath);
        console.log(`  Compressed: ${(originalSize / 1024 / 1024).toFixed(1)}MB -> ${(newSize / 1024 / 1024).toFixed(1)}MB`);
        
        if (newSize > MAX_SIZE_BYTES) {
          console.log(`  Still too large, skipping`);
          skipped++;
          continue;
        }
        fileToUpload = compressedPath;
      } else {
        console.log(`  Compression failed, skipping`);
        skipped++;
        continue;
      }
    }
    
    try {
      const result = await uploadFile(fileToUpload, campgroundId);
      
      // Update database with new Cloudinary URL
      await prisma.campground.update({
        where: { id: campgroundId },
        data: { campgroundMapUrl: result.secure_url }
      });
      
      console.log(`[${i + 1}/${files.length}] OK: ${campgroundId}`);
      success++;
      
      // Small delay to avoid rate limits
      await new Promise(r => setTimeout(r, 100));
    } catch (err) {
      console.log(`[${i + 1}/${files.length}] FAIL: ${campgroundId} - ${err.message}`);
      errors.push({ id: campgroundId, file: filename, error: err.message });
      failed++;
    }
  }
  
  console.log(`\nDone! Success: ${success}, Failed: ${failed}, Skipped: ${skipped}`);
  
  if (errors.length > 0) {
    fs.writeFileSync(
      path.join(MAPS_DIR, 'upload-errors.json'),
      JSON.stringify(errors, null, 2)
    );
    console.log(`Error log saved to: ${path.join(MAPS_DIR, 'upload-errors.json')}`);
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(console.error);
