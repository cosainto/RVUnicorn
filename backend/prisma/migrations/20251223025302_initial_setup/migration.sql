-- CreateEnum
CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateEnum
CREATE TYPE "RecipeCategory" AS ENUM ('BREAKFAST', 'LUNCH', 'DINNER', 'SNACK', 'DESSERT', 'DRINK');

-- CreateEnum
CREATE TYPE "GearCategory" AS ENUM ('TENT', 'SLEEPING_BAG', 'BACKPACK', 'COOKING', 'LIGHTING', 'TOOLS', 'CLOTHING', 'ELECTRONICS', 'OTHER');

-- CreateEnum
CREATE TYPE "GearCondition" AS ENUM ('NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR');

-- CreateEnum
CREATE TYPE "ListingStatus" AS ENUM ('AVAILABLE', 'PENDING', 'SOLD');

-- CreateEnum
CREATE TYPE "RVType" AS ENUM ('CLASS_A', 'CLASS_B', 'CLASS_C', 'FIFTH_WHEEL', 'TRAVEL_TRAILER', 'TOY_HAULER', 'POPUP', 'TRUCK_CAMPER');

-- CreateEnum
CREATE TYPE "MaintenanceCategory" AS ENUM ('OIL_CHANGE', 'TIRE_ROTATION', 'BRAKE_SERVICE', 'ENGINE_REPAIR', 'TRANSMISSION', 'ELECTRICAL', 'PLUMBING', 'HVAC', 'APPLIANCE', 'EXTERIOR', 'INTERIOR', 'SAFETY_INSPECTION', 'OTHER');

