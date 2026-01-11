-- CreateTable
CREATE TABLE "CampgroundAdmin" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundPost" (
    "id" TEXT NOT NULL,
    "campgroundId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "imageUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampgroundPost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundPostLike" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CampgroundPostLike_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CampgroundPostComment" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CampgroundPostComment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CampgroundAdmin_userId_idx" ON "CampgroundAdmin"("userId");

-- CreateIndex
CREATE INDEX "CampgroundAdmin_campgroundId_idx" ON "CampgroundAdmin"("campgroundId");

-- CreateIndex
CREATE UNIQUE INDEX "CampgroundAdmin_userId_campgroundId_key" ON "CampgroundAdmin"("userId", "campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundPost_campgroundId_idx" ON "CampgroundPost"("campgroundId");

-- CreateIndex
CREATE INDEX "CampgroundPost_authorId_idx" ON "CampgroundPost"("authorId");

-- CreateIndex
CREATE INDEX "CampgroundPost_createdAt_idx" ON "CampgroundPost"("createdAt");

-- CreateIndex
CREATE INDEX "CampgroundPostLike_postId_idx" ON "CampgroundPostLike"("postId");

-- CreateIndex
CREATE INDEX "CampgroundPostLike_userId_idx" ON "CampgroundPostLike"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "CampgroundPostLike_postId_userId_key" ON "CampgroundPostLike"("postId", "userId");

-- CreateIndex
CREATE INDEX "CampgroundPostComment_postId_idx" ON "CampgroundPostComment"("postId");

-- CreateIndex
CREATE INDEX "CampgroundPostComment_userId_idx" ON "CampgroundPostComment"("userId");

-- AddForeignKey
ALTER TABLE "CampgroundAdmin" ADD CONSTRAINT "CampgroundAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundAdmin" ADD CONSTRAINT "CampgroundAdmin_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPost" ADD CONSTRAINT "CampgroundPost_campgroundId_fkey" FOREIGN KEY ("campgroundId") REFERENCES "Campground"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPost" ADD CONSTRAINT "CampgroundPost_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPostLike" ADD CONSTRAINT "CampgroundPostLike_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CampgroundPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPostLike" ADD CONSTRAINT "CampgroundPostLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPostComment" ADD CONSTRAINT "CampgroundPostComment_postId_fkey" FOREIGN KEY ("postId") REFERENCES "CampgroundPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CampgroundPostComment" ADD CONSTRAINT "CampgroundPostComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
