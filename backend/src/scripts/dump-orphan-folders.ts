import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew',
});

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  console.log('Listing remaining subfolders...');
  const folders: string[] = [];
  let nextCursor: string | undefined;

  try {
    do {
      const result: any = await cloudinary.api.sub_folders('campgrounds', {
        max_results: 500,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });
      for (const f of result.folders) folders.push(f.name);
      nextCursor = result.next_cursor;
      await delay(500);
    } while (nextCursor);
  } catch (e: any) {
    console.log('Error:', e.error || e.message || e);
  }

  console.log('Found ' + folders.length + ' remaining subfolders');
  if (folders.length === 0) return;

  const report: { folder: string; photos: string[] }[] = [];

  for (let i = 0; i < folders.length; i++) {
    try {
      const res: any = await cloudinary.api.resources({
        type: 'upload',
        prefix: 'campgrounds/' + folders[i] + '/',
        max_results: 20,
      });
      report.push({ folder: folders[i], photos: res.resources.map((r: any) => r.secure_url) });
      if ((i + 1) % 100 === 0) console.log('  Scanned ' + (i + 1) + '/' + folders.length);
      await delay(500);
    } catch (e: any) {
      report.push({ folder: folders[i], photos: [] });
      console.log('  Rate limited at ' + (i + 1) + ', waiting 30s...');
      await delay(30000);
    }
  }

  fs.writeFileSync('orphan-cloudinary-folders.json', JSON.stringify(report, null, 2));
  console.log('Saved ' + report.length + ' folders to orphan-cloudinary-folders.json');
  console.log('Total photos: ' + report.reduce((s, r) => s + r.photos.length, 0));
}

run().catch(e => console.error('Fatal:', e));
