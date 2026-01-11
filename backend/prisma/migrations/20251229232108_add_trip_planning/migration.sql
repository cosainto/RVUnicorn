-- CreateTable
CREATE TABLE "TripPlan" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startLocation" TEXT NOT NULL,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "useHometown" BOOLEAN NOT NULL DEFAULT true,
    "endLocation" TEXT NOT NULL,
    "endLatitude" DOUBLE PRECISION,
    "endLongitude" DOUBLE PRECISION,
    "distanceMiles" DOUBLE PRECISION,
    "durationMinutes" INTEGER,
    "routePolyline" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "actualMiles" DOUBLE PRECISION,
    "isDriving" BOOLEAN NOT NULL DEFAULT true,
    "ridingWithId" TEXT,
    "routePreference" TEXT NOT NULL DEFAULT 'FASTEST',
    "avoidTolls" BOOLEAN NOT NULL DEFAULT false,
    "avoidHighways" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserMileageLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tripPlanId" TEXT,
    "miles" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "tripDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserMileageLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripPlan_eventId_userId_key" ON "TripPlan"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPlan" ADD CONSTRAINT "TripPlan_ridingWithId_fkey" FOREIGN KEY ("ridingWithId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMileageLog" ADD CONSTRAINT "UserMileageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserMileageLog" ADD CONSTRAINT "UserMileageLog_tripPlanId_fkey" FOREIGN KEY ("tripPlanId") REFERENCES "TripPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
