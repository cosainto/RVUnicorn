/*
  Warnings:

  - You are about to drop the column `coordinates` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `priceRange` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `campsiteId` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `friendId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `purchasePrice` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `contactEmail` on the `JobListing` table. All the data in the column will be lost.
  - You are about to drop the column `requirements` on the `JobListing` table. All the data in the column will be lost.
  - You are about to drop the column `location` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `rvType` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `serviceType` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `MaintenanceRecord` table. All the data in the column will be lost.
  - You are about to drop the column `read` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `recipientId` on the `Message` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Photo` table. All the data in the column will be lost.
  - You are about to drop the column `privacy` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `privacy` on the `Recipe` table. All the data in the column will be lost.
  - You are about to drop the column `campsiteId` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `activityId` on the `WishListActivityTag` table. All the data in the column will be lost.
  - You are about to drop the column `campgroundName` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `isCompleted` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `isPublic` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `notes` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `sourceItemId` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `state` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the column `targetDate` on the `WishListItem` table. All the data in the column will be lost.
  - You are about to drop the `Album` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventMeal` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventPackItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListActivity` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListCollaborator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishListFollow` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[userId,campgroundId,flairType]` on the table `CampsiteFlair` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[followerId,followingId]` on the table `Friendship` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,state]` on the table `StateVisit` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[wishListId,tag]` on the table `WishListActivityTag` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `campgroundId` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Comment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EventInvite` table without a default value. This is not possible if the table is not empty.
  - Added the required column `followerId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `followingId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Made the column `company` on table `JobListing` required. This step will fail if there are existing NULL values in that column.
  - Made the column `location` on table `JobListing` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `maintenanceType` to the `MaintenanceRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `vehicleType` to the `MaintenanceRecord` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverId` to the `Message` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `url` to the `Photo` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `PhotoComment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `RecipeComment` table without a default value. This is not possible if the table is not empty.
  - Made the column `visitDate` on table `StateVisit` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `checkInDate` to the `Stay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Stay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tag` to the `WishListActivityTag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wishListId` to the `WishListActivityTag` table without a default value. This is not possible if the table is not empty.
  - Added the required column `title` to the `WishListItem` table without a default value. This is not possible if the table is not empty.
  - Added the required column `wishListId` to the `WishListItem` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Album" DROP CONSTRAINT "Album_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteEvent" DROP CONSTRAINT "CampsiteEvent_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteFlair" DROP CONSTRAINT "CampsiteFlair_campsiteId_fkey";

-- DropForeignKey
ALTER TABLE "EventInvite" DROP CONSTRAINT "EventInvite_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventMeal" DROP CONSTRAINT "EventMeal_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "EventMeal" DROP CONSTRAINT "EventMeal_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventPackItem" DROP CONSTRAINT "EventPackItem_assignedTo_fkey";

-- DropForeignKey
ALTER TABLE "EventPackItem" DROP CONSTRAINT "EventPackItem_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_friendId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_userId_fkey";

-- DropForeignKey
ALTER TABLE "MealRSVP" DROP CONSTRAINT "MealRSVP_mealId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_albumId_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "WishListActivity" DROP CONSTRAINT "WishListActivity_wishListItemId_fkey";

-- DropForeignKey
ALTER TABLE "WishListActivityTag" DROP CONSTRAINT "WishListActivityTag_activityId_fkey";

-- DropForeignKey
ALTER TABLE "WishListCollaborator" DROP CONSTRAINT "WishListCollaborator_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishListCollaborator" DROP CONSTRAINT "WishListCollaborator_wishListItemId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollow" DROP CONSTRAINT "WishListFollow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "WishListFollow" DROP CONSTRAINT "WishListFollow_followingId_fkey";

-- DropIndex
DROP INDEX "Campground_latitude_longitude_idx";

-- DropIndex
DROP INDEX "CampgroundCheckIn_checkOutDate_idx";

-- DropIndex
DROP INDEX "CampsiteFlair_campsiteId_idx";

-- DropIndex
DROP INDEX "Friendship_friendId_idx";

-- DropIndex
DROP INDEX "Friendship_userId_friendId_key";

-- DropIndex
DROP INDEX "Friendship_userId_idx";

-- DropIndex
DROP INDEX "Message_recipientId_idx";

-- DropIndex
DROP INDEX "WishListActivityTag_activityId_idx";

-- DropIndex
DROP INDEX "WishListActivityTag_activityId_userId_key";

-- DropIndex
DROP INDEX "WishListItem_isPublic_idx";

-- DropIndex
DROP INDEX "WishListItem_sourceItemId_idx";

-- DropIndex
DROP INDEX "WishListItem_state_idx";

-- AlterTable
ALTER TABLE "Campground" DROP COLUMN "coordinates",
DROP COLUMN "imageUrl",
DROP COLUMN "phone",
DROP COLUMN "priceRange",
DROP COLUMN "website",
ADD COLUMN     "facilityId" TEXT,
ADD COLUMN     "recAreaId" TEXT;

-- AlterTable
ALTER TABLE "CampgroundCheckIn" ALTER COLUMN "checkOutDate" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CampsiteFlair" DROP COLUMN "campsiteId",
DROP COLUMN "state",
ADD COLUMN     "campgroundId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Comment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "EventInvite" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Friendship" DROP COLUMN "friendId",
DROP COLUMN "status",
DROP COLUMN "userId",
ADD COLUMN     "followerId" TEXT NOT NULL,
ADD COLUMN     "followingId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "GearItem" DROP COLUMN "imageUrl",
DROP COLUMN "purchasePrice",
ADD COLUMN     "price" DOUBLE PRECISION,
ALTER COLUMN "category" DROP NOT NULL;

-- AlterTable
ALTER TABLE "JobListing" DROP COLUMN "contactEmail",
DROP COLUMN "requirements",
ALTER COLUMN "company" SET NOT NULL,
ALTER COLUMN "location" SET NOT NULL;

-- AlterTable
ALTER TABLE "MaintenanceRecord" DROP COLUMN "location",
DROP COLUMN "rvType",
DROP COLUMN "serviceType",
DROP COLUMN "title",
ADD COLUMN     "maintenanceType" TEXT NOT NULL,
ADD COLUMN     "vehicleType" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "MealRSVP" ADD COLUMN     "dietaryReq" TEXT,
ALTER COLUMN "status" SET DEFAULT 'ATTENDING';

-- AlterTable
ALTER TABLE "Message" DROP COLUMN "read",
DROP COLUMN "recipientId",
ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "receiverId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Photo" DROP COLUMN "imageUrl",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "url" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "PhotoComment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "privacy",
ADD COLUMN     "campgroundId" TEXT,
ADD COLUMN     "title" TEXT,
ADD COLUMN     "type" TEXT NOT NULL DEFAULT 'GENERAL';

-- AlterTable
ALTER TABLE "Recipe" DROP COLUMN "privacy";

-- AlterTable
ALTER TABLE "RecipeComment" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "StateVisit" DROP COLUMN "campsiteId",
DROP COLUMN "endDate",
DROP COLUMN "eventId",
DROP COLUMN "notes",
ALTER COLUMN "visitDate" SET NOT NULL;

-- AlterTable
ALTER TABLE "Stay" DROP COLUMN "endDate",
DROP COLUMN "notes",
DROP COLUMN "startDate",
ADD COLUMN     "checkInDate" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "checkOutDate" TIMESTAMP(3),
ADD COLUMN     "photos" TEXT[],
ADD COLUMN     "review" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "campgroundId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "rvLength" SET DATA TYPE DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "WishListActivityTag" DROP COLUMN "activityId",
ADD COLUMN     "tag" TEXT NOT NULL,
ADD COLUMN     "wishListId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "WishListItem" DROP COLUMN "campgroundName",
DROP COLUMN "imageUrl",
DROP COLUMN "isCompleted",
DROP COLUMN "isPublic",
DROP COLUMN "notes",
DROP COLUMN "sourceItemId",
DROP COLUMN "state",
DROP COLUMN "targetDate",
ADD COLUMN     "description" TEXT,
ADD COLUMN     "isPurchased" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "priority" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "title" TEXT NOT NULL,
ADD COLUMN     "url" TEXT,
ADD COLUMN     "wishListId" TEXT NOT NULL;

-- DropTable
DROP TABLE "Album";

-- DropTable
DROP TABLE "CampsiteEvent";

-- DropTable
DROP TABLE "EventMeal";

-- DropTable
DROP TABLE "EventPackItem";

-- DropTable
DROP TABLE "WishListActivity";

-- DropTable
DROP TABLE "WishListCollaborator";

-- DropTable
DROP TABLE "WishListFollow";

-- DropEnum
DROP TYPE "Privacy";

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "location" TEXT,
    "campgroundId" TEXT,
    "maxAttendees" INTEGER,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventAttendee" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATTENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedMeal" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "recipeId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignedMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingList" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackItem" (
    "id" TEXT NOT NULL,
    "packingListId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isPacked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignedPackItem" (
    "id" TEXT NOT NULL,
    "packItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignedPackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoAlbum" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverPhoto" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'FRIENDS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhotoAlbum_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishList" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListCollaboration" (
    "id" TEXT NOT NULL,
    "wishListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'EDITOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListCollaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListFollower" (
    "id" TEXT NOT NULL,
    "wishListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListFollower_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListFollowing" (
    "id" TEXT NOT NULL,
    "wishListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListFollowing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteCampground" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteCampground_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "Event_campgroundId_idx" ON "Event"("campgroundId");

-- CreateIndex
CREATE INDEX "Event_startDate_idx" ON "Event"("startDate");

-- CreateIndex
CREATE INDEX "EventAttendee_eventId_idx" ON "EventAttendee"("eventId");

-- CreateIndex
CREATE INDEX "EventAttendee_userId_idx" ON "EventAttendee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventAttendee_eventId_userId_key" ON "EventAttendee"("eventId", "userId");

-- CreateIndex
CREATE INDEX "Meal_eventId_idx" ON "Meal"("eventId");

-- CreateIndex
CREATE INDEX "Meal_date_idx" ON "Meal"("date");

-- CreateIndex
CREATE INDEX "AssignedMeal_mealId_idx" ON "AssignedMeal"("mealId");

-- CreateIndex
CREATE INDEX "AssignedMeal_userId_idx" ON "AssignedMeal"("userId");

-- CreateIndex
CREATE INDEX "AssignedMeal_recipeId_idx" ON "AssignedMeal"("recipeId");

-- CreateIndex
CREATE UNIQUE INDEX "PackingList_eventId_key" ON "PackingList"("eventId");

-- CreateIndex
CREATE INDEX "PackItem_packingListId_idx" ON "PackItem"("packingListId");

-- CreateIndex
CREATE INDEX "PackItem_category_idx" ON "PackItem"("category");

-- CreateIndex
CREATE INDEX "AssignedPackItem_packItemId_idx" ON "AssignedPackItem"("packItemId");

-- CreateIndex
CREATE INDEX "AssignedPackItem_userId_idx" ON "AssignedPackItem"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignedPackItem_packItemId_userId_key" ON "AssignedPackItem"("packItemId", "userId");

-- CreateIndex
CREATE INDEX "PhotoAlbum_userId_idx" ON "PhotoAlbum"("userId");

-- CreateIndex
CREATE INDEX "WishList_visibility_idx" ON "WishList"("visibility");

-- CreateIndex
CREATE INDEX "WishListCollaboration_wishListId_idx" ON "WishListCollaboration"("wishListId");

-- CreateIndex
CREATE INDEX "WishListCollaboration_userId_idx" ON "WishListCollaboration"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListCollaboration_wishListId_userId_key" ON "WishListCollaboration"("wishListId", "userId");

-- CreateIndex
CREATE INDEX "WishListFollower_wishListId_idx" ON "WishListFollower"("wishListId");

-- CreateIndex
CREATE INDEX "WishListFollower_userId_idx" ON "WishListFollower"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListFollower_wishListId_userId_key" ON "WishListFollower"("wishListId", "userId");

-- CreateIndex
CREATE INDEX "WishListFollowing_wishListId_idx" ON "WishListFollowing"("wishListId");

-- CreateIndex
CREATE INDEX "WishListFollowing_userId_idx" ON "WishListFollowing"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListFollowing_wishListId_userId_key" ON "WishListFollowing"("wishListId", "userId");

-- CreateIndex
CREATE INDEX "FavoriteCampground_userId_idx" ON "FavoriteCampground"("userId");

-- CreateIndex
CREATE INDEX "FavoriteCampground_campgroundId_idx" ON "FavoriteCampground"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCampground_userId_campgroundId_key" ON "FavoriteCampground"("userId", "campgroundId");

-- CreateIndex
CREATE INDEX "Campground_slug_idx" ON "Campground"("slug");

-- CreateIndex
CREATE INDEX "CampsiteFlair_campgroundId_idx" ON "CampsiteFlair"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampsiteFlair_userId_campgroundId_flairType_key" ON "CampsiteFlair"("userId", "campgroundId", "flairType");

-- CreateIndex
CREATE INDEX "Friendship_followerId_idx" ON "Friendship"("followerId");

-- CreateIndex
CREATE INDEX "Friendship_followingId_idx" ON "Friendship"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_followerId_followingId_key" ON "Friendship"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "JobListing_jobType_idx" ON "JobListing"("jobType");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_vehicleType_idx" ON "MaintenanceRecord"("vehicleType");

-- CreateIndex
CREATE INDEX "Message_receiverId_idx" ON "Message"("receiverId");

-- CreateIndex
CREATE INDEX "Post_campgroundId_idx" ON "Post"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisit_userId_state_key" ON "StateVisit"("userId", "state");

-- CreateIndex
CREATE INDEX "Stay_checkInDate_idx" ON "Stay"("checkInDate");

-- CreateIndex
CREATE INDEX "WishListActivityTag_wishListId_idx" ON "WishListActivityTag"("wishListId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListActivityTag_wishListId_tag_key" ON "WishListActivityTag"("wishListId", "tag");

-- CreateIndex
CREATE INDEX "WishListItem_wishListId_idx" ON "WishListItem"("wishListId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventAttendee" ADD CONSTRAINT "EventAttendee_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meal" ADD CONSTRAINT "Meal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRSVP" ADD CONSTRAINT "MealRSVP_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedMeal" ADD CONSTRAINT "AssignedMeal_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "Meal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedMeal" ADD CONSTRAINT "AssignedMeal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedMeal" ADD CONSTRAINT "AssignedMeal_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingList" ADD CONSTRAINT "PackingList_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackItem" ADD CONSTRAINT "PackItem_packingListId_fkey" FOREIGN KEY ("packingListId") REFERENCES "PackingList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedPackItem" ADD CONSTRAINT "AssignedPackItem_packItemId_fkey" FOREIGN KEY ("packItemId") REFERENCES "PackItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignedPackItem" ADD CONSTRAINT "AssignedPackItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteFlair" ADD CONSTRAINT "CampsiteFlair_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoAlbum" ADD CONSTRAINT "PhotoAlbum_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "PhotoAlbum"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListItem" ADD CONSTRAINT "WishListItem_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListActivityTag" ADD CONSTRAINT "WishListActivityTag_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListCollaboration" ADD CONSTRAINT "WishListCollaboration_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListCollaboration" ADD CONSTRAINT "WishListCollaboration_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollower" ADD CONSTRAINT "WishListFollower_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollower" ADD CONSTRAINT "WishListFollower_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollowing" ADD CONSTRAINT "WishListFollowing_wishListId_fkey" FOREIGN KEY ("wishListId") REFERENCES "WishList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollowing" ADD CONSTRAINT "WishListFollowing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCampground" ADD CONSTRAINT "FavoriteCampground_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCampground" ADD CONSTRAINT "FavoriteCampground_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
