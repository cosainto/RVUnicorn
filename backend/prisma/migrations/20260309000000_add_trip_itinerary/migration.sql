-- Upgrade Trip table
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PLANNING';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "visibility" TEXT NOT NULL DEFAULT 'PRIVATE';
ALTER TABLE "Trip" ADD COLUMN IF NOT EXISTS "coverImage" TEXT;
ALTER TABLE "Trip" ALTER COLUMN "startDate" DROP NOT NULL;
ALTER TABLE "Trip" ALTER COLUMN "endDate" DROP NOT NULL;
UPDATE "Trip" SET "title" = "name" WHERE "title" IS NULL;

-- Create TripDay table
CREATE TABLE IF NOT EXISTS "TripDay" (
  "id" TEXT NOT NULL,
  "tripId" TEXT NOT NULL,
  "date" TIMESTAMP(3),
  "dayNumber" INTEGER NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'TRAVEL',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripDay_pkey" PRIMARY KEY ("id")
);

-- Create TripStop table
CREATE TABLE IF NOT EXISTS "TripStop" (
  "id" TEXT NOT NULL,
  "tripDayId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "type" TEXT NOT NULL,
  "campgroundId" TEXT,
  "customName" TEXT,
  "address" TEXT,
  "latitude" DOUBLE PRECISION,
  "longitude" DOUBLE PRECISION,
  "notes" TEXT,
  "siteNumber" TEXT,
  "durationMins" INTEGER,
  "cost" DOUBLE PRECISION,
  "confirmed" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TripStop_pkey" PRIMARY KEY ("id")
);

-- Add foreign keys
ALTER TABLE "TripDay" ADD CONSTRAINT "TripDay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_tripDayId_fkey" FOREIGN KEY ("tripDayId") REFERENCES "TripDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TripStop" ADD CONSTRAINT "TripStop_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add indexes
CREATE INDEX IF NOT EXISTS "TripDay_tripId_idx" ON "TripDay"("tripId");
CREATE INDEX IF NOT EXISTS "TripStop_tripDayId_idx" ON "TripStop"("tripDayId");
CREATE INDEX IF NOT EXISTS "TripStop_campgroundId_idx" ON "TripStop"("campgroundId");
