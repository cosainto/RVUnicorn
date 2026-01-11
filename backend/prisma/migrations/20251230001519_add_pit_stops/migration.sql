-- CreateTable
CREATE TABLE "PitStop" (
    "id" TEXT NOT NULL,
    "tripPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "stopType" TEXT NOT NULL,
    "notes" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "estimatedArrival" TIMESTAMP(3),
    "estimatedDuration" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PitStop_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PitStop" ADD CONSTRAINT "PitStop_tripPlanId_fkey" FOREIGN KEY ("tripPlanId") REFERENCES "TripPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
