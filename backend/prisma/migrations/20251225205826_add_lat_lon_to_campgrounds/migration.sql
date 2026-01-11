/*
  Warnings:

  - You are about to drop the column `bathroomSchedule` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `fullDescription` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `hours` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `mapImageUrl` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `nightlyRate` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `restaurantMenu` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `socialLinks` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `color` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `icon` on the `CampsiteFlair` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `CampsiteFlair` table. All the data in the column will be lost.
  - The `status` column on the `Friendship` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `campgroundId` on the `Post` table. All the data in the column will be lost.
  - The `difficulty` column on the `Recipe` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `category` column on the `Recipe` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the column `name` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Booking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `BorrowRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampgroundCheckIn` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampgroundModerator` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampgroundReview` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteAdmin` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteAnnouncement` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteFollow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteGalleryPhoto` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteRating` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteRental` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteSite` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteStoreItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommunityReply` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CommunityThread` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FavoriteCampground` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GearListing` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GearMessage` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobApplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobPosting` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModerationAction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RVMaintenanceLog` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RVProfile` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RecipeLike` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RentalRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sticker` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StickerAward` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StickerRequest` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Trip` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TripStop` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `UserResume` table. If the table is not empty, all the data it contains will be lost.
  - Made the column `state` on table `Campground` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `flairType` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `state` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `CampsiteFlair` table without a default value. This is not possible if the table is not empty.
  - Made the column `firstName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateEnum
CREATE TYPE "Privacy" AS ENUM ('PUBLIC', 'FRIENDS', 'PRIVATE');

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_siteId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "BorrowRequest" DROP CONSTRAINT "BorrowRequest_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "BorrowRequest" DROP CONSTRAINT "BorrowRequest_lenderId_fkey";

-- DropForeignKey
ALTER TABLE "BorrowRequest" DROP CONSTRAINT "BorrowRequest_requesterId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundCheckIn" DROP CONSTRAINT "CampgroundCheckIn_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundCheckIn" DROP CONSTRAINT "CampgroundCheckIn_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundModerator" DROP CONSTRAINT "CampgroundModerator_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundModerator" DROP CONSTRAINT "CampgroundModerator_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundReview" DROP CONSTRAINT "CampgroundReview_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampgroundReview" DROP CONSTRAINT "CampgroundReview_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteAdmin" DROP CONSTRAINT "CampsiteAdmin_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteAnnouncement" DROP CONSTRAINT "CampsiteAnnouncement_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteEvent" DROP CONSTRAINT "CampsiteEvent_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteFollow" DROP CONSTRAINT "CampsiteFollow_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteGalleryPhoto" DROP CONSTRAINT "CampsiteGalleryPhoto_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteRating" DROP CONSTRAINT "CampsiteRating_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteRental" DROP CONSTRAINT "CampsiteRental_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteSite" DROP CONSTRAINT "CampsiteSite_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteStoreItem" DROP CONSTRAINT "CampsiteStoreItem_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityReply" DROP CONSTRAINT "CommunityReply_authorId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityReply" DROP CONSTRAINT "CommunityReply_threadId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityThread" DROP CONSTRAINT "CommunityThread_authorId_fkey";

-- DropForeignKey
ALTER TABLE "CommunityThread" DROP CONSTRAINT "CommunityThread_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteCampground" DROP CONSTRAINT "FavoriteCampground_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteCampground" DROP CONSTRAINT "FavoriteCampground_userId_fkey";

-- DropForeignKey
ALTER TABLE "GearListing" DROP CONSTRAINT "GearListing_userId_fkey";

-- DropForeignKey
ALTER TABLE "GearMessage" DROP CONSTRAINT "GearMessage_listingId_fkey";

-- DropForeignKey
ALTER TABLE "GearMessage" DROP CONSTRAINT "GearMessage_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_jobId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobPosting" DROP CONSTRAINT "JobPosting_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationAction" DROP CONSTRAINT "ModerationAction_moderatorId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "RVMaintenanceLog" DROP CONSTRAINT "RVMaintenanceLog_rvProfileId_fkey";

-- DropForeignKey
ALTER TABLE "RVMaintenanceLog" DROP CONSTRAINT "RVMaintenanceLog_userId_fkey";

-- DropForeignKey
ALTER TABLE "RVProfile" DROP CONSTRAINT "RVProfile_userId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLike" DROP CONSTRAINT "RecipeLike_recipeId_fkey";

-- DropForeignKey
ALTER TABLE "RecipeLike" DROP CONSTRAINT "RecipeLike_userId_fkey";

-- DropForeignKey
ALTER TABLE "RentalRequest" DROP CONSTRAINT "RentalRequest_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "RentalRequest" DROP CONSTRAINT "RentalRequest_rentalId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisit" DROP CONSTRAINT "StateVisit_campsiteId_fkey";

-- DropForeignKey
ALTER TABLE "Sticker" DROP CONSTRAINT "Sticker_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "Sticker" DROP CONSTRAINT "Sticker_createdBy_fkey";

-- DropForeignKey
ALTER TABLE "StickerAward" DROP CONSTRAINT "StickerAward_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "StickerAward" DROP CONSTRAINT "StickerAward_stickerId_fkey";

-- DropForeignKey
ALTER TABLE "StickerAward" DROP CONSTRAINT "StickerAward_userId_fkey";

-- DropForeignKey
ALTER TABLE "StickerRequest" DROP CONSTRAINT "StickerRequest_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "StickerRequest" DROP CONSTRAINT "StickerRequest_stickerId_fkey";

-- DropForeignKey
ALTER TABLE "StickerRequest" DROP CONSTRAINT "StickerRequest_userId_fkey";

-- DropForeignKey
ALTER TABLE "Trip" DROP CONSTRAINT "Trip_userId_fkey";

-- DropForeignKey
ALTER TABLE "TripStop" DROP CONSTRAINT "TripStop_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "TripStop" DROP CONSTRAINT "TripStop_tripId_fkey";

-- DropForeignKey
ALTER TABLE "UserResume" DROP CONSTRAINT "UserResume_userId_fkey";

-- DropIndex
DROP INDEX "Campground_slug_idx";

-- DropIndex
DROP INDEX "Post_campgroundId_idx";

-- DropIndex
DROP INDEX "StateVisit_userId_state_key";

-- AlterTable
ALTER TABLE "Campground" DROP COLUMN "bathroomSchedule",
DROP COLUMN "fullDescription",
DROP COLUMN "hours",
DROP COLUMN "mapImageUrl",
DROP COLUMN "nightlyRate",
DROP COLUMN "restaurantMenu",
DROP COLUMN "socialLinks",
ADD COLUMN     "coordinates" TEXT,
ADD COLUMN     "phoneNumber" TEXT,
ADD COLUMN     "priceRange" TEXT,
ALTER COLUMN "description" DROP NOT NULL,
ALTER COLUMN "state" SET NOT NULL;

-- AlterTable
ALTER TABLE "CampsiteEvent" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "campgroundId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CampsiteFlair" DROP COLUMN "color",
DROP COLUMN "createdAt",
DROP COLUMN "icon",
DROP COLUMN "name",
ADD COLUMN     "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "flairType" TEXT NOT NULL,
ADD COLUMN     "state" TEXT NOT NULL,
ADD COLUMN     "userId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Friendship" DROP COLUMN "status",
ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'pending';

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "campgroundId",
ADD COLUMN     "privacy" "Privacy" NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Recipe" ADD COLUMN     "privacy" "Privacy" NOT NULL DEFAULT 'PUBLIC',
DROP COLUMN "difficulty",
ADD COLUMN     "difficulty" TEXT,
DROP COLUMN "category",
ADD COLUMN     "category" TEXT;

-- AlterTable
ALTER TABLE "StateVisit" ADD COLUMN     "endDate" TIMESTAMP(3),
ADD COLUMN     "eventId" TEXT;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "name",
ADD COLUMN     "rvLength" INTEGER,
ADD COLUMN     "rvMake" TEXT,
ADD COLUMN     "rvModel" TEXT,
ADD COLUMN     "rvName" TEXT,
ADD COLUMN     "rvType" TEXT,
ADD COLUMN     "rvYear" INTEGER,
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- DropTable
DROP TABLE "Booking";

-- DropTable
DROP TABLE "BorrowRequest";

-- DropTable
DROP TABLE "CampgroundCheckIn";

-- DropTable
DROP TABLE "CampgroundModerator";

-- DropTable
DROP TABLE "CampgroundReview";

-- DropTable
DROP TABLE "CampsiteAdmin";

-- DropTable
DROP TABLE "CampsiteAnnouncement";

-- DropTable
DROP TABLE "CampsiteFollow";

-- DropTable
DROP TABLE "CampsiteGalleryPhoto";

-- DropTable
DROP TABLE "CampsiteRating";

-- DropTable
DROP TABLE "CampsiteRental";

-- DropTable
DROP TABLE "CampsiteSite";

-- DropTable
DROP TABLE "CampsiteStoreItem";

-- DropTable
DROP TABLE "CommunityReply";

-- DropTable
DROP TABLE "CommunityThread";

-- DropTable
DROP TABLE "FavoriteCampground";

-- DropTable
DROP TABLE "GearListing";

-- DropTable
DROP TABLE "GearMessage";

-- DropTable
DROP TABLE "JobApplication";

-- DropTable
DROP TABLE "JobPosting";

-- DropTable
DROP TABLE "ModerationAction";

-- DropTable
DROP TABLE "RVMaintenanceLog";

-- DropTable
DROP TABLE "RVProfile";

-- DropTable
DROP TABLE "RecipeLike";

-- DropTable
DROP TABLE "RentalRequest";

-- DropTable
DROP TABLE "Sticker";

-- DropTable
DROP TABLE "StickerAward";

-- DropTable
DROP TABLE "StickerRequest";

-- DropTable
DROP TABLE "Trip";

-- DropTable
DROP TABLE "TripStop";

-- DropTable
DROP TABLE "UserResume";

-- DropEnum
DROP TYPE "AdminRole";

-- DropEnum
DROP TYPE "AnnouncementPriority";

-- DropEnum
DROP TYPE "ApplicationStatus";

-- DropEnum
DROP TYPE "BookingStatus";

-- DropEnum
DROP TYPE "BorrowStatus";

-- DropEnum
DROP TYPE "Difficulty";

-- DropEnum
DROP TYPE "FriendshipStatus";

-- DropEnum
DROP TYPE "GearCategory";

-- DropEnum
DROP TYPE "GearCondition";

-- DropEnum
DROP TYPE "JobCategory";

-- DropEnum
DROP TYPE "JobType";

-- DropEnum
DROP TYPE "ListingStatus";

-- DropEnum
DROP TYPE "MaintenanceCategory";

-- DropEnum
DROP TYPE "ModerationType";

-- DropEnum
DROP TYPE "PayType";

-- DropEnum
DROP TYPE "RVType";

-- DropEnum
DROP TYPE "RecipeCategory";

-- DropEnum
DROP TYPE "RentalCategory";

-- DropEnum
DROP TYPE "RentalStatus";

-- DropEnum
DROP TYPE "SiteType";

-- DropEnum
DROP TYPE "StickerCategory";

-- DropEnum
DROP TYPE "StickerRequestStatus";

-- DropEnum
DROP TYPE "StoreCategory";

-- CreateTable
CREATE TABLE "Stay" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Stay_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventInvite" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EventInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeRating" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Album" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "coverPhotoId" TEXT,
    "privacy" "Privacy" NOT NULL DEFAULT 'PUBLIC',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Album_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Photo" (
    "id" TEXT NOT NULL,
    "albumId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoComment" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "recipientId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventMeal" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "mealType" TEXT NOT NULL,
    "menuItems" TEXT[],
    "ingredients" TEXT[],
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventMeal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MealRSVP" (
    "id" TEXT NOT NULL,
    "mealId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MealRSVP_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventPackItem" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "assignedTo" TEXT,
    "isChecked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventPackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "campgroundName" TEXT NOT NULL,
    "imageUrl" TEXT,
    "targetDate" TIMESTAMP(3),
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "sourceItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WishListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListActivity" (
    "id" TEXT NOT NULL,
    "wishListItemId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "notes" TEXT,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sourceActivityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListActivityTag" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListActivityTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListCollaborator" (
    "id" TEXT NOT NULL,
    "wishListItemId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "canEdit" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WishListFollow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "followingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WishListFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobListing" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "company" TEXT,
    "location" TEXT,
    "jobType" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "salary" TEXT,
    "contactEmail" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "rvType" TEXT,
    "description" TEXT NOT NULL,
    "cost" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "serviceType" TEXT,
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "purchasePrice" DOUBLE PRECISION,
    "condition" TEXT,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Stay_userId_idx" ON "Stay"("userId");

-- CreateIndex
CREATE INDEX "Stay_campgroundId_idx" ON "Stay"("campgroundId");

-- CreateIndex
CREATE INDEX "EventInvite_eventId_idx" ON "EventInvite"("eventId");

-- CreateIndex
CREATE INDEX "EventInvite_userId_idx" ON "EventInvite"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventInvite_eventId_userId_key" ON "EventInvite"("eventId", "userId");

-- CreateIndex
CREATE INDEX "RecipeRating_recipeId_idx" ON "RecipeRating"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeRating_userId_idx" ON "RecipeRating"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeRating_recipeId_userId_key" ON "RecipeRating"("recipeId", "userId");

-- CreateIndex
CREATE INDEX "Album_userId_idx" ON "Album"("userId");

-- CreateIndex
CREATE INDEX "Photo_albumId_idx" ON "Photo"("albumId");

-- CreateIndex
CREATE INDEX "Photo_userId_idx" ON "Photo"("userId");

-- CreateIndex
CREATE INDEX "PhotoComment_photoId_idx" ON "PhotoComment"("photoId");

-- CreateIndex
CREATE INDEX "PhotoComment_userId_idx" ON "PhotoComment"("userId");

-- CreateIndex
CREATE INDEX "Message_senderId_idx" ON "Message"("senderId");

-- CreateIndex
CREATE INDEX "Message_recipientId_idx" ON "Message"("recipientId");

-- CreateIndex
CREATE INDEX "Message_createdAt_idx" ON "Message"("createdAt");

-- CreateIndex
CREATE INDEX "EventMeal_eventId_idx" ON "EventMeal"("eventId");

-- CreateIndex
CREATE INDEX "EventMeal_date_idx" ON "EventMeal"("date");

-- CreateIndex
CREATE INDEX "MealRSVP_mealId_idx" ON "MealRSVP"("mealId");

-- CreateIndex
CREATE INDEX "MealRSVP_userId_idx" ON "MealRSVP"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MealRSVP_mealId_userId_key" ON "MealRSVP"("mealId", "userId");

-- CreateIndex
CREATE INDEX "EventPackItem_eventId_idx" ON "EventPackItem"("eventId");

-- CreateIndex
CREATE INDEX "EventPackItem_category_idx" ON "EventPackItem"("category");

-- CreateIndex
CREATE INDEX "WishListItem_userId_idx" ON "WishListItem"("userId");

-- CreateIndex
CREATE INDEX "WishListItem_state_idx" ON "WishListItem"("state");

-- CreateIndex
CREATE INDEX "WishListItem_isPublic_idx" ON "WishListItem"("isPublic");

-- CreateIndex
CREATE INDEX "WishListItem_sourceItemId_idx" ON "WishListItem"("sourceItemId");

-- CreateIndex
CREATE INDEX "WishListActivity_wishListItemId_idx" ON "WishListActivity"("wishListItemId");

-- CreateIndex
CREATE INDEX "WishListActivity_sourceActivityId_idx" ON "WishListActivity"("sourceActivityId");

-- CreateIndex
CREATE INDEX "WishListActivityTag_activityId_idx" ON "WishListActivityTag"("activityId");

-- CreateIndex
CREATE INDEX "WishListActivityTag_userId_idx" ON "WishListActivityTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListActivityTag_activityId_userId_key" ON "WishListActivityTag"("activityId", "userId");

-- CreateIndex
CREATE INDEX "WishListCollaborator_wishListItemId_idx" ON "WishListCollaborator"("wishListItemId");

-- CreateIndex
CREATE INDEX "WishListCollaborator_userId_idx" ON "WishListCollaborator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListCollaborator_wishListItemId_userId_key" ON "WishListCollaborator"("wishListItemId", "userId");

-- CreateIndex
CREATE INDEX "WishListFollow_followerId_idx" ON "WishListFollow"("followerId");

-- CreateIndex
CREATE INDEX "WishListFollow_followingId_idx" ON "WishListFollow"("followingId");

-- CreateIndex
CREATE UNIQUE INDEX "WishListFollow_followerId_followingId_key" ON "WishListFollow"("followerId", "followingId");

-- CreateIndex
CREATE INDEX "JobListing_userId_idx" ON "JobListing"("userId");

-- CreateIndex
CREATE INDEX "JobListing_isActive_idx" ON "JobListing"("isActive");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_userId_idx" ON "MaintenanceRecord"("userId");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_date_idx" ON "MaintenanceRecord"("date");

-- CreateIndex
CREATE INDEX "GearItem_userId_idx" ON "GearItem"("userId");

-- CreateIndex
CREATE INDEX "GearItem_category_idx" ON "GearItem"("category");

-- CreateIndex
CREATE INDEX "Campground_latitude_longitude_idx" ON "Campground"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "CampsiteEvent_startDate_idx" ON "CampsiteEvent"("startDate");

-- CreateIndex
CREATE INDEX "CampsiteFlair_userId_idx" ON "CampsiteFlair"("userId");

-- CreateIndex
CREATE INDEX "Post_createdAt_idx" ON "Post"("createdAt");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteFlair" ADD CONSTRAINT "CampsiteFlair_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteEvent" ADD CONSTRAINT "CampsiteEvent_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CampsiteEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventInvite" ADD CONSTRAINT "EventInvite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeRating" ADD CONSTRAINT "RecipeRating_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Album" ADD CONSTRAINT "Album_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_albumId_fkey" FOREIGN KEY ("albumId") REFERENCES "Album"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Photo" ADD CONSTRAINT "Photo_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoComment" ADD CONSTRAINT "PhotoComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMeal" ADD CONSTRAINT "EventMeal_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CampsiteEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventMeal" ADD CONSTRAINT "EventMeal_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRSVP" ADD CONSTRAINT "MealRSVP_mealId_fkey" FOREIGN KEY ("mealId") REFERENCES "EventMeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MealRSVP" ADD CONSTRAINT "MealRSVP_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackItem" ADD CONSTRAINT "EventPackItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CampsiteEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventPackItem" ADD CONSTRAINT "EventPackItem_assignedTo_fkey" FOREIGN KEY ("assignedTo") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListItem" ADD CONSTRAINT "WishListItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListActivity" ADD CONSTRAINT "WishListActivity_wishListItemId_fkey" FOREIGN KEY ("wishListItemId") REFERENCES "WishListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListActivityTag" ADD CONSTRAINT "WishListActivityTag_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "WishListActivity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListActivityTag" ADD CONSTRAINT "WishListActivityTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListCollaborator" ADD CONSTRAINT "WishListCollaborator_wishListItemId_fkey" FOREIGN KEY ("wishListItemId") REFERENCES "WishListItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListCollaborator" ADD CONSTRAINT "WishListCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollow" ADD CONSTRAINT "WishListFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WishListFollow" ADD CONSTRAINT "WishListFollow_followingId_fkey" FOREIGN KEY ("followingId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobListing" ADD CONSTRAINT "JobListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearItem" ADD CONSTRAINT "GearItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
