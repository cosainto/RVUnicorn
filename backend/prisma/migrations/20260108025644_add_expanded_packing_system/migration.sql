-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'General',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "imageUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TripPackItem" (
    "id" TEXT NOT NULL,
    "tripId" TEXT,
    "eventId" TEXT,
    "inventoryItemId" TEXT,
    "customName" TEXT,
    "customCategory" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "isPacked" BOOLEAN NOT NULL DEFAULT false,
    "packedAt" TIMESTAMP(3),
    "packedById" TEXT,
    "assignedToId" TEXT,
    "assignmentStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "declinedAt" TIMESTAMP(3),
    "declineReason" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TripPackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PackingListTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PRIVATE',
    "items" JSONB NOT NULL,
    "copiedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PackingListTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BasecampActivity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityName" TEXT,
    "metadata" JSONB,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BasecampActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryItem_userId_idx" ON "InventoryItem"("userId");

-- CreateIndex
CREATE INDEX "InventoryItem_category_idx" ON "InventoryItem"("category");

-- CreateIndex
CREATE INDEX "TripPackItem_tripId_idx" ON "TripPackItem"("tripId");

-- CreateIndex
CREATE INDEX "TripPackItem_eventId_idx" ON "TripPackItem"("eventId");

-- CreateIndex
CREATE INDEX "TripPackItem_assignedToId_idx" ON "TripPackItem"("assignedToId");

-- CreateIndex
CREATE INDEX "TripPackItem_inventoryItemId_idx" ON "TripPackItem"("inventoryItemId");

-- CreateIndex
CREATE INDEX "TripPackItem_isPacked_idx" ON "TripPackItem"("isPacked");

-- CreateIndex
CREATE INDEX "PackingListTemplate_userId_idx" ON "PackingListTemplate"("userId");

-- CreateIndex
CREATE INDEX "PackingListTemplate_privacy_idx" ON "PackingListTemplate"("privacy");

-- CreateIndex
CREATE INDEX "BasecampActivity_userId_isRead_idx" ON "BasecampActivity"("userId", "isRead");

-- CreateIndex
CREATE INDEX "BasecampActivity_userId_createdAt_idx" ON "BasecampActivity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "BasecampActivity_entityType_entityId_idx" ON "BasecampActivity"("entityType", "entityId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "TripPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_packedById_fkey" FOREIGN KEY ("packedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripPackItem" ADD CONSTRAINT "TripPackItem_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PackingListTemplate" ADD CONSTRAINT "PackingListTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasecampActivity" ADD CONSTRAINT "BasecampActivity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BasecampActivity" ADD CONSTRAINT "BasecampActivity_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
