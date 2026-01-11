/*
  Warnings:

  - You are about to drop the column `visitDate` on the `StateVisit` table. All the data in the column will be lost.
  - Added the required column `startDate` to the `StateVisit` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "StateVisit_visitDate_idx";

-- AlterTable
ALTER TABLE "StateVisit" DROP COLUMN "visitDate",
ADD COLUMN     "campsiteId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PhotoAlbum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "albumId" TEXT,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateVisitAlbum" (
    "id" TEXT NOT NULL,
    "stateVisitId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateVisitAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PhotoAlbum_userId_idx" ON "PhotoAlbum"("userId");

-- CreateIndex
CREATE INDEX "Photo_userId_idx" ON "Photo"("userId");

-- CreateIndex
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE INDEX "StateVisitAlbum_stateVisitId_idx" ON "StateVisitAlbum"("stateVisitId");

-- CreateIndex
CREATE INDEX "StateVisitAlbum_albumId_idx" ON "StateVisitAlbum"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisitAlbum_stateVisitId_albumId_key" ON "StateVisitAlbum"("stateVisitId", "albumId");

-- CreateIndex
CREATE INDEX "StateVisit_startDate_idx" ON "StateVisit"("startDate");

-- CreateIndex
CREATE INDEX "StateVisit_campsiteId_idx" ON "StateVisit"("campsiteId");

-- CreateIndex
CREATE INDEX "StateVisit_eventId_idx" ON "StateVisit"("eventId");

-- AddForeignKey
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAlbum" ADD CONSTRAINT "StateVisitAlbum_stateVisitId_fkey" FOREIGN KEY ("stateVisitId") REFERENCES "StateVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAlbum" ADD CONSTRAINT "StateVisitAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;
