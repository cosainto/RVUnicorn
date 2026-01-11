const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
  try {
    // Find all photos
    const photos = await prisma.photo.findMany();
    console.log(`Found ${photos.length} photos`);

    // Find all albums
    const albums = await prisma.album.findMany();
    const albumIds = new Set(albums.map(a => a.id));
    console.log(`Found ${albums.length} albums`);

    // Find orphaned photos
    const orphanedPhotos = photos.filter(photo => !albumIds.has(photo.albumId));
    console.log(`Found ${orphanedPhotos.length} orphaned photos`);

    // Delete orphaned photos
    if (orphanedPhotos.length > 0) {
      for (const photo of orphanedPhotos) {
        console.log(`Deleting orphaned photo: ${photo.id} (albumId: ${photo.albumId})`);
        await prisma.photo.delete({ where: { id: photo.id } });
      }
      console.log('✅ Cleanup complete!');
    } else {
      console.log('✅ No orphaned photos found!');
    }
  } catch (error) {
    console.error('Cleanup error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
