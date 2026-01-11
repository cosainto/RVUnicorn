/*
  Warnings:

  - The `role` column on the `CampgroundAdmin` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[customSlug]` on the table `Campground` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[hashtag]` on the table `Campground` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "CampgroundTier" AS ENUM ('FREE', 'CLASS_C', 'CLASS_B', 'CLASS_A');

-- CreateEnum
CREATE TYPE "ClaimStatus" AS ENUM ('UNCLAIMED', 'PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'ADMIN', 'MODERATOR');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'IMPORTANT', 'URGENT');

-- AlterTable
ALTER TABLE "Campground" ADD COLUMN     "accentColor" TEXT,
ADD COLUMN     "bookingUrl" TEXT,
ADD COLUMN     "businessEmail" TEXT,
ADD COLUMN     "businessPhone" TEXT,
ADD COLUMN     "claimedAt" TIMESTAMP(3),
ADD COLUMN     "claimedById" TEXT,
ADD COLUMN     "customSlug" TEXT,
ADD COLUMN     "facebookUrl" TEXT,
ADD COLUMN     "hashtag" TEXT,
ADD COLUMN     "headerLayout" TEXT,
ADD COLUMN     "imageUrl" TEXT,
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "theme" TEXT,
ADD COLUMN     "tier" "CampgroundTier" NOT NULL DEFAULT 'FREE',
ADD COLUMN     "tierEndDate" TIMESTAMP(3),
ADD COLUMN     "tierStartDate" TIMESTAMP(3),
ADD COLUMN     "tiktokUrl" TEXT,
ADD COLUMN     "twitterUrl" TEXT,
ADD COLUMN     "verificationDocs" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "verificationStatus" "ClaimStatus" NOT NULL DEFAULT 'UNCLAIMED',
ADD COLUMN     "websiteUrl" TEXT,
ADD COLUMN     "youtubeUrl" TEXT;

-- AlterTable
ALTER TABLE "CampgroundAdmin" ADD COLUMN     "addedById" TEXT,
DROP COLUMN "role",
ADD COLUMN     "role" "AdminRole" NOT NULL DEFAULT 'MODERATOR';

-- AlterTable
ALTER TABLE "CampgroundAnnouncement" ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "isPublished" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN     "publishedAt" TIMESTAMP(3),
ADD COLUMN     "scheduledAt" TIMESTAMP(3),
ADD COLUMN     "viewCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "CampgroundEvent" ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "GearItem" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "PhotoAlbum" ADD COLUMN     "privacy" TEXT NOT NULL DEFAULT 'PUBLIC';

-- AlterTable
ALTER TABLE "Post" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "rvDescription" TEXT,
ADD COLUMN     "rvFeatures" TEXT[],
ADD COLUMN     "rvLength" INTEGER,
ADD COLUMN     "rvSleeps" INTEGER,
ADD COLUMN     "rvSlideouts" INTEGER,
ADD COLUMN     "rvWeight" INTEGER;

-- CreateTable
CREATE TABLE "MutedEntity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "mutedUserId" TEXT,
    "mutedCampgroundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MutedEntity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attraction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'other',
    "state" TEXT NOT NULL,
    "city" TEXT,
    "address" TEXT,
    "imageUrl" TEXT,
    "groupId" TEXT,
    "description" TEXT,
    "website" TEXT,
    "isVisited" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Attraction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TopFriend" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "rank" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TopFriend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "mileage" INTEGER,
    "location" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "serviceDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "notes" TEXT,
    "receiptImage" TEXT,
    "providerName" TEXT,
    "providerAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaintenanceReminder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "maintenanceId" TEXT,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "customMiles" INTEGER,
    "customMonths" INTEGER,
    "nextDueDate" TIMESTAMP(3),
    "nextDueMileage" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceReminder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RVShowcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "photos" TEXT[],
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RVShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Group" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "coverPhoto" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GroupInvite" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "inviterId" TEXT NOT NULL,
    "inviteeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GroupInvite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventComment" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "mentions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Mention" (
    "id" TEXT NOT NULL,
    "postId" TEXT,
    "activityId" TEXT,
    "mentionedUserId" TEXT,
    "mentionedCampgroundId" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Mention_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateGasPrice" (
    "id" TEXT NOT NULL,
    "stateCode" TEXT NOT NULL,
    "stateName" TEXT NOT NULL,
    "regularPrice" DOUBLE PRECISION NOT NULL,
    "midgradePrice" DOUBLE PRECISION,
    "premiumPrice" DOUBLE PRECISION,
    "dieselPrice" DOUBLE PRECISION NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateGasPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GasStation" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "zipCode" TEXT,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "interstate" TEXT,
    "exitNumber" TEXT,
    "hasDiesel" BOOLEAN NOT NULL DEFAULT true,
    "hasTruckParking" BOOLEAN NOT NULL DEFAULT false,
    "hasRVParking" BOOLEAN NOT NULL DEFAULT false,
    "hasRestrooms" BOOLEAN NOT NULL DEFAULT true,
    "hasShowers" BOOLEAN NOT NULL DEFAULT false,
    "hasRestaurant" BOOLEAN NOT NULL DEFAULT false,
    "hasStore" BOOLEAN NOT NULL DEFAULT true,
    "hasPropane" BOOLEAN NOT NULL DEFAULT false,
    "hasDumpStation" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "website" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GasStation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RestStop" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "interstate" TEXT NOT NULL,
    "direction" TEXT,
    "mileMarker" DOUBLE PRECISION,
    "hasRestrooms" BOOLEAN NOT NULL DEFAULT true,
    "hasPicnicArea" BOOLEAN NOT NULL DEFAULT false,
    "hasPetArea" BOOLEAN NOT NULL DEFAULT false,
    "hasVending" BOOLEAN NOT NULL DEFAULT false,
    "hasWifi" BOOLEAN NOT NULL DEFAULT false,
    "hasRVParking" BOOLEAN NOT NULL DEFAULT false,
    "hasDumpStation" BOOLEAN NOT NULL DEFAULT false,
    "hasWater" BOOLEAN NOT NULL DEFAULT false,
    "is24Hours" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RestStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Interstate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "startState" TEXT NOT NULL,
    "endState" TEXT NOT NULL,
    "totalMiles" DOUBLE PRECISION,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Interstate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTrip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "originAddress" TEXT NOT NULL,
    "originLat" DOUBLE PRECISION NOT NULL,
    "originLng" DOUBLE PRECISION NOT NULL,
    "destinationAddress" TEXT NOT NULL,
    "destinationLat" DOUBLE PRECISION NOT NULL,
    "destinationLng" DOUBLE PRECISION NOT NULL,
    "campgroundId" TEXT,
    "distanceMeters" INTEGER NOT NULL,
    "durationSeconds" INTEGER NOT NULL,
    "polyline" TEXT NOT NULL,
    "plannedStops" JSONB NOT NULL DEFAULT '[]',
    "estimatedFuelGallons" DOUBLE PRECISION,
    "estimatedFuelCost" DOUBLE PRECISION,
    "mpgUsed" DOUBLE PRECISION,
    "plannedStartDate" TIMESTAMP(3),
    "plannedEndDate" TIMESTAMP(3),
    "eventId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'PRIVATE',
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "copyCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedTripComment" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedTripComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundAnalytics" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "eventType" TEXT NOT NULL,
    "userId" TEXT,
    "source" TEXT,
    "metadata" JSONB,

    CONSTRAINT "CampgroundAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoTag" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "taggedBy" TEXT NOT NULL,
    "x" DOUBLE PRECISION,
    "y" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhotoCampgroundTag" (
    "id" TEXT NOT NULL,
    "photoId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "taggedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhotoCampgroundTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MutedEntity_userId_idx" ON "MutedEntity"("userId");

-- CreateIndex
CREATE INDEX "MutedEntity_mutedUserId_idx" ON "MutedEntity"("mutedUserId");

-- CreateIndex
CREATE INDEX "MutedEntity_mutedCampgroundId_idx" ON "MutedEntity"("mutedCampgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "MutedEntity_userId_mutedUserId_key" ON "MutedEntity"("userId", "mutedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "MutedEntity_userId_mutedCampgroundId_key" ON "MutedEntity"("userId", "mutedCampgroundId");

-- CreateIndex
CREATE INDEX "TopFriend_userId_idx" ON "TopFriend"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TopFriend_userId_friendId_key" ON "TopFriend"("userId", "friendId");

-- CreateIndex
CREATE UNIQUE INDEX "TopFriend_userId_rank_key" ON "TopFriend"("userId", "rank");

-- CreateIndex
CREATE INDEX "MaintenanceRecord_userId_idx" ON "MaintenanceRecord"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MaintenanceReminder_maintenanceId_key" ON "MaintenanceReminder"("maintenanceId");

-- CreateIndex
CREATE INDEX "MaintenanceReminder_userId_idx" ON "MaintenanceReminder"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RVShowcase_userId_key" ON "RVShowcase"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Group_slug_key" ON "Group"("slug");

-- CreateIndex
CREATE INDEX "Group_slug_idx" ON "Group"("slug");

-- CreateIndex
CREATE INDEX "Group_createdById_idx" ON "Group"("createdById");

-- CreateIndex
CREATE INDEX "GroupMember_userId_idx" ON "GroupMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupMember_groupId_userId_key" ON "GroupMember"("groupId", "userId");

-- CreateIndex
CREATE INDEX "GroupInvite_inviteeId_idx" ON "GroupInvite"("inviteeId");

-- CreateIndex
CREATE UNIQUE INDEX "GroupInvite_groupId_inviteeId_key" ON "GroupInvite"("groupId", "inviteeId");

-- CreateIndex
CREATE INDEX "EventComment_eventId_idx" ON "EventComment"("eventId");

-- CreateIndex
CREATE INDEX "EventComment_userId_idx" ON "EventComment"("userId");

-- CreateIndex
CREATE INDEX "EventComment_createdAt_idx" ON "EventComment"("createdAt");

-- CreateIndex
CREATE INDEX "Mention_mentionedUserId_idx" ON "Mention"("mentionedUserId");

-- CreateIndex
CREATE INDEX "Mention_mentionedCampgroundId_idx" ON "Mention"("mentionedCampgroundId");

-- CreateIndex
CREATE INDEX "Mention_postId_idx" ON "Mention"("postId");

-- CreateIndex
CREATE INDEX "Mention_activityId_idx" ON "Mention"("activityId");

-- CreateIndex
CREATE UNIQUE INDEX "StateGasPrice_stateCode_key" ON "StateGasPrice"("stateCode");

-- CreateIndex
CREATE INDEX "GasStation_state_idx" ON "GasStation"("state");

-- CreateIndex
CREATE INDEX "GasStation_interstate_idx" ON "GasStation"("interstate");

-- CreateIndex
CREATE INDEX "GasStation_brand_idx" ON "GasStation"("brand");

-- CreateIndex
CREATE INDEX "GasStation_latitude_longitude_idx" ON "GasStation"("latitude", "longitude");

-- CreateIndex
CREATE INDEX "RestStop_state_idx" ON "RestStop"("state");

-- CreateIndex
CREATE INDEX "RestStop_interstate_idx" ON "RestStop"("interstate");

-- CreateIndex
CREATE INDEX "RestStop_latitude_longitude_idx" ON "RestStop"("latitude", "longitude");

-- CreateIndex
CREATE UNIQUE INDEX "Interstate_name_key" ON "Interstate"("name");

-- CreateIndex
CREATE INDEX "SavedTrip_userId_idx" ON "SavedTrip"("userId");

-- CreateIndex
CREATE INDEX "SavedTrip_campgroundId_idx" ON "SavedTrip"("campgroundId");

-- CreateIndex
CREATE INDEX "SavedTrip_visibility_idx" ON "SavedTrip"("visibility");

-- CreateIndex
CREATE INDEX "SavedTripComment_tripId_idx" ON "SavedTripComment"("tripId");

-- CreateIndex
CREATE INDEX "CampgroundAnalytics_campgroundId_date_idx" ON "CampgroundAnalytics"("campgroundId", "date");

-- CreateIndex
CREATE INDEX "CampgroundAnalytics_eventType_idx" ON "CampgroundAnalytics"("eventType");

-- CreateIndex
CREATE INDEX "PhotoTag_photoId_idx" ON "PhotoTag"("photoId");

-- CreateIndex
CREATE INDEX "PhotoTag_userId_idx" ON "PhotoTag"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoTag_photoId_userId_key" ON "PhotoTag"("photoId", "userId");

-- CreateIndex
CREATE INDEX "PhotoCampgroundTag_photoId_idx" ON "PhotoCampgroundTag"("photoId");

-- CreateIndex
CREATE INDEX "PhotoCampgroundTag_campgroundId_idx" ON "PhotoCampgroundTag"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "PhotoCampgroundTag_photoId_campgroundId_key" ON "PhotoCampgroundTag"("photoId", "campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "Campground_customSlug_key" ON "Campground"("customSlug");

-- CreateIndex
CREATE UNIQUE INDEX "Campground_hashtag_key" ON "Campground"("hashtag");

-- CreateIndex
CREATE INDEX "CampgroundAnnouncement_campgroundId_idx" ON "CampgroundAnnouncement"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundAnnouncement_scheduledAt_idx" ON "CampgroundAnnouncement"("scheduledAt");

-- CreateIndex
CREATE INDEX "CampgroundAnnouncement_isPublished_idx" ON "CampgroundAnnouncement"("isPublished");

-- CreateIndex
CREATE INDEX "PhotoAlbum_privacy_idx" ON "PhotoAlbum"("privacy");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Campground" ADD CONSTRAINT "Campground_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutedEntity" ADD CONSTRAINT "MutedEntity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutedEntity" ADD CONSTRAINT "MutedEntity_mutedUserId_fkey" FOREIGN KEY ("mutedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MutedEntity" ADD CONSTRAINT "MutedEntity_mutedCampgroundId_fkey" FOREIGN KEY ("mutedCampgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attraction" ADD CONSTRAINT "Attraction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopFriend" ADD CONSTRAINT "TopFriend_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TopFriend" ADD CONSTRAINT "TopFriend_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceRecord" ADD CONSTRAINT "MaintenanceRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaintenanceReminder" ADD CONSTRAINT "MaintenanceReminder_maintenanceId_fkey" FOREIGN KEY ("maintenanceId") REFERENCES "MaintenanceRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RVShowcase" ADD CONSTRAINT "RVShowcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupMember" ADD CONSTRAINT "GroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_inviterId_fkey" FOREIGN KEY ("inviterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GroupInvite" ADD CONSTRAINT "GroupInvite_inviteeId_fkey" FOREIGN KEY ("inviteeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventComment" ADD CONSTRAINT "EventComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_mentionedUserId_fkey" FOREIGN KEY ("mentionedUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_mentionedCampgroundId_fkey" FOREIGN KEY ("mentionedCampgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Mention" ADD CONSTRAINT "Mention_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrip" ADD CONSTRAINT "SavedTrip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrip" ADD CONSTRAINT "SavedTrip_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTrip" ADD CONSTRAINT "SavedTrip_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTripComment" ADD CONSTRAINT "SavedTripComment_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "SavedTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedTripComment" ADD CONSTRAINT "SavedTripComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundAnalytics" ADD CONSTRAINT "CampgroundAnalytics_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoTag" ADD CONSTRAINT "PhotoTag_taggedBy_fkey" FOREIGN KEY ("taggedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoCampgroundTag" ADD CONSTRAINT "PhotoCampgroundTag_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "Photo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoCampgroundTag" ADD CONSTRAINT "PhotoCampgroundTag_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoCampgroundTag" ADD CONSTRAINT "PhotoCampgroundTag_taggedBy_fkey" FOREIGN KEY ("taggedBy") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
