-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "wallOwnerId" TEXT;

-- CreateIndex
CREATE INDEX "Post_wallOwnerId_idx" ON "Post"("wallOwnerId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_wallOwnerId_fkey" FOREIGN KEY ("wallOwnerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
