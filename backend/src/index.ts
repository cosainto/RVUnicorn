import dotenv from 'dotenv';
dotenv.config();
console.log('🔑 JWT_SECRET loaded:', process.env.JWT_SECRET);

import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import photoRoutes from "./routes/photo.routes";
import videoRoutes from "./routes/video.routes";
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import friendshipRoutes from './routes/friendship.routes';
import recipeRoutes from './routes/recipe.routes';
import gearRoutes from './routes/gear.routes';
import travelMapRoutes from './routes/travel-map.routes';
import tripRoutes from './routes/trip.routes';
import tripCommentsRoutes from './routes/trip-comments.routes';
import tripPlannerRoutes from './routes/trip-planner.routes';
import campgroundRoutes from './routes/campground.routes';
import adminRoutes from './routes/admin.routes';
import calendarRoutes from './routes/calendar.routes';
import rvCoOwnerRoutes from './routes/rv-coowner.routes';
import campgroundFeaturesRoutes from "./routes/campground-features.routes";
import campgroundPostsRoutes from "./routes/campground-posts.routes";
import muteRoutes from "./routes/mute.routes";
import campsiteRoutes from './routes/campsite-business.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import wishlistRoutes from './routes/wishlist.routes';
import placeWishlistRoutes from './routes/place-wishlist.routes';
import campgroundActionsRoutes from "./routes/campground-actions.routes";
import mentionRoutes from './routes/mention.routes';
import roadtripRoutes from './routes/roadtrip.routes';
import savedTripsRoutes from './routes/saved-trips.routes';
import drivePlannerRoutes from './routes/drive-planner.routes';
import borrowRoutes from './routes/borrow.routes';
import stickerRoutes from './routes/sticker.routes';
import jobRoutes from './routes/job.routes';
import basecampRoutes from './routes/basecamp.routes';
import communityRoutes from './routes/community.routes';
import checkinRoutes from './routes/checkin.routes';
import photoAlbumRoutes from './routes/photo-album.routes';
import notificationRoutes from './routes/notification.routes';
import rvRoutes from './routes/rv.routes';
import rvEnhancementsRoutes from './routes/rv-enhancements.routes';
import overnightStopsRoutes from './routes/overnight-stops.routes';
import harvestHostsRoutes from './routes/harvest-hosts.routes';
import profileRoutes from './routes/profile.routes';
import uploadRoutes from './routes/upload.routes';
import profileUploadRoutes from './routes/profile-upload.routes';
import messageRoutes from './routes/message.routes';
import groupRoutes from './routes/group.routes';
import rvShowcaseRoutes from './routes/rv-showcase.routes';
import userRoutes from './routes/user.routes';
import albumRoutes from './routes/album.routes';
import path from 'path';
import threadRoutes from './routes/threads.routes';
import attractionRoutes from './routes/attractions.routes';
import gasPricesRoutes from './routes/gas-prices.routes';
import businessRoutes from "./routes/business.routes";
import tripMealRoutes from "./routes/trip-meal.routes";
import photoTagsRoutes from "./routes/photo-tags.routes";
import socialRoutes from "./routes/social.routes";
import inventoryRoutes from './routes/inventory.routes';
import tripPackingRoutes from './routes/trip-packing.routes';
import packTemplateRoutes from './routes/pack-template.routes';
import basecampActivityRoutes from './routes/basecamp-activity.routes';
import activityRoutes from "./routes/activity.routes";
import privacyRoutes from './routes/privacy.routes';
import accountRoutes from './routes/account.routes';
import badgeRoutes from './routes/badge.routes';
import topFriendsRoutes from './routes/top-friends.routes';
import creatorRoutes from './routes/creator.routes';
import basecampCreatorFeedRoutes from './routes/basecamp-creator-feed.routes';
import creatorFollowingRoutes from './routes/creator-following.routes';
import creatorDiscoveryRoutes from './routes/creator-discovery.routes';
import creatorFeatureRoutes from './routes/creator-features.routes';
import bookingClickRoutes from './routes/bookingClick.routes';
import onboardingRoutes from './routes/onboarding.routes';
import preferencesRoutes from "./routes/preferences.routes";
import personalPackRoutes from "./routes/personal-pack.routes";
import analyticsRoutes from "./routes/analytics.routes";
import momentsRoutes from "./routes/moments.routes";
import crosspostRoutes from "./routes/crosspost.routes";
import commentsRoutes from "./routes/comments.routes";
import mediaAlbumsRoutes from "./routes/media-albums.routes";
import thingsToDoRoutes from "./routes/things-to-do.routes";
import packupRoutes from "./routes/packup.routes";
import gearAdsRoutes from "./routes/gear-ads.routes";
// import enhancedDrivePlannerRoutes from './routes/enhanced-drive-planner.routes';
import weatherRoutes from './routes/weather.routes';
import hitchRoutes from './routes/hitch.routes';
import eventActivitiesRoutes from './routes/event-activities.routes';
import profileMapRoutes from './routes/profile-map.routes';
import searchRoutes from './routes/search.routes';
import hitchRemindersRoutes from './routes/hitch-reminders.routes';
import hitchJobsRoutes from './routes/hitch-jobs.routes';
import hitchChatRoutes from './routes/hitch-chat.routes';
import hitchGuidesRoutes from './routes/hitch-guides.routes';
import guideUnlocksRoutes from './routes/guide-unlocks.routes';
import campfireRoutes from './routes/campfire.routes';
import campfirePhase4Routes from './routes/campfire-phase4.routes';
import boardsRoutes from './routes/boards.routes';
import sponsorCampaignsRoutes from './routes/sponsor-campaigns.routes';
import inviteRoutes from './routes/invite.routes';
import itineraryRoutes from './routes/itinerary.routes';
import itineraryAiRoutes from './routes/itinerary-ai.routes';
import overnightSpotsRoutes from './routes/overnight-spots.routes';
import aiMaintenanceRouter from "./routes/ai-maintenance";
import { runMaintenanceCron } from "./cron/maintenance-cron";
import { registerCampfireSockets } from './campfire/campfire.socket';
import { registerTriviaCrons } from './cron/trivia-cron';


