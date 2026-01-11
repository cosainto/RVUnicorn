/*
  Warnings:

  - Added the required column `createdById` to the `EventSubevent` table without a default value. This is not possible if the table is not empty.
  - Added the required column `date` to the `EventSubevent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "EventSubevent" ADD COLUMN     "activityType" TEXT NOT NULL DEFAULT 'OTHER',
ADD COLUMN     "createdById" TEXT NOT NULL,
ADD COLUMN     "date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "hostId" TEXT,
ALTER COLUMN "startTime" DROP NOT NULL,
ALTER COLUMN "startTime" SET DATA TYPE TEXT,
ALTER COLUMN "endTime" SET DATA TYPE TEXT;

-- AlterTable
ALTER TABLE "SubeventAttendee" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'INTERESTED';

-- CreateIndex
CREATE INDEX "EventSubevent_hostId_idx" ON "EventSubevent"("hostId");

-- CreateIndex
CREATE INDEX "EventSubevent_createdById_idx" ON "EventSubevent"("createdById");

-- AddForeignKey
ALTER TABLE "EventSubevent" ADD CONSTRAINT "EventSubevent_hostId_fkey" FOREIGN KEY ("hostId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSubevent" ADD CONSTRAINT "EventSubevent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
