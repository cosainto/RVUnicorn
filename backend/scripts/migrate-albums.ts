import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();

async function migrateAlbums() {
  console.log('Starting album migration...');

  const oldAlbums = await prisma.photoAlbum.findMany({
    include: { photos: true },
  });

  console.log(`Found ${oldAlbums.length} old albums to migrate`);

  for (const oldAlbum of oldAlbums) {
    const existing = await prisma.album.findFirst({
      where: { userId: oldAlbum.userId, title: oldAlbum.title },
    });

    if (existing) {
      console.log(`Skipping "${oldAlbum.title}" - already migrated`);
      continue;
    }

    const newAlbum = await prisma.album.create({
      data: {
        id: createId(),
        userId: oldAlbum.userId,
        title: oldAlbum.title,
        description: oldAlbum.description,
        defaultVisibility: 'FRIENDS_ONLY',
        discoveryEnabled: false,
        updatedAt: new Date(),
      },
    });

    console.log(`Created album: ${newAlbum.title}`);

    let coverMediaId: string | null = null;
    for (const photo of oldAlbum.photos) {
      const newMedia = await prisma.media.create({
        data: {
          id: createId(),
          albumId: newAlbum.id,
          uploaderId: oldAlbum.userId,
          type: 'PHOTO',
          cloudinaryId: `legacy/${photo.id}`,
          url: photo.imageUrl,
          width: 0,
          height: 0,
          visibility: 'FRIENDS_ONLY',
          caption: photo.caption,
          createdAt: photo.createdAt,
          updatedAt: new Date(),
        },
      });

      if (!coverMediaId) coverMediaId = newMedia.id;
      console.log(`  Migrated photo: ${photo.id}`);
    }

    if (coverMediaId) {
      await prisma.album.update({
        where: { id: newAlbum.id },
        data: { coverMediaId },
      });
    }

    console.log(`Completed: ${oldAlbum.title} (${oldAlbum.photos.length} photos)`);
  }

  console.log('Migration complete!');
}

migrateAlbums()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
