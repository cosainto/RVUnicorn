/*
  Warnings:

  - You are about to drop the column `phoneNumber` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `campgroundId` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `flairType` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `maxAttendees` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `organizerId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `followerId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `followingId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `maintenanceType` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `vehicleType` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `isRead` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `url` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `type` on the `Post` table. All the data in the column will be lost.
  - The `instructions` column on the `Recipe` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `visitDate` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `checkInDate` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `checkOutDate` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `photos` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `rating` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `review` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `rvLength` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `rvName` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `AssignedMeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `AssignedPackItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampgroundCheckIn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventInvite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobListing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Meal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MealRSVP` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackingList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PhotoAlbum` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PhotoComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeComment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListActivityTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListCollaboration` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListFollower` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListFollowing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,campsiteId]` on the table `CampsiteFlair` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,friendId]` on the table `Friendship` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,postId]` on the table `Like` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,albumId]` on the table `Like` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,photoId]` on the table `Like` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campsiteId` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `friendId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `category` to the `MaintenanceRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `MaintenanceRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `imageUrl` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `StateVisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `endDate` to the `Stay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startDate` to the `Stay` table without a default value. This is not possible if the table is not empty.
  - Made the column `campgroundId` on table `Stay` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "AssignedMeal" DROP CONSTRAINT "AssignedMeal_mealId_fkey";

-- DropForeignKey
ALTER TABLE "AssignedMeal" DROP CONSTRAINT "AssignedMeal_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "AssignedMeal" DROP CONSTRAINT "AssignedMeal_userId_fkey";

-- DropForeignKey
ALTER TABLE "AssignedPackItem" DROP CONSTRAINT "AssignedPackItem_packItemId_fkey";

-- DropForeignKey
ALTER TABLE "AssignedPackItem" DROP CONSTRAINT "AssignedPackItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundCheckIn" DROP CONSTRAINT "CampgroundCheckIn_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundCheckIn" DROP CONSTRAINT "CampgroundCheckIn_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteFlair" DROP CONSTRAINT "CampsiteFlair_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "EventInvite" DROP CONSTRAINT "EventInvite_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventInvite" DROP CONSTRAINT "EventInvite_userId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_followingId_fkey";

-- DropForeignKey
ALTER TABLE "JobListing" DROP CONSTRAINT "JobListing_userId_fkey";

-- DropForeignKey
ALTER TABLE "Meal" DROP CONSTRAINT "Meal_eventId_fkey";

-- DropForeignKey
ALTER TABLE "MealRSVP" DROP CONSTRAINT "MealRSVP_mealId_fkey";

-- DropForeignKey
ALTER TABLE "MealRSVP" DROP CONSTRAINT "MealRSVP_userId_fkey";

-- DropForeignKey
ALTER TABLE "PackItem" DROP CONSTRAINT "PackItem_packingListId_fkey";

-- DropForeignKey
ALTER TABLE "PackingList" DROP CONSTRAINT "PackingList_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_albumId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoAlbum" DROP CONSTRAINT "PhotoAlbum_userId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoComment" DROP CONSTRAINT "PhotoComment_photoId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoComment" DROP CONSTRAINT "PhotoComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeComment" DROP CONSTRAINT "RecipeComment_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeComment" DROP CONSTRAINT "RecipeComment_userId_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "WishListActivityTag" DROP CONSTRAINT "WishListActivityTag_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListActivityTag" DROP CONSTRAINT "WishListActivityTag_wishListId_fkey";

-- DropForeignKey
ALTER TABLE "WishListCollaboration" DROP CONSTRAINT "WishListCollaboration_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListCollaboration" DROP CONSTRAINT "WishListCollaboration_wishListId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollower" DROP CONSTRAINT "WishListFollower_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollower" DROP CONSTRAINT "WishListFollower_wishListId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollowing" DROP CONSTRAINT "WishListFollowing_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollowing" DROP CONSTRAINT "WishListFollowing_wishListId_fkey";

-- DropForeignKey
ALTER TABLE "WishListItem" DROP CONSTRAINT "WishListItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListItem" DROP CONSTRAINT "WishListItem_wishListId_fkey";

-- DropIndex
DROP INDEX "CampsiteFlair_campgroundId_idx";

-- DropIndex
DROP INDEX "CampsiteFlair_userId_campgroundId_flairType_key";

-- DropIndex
DROP INDEX "Event_organizerId_idx";

-- DropIndex
DROP INDEX "Friendship_followerId_followingId_key";

-- DropIndex
DROP INDEX "Friendship_followerId_idx";

-- DropIndex
DROP INDEX "Friendship_followingId_idx";

-- DropIndex
DROP INDEX "Like_postId_userId_key";

-- DropIndex
DROP INDEX "MaintenanceRecord_vehicleType_idx";

-- DropIndex
DROP INDEX "StateVisit_userId_state_key";

-- DropIndex
DROP INDEX "Stay_checkInDate_idx";

-- AlterTable
ALTER TABLE "Campground" DROP COLUMN "phoneNumber",
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "priceRange" TEXT,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "state" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CampsiteFlair" DROP COLUMN "campgroundId",
DROP COLUMN "flairType",
ADD COLUMN     "campsiteId" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "albumId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "isPublic",
DROP COLUMN "maxAttendees",
DROP COLUMN "organizerId",
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EventAttendee" ALTER COLUMN "status" SET DEFAULT 'going';

-- AlterTable
ALTER TABLE "Friendship" DROP COLUMN "followerId",
DROP COLUMN "followingId",
ADD COLUMN     "friendId" TEXT NOT NULL,
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending',
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GearItem" DROP COLUMN "notes",
ADD COLUMN     "available" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "weight" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "Like" ADD COLUMN     "albumId" TEXT,
ADD COLUMN     "photoId" TEXT,
ALTER COLUMN "postId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "MaintenanceRecord" DROP COLUMN "maintenanceType",
DROP COLUMN "vehicleType",
ADD COLUMN     "category" TEXT NOT NULL,
ADD COLUMN     "nextDue" TIMESTAMP(3),
ADD COLUMN     "title" TEXT NOT NULL,
ALTER COLUMN "description" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "isRead",
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "updatedAt",
DROP COLUMN "url",
ADD COLUMN     "imageUrl" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "title",
DROP COLUMN "type";

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "cuisine" TEXT,
DROP COLUMN "instructions",
ADD COLUMN     "instructions" TEXT[];

-- AlterTable
ALTER TABLE "RecipeRating" ADD COLUMN     "review" TEXT;

-- AlterTable - First add and populate startDate from visitDate
ALTER TABLE "StateVisit" ADD COLUMN "startDate" TIMESTAMP(3);
UPDATE "StateVisit" SET "startDate" = "visitDate" WHERE "startDate" IS NULL;
ALTER TABLE "StateVisit" ALTER COLUMN "startDate" SET NOT NULL;

-- AlterTable - Now drop visitDate and add other columns
ALTER TABLE "StateVisit" DROP COLUMN "visitDate",
ADD COLUMN     "campsiteId" TEXT,
ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "notes" TEXT;

-- AlterTable
ALTER TABLE "Stay" DROP COLUMN "checkInDate",
DROP COLUMN "checkOutDate",
DROP COLUMN "photos",
DROP COLUMN "rating",
DROP COLUMN "review",
DROP COLUMN "updatedAt",
ADD COLUMN     "endDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "startDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "campgroundId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "rvLength",
DROP COLUMN "rvName",
ADD COLUMN     "isAdmin" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isModerator" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "verified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "website" TEXT,
ALTER COLUMN "firstName" DROP NOT NULL,
ALTER COLUMN "lastName" DROP NOT NULL;

-- DropTable
DROP TABLE "AssignedMeal";

-- DropTable
DROP TABLE "AssignedPackItem";

-- DropTable
DROP TABLE "CampgroundCheckIn";

-- DropTable
DROP TABLE "EventInvite";

-- DropTable
DROP TABLE "JobListing";

-- DropTable
DROP TABLE "Meal";

-- DropTable
DROP TABLE "MealRSVP";

-- DropTable
DROP TABLE "PackItem";

-- DropTable
DROP TABLE "PackingList";

-- DropTable
DROP TABLE "PhotoAlbum";

-- DropTable
DROP TABLE "PhotoComment";

-- DropTable
DROP TABLE "RecipeComment";

-- DropTable
DROP TABLE "WishList";

-- DropTable
DROP TABLE "WishListActivityTag";

-- DropTable
DROP TABLE "WishListCollaboration";

-- DropTable
DROP TABLE "WishListFollower";

-- DropTable
DROP TABLE "WishListFollowing";

-- DropTable
DROP TABLE "WishListItem";

-- CreateTable
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMeal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "recipeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMealRsvp" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventMealRsvp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSubevent" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3),
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventSubevent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubeventAttendee" (
    "id" TEXT NOT NULL,
    "subeventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubeventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackList" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "packListId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventPackList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventNote" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventChecklist" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChecklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventChecklistItem" (
    "id" TEXT NOT NULL,
    "checklistId" TEXT NOT NULL,
    "userId" TEXT,
    "description" TEXT NOT NULL,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateVisitAttendee" (
    "id" TEXT NOT NULL,
    "stateVisitId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateVisitAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateVisitAlbum" (
    "id" TEXT NOT NULL,
    "stateVisitId" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateVisitAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "stateVisitId" TEXT,
    "eventId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoTag" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "x" DOUBLE PRECISION NOT NULL,
    "y" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "PhotoTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackList" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "isTemplate" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackListItem" (
    "id" TEXT NOT NULL,
    "packListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "packed" BOOLEAN NOT NULL DEFAULT false,
    "category" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PackListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearBorrow" (
    "id" TEXT NOT NULL,
    "gearItemId" TEXT NOT NULL,
    "borrowerId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GearBorrow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planning',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripParticipant" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'participant',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT,
    "itemType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" TEXT,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishlistItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT NOT NULL,
    "location" TEXT,
    "jobType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "salary" TEXT,
    "remote" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCost" DOUBLE PRECISION,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "category" TEXT,
    "rarity" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "moderatorId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Report" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Report_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");

-- CreateIndex
CREATE INDEX "Follow_followingId_idx" ON "Follow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Follow_followerId_followingId_key" ON "Follow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "EventMeal_eventId_idx" ON "EventMeal"("eventId");

-- CreateIndex
CREATE INDEX "EventMeal_date_idx" ON "EventMeal"("date");

-- CreateIndex
CREATE INDEX "EventMealRsvp_mealId_idx" ON "EventMealRsvp"("mealId");

-- CreateIndex
CREATE INDEX "EventMealRsvp_userId_idx" ON "EventMealRsvp"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventMealRsvp_mealId_userId_key" ON "EventMealRsvp"("mealId", "userId");

-- CreateIndex
CREATE INDEX "EventSubevent_eventId_idx" ON "EventSubevent"("eventId");

-- CreateIndex
CREATE INDEX "EventSubevent_userId_idx" ON "EventSubevent"("userId");

-- CreateIndex
CREATE INDEX "SubeventAttendee_subeventId_idx" ON "SubeventAttendee"("subeventId");

-- CreateIndex
CREATE INDEX "SubeventAttendee_userId_idx" ON "SubeventAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "SubeventAttendee_subeventId_userId_key" ON "SubeventAttendee"("subeventId", "userId");

-- CreateIndex
CREATE INDEX "EventPackList_eventId_idx" ON "EventPackList"("eventId");

-- CreateIndex
CREATE INDEX "EventPackList_packListId_idx" ON "EventPackList"("packListId");

-- CreateIndex
CREATE UNIQUE INDEX "EventPackList_eventId_packListId_key" ON "EventPackList"("eventId", "packListId");

-- CreateIndex
CREATE INDEX "EventNote_eventId_idx" ON "EventNote"("eventId");

-- CreateIndex
CREATE INDEX "EventNote_userId_idx" ON "EventNote"("userId");

-- CreateIndex
CREATE INDEX "EventChecklist_eventId_idx" ON "EventChecklist"("eventId");

-- CreateIndex
CREATE INDEX "EventChecklistItem_checklistId_idx" ON "EventChecklistItem"("checklistId");

-- CreateIndex
CREATE INDEX "EventChecklistItem_userId_idx" ON "EventChecklistItem"("userId");

-- CreateIndex
CREATE INDEX "StateVisitAttendee_stateVisitId_idx" ON "StateVisitAttendee"("stateVisitId");

-- CreateIndex
CREATE INDEX "StateVisitAttendee_userId_idx" ON "StateVisitAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisitAttendee_stateVisitId_userId_key" ON "StateVisitAttendee"("stateVisitId", "userId");

-- CreateIndex
CREATE INDEX "StateVisitAlbum_stateVisitId_idx" ON "StateVisitAlbum"("stateVisitId");

-- CreateIndex
CREATE INDEX "StateVisitAlbum_albumId_idx" ON "StateVisitAlbum"("albumId");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisitAlbum_stateVisitId_albumId_key" ON "StateVisitAlbum"("stateVisitId", "albumId");

-- CreateIndex
CREATE INDEX "Album_userId_idx" ON "Album"("userId");

-- CreateIndex
CREATE INDEX "Album_stateVisitId_idx" ON "Album"("stateVisitId");

-- CreateIndex
CREATE INDEX "Album_eventId_idx" ON "Album"("eventId");

-- CreateIndex
CREATE INDEX "PhotoTag_photoId_idx" ON "PhotoTag"("photoId");

-- CreateIndex
CREATE INDEX "PhotoTag_userId_idx" ON "PhotoTag"("userId");

-- CreateIndex
CREATE INDEX "PackList_userId_idx" ON "PackList"("userId");

-- CreateIndex
CREATE INDEX "PackList_category_idx" ON "PackList"("category");

-- CreateIndex
CREATE INDEX "PackListItem_packListId_idx" ON "PackListItem"("packListId");

-- CreateIndex
CREATE INDEX "PackListItem_userId_idx" ON "PackListItem"("userId");

-- CreateIndex
CREATE INDEX "GearBorrow_gearItemId_idx" ON "GearBorrow"("gearItemId");

-- CreateIndex
CREATE INDEX "GearBorrow_borrowerId_idx" ON "GearBorrow"("borrowerId");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "Trip_startDate_idx" ON "Trip"("startDate");

-- CreateIndex
CREATE INDEX "TripParticipant_tripId_idx" ON "TripParticipant"("tripId");

-- CreateIndex
CREATE INDEX "TripParticipant_userId_idx" ON "TripParticipant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TripParticipant_tripId_userId_key" ON "TripParticipant"("tripId", "userId");

-- CreateIndex
CREATE INDEX "WishlistItem_userId_idx" ON "WishlistItem"("userId");

-- CreateIndex
CREATE INDEX "WishlistItem_itemType_idx" ON "WishlistItem"("itemType");

-- CreateIndex
CREATE INDEX "Job_userId_idx" ON "Job"("userId");

-- CreateIndex
CREATE INDEX "Job_jobType_idx" ON "Job"("jobType");

-- CreateIndex
CREATE INDEX "Job_active_idx" ON "Job"("active");

-- CreateIndex
CREATE INDEX "JobApplication_jobId_idx" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "JobApplication_jobId_userId_key" ON "JobApplication"("jobId", "userId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_campgroundId_idx" ON "Booking"("campgroundId");

-- CreateIndex
CREATE INDEX "Booking_startDate_idx" ON "Booking"("startDate");

-- CreateIndex
CREATE INDEX "Sticker_userId_idx" ON "Sticker"("userId");

-- CreateIndex
CREATE INDEX "Sticker_category_idx" ON "Sticker"("category");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_idx" ON "ModerationAction"("moderatorId");

-- CreateIndex
CREATE INDEX "ModerationAction_targetType_targetId_idx" ON "ModerationAction"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_reporterId_idx" ON "Report"("reporterId");

-- CreateIndex
CREATE INDEX "Report_targetType_targetId_idx" ON "Report"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "Report_status_idx" ON "Report"("status");

-- CreateIndex
CREATE INDEX "Campground_recAreaId_idx" ON "Campground"("recAreaId");

-- CreateIndex
CREATE INDEX "Campground_facilityId_idx" ON "Campground"("facilityId");

-- CreateIndex
CREATE INDEX "CampsiteFlair_campsiteId_idx" ON "CampsiteFlair"("campsiteId");

-- CreateIndex
CREATE UNIQUE INDEX "CampsiteFlair_userId_campsiteId_key" ON "CampsiteFlair"("userId", "campsiteId");

-- CreateIndex
CREATE INDEX "Comment_albumId_idx" ON "Comment"("albumId");

-- CreateIndex
CREATE INDEX "Event_userId_idx" ON "Event"("userId");

-- CreateIndex
CREATE INDEX "Friendship_userId_idx" ON "Friendship"("userId");

-- CreateIndex
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");

-- CreateIndex
CREATE INDEX "Like_albumId_idx" ON "Like"("albumId");

-- CreateIndex
CREATE INDEX "Like_photoId_idx" ON "Like"("photoId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_postId_key" ON "Like"("userId", "postId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_albumId_key" ON "Like"("userId", "albumId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_userId_photoId_key" ON "Like"("userId", "photoId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_category_idx" ON "MaintenanceRecord"("category");

-- CreateIndex
CREATE INDEX "Recipe_cuisine_idx" ON "Recipe"("cuisine");

-- CreateIndex
CREATE INDEX "StateVisit_campsiteId_idx" ON "StateVisit"("campsiteId");

-- CreateIndex
CREATE INDEX "StateVisit_eventId_idx" ON "StateVisit"("eventId");

-- CreateIndex
CREATE INDEX "Stay_eventId_idx" ON "Stay"("eventId");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_username_idx" ON "User"("username");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Follow" ADD CONSTRAINT "Follow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteFlair" ADD CONSTRAINT "CampsiteFlair_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMeal" ADD CONSTRAINT "EventMeal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMeal" ADD CONSTRAINT "EventMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMealRsvp" ADD CONSTRAINT "EventMealRsvp_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "EventMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMealRsvp" ADD CONSTRAINT "EventMealRsvp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSubevent" ADD CONSTRAINT "EventSubevent_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSubevent" ADD CONSTRAINT "EventSubevent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubeventAttendee" ADD CONSTRAINT "SubeventAttendee_subeventId_fkey" FOREIGN KEY ("subeventId") REFERENCES "EventSubevent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubeventAttendee" ADD CONSTRAINT "SubeventAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackList" ADD CONSTRAINT "EventPackList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackList" ADD CONSTRAINT "EventPackList_packListId_fkey" FOREIGN KEY ("packListId") REFERENCES "PackList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventNote" ADD CONSTRAINT "EventNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklist" ADD CONSTRAINT "EventChecklist_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_checklistId_fkey" FOREIGN KEY ("checklistId") REFERENCES "EventChecklist"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventChecklistItem" ADD CONSTRAINT "EventChecklistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAttendee" ADD CONSTRAINT "StateVisitAttendee_stateVisitId_fkey" FOREIGN KEY ("stateVisitId") REFERENCES "StateVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAttendee" ADD CONSTRAINT "StateVisitAttendee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAlbum" ADD CONSTRAINT "StateVisitAlbum_stateVisitId_fkey" FOREIGN KEY ("stateVisitId") REFERENCES "StateVisit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAlbum" ADD CONSTRAINT "StateVisitAlbum_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackList" ADD CONSTRAINT "PackList_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackListItem" ADD CONSTRAINT "PackListItem_packListId_fkey" FOREIGN KEY ("packListId") REFERENCES "PackList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackListItem" ADD CONSTRAINT "PackListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearBorrow" ADD CONSTRAINT "GearBorrow_gearItemId_fkey" FOREIGN KEY ("gearItemId") REFERENCES "GearItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearBorrow" ADD CONSTRAINT "GearBorrow_borrowerId_fkey" FOREIGN KEY ("borrowerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripParticipant" ADD CONSTRAINT "TripParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishlistItem" ADD CONSTRAINT "WishlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Job" ADD CONSTRAINT "Job_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
