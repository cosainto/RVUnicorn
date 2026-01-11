-- CreateTable
CREATE TABLE "CreatorPageCollaborator" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "collaboratorId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'COLLABORATOR',
    "canPost" BOOLEAN NOT NULL DEFAULT true,
    "canEdit" BOOLEAN NOT NULL DEFAULT true,
    "canDelete" BOOLEAN NOT NULL DEFAULT false,
    "canManageCollaborators" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreatorPageCollaborator_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CreatorPageCollaborator_collaboratorId_idx" ON "CreatorPageCollaborator"("collaboratorId");

-- CreateIndex
CREATE INDEX "CreatorPageCollaborator_creatorId_idx" ON "CreatorPageCollaborator"("creatorId");

-- CreateIndex
CREATE UNIQUE INDEX "CreatorPageCollaborator_creatorId_collaboratorId_key" ON "CreatorPageCollaborator"("creatorId", "collaboratorId");

-- AddForeignKey
ALTER TABLE "CreatorPageCollaborator" ADD CONSTRAINT "CreatorPageCollaborator_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreatorPageCollaborator" ADD CONSTRAINT "CreatorPageCollaborator_collaboratorId_fkey" FOREIGN KEY ("collaboratorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
