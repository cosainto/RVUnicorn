-- CreateTable
CREATE TABLE "CampgroundCheckIn" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "checkInDate" TIMESTAMP(3) NOT NULL,
    "checkOutDate" TIMESTAMP(3) NOT NULL,
    "siteNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampgroundCheckIn_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_userId_idx" ON "CampgroundCheckIn"("userId");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_campgroundId_idx" ON "CampgroundCheckIn"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_checkInDate_idx" ON "CampgroundCheckIn"("checkInDate");

-- CreateIndex
CREATE INDEX "CampgroundCheckIn_checkOutDate_idx" ON "CampgroundCheckIn"("checkOutDate");

-- AddForeignKey
ALTER TABLE "CampgroundCheckIn" ADD CONSTRAINT "CampgroundCheckIn_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundCheckIn" ADD CONSTRAINT "CampgroundCheckIn_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;
