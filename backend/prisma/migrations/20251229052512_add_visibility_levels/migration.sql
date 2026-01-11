/*
  Warnings:

  - You are about to drop the column `isPublic` on the `StateVisit` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "StateVisit" DROP COLUMN "isPublic",
ADD COLUMN     "visibility" BOOLEAN NOT NULL DEFAULT true;
