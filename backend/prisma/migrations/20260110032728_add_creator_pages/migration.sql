-- AlterTable
ALTER TABLE "User" ADD COLUMN     "creatorBio" TEXT,
ADD COLUMN     "creatorCoverImage" TEXT,
ADD COLUMN     "creatorEnabledAt" TIMESTAMP(3),
ADD COLUMN     "creatorFeatured" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "creatorSpecialties" TEXT[],
ADD COLUMN     "creatorVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isCreator" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CreatorContent" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "body" TEXT,
    "thumbnailUrl" TEXT,
    "videoUrl" TEXT,
    "embedUrl" TEXT,
    "embedPlatform" TEXT,
    "category" TEXT,
    "tags" TEXT[],
    "campgroundId" TEXT,
    "eventId" TEXT,
    "tripId" TEXT,
    "isSponsored" BOOLEAN NOT NULL DEFAULT false,
    "sponsorName" TEXT,
    "affiliateLinks" JSONB,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "publishedAt" TIMESTAMP(3),
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "repostCount" INTEGER NOT NULL DEFAULT 0,
    "saveCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorContent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorContentPhoto" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorContentPhoto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorContentGear" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "gearItemId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "affiliateUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorContentGear_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorContentTag" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "tagType" TEXT NOT NULL,
    "userId" TEXT,
    "campgroundId" TEXT,
    "brandName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorContentTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorCollaboration" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLLABORATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorCollaboration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorFollow" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorFollow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorContentLike" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorContentLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorContentComment" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "parentId" TEXT,
    "isCreatorReply" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorContentComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorRepost" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorRepost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorSave" (
    "id" TEXT NOT NULL,
    "contentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorSave_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreatorStats" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "totalViews" INTEGER NOT NULL DEFAULT 0,
    "totalLikes" INTEGER NOT NULL DEFAULT 0,
    "totalComments" INTEGER NOT NULL DEFAULT 0,
    "totalReposts" INTEGER NOT NULL DEFAULT 0,
    "totalSaves" INTEGER NOT NULL DEFAULT 0,
    "followerCount" INTEGER NOT NULL DEFAULT 0,
    "viewsThisWeek" INTEGER NOT NULL DEFAULT 0,
    "viewsThisMonth" INTEGER NOT NULL DEFAULT 0,
    "followersThisWeek" INTEGER NOT NULL DEFAULT 0,
    "followersThisMonth" INTEGER NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorStats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorContent_creatorId_idx" ON "CreatorContent"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorContent_category_idx" ON "CreatorContent"("category");

-- CreateIndex
CREATE INDEX "CreatorContent_status_publishedAt_idx" ON "CreatorContent"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "CreatorContent_campgroundId_idx" ON "CreatorContent"("campgroundId");

-- CreateIndex
CREATE INDEX "CreatorContentPhoto_contentId_idx" ON "CreatorContentPhoto"("contentId");

-- CreateIndex
CREATE INDEX "CreatorContentGear_contentId_idx" ON "CreatorContentGear"("contentId");

-- CreateIndex
CREATE INDEX "CreatorContentTag_contentId_idx" ON "CreatorContentTag"("contentId");

-- CreateIndex
CREATE INDEX "CreatorContentTag_userId_idx" ON "CreatorContentTag"("userId");

-- CreateIndex
CREATE INDEX "CreatorContentTag_campgroundId_idx" ON "CreatorContentTag"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorContentTag_contentId_tagType_userId_key" ON "CreatorContentTag"("contentId", "tagType", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorContentTag_contentId_tagType_campgroundId_key" ON "CreatorContentTag"("contentId", "tagType", "campgroundId");

-- CreateIndex
CREATE INDEX "CreatorCollaboration_collaboratorId_idx" ON "CreatorCollaboration"("collaboratorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorCollaboration_contentId_collaboratorId_key" ON "CreatorCollaboration"("contentId", "collaboratorId");

-- CreateIndex
CREATE INDEX "CreatorFollow_creatorId_idx" ON "CreatorFollow"("creatorId");

-- CreateIndex
CREATE INDEX "CreatorFollow_followerId_idx" ON "CreatorFollow"("followerId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorFollow_creatorId_followerId_key" ON "CreatorFollow"("creatorId", "followerId");

-- CreateIndex
CREATE INDEX "CreatorContentLike_contentId_idx" ON "CreatorContentLike"("contentId");

-- CreateIndex
CREATE INDEX "CreatorContentLike_userId_idx" ON "CreatorContentLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorContentLike_contentId_userId_key" ON "CreatorContentLike"("contentId", "userId");

-- CreateIndex
CREATE INDEX "CreatorContentComment_contentId_idx" ON "CreatorContentComment"("contentId");

-- CreateIndex
CREATE INDEX "CreatorContentComment_userId_idx" ON "CreatorContentComment"("userId");

-- CreateIndex
CREATE INDEX "CreatorContentComment_parentId_idx" ON "CreatorContentComment"("parentId");

-- CreateIndex
CREATE INDEX "CreatorRepost_contentId_idx" ON "CreatorRepost"("contentId");

-- CreateIndex
CREATE INDEX "CreatorRepost_userId_idx" ON "CreatorRepost"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorRepost_contentId_userId_key" ON "CreatorRepost"("contentId", "userId");

-- CreateIndex
CREATE INDEX "CreatorSave_userId_idx" ON "CreatorSave"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorSave_contentId_userId_key" ON "CreatorSave"("contentId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorStats_userId_key" ON "CreatorStats"("userId");

-- AddForeignKey
ALTER TABLE "CreatorContent" ADD CONSTRAINT "CreatorContent_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContent" ADD CONSTRAINT "CreatorContent_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentPhoto" ADD CONSTRAINT "CreatorContentPhoto_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentGear" ADD CONSTRAINT "CreatorContentGear_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentTag" ADD CONSTRAINT "CreatorContentTag_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentTag" ADD CONSTRAINT "CreatorContentTag_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentTag" ADD CONSTRAINT "CreatorContentTag_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCollaboration" ADD CONSTRAINT "CreatorCollaboration_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorCollaboration" ADD CONSTRAINT "CreatorCollaboration_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorFollow" ADD CONSTRAINT "CreatorFollow_followerId_fkey" FOREIGN KEY ("followerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentLike" ADD CONSTRAINT "CreatorContentLike_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentLike" ADD CONSTRAINT "CreatorContentLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentComment" ADD CONSTRAINT "CreatorContentComment_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentComment" ADD CONSTRAINT "CreatorContentComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorContentComment" ADD CONSTRAINT "CreatorContentComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "CreatorContentComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorRepost" ADD CONSTRAINT "CreatorRepost_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorRepost" ADD CONSTRAINT "CreatorRepost_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSave" ADD CONSTRAINT "CreatorSave_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "CreatorContent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorSave" ADD CONSTRAINT "CreatorSave_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorStats" ADD CONSTRAINT "CreatorStats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
