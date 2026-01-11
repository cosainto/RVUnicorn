-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "privacy" TEXT NOT NULL DEFAULT 'PUBLIC';

-- CreateIndex
CREATE INDEX "Recipe_privacy_idx" ON "Recipe"("privacy");
