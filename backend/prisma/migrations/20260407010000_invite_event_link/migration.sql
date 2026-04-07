-- AlterTable
ALTER TABLE "Invite" ADD COLUMN "eventId" TEXT;
ALTER TABLE "Invite" ADD COLUMN "personalMessage" TEXT;

-- CreateIndex
CREATE INDEX "Invite_eventId_idx" ON "Invite"("eventId");

-- AddForeignKey
ALTER TABLE "Invite" ADD CONSTRAINT "Invite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
