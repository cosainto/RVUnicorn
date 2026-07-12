import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import compression from 'compression';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import { prisma } from './lib/prisma';
import photoRoutes from "./routes/photo.routes";
import videoRoutes from "./routes/video.routes";
import authRoutes from './routes/auth.routes';
import postRoutes from './routes/post.routes';
import friendshipRoutes from './routes/friendship.routes';
import recipeRoutes from './routes/recipe.routes';
import gearRoutes from './routes/gear.routes';
import travelMapRoutes from './routes/travel-map.routes';
import tripRoutes from './routes/trip.routes';
import workBlocksRoutes from './routes/work-blocks.routes';
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
import supplyRoutes from './routes/supply.routes';
import householdRoutes from './routes/household.routes';
import emergencyContactRoutes from './routes/emergency-contacts.routes';
import borrowRoutes from './routes/borrow.routes';
import stickerRoutes from './routes/sticker.routes';
import jobRoutes from './routes/job.routes';
import basecampRoutes from './routes/basecamp.routes';
import basecampDashboardRoutes from './routes/basecamp-dashboard.routes';
import basecampV2Routes from './routes/basecamp-v2.routes';
import communityFeedRoutes from './routes/community-feed.routes';
import locationDetailRoutes from './routes/locationDetail.routes';
import passengerRoutes from './routes/passenger.routes';
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
import enhancedDrivePlannerRoutes from './routes/enhanced-drive-planner.routes';
import weatherRoutes from './routes/weather.routes';
import hitchRoutes from './routes/hitch.routes';
import eventActivitiesRoutes from './routes/event-activities.routes';
import profileMapRoutes from './routes/profile-map.routes';
import searchRoutes from './routes/search.routes';
import hitchRemindersRoutes from './routes/hitch-reminders.routes';
import experiencesRoutes from './routes/experiences.routes';
import rigHubRoutes from './routes/rig-hub.routes';
import rigScrapbookRoutes from './routes/rig-scrapbook.routes';
import hitchJobsRoutes from './routes/hitch-jobs.routes';
import hitchChatRoutes from './routes/hitch-chat.routes';
import hitchGuidesRoutes from './routes/hitch-guides.routes';
import guideUnlocksRoutes from './routes/guide-unlocks.routes';
import campfireRoutes from './routes/campfire.routes';
import campfirePhase4Routes from './routes/campfire-phase4.routes';
import boardsRoutes from './routes/boards.routes';
import wildlifeRoutes from './routes/wildlife.routes';
import sponsorCampaignsRoutes from './routes/sponsor-campaigns.routes';
import inviteRoutes from './routes/invite.routes';
import itineraryRoutes from './routes/itinerary.routes';
import itineraryAiRoutes from './routes/itinerary-ai.routes';
import overnightSpotsRoutes from './routes/overnight-spots.routes';
import campMarketRoutes from './routes/camp-market.routes';
import rigConnectionRoutes from './routes/rig-connection.routes';
import rigRoutes from './routes/rig.routes';
import modMarketplaceRoutes from './routes/mod-marketplace.routes';
import campfireTipsRoutes from './routes/campfire-tips.routes';
import feedControlsRoutes from './routes/feed-controls.routes';
import activityRailRoutes from './routes/activity-rail.routes';
import lastMinuteRoutes from './routes/last-minute.routes';
import welcomeKitRoutes from './routes/welcome-kit.routes';
import eventsV2Routes from './routes/events-v2.routes';
import eventOrganizerRoutes from './routes/event-organizer.routes';
import quizRoutes from './routes/quiz.routes';
import aiMaintenanceRouter from "./routes/ai-maintenance";
import { runMaintenanceCron } from "./cron/maintenance-cron";
import { updateGasPrices } from "./cron/gas-price-cron";
import { registerCampfireSockets } from './campfire/campfire.socket';
import { registerOrganizerSockets } from './campfire/organizer.socket';
import pushRoutes from './routes/push.routes';
import { runRoadChatCleanup } from './cron/road-chat-cleanup.cron';
import { runCampfireCleanup } from './cron/campfire-cleanup.cron';
import { registerRoadChatSockets } from './campfire/road-chat.socket';
import { registerTriviaCrons } from './cron/trivia-cron';
import { registerEventSockets } from './campfire/events.socket';
import { runAutopilotCycle, checkEventMemoryTransitions } from './services/autopilotService';
import { runStaySurveyPromptCron } from './cron/stay-survey-prompt.cron';
import { runPostCheckoutPhotoReminderCron } from './cron/post-checkout-photo-reminder.cron';
import { runCheckInInviteExpireCron } from './cron/checkin-invite-expire.cron';
import { runExperienceReviewNudgeCron } from './cron/experience-review-nudge.cron';
import campfireThreadAdminRoutes from './routes/campfireThreadAdmin.routes';
import { registerCampfireThreadCrons } from './cron/campfire-thread.cron';
import organizerDashboardRoutes from './routes/organizerDashboard.routes';
import { registerBroadcastCron } from './cron/broadcast.cron';
import { runDuplicateRigDetection } from './cron/duplicate-rig-detection.cron';
import tripKitRoutes from './routes/tripKit.routes';
import creatorEventsRoutes from './routes/creatorEvents.routes';
import { registerCreatorNetworkCrons } from './cron/creatorNetwork.cron';
import { registerScrapbookAnniversaryCron } from './cron/scrapbook-anniversary.cron';
import scrapbookAdvancedRoutes from './routes/scrapbookAdvanced.routes';
import tripConfidenceRoutes from './routes/tripConfidence.routes';
import tripIntelligenceRoutes from './routes/tripIntelligence.routes';
import routeCoPilotRoutes from './routes/routeCoPilot.routes';
import { registerCoPilotSockets } from './campfire/copilot.socket';
import { registerConfidenceCron } from './cron/tripConfidence.cron';
import { registerUtilityScoreCron } from './cron/utility-score.cron';
import { registerContributionScoreCron } from './cron/contributionScore.cron';
import { registerEmailCampaignCrons } from './cron/email-campaigns.cron';
import { registerEmailDigestCrons } from './cron/email-digest.cron';
import { registerWishlistNotificationCron } from './cron/wishlist-notification.cron';
import { runAutoCheckoutCron } from './cron/auto-checkout.cron';
import { registerBanterScheduler } from './services/banter/banterScheduler';
import doThisHereRoutes from './routes/doThisHere.routes';
import emailRoutes from './routes/email.routes';


