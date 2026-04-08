-- AlterTable
ALTER TABLE "Campground" ADD COLUMN "pricePerNightSource" TEXT;
ALTER TABLE "Campground" ADD COLUMN "pricePerNightUpdatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "CampgroundPriceReport" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pricePaid" DOUBLE PRECISION NOT NULL,
    "siteType" TEXT,
    "hookupLevel" TEXT,
    "season" TEXT,
    "notes" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundPriceReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampgroundPriceReport_campgroundId_idx" ON "CampgroundPriceReport"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundPriceReport_userId_idx" ON "CampgroundPriceReport"("userId");

-- CreateIndex
CREATE INDEX "CampgroundPriceReport_reportedAt_idx" ON "CampgroundPriceReport"("reportedAt");

-- AddForeignKey
ALTER TABLE "CampgroundPriceReport" ADD CONSTRAINT "CampgroundPriceReport_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPriceReport" ADD CONSTRAINT "CampgroundPriceReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