import campgroundBadgesRoutes from './routes/campground-badges.routes';
import triviaAdminRoutes from './routes/trivia-admin.routes';



export const prisma = new PrismaClient();

const app = express();
const httpServer = createServer(app);
export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: [
      'http://localhost:5173',
      'http://localhost:5174',
      'https://www.rvunicorn.com',
      'https://rvunicorn.com',
    ],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:5175',
    'https://www.rvunicorn.com',
    'https://rvunicorn.com',
    'https://ideal-renewal-production.up.railway.app'
  ],
  credentials: true
}));
app.use(express.json());

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.get('/api/version', (req, res) => res.json({ version: '2.0', timestamp: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendshipRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/travel-map', travelMapRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/rv/co-owners', rvCoOwnerRoutes);
app.use('/api/events', tripRoutes);
app.use('/api/events', tripCommentsRoutes);
app.use('/api/trip-planner', tripPlannerRoutes);
app.use('/api/campgrounds', campgroundRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campground-posts', campgroundPostsRoutes);
app.use('/api/mute', muteRoutes);
app.use("/api/campground-features", campgroundFeaturesRoutes);
app.use('/api/campsites', campsiteRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/place-wishlist', placeWishlistRoutes);
app.use("/api/campground-actions", campgroundActionsRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/stickers', stickerRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/communities', communityRoutes);
app.use('/api/checkins', checkinRoutes);
app.use('/api/photo-albums', photoAlbumRoutes);
app.use('/api/media-albums', mediaAlbumsRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/rv', rvRoutes);
app.use('/api/rv-enhancements', rvEnhancementsRoutes);
app.use('/api/overnight-stops', overnightStopsRoutes);
app.use('/api/harvest-hosts', harvestHostsRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/profile-upload', profileUploadRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/rv-showcase', rvShowcaseRoutes);
app.use('/api/users', userRoutes);
app.use('/api/albums', albumRoutes);
app.use('/api/basecamp', basecampRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/attractions', attractionRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/mentions', mentionRoutes);
app.use('/api/roadtrip', roadtripRoutes);
app.use('/api/saved-trips', savedTripsRoutes);
app.use('/api/saved-trips', savedTripsRoutes);
app.use('/api/gas-prices', gasPricesRoutes);
app.use("/api/event-meals", tripMealRoutes);
app.use("/api/drive-planner", drivePlannerRoutes);
app.use("/api/business", businessRoutes);
app.use("/api/photo-tags", photoTagsRoutes);
app.use("/api/social", socialRoutes);
app.use('/api/privacy', privacyRoutes);
app.use('/api/account', accountRoutes);
app.use('/api/badges', badgeRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/trip-packing', tripPackingRoutes);
app.use('/api/pack-templates', packTemplateRoutes);
app.use('/api/basecamp-activity', basecampActivityRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/top-friends', topFriendsRoutes);
app.use('/api/creators', creatorRoutes);
app.use('/api/basecamp', basecampCreatorFeedRoutes);
app.use('/api/creators', creatorDiscoveryRoutes);
app.use('/api/creators', creatorFollowingRoutes);
app.use('/api/creator-features', creatorFeatureRoutes);
app.use('/api/booking-clicks', bookingClickRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use("/api/preferences", preferencesRoutes);
app.use("/api/personal-pack", personalPackRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/moments", momentsRoutes);
app.use("/api/crosspost", crosspostRoutes);
app.use("/api/comments", commentsRoutes);
app.use("/api/things-to-do", thingsToDoRoutes);
app.use("/api/packup", packupRoutes);
app.use("/api/gear-ads", gearAdsRoutes);
// app.use('/api/drive-planner', enhancedDrivePlannerRoutes);
app.use('/api/weather', weatherRoutes);
app.use('/api', eventActivitiesRoutes);
app.use('/api', profileMapRoutes);
app.use('/api/hitch/reminders', hitchRemindersRoutes);
app.use('/api/hitch/jobs', hitchJobsRoutes);
app.use('/api/hitch', hitchChatRoutes);
app.use('/api/hitch', hitchRoutes);
app.use('/api/hitch', hitchGuidesRoutes);
app.use('/api/guide-unlocks', guideUnlocksRoutes);
app.use('/api/campfire', campfireRoutes);
app.use('/api/campfire-phase4', campfirePhase4Routes);
app.use('/api/boards', boardsRoutes);
app.use('/api/sponsor-campaigns', sponsorCampaignsRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/campground-badges', campgroundBadgesRoutes);
app.use('/api/trivia-admin', triviaAdminRoutes);
app.use("/api/ai-maintenance", aiMaintenanceRouter);
app.use("/api/itinerary", itineraryRoutes);
app.use("/api/itinerary-ai", itineraryAiRoutes);
app.use("/api/overnight-spots", overnightSpotsRoutes);




// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


registerCampfireSockets(io);
registerTriviaCrons(io);
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
// trigger deploy
// Force redeploy Sat Jan 17 17:17:40 CST 2026


// Nightly AI maintenance check — runs at 2am
const CRON_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(runMaintenanceCron, CRON_INTERVAL);
// Also run once 30 seconds after server start
setTimeout(runMaintenanceCron, 30000);
// force prisma regen Thu Mar 12 19:02:31 CDT 2026
// force prisma regen Thu Mar 12 19:14:38 CDT 2026
// 1773629719