import campgroundBadgesRoutes from './routes/campground-badges.routes';
import triviaAdminRoutes from './routes/trivia-admin.routes';
import roadTripsRoutes from './routes/road-trips.routes';
import tripSubeventsRoutes from './routes/trip-subevents.routes';
import ssrRoutes from './routes/ssr';
import waitlistRoutes from './routes/waitlist.routes';
import companionRoutes from './routes/companion.routes';
import adminAnalyticsRoutes from './routes/admin-analytics.routes';
import communityAIRoutes, { weeklyPromptCron, boardRevivalCron } from './routes/communityAI.routes';
import onboardingV2Routes from './routes/onboarding-v2.routes';
import tripPublicRoutes from './routes/trip-public.routes';
import jobIntegrationRoutes from './routes/job-integrations.routes';
import sharingRoutes, { checkSharedFire } from './routes/sharing.routes';
import publicRoutes from './routes/public.routes';
import stripeRoutes from './routes/stripe.routes';
import express_raw from 'express';
import oauthRoutes from './routes/oauth.routes';
import localBusinessRoutes from './routes/local-business.routes';
import dealerRoutes from './routes/dealer.routes';
import smartTripAssistantRoutes from './routes/smart-trip-assistant.routes';
import passport from 'passport';



export { prisma };

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
app.use(compression());
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
app.use(express.json({
  limit: '2mb',
  // Stash raw bytes so the Stripe webhook handler can verify signatures.
  // Stripe's constructEvent() requires the original payload, but the global
  // json parser would otherwise replace req.body with a parsed object.
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Serve uploaded files with caching headers
app.use('/uploads', express.static(path.join(__dirname, '../uploads'), {
  maxAge: '7d',
  immutable: true,
}));

// Public routes (no auth required)
app.use('/api/waitlist', waitlistRoutes);
app.use('/api/chat', companionRoutes);
app.use('/api/admin/analytics', adminAnalyticsRoutes);
app.use('/api/community', communityAIRoutes);
app.use('/api/onboarding', onboardingV2Routes);
app.use('/api/trips', tripPublicRoutes);
app.use('/api/jobs', jobIntegrationRoutes);
app.use('/api/sharing', sharingRoutes);
app.use('/api/public', publicRoutes);
// Stripe webhook needs raw body — mount before json parser doesn't work since json is global
// Instead, the stripe route handles raw body internally via express.raw
app.use('/api/stripe', stripeRoutes);
app.use(passport.initialize());
app.use('/api', oauthRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/rigs', rigRoutes);
app.use('/api/mods', modMarketplaceRoutes);

// Routes
app.get('/api/version', (req, res) => res.json({ version: '2.0', timestamp: Date.now() }));
app.use('/api/auth', authRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/friends', friendshipRoutes);
app.use('/api/recipes', recipeRoutes);
app.use('/api/gear', gearRoutes);
app.use('/api/travel-map', travelMapRoutes);
app.use('/api/trips', tripRoutes);
app.use('/api/events', workBlocksRoutes);
app.use('/api/calendar', calendarRoutes);
app.use('/api/rv/co-owners', rvCoOwnerRoutes);
app.use('/api/events', tripRoutes);
app.use('/api/events', tripCommentsRoutes);
app.use('/api/trip-planner', tripPlannerRoutes);
app.use("/api/campground-features", campgroundFeaturesRoutes);
app.use("/api/campgrounds", campgroundFeaturesRoutes); // reviews, photos, events, announcements under /api/campgrounds
app.use('/api/campgrounds', campgroundRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/campground-posts', campgroundPostsRoutes);
app.use('/api/mute', muteRoutes);
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
app.use('/api/basecamp/mc', basecampDashboardRoutes);
app.use('/api/basecamp/v2', basecampV2Routes);
app.use('/api/community', communityFeedRoutes);
app.use('/api/locations', locationDetailRoutes);
app.use('/api/passenger', passengerRoutes);
app.use('/api/threads', threadRoutes);
app.use('/api/attractions', attractionRoutes);
app.use('/api/photos', photoRoutes);
app.use('/api/mentions', mentionRoutes);
app.use('/api/roadtrip', roadtripRoutes);
app.use('/api/saved-trips', savedTripsRoutes);
app.use('/api/gas-prices', gasPricesRoutes);
app.use("/api/event-meals", tripMealRoutes);
app.use("/api/drive-planner", drivePlannerRoutes);
app.use("/api/supply", supplyRoutes);
import scrapbookRoutes from "./routes/scrapbook.routes";
app.use("/api/scrapbook", scrapbookRoutes);
app.use("/api/scrapbook", scrapbookAdvancedRoutes);
import tripStoryRoutes from './routes/trip-story.routes';
app.use("/api/trip-story", tripStoryRoutes);
app.use("/api/household", householdRoutes);
app.use("/api/emergency-contacts", emergencyContactRoutes);
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
app.use('/api/drive-planner', enhancedDrivePlannerRoutes);
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
app.use('/api/wildlife', wildlifeRoutes);
app.use('/api/sponsor-campaigns', sponsorCampaignsRoutes);
app.use('/api/invites', inviteRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/campground-badges', campgroundBadgesRoutes);
app.use('/api/trivia-admin', triviaAdminRoutes);
app.use("/api/ai-maintenance", aiMaintenanceRouter);
app.use("/api/itinerary", itineraryRoutes);
app.use("/api/itinerary-ai", itineraryAiRoutes);
app.use("/api/overnight-spots", overnightSpotsRoutes);
app.use("/api/camp-market", campMarketRoutes);
app.use("/api/rig-connection", rigConnectionRoutes);
app.use("/api/campfire-tips", campfireTipsRoutes);
app.use("/api/feed", feedControlsRoutes);
app.use('/api/map/activity-rail', activityRailRoutes);
app.use("/api/last-minute", lastMinuteRoutes);
app.use("/api/welcome-kit", welcomeKitRoutes);
app.use("/api/events-v2", eventsV2Routes);
app.use("/api/events-v2", eventOrganizerRoutes);
app.use("/api/road-trips", roadTripsRoutes);
app.use("/api/events/:eventId/subevents", tripSubeventsRoutes);
app.use("/api/local-business", localBusinessRoutes);
app.use("/api/dealers", dealerRoutes);
app.use("/api/admin/campfire-threads", campfireThreadAdminRoutes);
app.use("/api/organizer", organizerDashboardRoutes);
app.use("/api/trip-confidence", tripConfidenceRoutes);
app.use("/api/trip-intelligence", tripIntelligenceRoutes);
app.use("/api/route-copilot", routeCoPilotRoutes);
app.use("/api/trip-kits", tripKitRoutes);
app.use("/api/creator-events", creatorEventsRoutes);
app.use("/api/actionable", doThisHereRoutes);
app.use("/api/email-preferences", emailRoutes);
app.use("/api/experiences", experiencesRoutes);
app.use("/api/rigs", rigHubRoutes);
app.use("/api/rigs", rigScrapbookRoutes);
app.use("/api/smart-trip", smartTripAssistantRoutes);
app.use("/api", emailRoutes);




// SSR routes — serve pre-rendered HTML for crawlers and direct page loads
app.use(ssrRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});


registerCampfireSockets(io);
registerEventSockets(io);
registerOrganizerSockets(io);
// Road chat cleanup — run every hour
setInterval(runRoadChatCleanup, 60 * 60 * 1000);
runRoadChatCleanup();
// Campfire chat cleanup — delete messages older than 24h, run every hour
setInterval(runCampfireCleanup, 60 * 60 * 1000);
runCampfireCleanup();
registerRoadChatSockets(io);
registerCoPilotSockets(io);
registerTriviaCrons(io);
registerCampfireThreadCrons();
registerBroadcastCron();
registerConfidenceCron();
registerCreatorNetworkCrons();
registerScrapbookAnniversaryCron();
registerUtilityScoreCron();
registerContributionScoreCron();
registerEmailCampaignCrons();
registerEmailDigestCrons();
registerWishlistNotificationCron();
registerBanterScheduler(io);
httpServer.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  // FRONTEND_URL is logged once at module load by utils/frontendUrl.ts; the
  // line above this used to log a different value than what was actually used
  // because each route file resolved it independently. See utils/frontendUrl.ts.
  console.log(`GOOGLE_CLIENT_ID: ${process.env.GOOGLE_CLIENT_ID ? 'SET' : 'NOT SET'}`);
});
// trigger deploy
// Force redeploy Sat Jan 17 17:17:40 CST 2026


// Nightly AI maintenance check — runs at 2am
const CRON_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours
setInterval(runMaintenanceCron, CRON_INTERVAL);
// Also run once 30 seconds after server start
setTimeout(runMaintenanceCron, 30000);

// Gas price cron — runs on startup + every 7 days
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
updateGasPrices(); // run immediately on startup
setInterval(updateGasPrices, SEVEN_DAYS_MS);
// Co-Host Autopilot — runs every 5 min for live events
setInterval(() => runAutopilotCycle().catch(e => console.error('[Autopilot]', e)), 5 * 60 * 1000);
// Trip Memory transitions — runs hourly
setInterval(() => checkEventMemoryTransitions().catch(e => console.error('[TripMemory]', e)), 60 * 60 * 1000);
// Hitch's 24h post-trip survey nudge — runs hourly. Sends a friendly
// "how was your stay?" notification to attendees of trips that ended
// 24-96h ago, if they haven't already left a CampgroundReview.
setInterval(() => runStaySurveyPromptCron().catch(e => console.error('[StaySurveyPrompt]', e)), 60 * 60 * 1000);
setInterval(() => runPostCheckoutPhotoReminderCron().catch(e => console.error('[PostCheckoutPhotoReminder]', e)), 60 * 60 * 1000);
setInterval(() => runCheckInInviteExpireCron().catch(e => console.error('[CheckInInviteExpire]', e)), 15 * 60 * 1000);
setInterval(() => runExperienceReviewNudgeCron().catch(e => console.error('[ExperienceReviewNudge]', e)), 30 * 60 * 1000);
// Auto-checkout stale check-ins — runs hourly, gates internally to 3 AM CT
setInterval(() => runAutoCheckoutCron().catch(e => console.error('[AutoCheckout]', e)), 60 * 60 * 1000);
// Duplicate rig detection — runs hourly, gates internally to 2 AM CT
setInterval(() => runDuplicateRigDetection().catch(e => console.error('[DuplicateRig]', e)), 60 * 60 * 1000);
// Community AI crons — check hourly, fire at specific times
setInterval(() => {
  const now = new Date();
  const hourUTC = now.getUTCHours();
  // Weekly prompt: Monday 9am CT (14:00 UTC)
  if (now.getDay() === 1 && hourUTC === 14) {
    weeklyPromptCron().catch(e => console.error('[CommunityAI Weekly]', e));
  }
  // Board revival: Wednesday only at 10am CT (15:00 UTC) — was daily, throttled to reduce system noise
  if (now.getDay() === 3 && hourUTC === 15) {
    boardRevivalCron().catch(e => console.error('[CommunityAI Revival]', e));
  }
}, 60 * 60 * 1000);

// Graceful shutdown — release Prisma connection pool
process.on('SIGINT', async () => {
  await prisma.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  process.exit(0);
});
