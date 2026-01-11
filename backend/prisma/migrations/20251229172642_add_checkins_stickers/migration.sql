-- CreateTable
CREATE TABLE "CheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3),
    "siteNumber" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sticker" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "emoji" TEXT,
    "criteria" TEXT,
    "isLimited" BOOLEAN NOT NULL DEFAULT false,
    "maxQuantity" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserSticker" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stickerId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserSticker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StickerRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "stickerId" TEXT NOT NULL,
    "evidence" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StickerRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundFollow" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundFollow_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckIn_userId_idx" ON "CheckIn"("userId");

-- CreateIndex
CREATE INDEX "CheckIn_campgroundId_idx" ON "CheckIn"("campgroundId");

-- CreateIndex
CREATE INDEX "CheckIn_isActive_idx" ON "CheckIn"("isActive");

-- CreateIndex
CREATE INDEX "Sticker_campgroundId_idx" ON "Sticker"("campgroundId");

-- CreateIndex
CREATE INDEX "UserSticker_userId_idx" ON "UserSticker"("userId");

-- CreateIndex
CREATE INDEX "UserSticker_stickerId_idx" ON "UserSticker"("stickerId");

-- CreateIndex
CREATE UNIQUE INDEX "UserSticker_userId_stickerId_key" ON "UserSticker"("userId", "stickerId");

-- CreateIndex
CREATE INDEX "StickerRequest_userId_idx" ON "StickerRequest"("userId");

-- CreateIndex
CREATE INDEX "StickerRequest_stickerId_idx" ON "StickerRequest"("stickerId");

-- CreateIndex
CREATE INDEX "StickerRequest_status_idx" ON "StickerRequest"("status");

-- CreateIndex
CREATE INDEX "CampgroundFollow_userId_idx" ON "CampgroundFollow"("userId");

-- CreateIndex
CREATE INDEX "CampgroundFollow_campgroundId_idx" ON "CampgroundFollow"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampgroundFollow_userId_campgroundId_key" ON "CampgroundFollow"("userId", "campgroundId");

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sticker" ADD CONSTRAINT "Sticker_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSticker" ADD CONSTRAINT "UserSticker_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserSticker" ADD CONSTRAINT "UserSticker_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerRequest" ADD CONSTRAINT "StickerRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StickerRequest" ADD CONSTRAINT "StickerRequest_stickerId_fkey" FOREIGN KEY ("stickerId") REFERENCES "Sticker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundFollow" ADD CONSTRAINT "CampgroundFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundFollow" ADD CONSTRAINT "CampgroundFollow_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
