import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: 'dy6eetmh7',
  api_key: '333927774328418',
  api_secret: '9phbOjjX2YxVI43orwmWdoiCvew'
});

async function run() {
  const usage = await cloudinary.api.usage();
  console.log('Storage used:', (usage.storage.usage / 1024 / 1024).toFixed(0), 'MB');

  try {
    const folders = await cloudinary.api.sub_folders('campgrounds');
    console.log('Subfolders in campgrounds/:', folders.folders.length);
    console.log('First 5:', folders.folders.slice(0, 5).map((f: any) => f.name));
  } catch (e: any) {
    console.log('No subfolders');
  }

  const res = await cloudinary.api.resources({ type: 'upload', prefix: 'campgrounds/', max_results: 10 });
  console.log('Total sample:', res.resources.length);
  res.resources.forEach((r: any) => console.log(' ', r.public_id));
}
run();
