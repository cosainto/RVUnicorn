-- CreateTable
CREATE TABLE "RVShowcase" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "privacy" TEXT NOT NULL DEFAULT 'PUBLIC',
    "photos" TEXT[],
    "videoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RVShowcase_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RVShowcase_userId_key" ON "RVShowcase"("userId");

-- CreateIndex
CREATE INDEX "RVShowcase_userId_idx" ON "RVShowcase"("userId");

-- AddForeignKey
ALTER TABLE "RVShowcase" ADD CONSTRAINT "RVShowcase_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
