-- AlterTable
ALTER TABLE "PhotoAlbum" ADD COLUMN "coverPhotoId" TEXT;

-- CreateTable
CREATE TABLE "PhotoAlbumCollaborator" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoAlbumCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoAlbumCollaborator_albumId_idx" ON "PhotoAlbumCollaborator"("albumId");

-- CreateIndex
CREATE INDEX "PhotoAlbumCollaborator_userId_idx" ON "PhotoAlbumCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoAlbumCollaborator_albumId_userId_key" ON "PhotoAlbumCollaborator"("albumId", "userId");

-- AddForeignKey
ALTER TABLE "PhotoAlbumCollaborator" ADD CONSTRAINT "PhotoAlbumCollaborator_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAlbumCollaborator" ADD CONSTRAINT "PhotoAlbumCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
