/*
  Warnings:

  - A unique constraint covering the columns `[userId,eventId]` on the table `Like` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Like_albumId_idx";

-- DropIndex
DROP INDEX "Like_photoId_idx";

-- DropIndex
DROP INDEX "Like_postId_idx";

-- DropIndex
DROP INDEX "Like_userId_idx";

-- AlterTable
ALTER TABLE "Like" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE INDEX "Like_eventId_idx" ON "Like"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_eventId_key" ON "Like"("userId", "eventId");

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
