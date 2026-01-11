/*
  Warnings:

  - You are about to drop the column `email` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `facilityId` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `phone` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `priceRange` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `recAreaId` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `slug` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `website` on the `Campground` table. All the data in the column will be lost.
  - You are about to drop the column `albumId` on the `Comment` table. All the data in the column will be lost.
  - You are about to drop the column `groupId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `imageUrl` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `privacy` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Event` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `EventMeal` table. All the data in the column will be lost.
  - You are about to drop the column `description` on the `EventMeal` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `EventMeal` table. All the data in the column will be lost.
  - You are about to drop the column `friendId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `Friendship` table. All the data in the column will be lost.
  - You are about to drop the column `available` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `brand` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `condition` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `model` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `price` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `purchaseDate` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `weight` on the `GearItem` table. All the data in the column will be lost.
  - You are about to drop the column `albumId` on the `Like` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `Like` table. All the data in the column will be lost.
  - You are about to drop the column `photoId` on the `Like` table. All the data in the column will be lost.
  - You are about to drop the column `campgroundId` on the `Post` table. All the data in the column will be lost.
  - You are about to drop the column `campsiteId` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `endDate` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `startDate` on the `StateVisit` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `StateVisitAttendee` table. All the data in the column will be lost.
  - You are about to drop the column `eventId` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `Stay` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `Trip` table. All the data in the column will be lost.
  - You are about to drop the column `isAdmin` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `isModerator` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `verified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `Album` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Booking` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `CampsiteFlair` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventChecklist` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventChecklistItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventMealRsvp` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventNote` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventPackList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `EventSubevent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `FavoriteCampground` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Follow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GearBorrow` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Group` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupMember` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `GroupPost` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Job` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `JobApplication` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `MaintenanceRecord` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `ModerationAction` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackList` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PackListItem` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Photo` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `PhotoTag` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `RVShowcase` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Report` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `StateVisitAlbum` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Sticker` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SubeventAttendee` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `TripParticipant` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `WishlistItem` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[initiatorId,receiverId]` on the table `Friendship` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[postId,userId]` on the table `Like` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stateVisitId,attendeeId]` on the table `StateVisitAttendee` will be added. If there are existing duplicate values, this will fail.
  - Made the column `postId` on table `Comment` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `organizerId` to the `Event` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `EventAttendee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `scheduledAt` to the `EventMeal` table without a default value. This is not possible if the table is not empty.
  - Added the required column `initiatorId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverId` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Friendship` table without a default value. This is not possible if the table is not empty.
  - Made the column `category` on table `GearItem` required. This step will fail if there are existing NULL values in that column.
  - Made the column `postId` on table `Like` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `updatedAt` to the `RecipeRating` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `StateVisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `visitDate` to the `StateVisit` table without a default value. This is not possible if the table is not empty.
  - Added the required column `attendeeId` to the `StateVisitAttendee` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Stay` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Trip` table without a default value. This is not possible if the table is not empty.
  - Made the column `firstName` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `lastName` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Album" DROP CONSTRAINT "Album_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Album" DROP CONSTRAINT "Album_userId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "Booking" DROP CONSTRAINT "Booking_userId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteFlair" DROP CONSTRAINT "CampsiteFlair_campsiteId_fkey";

-- DropForeignKey
ALTER TABLE "CampsiteFlair" DROP CONSTRAINT "CampsiteFlair_userId_fkey";

-- DropForeignKey
ALTER TABLE "Comment" DROP CONSTRAINT "Comment_albumId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_groupId_fkey";

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventChecklist" DROP CONSTRAINT "EventChecklist_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventChecklistItem" DROP CONSTRAINT "EventChecklistItem_checklistId_fkey";

-- DropForeignKey
ALTER TABLE "EventChecklistItem" DROP CONSTRAINT "EventChecklistItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventMealRsvp" DROP CONSTRAINT "EventMealRsvp_mealId_fkey";

-- DropForeignKey
ALTER TABLE "EventMealRsvp" DROP CONSTRAINT "EventMealRsvp_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventNote" DROP CONSTRAINT "EventNote_userId_fkey";

-- DropForeignKey
ALTER TABLE "EventPackList" DROP CONSTRAINT "EventPackList_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventPackList" DROP CONSTRAINT "EventPackList_packListId_fkey";

-- DropForeignKey
ALTER TABLE "EventSubevent" DROP CONSTRAINT "EventSubevent_createdById_fkey";

-- DropForeignKey
ALTER TABLE "EventSubevent" DROP CONSTRAINT "EventSubevent_eventId_fkey";

-- DropForeignKey
ALTER TABLE "EventSubevent" DROP CONSTRAINT "EventSubevent_hostId_fkey";

-- DropForeignKey
ALTER TABLE "EventSubevent" DROP CONSTRAINT "EventSubevent_userId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteCampground" DROP CONSTRAINT "FavoriteCampground_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "FavoriteCampground" DROP CONSTRAINT "FavoriteCampground_userId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followerId_fkey";

-- DropForeignKey
ALTER TABLE "Follow" DROP CONSTRAINT "Follow_followingId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_friendId_fkey";

-- DropForeignKey
ALTER TABLE "Friendship" DROP CONSTRAINT "Friendship_userId_fkey";

-- DropForeignKey
ALTER TABLE "GearBorrow" DROP CONSTRAINT "GearBorrow_borrowerId_fkey";

-- DropForeignKey
ALTER TABLE "GearBorrow" DROP CONSTRAINT "GearBorrow_gearItemId_fkey";

-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_createdById_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupMember" DROP CONSTRAINT "GroupMember_userId_fkey";

-- DropForeignKey
ALTER TABLE "GroupPost" DROP CONSTRAINT "GroupPost_groupId_fkey";

-- DropForeignKey
ALTER TABLE "GroupPost" DROP CONSTRAINT "GroupPost_userId_fkey";

-- DropForeignKey
ALTER TABLE "Job" DROP CONSTRAINT "Job_userId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_jobId_fkey";

-- DropForeignKey
ALTER TABLE "JobApplication" DROP CONSTRAINT "JobApplication_userId_fkey";

-- DropForeignKey
ALTER TABLE "Like" DROP CONSTRAINT "Like_albumId_fkey";

-- DropForeignKey
ALTER TABLE "Like" DROP CONSTRAINT "Like_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Like" DROP CONSTRAINT "Like_photoId_fkey";

-- DropForeignKey
ALTER TABLE "MaintenanceRecord" DROP CONSTRAINT "MaintenanceRecord_userId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_receiverId_fkey";

-- DropForeignKey
ALTER TABLE "Message" DROP CONSTRAINT "Message_senderId_fkey";

-- DropForeignKey
ALTER TABLE "ModerationAction" DROP CONSTRAINT "ModerationAction_moderatorId_fkey";

-- DropForeignKey
ALTER TABLE "PackList" DROP CONSTRAINT "PackList_userId_fkey";

-- DropForeignKey
ALTER TABLE "PackListItem" DROP CONSTRAINT "PackListItem_packListId_fkey";

-- DropForeignKey
ALTER TABLE "PackListItem" DROP CONSTRAINT "PackListItem_userId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_albumId_fkey";

-- DropForeignKey
ALTER TABLE "Photo" DROP CONSTRAINT "Photo_userId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoTag" DROP CONSTRAINT "PhotoTag_photoId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoTag" DROP CONSTRAINT "PhotoTag_userId_fkey";

-- DropForeignKey
ALTER TABLE "Post" DROP CONSTRAINT "Post_campgroundId_fkey";

-- DropForeignKey
ALTER TABLE "RVShowcase" DROP CONSTRAINT "RVShowcase_userId_fkey";

-- DropForeignKey
ALTER TABLE "Report" DROP CONSTRAINT "Report_reporterId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisit" DROP CONSTRAINT "StateVisit_campsiteId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisit" DROP CONSTRAINT "StateVisit_eventId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisitAlbum" DROP CONSTRAINT "StateVisitAlbum_albumId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisitAlbum" DROP CONSTRAINT "StateVisitAlbum_stateVisitId_fkey";

-- DropForeignKey
ALTER TABLE "StateVisitAttendee" DROP CONSTRAINT "StateVisitAttendee_userId_fkey";

-- DropForeignKey
ALTER TABLE "Stay" DROP CONSTRAINT "Stay_eventId_fkey";

-- DropForeignKey
ALTER TABLE "Sticker" DROP CONSTRAINT "Sticker_userId_fkey";

-- DropForeignKey
ALTER TABLE "SubeventAttendee" DROP CONSTRAINT "SubeventAttendee_subeventId_fkey";

-- DropForeignKey
ALTER TABLE "SubeventAttendee" DROP CONSTRAINT "SubeventAttendee_userId_fkey";

-- DropForeignKey
ALTER TABLE "TripParticipant" DROP CONSTRAINT "TripParticipant_tripId_fkey";

-- DropForeignKey
ALTER TABLE "TripParticipant" DROP CONSTRAINT "TripParticipant_userId_fkey";

-- DropForeignKey
ALTER TABLE "WishlistItem" DROP CONSTRAINT "WishlistItem_userId_fkey";

-- DropIndex
DROP INDEX "Campground_facilityId_idx";

-- DropIndex
DROP INDEX "Campground_recAreaId_idx";

-- DropIndex
DROP INDEX "Campground_slug_idx";

-- DropIndex
DROP INDEX "Campground_slug_key";

-- DropIndex
DROP INDEX "Comment_albumId_idx";

-- DropIndex
DROP INDEX "Event_groupId_idx";

-- DropIndex
DROP INDEX "Event_userId_idx";

-- DropIndex
DROP INDEX "EventMeal_date_idx";

-- DropIndex
DROP INDEX "Friendship_friendId_idx";

-- DropIndex
DROP INDEX "Friendship_userId_friendId_key";

-- DropIndex
DROP INDEX "Friendship_userId_idx";

-- DropIndex
DROP INDEX "Like_eventId_idx";

-- DropIndex
DROP INDEX "Like_userId_albumId_key";

-- DropIndex
DROP INDEX "Like_userId_eventId_key";

-- DropIndex
DROP INDEX "Like_userId_photoId_key";

-- DropIndex
DROP INDEX "Like_userId_postId_key";

-- DropIndex
DROP INDEX "Post_campgroundId_idx";

-- DropIndex
DROP INDEX "StateVisit_campsiteId_idx";

-- DropIndex
DROP INDEX "StateVisit_eventId_idx";

-- DropIndex
DROP INDEX "StateVisitAttendee_stateVisitId_userId_key";

-- DropIndex
DROP INDEX "StateVisitAttendee_userId_idx";

-- DropIndex
DROP INDEX "Stay_eventId_idx";

-- AlterTable
ALTER TABLE "Campground" DROP COLUMN "email",
DROP COLUMN "facilityId",
DROP COLUMN "imageUrl",
DROP COLUMN "phone",
DROP COLUMN "priceRange",
DROP COLUMN "recAreaId",
DROP COLUMN "slug",
DROP COLUMN "website";

-- AlterTable
ALTER TABLE "Comment" DROP COLUMN "albumId",
ALTER COLUMN "postId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "groupId",
DROP COLUMN "imageUrl",
DROP COLUMN "privacy",
DROP COLUMN "userId",
ADD COLUMN     "organizerId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "EventAttendee" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "EventMeal" DROP COLUMN "date",
DROP COLUMN "description",
DROP COLUMN "title",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "scheduledAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Friendship" DROP COLUMN "friendId",
DROP COLUMN "userId",
ADD COLUMN     "initiatorId" TEXT NOT NULL,
ADD COLUMN     "receiverId" TEXT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "GearItem" DROP COLUMN "available",
DROP COLUMN "brand",
DROP COLUMN "condition",
DROP COLUMN "model",
DROP COLUMN "price",
DROP COLUMN "purchaseDate",
DROP COLUMN "weight",
ALTER COLUMN "category" SET NOT NULL;

-- AlterTable
ALTER TABLE "Like" DROP COLUMN "albumId",
DROP COLUMN "eventId",
DROP COLUMN "photoId",
ALTER COLUMN "postId" SET NOT NULL;

-- AlterTable
ALTER TABLE "Post" DROP COLUMN "campgroundId";

-- AlterTable
ALTER TABLE "RecipeRating" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "StateVisit" DROP COLUMN "campsiteId",
DROP COLUMN "endDate",
DROP COLUMN "eventId",
DROP COLUMN "startDate",
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "visitDate" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "StateVisitAttendee" DROP COLUMN "userId",
ADD COLUMN     "attendeeId" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Stay" DROP COLUMN "eventId",
DROP COLUMN "verified",
ADD COLUMN     "tripId" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Trip" DROP COLUMN "status",
DROP COLUMN "title",
ADD COLUMN     "name" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "User" DROP COLUMN "isAdmin",
DROP COLUMN "isModerator",
DROP COLUMN "verified",
ALTER COLUMN "firstName" SET NOT NULL,
ALTER COLUMN "lastName" SET NOT NULL;

-- DropTable
DROP TABLE "Album";

-- DropTable
DROP TABLE "Booking";

-- DropTable
DROP TABLE "CampsiteFlair";

-- DropTable
DROP TABLE "EventChecklist";

-- DropTable
DROP TABLE "EventChecklistItem";

-- DropTable
DROP TABLE "EventMealRsvp";

-- DropTable
DROP TABLE "EventNote";

-- DropTable
DROP TABLE "EventPackList";

-- DropTable
DROP TABLE "EventSubevent";

-- DropTable
DROP TABLE "FavoriteCampground";

-- DropTable
DROP TABLE "Follow";

-- DropTable
DROP TABLE "GearBorrow";

-- DropTable
DROP TABLE "Group";

-- DropTable
DROP TABLE "GroupMember";

-- DropTable
DROP TABLE "GroupPost";

-- DropTable
DROP TABLE "Job";

-- DropTable
DROP TABLE "JobApplication";

-- DropTable
DROP TABLE "MaintenanceRecord";

-- DropTable
DROP TABLE "Message";

-- DropTable
DROP TABLE "ModerationAction";

-- DropTable
DROP TABLE "PackList";

-- DropTable
DROP TABLE "PackListItem";

-- DropTable
DROP TABLE "Photo";

-- DropTable
DROP TABLE "PhotoTag";

-- DropTable
DROP TABLE "RVShowcase";

-- DropTable
DROP TABLE "Report";

-- DropTable
DROP TABLE "StateVisitAlbum";

-- DropTable
DROP TABLE "Sticker";

-- DropTable
DROP TABLE "SubeventAttendee";

-- DropTable
DROP TABLE "TripParticipant";

-- DropTable
DROP TABLE "WishlistItem";

-- CreateIndex
CREATE INDEX "Campground_name_idx" ON "Campground"("name");

-- CreateIndex
CREATE INDEX "Event_organizerId_idx" ON "Event"("organizerId");

-- CreateIndex
CREATE INDEX "EventMeal_recipeId_idx" ON "EventMeal"("recipeId");

-- CreateIndex
CREATE INDEX "Friendship_initiatorId_idx" ON "Friendship"("initiatorId");

-- CreateIndex
CREATE INDEX "Friendship_receiverId_idx" ON "Friendship"("receiverId");

-- CreateIndex
CREATE INDEX "Friendship_status_idx" ON "Friendship"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Friendship_initiatorId_receiverId_key" ON "Friendship"("initiatorId", "receiverId");

-- CreateIndex
CREATE INDEX "Like_postId_idx" ON "Like"("postId");

-- CreateIndex
CREATE INDEX "Like_userId_idx" ON "Like"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Like_postId_userId_key" ON "Like"("postId", "userId");

-- CreateIndex
CREATE INDEX "StateVisit_visitDate_idx" ON "StateVisit"("visitDate");

-- CreateIndex
CREATE INDEX "StateVisitAttendee_attendeeId_idx" ON "StateVisitAttendee"("attendeeId");

-- CreateIndex
CREATE UNIQUE INDEX "StateVisitAttendee_stateVisitId_attendeeId_key" ON "StateVisitAttendee"("stateVisitId", "attendeeId");

-- CreateIndex
CREATE INDEX "Stay_tripId_idx" ON "Stay"("tripId");

-- CreateIndex
CREATE INDEX "Stay_startDate_idx" ON "Stay"("startDate");

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Stay" ADD CONSTRAINT "Stay_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StateVisitAttendee" ADD CONSTRAINT "StateVisitAttendee_attendeeId_fkey" FOREIGN KEY ("attendeeId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
