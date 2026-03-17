import { v2 as cloudinary } from 'cloudinary';
import * as dotenv from 'dotenv';
dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const badges = [
  { file: '/Users/roberts/Desktop/Pictures_RV_Unicorn/Trivia_master.png', publicId: 'badges/campfire-champion' },
  { file: '/Users/roberts/Desktop/Pictures_RV_Unicorn/ON_FIRE.PNG',       publicId: 'badges/hot-streak' },
  { file: '/Users/roberts/Desktop/Pictures_RV_Unicorn/PERFECT_SCORE.PNG', publicId: 'badges/perfect-round' },
  { file: '/Users/roberts/Desktop/Pictures_RV_Unicorn/trivia_rookie.png', publicId: 'badges/trivia-rookie' },
];

(async () => {
  for (const b of badges) {
    const result = await cloudinary.uploader.upload(b.file, { public_id: b.publicId, overwrite: true });
    console.log(`✅ ${b.publicId}: ${result.secure_url}`);
  }
})();
