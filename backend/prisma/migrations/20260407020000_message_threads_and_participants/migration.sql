-- AlterTable
ALTER TABLE "Message" ADD COLUMN "threadId" TEXT;
ALTER TABLE "Message" ADD COLUMN "inReplyToId" TEXT;
ALTER TABLE "Message" ADD COLUMN "participantIds" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "Message_threadId_idx" ON "Message"("threadId");