-- CreateEnum
CREATE TYPE "BorrowStatus" AS ENUM ('PENDING', 'FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SiteType" AS ENUM ('TENT', 'RV', 'CABIN', 'GROUP');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AdminRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "RentalCategory" AS ENUM ('KAYAK', 'CANOE', 'BIKE', 'FISHING_GEAR', 'SPORTS_EQUIPMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "RentalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "StoreCategory" AS ENUM ('FIREWOOD', 'ICE', 'SNACKS', 'DRINKS', 'CAMPING_SUPPLIES', 'SOUVENIRS', 'OTHER');

-- CreateEnum
CREATE TYPE "StickerCategory" AS ENUM ('ACHIEVEMENT', 'EVENT', 'LOCATION', 'COMMUNITY', 'SEASONAL');

-- CreateEnum
CREATE TYPE "StickerRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "JobCategory" AS ENUM ('FRONT_DESK', 'MAINTENANCE', 'HOUSEKEEPING', 'GROUNDSKEEPING', 'ACTIVITIES', 'RETAIL', 'FOOD_SERVICE', 'SECURITY', 'MANAGEMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('FULL_TIME', 'PART_TIME', 'SEASONAL', 'VOLUNTEER', 'WORKAMPING');

-- CreateEnum
CREATE TYPE "PayType" AS ENUM ('HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY', 'STIPEND');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'REVIEWED', 'INTERVIEWING', 'ACCEPTED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ModerationType" AS ENUM ('DELETE_THREAD', 'DELETE_REPLY', 'LOCK_THREAD', 'UNLOCK_THREAD', 'PIN_THREAD', 'UNPIN_THREAD', 'WARN_USER', 'BAN_USER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT,
    "bio" TEXT,
    "location" TEXT,
    "profilePicture" TEXT,
    "coverPhoto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Like" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Like_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Friendship" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "friendId" TEXT NOT NULL,
    "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Friendship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "ingredients" TEXT[],
    "instructions" TEXT NOT NULL,
    "prepTime" INTEGER,
    "cookTime" INTEGER,
    "servings" INTEGER,
    "difficulty" "Difficulty",
    "category" "RecipeCategory",
    "imageUrl" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeComment" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeLike" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearListing" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "GearCategory" NOT NULL,
    "condition" "GearCondition" NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "imageUrl" TEXT,
    "location" TEXT,
    "userId" TEXT NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'AVAILABLE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GearListing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GearMessage" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GearMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StateVisit" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3),
    "notes" TEXT,
    "campsiteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StateVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campground" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "state" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "amenities" TEXT[],
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "fullDescription" TEXT,
    "nightlyRate" DOUBLE PRECISION,
    "phone" TEXT,
    "email" TEXT,
    "website" TEXT,
    "socialLinks" JSONB,
    "mapImageUrl" TEXT,
    "hours" JSONB,
    "bathroomSchedule" TEXT,
    "restaurantMenu" JSONB,

    CONSTRAINT "Campground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundReview" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RVProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rvType" "RVType" NOT NULL,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "length" DOUBLE PRECISION,
    "slideouts" INTEGER,
    "sleeps" INTEGER,
    "description" TEXT,
    "features" TEXT[],
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RVProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RVMaintenanceLog" (
    "id" TEXT NOT NULL,
    "rvProfileId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "MaintenanceCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cost" DOUBLE PRECISION,
    "date" TIMESTAMP(3) NOT NULL,
    "mileage" INTEGER,
    "location" TEXT,
    "reminderDate" TIMESTAMP(3),
    "reminderMileage" INTEGER,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RVMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trip" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Trip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripStop" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "arrivalDate" TIMESTAMP(3) NOT NULL,
    "departureDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL,

    CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteFlair" (
    "id" TEXT NOT NULL,
    "campsiteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteFlair_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FavoriteCampground" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FavoriteCampground_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BorrowRequest" (
    "id" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "description" TEXT,
    "requesterId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "status" "BorrowStatus" NOT NULL DEFAULT 'PENDING',
    "lenderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BorrowRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteSite" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "siteNumber" TEXT NOT NULL,
    "siteType" "SiteType" NOT NULL,
    "maxRvLength" INTEGER,
    "amenities" TEXT[],
    "pricePerNight" DOUBLE PRECISION NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampsiteSite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "guests" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteAdmin" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AdminRole" NOT NULL DEFAULT 'MANAGER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteFollow" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteRating" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteAnnouncement" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'NORMAL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),

    CONSTRAINT "CampsiteAnnouncement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteEvent" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "location" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteRental" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "RentalCategory" NOT NULL,
    "pricePerHour" DOUBLE PRECISION,
    "pricePerDay" DOUBLE PRECISION,
    "imageUrl" TEXT,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteRental_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RentalRequest" (
    "id" TEXT NOT NULL,
    "rentalId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "RentalStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RentalRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteStoreItem" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "category" "StoreCategory" NOT NULL,
    "imageUrl" TEXT,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteStoreItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampsiteGalleryPhoto" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampsiteGalleryPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT NOT NULL,
    "campgroundId" TEXT,
    "category" "StickerCategory" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickerRequest" (
    "id" TEXT NOT NULL,
    "stickerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT,
    "status" "StickerRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "StickerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickerAward" (
    "id" TEXT NOT NULL,
    "stickerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StickerAward_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobPosting" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "JobCategory" NOT NULL,
    "jobType" "JobType" NOT NULL,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "hoursPerWeek" INTEGER,
    "payRate" DOUBLE PRECISION,
    "payType" "PayType",
    "housingProvided" BOOLEAN NOT NULL DEFAULT false,
    "housingDetails" TEXT,
    "rvSiteProvided" BOOLEAN NOT NULL DEFAULT false,
    "rvSiteDetails" TEXT,
    "utilitiesIncluded" BOOLEAN NOT NULL DEFAULT false,
    "mealsIncluded" BOOLEAN NOT NULL DEFAULT false,
    "requirements" TEXT[],
    "benefits" TEXT[],
    "duties" TEXT[],
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobPosting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobApplication" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "coverLetter" TEXT,
    "resumeUrl" TEXT,
    "yearsExperience" INTEGER,
    "availability" TEXT,
    "references" JSONB,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "JobApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserResume" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "location" TEXT,
    "summary" TEXT,
    "skills" TEXT[],
    "experience" JSONB,
    "education" JSONB,
    "certifications" TEXT[],
    "rvDetails" TEXT,
    "availability" TEXT,
    "references" JSONB,
    "resumeFileUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserResume_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityThread" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityThread_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunityReply" (
    "id" TEXT NOT NULL,
    "threadId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunityReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notificationsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampgroundCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundModerator" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "CampgroundModerator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationAction" (
    "id" TEXT NOT NULL,
    "threadId" TEXT,
    "replyId" TEXT,
    "action" "ModerationType" NOT NULL,
    "reason" TEXT,
    "moderatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ModerationAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "Post_userId_idx" ON "Post"("userId");

-- CreateIndex
CREATE INDEX "Post_campgroundId_idx" ON "Post"("campgroundId");

-- CreateIndex
CREATE INDEX "Comment_postId_idx" ON "Comment"("postId");

-- CreateIndex
CREATE INDEX "Comment_userId_idx" ON "Comment"("userId");

-- CreateIndex
CREATE INDEX "Like_postId_idx" ON "Like"("postId");

-- CreateIndex
CREATE INDEX "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_postId_userId_key" ON "Like"("postId", "userId");

-- CreateIndex
CREATE INDEX "Friendship_userId_idx" ON "Friendship"("userId");

-- CreateIndex
CREATE INDEX "Friendship_friendId_idx" ON "Friendship"("friendId");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_userId_friendId_key" ON "Friendship"("userId", "friendId");

-- CreateIndex
CREATE INDEX "Recipe_userId_idx" ON "Recipe"("userId");

-- CreateIndex
CREATE INDEX "Recipe_category_idx" ON "Recipe"("category");

-- CreateIndex
CREATE INDEX "RecipeComment_recipeId_idx" ON "RecipeComment"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeComment_userId_idx" ON "RecipeComment"("userId");

-- CreateIndex
CREATE INDEX "RecipeLike_recipeId_idx" ON "RecipeLike"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeLike_userId_idx" ON "RecipeLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RecipeLike_recipeId_userId_key" ON "RecipeLike"("recipeId", "userId");

-- CreateIndex
CREATE INDEX "GearListing_userId_idx" ON "GearListing"("userId");

-- CreateIndex
CREATE INDEX "GearListing_category_idx" ON "GearListing"("category");

-- CreateIndex
CREATE INDEX "GearListing_status_idx" ON "GearListing"("status");

-- CreateIndex
CREATE INDEX "GearMessage_listingId_idx" ON "GearMessage"("listingId");

-- CreateIndex
CREATE INDEX "GearMessage_userId_idx" ON "GearMessage"("userId");

-- CreateIndex
CREATE INDEX "StateVisit_userId_idx" ON "StateVisit"("userId");

-- CreateIndex
CREATE INDEX "StateVisit_state_idx" ON "StateVisit"("state");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisit_userId_state_key" ON "StateVisit"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "Campground_slug_key" ON "Campground"("slug");

-- CreateIndex
CREATE INDEX "Campground_state_idx" ON "Campground"("state");

-- CreateIndex
CREATE INDEX "Campground_slug_idx" ON "Campground"("slug");

-- CreateIndex
CREATE INDEX "CampgroundReview_campgroundId_idx" ON "CampgroundReview"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundReview_userId_idx" ON "CampgroundReview"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "RVProfile_userId_key" ON "RVProfile"("userId");

-- CreateIndex
CREATE INDEX "RVProfile_userId_idx" ON "RVProfile"("userId");

-- CreateIndex
CREATE INDEX "RVMaintenanceLog_rvProfileId_idx" ON "RVMaintenanceLog"("rvProfileId");

-- CreateIndex
CREATE INDEX "RVMaintenanceLog_userId_idx" ON "RVMaintenanceLog"("userId");

-- CreateIndex
CREATE INDEX "RVMaintenanceLog_date_idx" ON "RVMaintenanceLog"("date");

-- CreateIndex
CREATE INDEX "Trip_userId_idx" ON "Trip"("userId");

-- CreateIndex
CREATE INDEX "TripStop_tripId_idx" ON "TripStop"("tripId");

-- CreateIndex
CREATE INDEX "TripStop_campgroundId_idx" ON "TripStop"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteFlair_campsiteId_idx" ON "CampsiteFlair"("campsiteId");

-- CreateIndex
CREATE INDEX "FavoriteCampground_userId_idx" ON "FavoriteCampground"("userId");

-- CreateIndex
CREATE INDEX "FavoriteCampground_campgroundId_idx" ON "FavoriteCampground"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "FavoriteCampground_userId_campgroundId_key" ON "FavoriteCampground"("userId", "campgroundId");

-- CreateIndex
CREATE INDEX "BorrowRequest_requesterId_idx" ON "BorrowRequest"("requesterId");

-- CreateIndex
CREATE INDEX "BorrowRequest_campgroundId_idx" ON "BorrowRequest"("campgroundId");

-- CreateIndex
CREATE INDEX "BorrowRequest_lenderId_idx" ON "BorrowRequest"("lenderId");

-- CreateIndex
CREATE INDEX "CampsiteSite_campgroundId_idx" ON "CampsiteSite"("campgroundId");

-- CreateIndex
CREATE INDEX "Booking_siteId_idx" ON "Booking"("siteId");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_campgroundId_idx" ON "Booking"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteAdmin_campgroundId_idx" ON "CampsiteAdmin"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampsiteAdmin_campgroundId_userId_key" ON "CampsiteAdmin"("campgroundId", "userId");

-- CreateIndex
CREATE INDEX "CampsiteFollow_campgroundId_idx" ON "CampsiteFollow"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampsiteFollow_campgroundId_userId_key" ON "CampsiteFollow"("campgroundId", "userId");

-- CreateIndex
CREATE INDEX "CampsiteRating_campgroundId_idx" ON "CampsiteRating"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampsiteRating_campgroundId_userId_key" ON "CampsiteRating"("campgroundId", "userId");

-- CreateIndex
CREATE INDEX "CampsiteAnnouncement_campgroundId_idx" ON "CampsiteAnnouncement"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteEvent_campgroundId_idx" ON "CampsiteEvent"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteRental_campgroundId_idx" ON "CampsiteRental"("campgroundId");

-- CreateIndex
CREATE INDEX "RentalRequest_rentalId_idx" ON "RentalRequest"("rentalId");

-- CreateIndex
CREATE INDEX "RentalRequest_campgroundId_idx" ON "RentalRequest"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteStoreItem_campgroundId_idx" ON "CampsiteStoreItem"("campgroundId");

-- CreateIndex
CREATE INDEX "CampsiteGalleryPhoto_campgroundId_idx" ON "CampsiteGalleryPhoto"("campgroundId");

-- CreateIndex
CREATE INDEX "Sticker_campgroundId_idx" ON "Sticker"("campgroundId");

-- CreateIndex
CREATE INDEX "Sticker_category_idx" ON "Sticker"("category");

-- CreateIndex
CREATE INDEX "StickerRequest_stickerId_idx" ON "StickerRequest"("stickerId");

-- CreateIndex
CREATE INDEX "StickerRequest_userId_idx" ON "StickerRequest"("userId");

-- CreateIndex
CREATE INDEX "StickerAward_userId_idx" ON "StickerAward"("userId");

-- CreateIndex
CREATE INDEX "StickerAward_stickerId_idx" ON "StickerAward"("stickerId");

-- CreateIndex
CREATE UNIQUE INDEX "StickerAward_stickerId_userId_key" ON "StickerAward"("stickerId", "userId");

-- CreateIndex
CREATE INDEX "JobPosting_campgroundId_idx" ON "JobPosting"("campgroundId");

-- CreateIndex
CREATE INDEX "JobPosting_category_idx" ON "JobPosting"("category");

-- CreateIndex
CREATE INDEX "JobPosting_jobType_idx" ON "JobPosting"("jobType");

-- CreateIndex
CREATE INDEX "JobPosting_isActive_idx" ON "JobPosting"("isActive");

-- CreateIndex
CREATE INDEX "JobApplication_jobId_idx" ON "JobApplication"("jobId");

-- CreateIndex
CREATE INDEX "JobApplication_userId_idx" ON "JobApplication"("userId");

-- CreateIndex
CREATE INDEX "JobApplication_status_idx" ON "JobApplication"("status");

-- CreateIndex
CREATE UNIQUE INDEX "UserResume_userId_key" ON "UserResume"("userId");

-- CreateIndex
CREATE INDEX "CommunityThread_campgroundId_idx" ON "CommunityThread"("campgroundId");

-- CreateIndex
CREATE INDEX "CommunityThread_authorId_idx" ON "CommunityThread"("authorId");

-- CreateIndex
CREATE INDEX "CommunityThread_createdAt_idx" ON "CommunityThread"("createdAt");

-- CreateIndex
CREATE INDEX "CommunityReply_threadId_idx" ON "CommunityReply"("threadId");

-- CreateIndex
CREATE INDEX "CommunityReply_authorId_idx" ON "CommunityReply"("authorId");

-- CreateIndex
CREATE INDEX "CommunityReply_createdAt_idx" ON "CommunityReply"("createdAt");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_userId_idx" ON "CampgroundCheckIn"("userId");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_campgroundId_idx" ON "CampgroundCheckIn"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_isActive_idx" ON "CampgroundCheckIn"("isActive");

-- CreateIndex
CREATE INDEX "CampgroundModerator_campgroundId_idx" ON "CampgroundModerator"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundModerator_userId_idx" ON "CampgroundModerator"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampgroundModerator_campgroundId_userId_key" ON "CampgroundModerator"("campgroundId", "userId");

-- CreateIndex
CREATE INDEX "ModerationAction_threadId_idx" ON "ModerationAction"("threadId");

-- CreateIndex
CREATE INDEX "ModerationAction_replyId_idx" ON "ModerationAction"("replyId");

-- CreateIndex
CREATE INDEX "ModerationAction_moderatorId_idx" ON "ModerationAction"("moderatorId");

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Post" ADD CONSTRAINT "Post_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_postId_fkey" FOREIGN KEY ("postId") REFERENCES "Post"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Like" ADD CONSTRAINT "Like_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey" FOREIGN KEY ("friendId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeComment" ADD CONSTRAINT "RecipeComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLike" ADD CONSTRAINT "RecipeLike_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeLike" ADD CONSTRAINT "RecipeLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearListing" ADD CONSTRAINT "GearListing_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearMessage" ADD CONSTRAINT "GearMessage_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "GearListing"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GearMessage" ADD CONSTRAINT "GearMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisit" ADD CONSTRAINT "StateVisit_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundReview" ADD CONSTRAINT "CampgroundReview_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundReview" ADD CONSTRAINT "CampgroundReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RVProfile" ADD CONSTRAINT "RVProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RVMaintenanceLog" ADD CONSTRAINT "RVMaintenanceLog_rvProfileId_fkey" FOREIGN KEY ("rvProfileId") REFERENCES "RVProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RVMaintenanceLog" ADD CONSTRAINT "RVMaintenanceLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Trip" ADD CONSTRAINT "Trip_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteFlair" ADD CONSTRAINT "CampsiteFlair_campsiteId_fkey" FOREIGN KEY ("campsiteId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCampground" ADD CONSTRAINT "FavoriteCampground_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FavoriteCampground" ADD CONSTRAINT "FavoriteCampground_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BorrowRequest" ADD CONSTRAINT "BorrowRequest_lenderId_fkey" FOREIGN KEY ("lenderId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteSite" ADD CONSTRAINT "CampsiteSite_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "CampsiteSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteAdmin" ADD CONSTRAINT "CampsiteAdmin_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteFollow" ADD CONSTRAINT "CampsiteFollow_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteRating" ADD CONSTRAINT "CampsiteRating_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteAnnouncement" ADD CONSTRAINT "CampsiteAnnouncement_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteEvent" ADD CONSTRAINT "CampsiteEvent_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteRental" ADD CONSTRAINT "CampsiteRental_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_rentalId_fkey" FOREIGN KEY ("rentalId") REFERENCES "CampsiteRental"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RentalRequest" ADD CONSTRAINT "RentalRequest_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteStoreItem" ADD CONSTRAINT "CampsiteStoreItem_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampsiteGalleryPhoto" ADD CONSTRAINT "CampsiteGalleryPhoto_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerRequest" ADD CONSTRAINT "StickerRequest_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerRequest" ADD CONSTRAINT "StickerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerRequest" ADD CONSTRAINT "StickerRequest_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerAward" ADD CONSTRAINT "StickerAward_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerAward" ADD CONSTRAINT "StickerAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerAward" ADD CONSTRAINT "StickerAward_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobPosting" ADD CONSTRAINT "JobPosting_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobPosting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobApplication" ADD CONSTRAINT "JobApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserResume" ADD CONSTRAINT "UserResume_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityThread" ADD CONSTRAINT "CommunityThread_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityThread" ADD CONSTRAINT "CommunityThread_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_threadId_fkey" FOREIGN KEY ("threadId") REFERENCES "CommunityThread"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunityReply" ADD CONSTRAINT "CommunityReply_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundCheckIn" ADD CONSTRAINT "CampgroundCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundCheckIn" ADD CONSTRAINT "CampgroundCheckIn_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundModerator" ADD CONSTRAINT "CampgroundModerator_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundModerator" ADD CONSTRAINT "CampgroundModerator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationAction" ADD CONSTRAINT "ModerationAction_moderatorId_fkey" FOREIGN KEY ("moderatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
