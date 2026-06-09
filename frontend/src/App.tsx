import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { useState, useEffect, Suspense, lazy } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DrivingSessionProvider } from './contexts/DrivingSessionContext';
import DriveCompanionWidget from './components/DriveCompanionWidget';
import ToastProvider from './components/ToastProvider';
import Navbar from './components/Navbar';
import GuideUnlockToast from './components/GuideUnlockToast';
import HitchFloatingChat from './components/HitchFloatingChat';
import MobileBottomNav from './components/MobileBottomNav';

// Retry lazy imports — handles stale chunks after deploys
function lazyRetry(importFn: () => Promise<any>) {
  return lazy(() => importFn().catch(() => {
    // Chunk failed to load (likely new deploy) — reload once
    const reloaded = sessionStorage.getItem('chunk_reload');
    if (!reloaded) {
      sessionStorage.setItem('chunk_reload', '1');
      window.location.reload();
    }
    return importFn();
  }));
}

// Onboarding trigger — shows modal for new users
function OnboardingTrigger() {
  const OnboardingModalV2 = lazy(() => import('./components/OnboardingModalV2'));
  const { user } = useAuth();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!user) return;
    // Check if user needs onboarding
    if (!(user as any).onboardingCompletedAt && !(user as any).onboardingSkippedAt && !(user as any).onboardingCompleted) {
      setShow(true);
    }
  }, [user]);

  if (!show || !user) return null;

  return (
    <Suspense fallback={null}>
      <OnboardingModalV2 onComplete={() => setShow(false)} displayName={(user as any).firstName || 'friend'} />
    </Suspense>
  );
}
import BookingFollowUpNotification from './components/BookingFollowUpNotification';
import React from 'react';
import { Camera } from 'lucide-react';

// Lazy-loaded page components — each becomes its own chunk
const FeedPage = lazy(() => import('./pages/FeedPage'));
const ThreadDetailPage = lazy(() => import('./pages/ThreadDetailPage'));
const TripCalendarWidget = lazy(() => import('./components/TripCalendarWidget'));
const RVOnboardingFlow = lazy(() => import('./components/RVOnboardingFlow'));
const TripStoryPage = lazy(() => import('./pages/TripStoryPage'));
const NotificationCenterPage = lazy(() => import('./pages/NotificationCenterPage'));
const HitchOnboarding = lazy(() => import('./components/HitchOnboarding'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const PublicTripPage = lazy(() => import('./pages/public/PublicTripPage'));
const PublicProfilePage = lazy(() => import('./pages/public/PublicProfilePage'));
const PublicPostPage = lazy(() => import('./pages/public/PublicPostPage'));
const PublicBoardThread = lazy(() => import('./pages/public/PublicBoardThread'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const ProfileTripsPage = lazy(() => import('./pages/profile/ProfileTripsPage'));
const ProfileCampgroundsPage = lazy(() => import('./pages/profile/ProfileCampgroundsPage'));
const ProfileFriendsPage = lazy(() => import('./pages/profile/ProfileFriendsPage'));
const RigProfilePage = lazy(() => import('./pages/rig/RigProfilePage'));
const RigEditPage = lazy(() => import('./pages/rig/edit/RigEditPage'));
const UserRecipesPage = lazy(() => import('./pages/UserRecipesPage'));
const UserGearPage = lazy(() => import('./pages/UserGearPage'));
const RigMemoryPage = lazy(() => import('./pages/RigMemoryPage'));
const TripsPage = lazy(() => import('./pages/TripsPage'));
const MyRVPage = lazy(() => import('./pages/MyRVPage'));
const TripEditPage = lazy(() => import('./pages/TripEditPage'));
const TripDetailPage = lazy(() => import('./pages/TripDetailPage'));
const RoadTripsPage = lazy(() => import('./pages/RoadTripsPage'));
const RoadTripDetailPage = lazy(() => import('./pages/RoadTripDetailPage'));
const CampgroundsPage = lazy(() => import('./pages/CampgroundsPage'));
const ExperiencePage = lazy(() => import('./pages/ExperiencePage'));
const AlbumsPage = lazy(() => import('./pages/AlbumsPage'));
const AlbumDetailPage = lazy(() => import('./pages/AlbumDetailPage'));
const RecipesPage = lazy(() => import('./pages/RecipesPage'));
const RecipeDetailPage = lazy(() => import('./pages/RecipeDetailPage'));
const TravelMapPage = lazy(() => import('./pages/TravelMapPage'));
const GearPackingPage = lazy(() => import('./pages/GearPackingPage'));
const FriendsPage = lazy(() => import('./pages/FriendsPage'));
const HashtagPage = lazy(() => import('./pages/HashtagPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage'));
const JobBoardPage = lazy(() => import('./pages/JobBoardPage'));
const ExplorePage = lazy(() => import('./pages/ExplorePage'));
const MapViewPage = lazy(() => import('./pages/MapViewPage'));
const GroupsPage = lazy(() => import('./pages/GroupsPage'));
const GroupDetailPage = lazy(() => import('./pages/GroupDetailPage'));
const GroupEditPage = lazy(() => import('./pages/GroupEditPage'));
const GroupInvitesPage = lazy(() => import('./pages/GroupInvitesPage'));
const CampgroundDetailPage = lazy(() => import('./pages/CampgroundDetailPage'));
const HostDetailPage = lazy(() => import('./pages/HostDetailPage'));
const OvernightSpotDetailPage = lazy(() => import('./pages/OvernightSpotDetailPage'));
const CreateHostPage = lazy(() => import('./pages/CreateHostPage'));
const HitchAIPage = lazy(() => import('./pages/HitchAIPage'));
const CreatorPage = lazy(() => import('./pages/CreatorPage'));
const CreatorLeaderboardPage = lazy(() => import('./pages/CreatorLeaderboardPage'));
const ModMarketplacePage = lazy(() => import('./pages/ModMarketplacePage'));
const CreatorDashboardPage = lazy(() => import('./pages/CreatorDashboardPage'));
const CreatorContentEditorPage = lazy(() => import('./pages/CreatorContentEditorPage'));
const BasecampPage = lazy(() => import('./pages/BasecampPage'));
const CommunityPage = lazy(() => import('./pages/CommunityPage'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
const BusinessBasecampPage = lazy(() => import('./pages/BusinessBasecampPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const EnhancedDrivePlanner = lazy(() => import('./components/EnhancedDrivePlanner'));
const PrivacySettingsPage = lazy(() => import('./pages/PrivacySettingsPage'));
const HouseholdSettingsPage = lazy(() => import('./pages/HouseholdSettingsPage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('./pages/TermsPage'));
const SMSTermsPage = lazy(() => import('./pages/SMSTermsPage'));
const BlockedUsersPage = lazy(() => import('./pages/BlockedUsersPage'));
const MutedSettingsPage = lazy(() => import('./pages/MutedSettingsPage'));
const AccountActivityLogPage = lazy(() => import('./pages/AccountActivityLogPage'));
const AccountDeletionPage = lazy(() => import('./pages/AccountDeletionPage'));
const BadgesPage = lazy(() => import('./pages/BadgesPage'));
const VideoPlayerPage = lazy(() => import('./pages/VideoPlayerPage'));
const MediaAlbumsPage = lazy(() => import('./pages/MediaAlbumsPage'));
const MediaAlbumDetailPage = lazy(() => import('./pages/MediaAlbumDetailPage'));
const QuickCaptureModal = lazy(() => import('./components/QuickCaptureModal'));
const SearchPage = lazy(() => import('./pages/SearchPage'));
const ItineraryPage = lazy(() => import('./pages/ItineraryPage'));
const AdminBadgeApprovalPage = lazy(() => import('./components/AdminBadgeApproval'));
const AdminCampgroundsPage = lazy(() => import('./pages/AdminCampgroundsPage'));
const AdminSponsorCampaignsPage = lazy(() => import('./pages/AdminSponsorCampaignsPage'));
const AdminHostListingsPage = lazy(() => import('./pages/AdminHostListingsPage'));
const AdminAnalyticsPage = lazy(() => import('./pages/AdminAnalyticsPage'));
const CampfireThreadAdminPage = lazy(() => import('./pages/admin/CampfireThreadAdminPage'));
const TripKitEditorPage = lazy(() => import('./pages/creator/TripKitEditorPage'));
const ScrapbookPublicPage = lazy(() => import('./pages/ScrapbookPublicPage'));
const ScrapbookDiscoverPage = lazy(() => import('./pages/ScrapbookDiscoverPage'));
const AuthCallbackPage = lazy(() => import('./pages/AuthCallbackPage'));
const PublicTripViewPage = lazy(() => import('./pages/PublicTripViewPage'));
const JoinCrewPage = lazy(() => import('./pages/JoinCrewPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const CampgroundUpgradePage = lazy(() => import('./pages/CampgroundUpgradePage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const CampgroundQuizPage = lazy(() => import('./pages/CampgroundQuizPage'));
const LastMinuteDealsPage = lazy(() => import('./pages/LastMinuteDealsPage'));
const EventsDiscoveryPage = lazy(() => import('./pages/EventsDiscoveryPage'));
const EventCreatePage = lazy(() => import('./pages/EventCreatePage'));
const EventDetailPageV2 = lazy(() => import('./pages/EventDetailPageV2'));
const EventManagePage = lazy(() => import('./pages/EventManagePage'));
const CheckInPage = lazy(() => import('./pages/CheckInPage'));
const OrganizerDashboard = lazy(() => import('./pages/OrganizerDashboard'));
const DealersPage = lazy(() => import('./pages/DealersPage'));
const DealerProfilePage = lazy(() => import('./pages/DealerProfilePage'));
const ActivityInstancePage = lazy(() => import('./pages/ActivityInstancePage'));

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
    </div>
  );
}

function GlobalCameraButton() {
  const [showCapture, setShowCapture] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setShowCapture(true)}
        className="fixed right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-40 flex items-center justify-center bottom-[7.5rem] sm:bottom-24"
        title="Quick Capture - Take photo or video"
      >
        <Camera className="w-7 h-7" />
      </button>
      <Suspense fallback={null}>
        <QuickCaptureModal
          isOpen={showCapture}
          onClose={() => setShowCapture(false)}
          onUploadComplete={() => setShowCapture(false)}
        />
      </Suspense>
    </>
  );
}

// Redirect component to properly handle /events/:id -> /trips/:id
function EventToTripRedirect() {
  const { id } = useParams();
  const { user } = useAuth();
  // If logged in, go to full trip page; otherwise show public event view
  return user ? <Navigate to={`/trips/${id}`} replace /> : <Navigate to={`/events-v2/${id}`} replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppContent() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !(user as any).onboardingCompleted) {
      const done = localStorage.getItem('hitch_onboarding_done');
      if (!done) setShowOnboarding(true);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <GuideUnlockToast />
      {showOnboarding && (
        <Suspense fallback={null}>
          <HitchOnboarding onComplete={() => {
            localStorage.setItem('hitch_onboarding_done', '1');
            setShowOnboarding(false);
            // Mark onboarding complete server-side so it never shows again
            import('./services/api').then(({ default: api }) => {
              api.patch('/auth/profile', { onboardingCompleted: true, onboardingCompletedAt: new Date().toISOString() }).catch(() => {});
            });
          }} />
        </Suspense>
      )}
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/s/:token" element={<ScrapbookPublicPage />} />
          <Route path="/scrapbooks" element={<ScrapbookDiscoverPage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/trips/:slug/view" element={<PublicTripViewPage />} />
          <Route path="/t/:tripId" element={<PublicTripPage />} />
          <Route path="/u/:username" element={<PublicProfilePage />} />
          <Route path="/posts/public/:postId" element={<PublicPostPage />} />
          <Route path="/boards/public/:threadId" element={<PublicBoardThread />} />
          <Route path="/rig/:slug" element={<RigProfilePage />} />
          <Route path="/rig/:slug/trips" element={<RigProfilePage />} />
          <Route path="/rig/:slug/campgrounds" element={<RigProfilePage />} />
          <Route path="/rig/:slug/mods" element={<RigProfilePage />} />
          <Route path="/rig/:slug/posts" element={<RigProfilePage />} />
          <Route path="/rig/:slug/stats" element={<RigProfilePage />} />
          <Route path="/rig/:slug/edit" element={<PrivateRoute><RigEditPage /></PrivateRoute>} />
          <Route path="/rig/:slug/edit/*" element={<PrivateRoute><RigEditPage /></PrivateRoute>} />
          <Route path="/join" element={<JoinCrewPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/business/:campgroundId/upgrade" element={<PrivateRoute><CampgroundUpgradePage /></PrivateRoute>} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/find-my-campground" element={<CampgroundQuizPage />} />
          <Route path="/experiences/:id" element={<ExperiencePage />} />
          <Route path="/deals" element={<LastMinuteDealsPage />} />
          <Route path="/dealers" element={<DealersPage />} />
          <Route path="/dealers/:dealerId" element={<DealerProfilePage />} />
          <Route path="/events-v2" element={<EventsDiscoveryPage />} />
          <Route path="/events-v2/create" element={<EventCreatePage />} />
          <Route path="/events-v2/:id" element={<EventDetailPageV2 />} />
          <Route path="/events-v2/:id/manage" element={<EventManagePage />} />
          <Route path="/organizer" element={<PrivateRoute><OrganizerDashboard /></PrivateRoute>} />
          <Route path="/checkin/:qrToken" element={<CheckInPage />} />
          <Route path="/activities/:instanceId" element={<PrivateRoute><ActivityInstancePage /></PrivateRoute>} />
          <Route
            path="/feed"
            element={
              <PrivateRoute>
                <FeedPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/:username/recipes"
            element={
              <PrivateRoute>
                <UserRecipesPage />
              </PrivateRoute>
            }
          />
          <Route path="/profile/:username/trips" element={<ProfileTripsPage />} />
          <Route path="/profile/:username/campgrounds" element={<ProfileCampgroundsPage />} />
          <Route path="/profile/:username/friends" element={<ProfileFriendsPage />} />
          <Route path="/profile/:username/edit" element={<Navigate to="/my-rv" replace />} />
          <Route
            path="/profile/:username/gear"
            element={
              <PrivateRoute>
                <UserGearPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/:username/rig"
            element={
              <PrivateRoute>
                <RigMemoryPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/profile/:username"
            element={
              <PrivateRoute>
                <ProfilePage user={user!} />
              </PrivateRoute>
            }
          />

          <Route path="/basecamp" element={<BasecampPage user={user} />} />
          <Route path="/community" element={<CommunityPage />} />
          <Route path="/community/:slug" element={<CommunityPage />} />
          <Route path="/business/:campgroundId" element={<BusinessBasecampPage />} />
          <Route path="/admin/campgrounds" element={<AdminCampgroundsPage />} />
          <Route path="/admin/analytics" element={<PrivateRoute><AdminAnalyticsPage /></PrivateRoute>} />
          <Route path="/admin/campfire-threads" element={<PrivateRoute><CampfireThreadAdminPage /></PrivateRoute>} />
          <Route path="/admin/sponsor-campaigns" element={<AdminSponsorCampaignsPage />} />
            <Route path="/admin/hosts" element={<AdminHostListingsPage />} />
            <Route path="/hosts/new" element={<CreateHostPage />} />
            <Route path="/hitch" element={<PrivateRoute><HitchAIPage /></PrivateRoute>} />
            <Route path="/hosts/:id" element={<HostDetailPage />} />
            <Route path="/overnight-spots/:id" element={<OvernightSpotDetailPage />} />

          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/media-albums" element={<PrivateRoute><MediaAlbumsPage /></PrivateRoute>} />
          <Route path="/media-albums/:id" element={<PrivateRoute><MediaAlbumDetailPage /></PrivateRoute>} />

          <Route path="/feed" element={<Navigate to="/community" replace />} />
          <Route path="/hashtag/:tag" element={<HashtagPage />} />

          <Route path="/threads/:id" element={<ThreadDetailPage />} />
          <Route path="/settings/household" element={<PrivateRoute><HouseholdSettingsPage /></PrivateRoute>} />
          <Route path="/settings/privacy" element={<PrivacySettingsPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
                <Route path="/terms" element={<TermsPage />} />
            <Route path="/sms-terms" element={<SMSTermsPage />} />
          <Route path="/settings/blocked" element={<BlockedUsersPage />} />
          <Route path="/settings/muted" element={<MutedSettingsPage />} />
          <Route path="/settings/activity" element={<AccountActivityLogPage />} />
          <Route path="/settings/delete-account" element={<AccountDeletionPage />} />
          <Route path="/badges" element={<BadgesPage />} />
          {/* Creator routes → redirect to Rig Profile system */}
          <Route path="/mods" element={<ModMarketplacePage />} />
          <Route path="/creators" element={<CreatorLeaderboardPage />} />
          <Route path="/creators/leaderboard" element={<CreatorLeaderboardPage />} />
          <Route path="/creators/:username" element={<CreatorPage />} />
          <Route path="/creators/:creatorUsername/content/:contentId" element={<PrivateRoute><VideoPlayerPage /></PrivateRoute>} />
          <Route path="/creator/dashboard" element={<PrivateRoute><CreatorDashboardPage /></PrivateRoute>} />
          <Route path="/creator/new" element={<PrivateRoute><CreatorContentEditorPage /></PrivateRoute>} />
          <Route path="/creator/edit/:contentId" element={<PrivateRoute><CreatorContentEditorPage /></PrivateRoute>} />
          <Route path="/creator/trip-kits/new" element={<PrivateRoute><TripKitEditorPage /></PrivateRoute>} />
          <Route path="/creator/trip-kits/:id/edit" element={<PrivateRoute><TripKitEditorPage /></PrivateRoute>} />

          <Route
            path="/groups/invites"
            element={
              <PrivateRoute>
                <GroupInvitesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/groups/:slug/edit"
            element={
              <PrivateRoute>
                <GroupEditPage />
              </PrivateRoute>
            }
          />
          <Route path="/groups/:slug" element={<GroupDetailPage />} />

          <Route
            path="/my-rv"
            element={
              <PrivateRoute>
                <MyRVPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <PrivateRoute>
                <SettingsPage />
              </PrivateRoute>
            }
          />

          {/* Redirect old /events URLs to /trips */}
          <Route path="/events" element={<Navigate to="/trips" replace />} />
          <Route path="/events/:id" element={<EventToTripRedirect />} />

          <Route
            path="/calendar" element={<PrivateRoute><div style={{minHeight:'100vh',background:'#f9fafb',padding:'24px'}}><TripCalendarWidget compact={false} /></div></PrivateRoute>} />
            <Route path="/trips"
            element={
              <PrivateRoute>
                <TripsPage />
              </PrivateRoute>
            }
          />
          <Route path="/explore" element={<ExplorePage />} />
          <Route path="/itinerary" element={<PrivateRoute><ItineraryPage /></PrivateRoute>} />
          <Route path="/itinerary/:id" element={<PrivateRoute><ItineraryPage /></PrivateRoute>} />
          <Route
            path="/trips/:id/edit"
            element={
              <PrivateRoute>
                <TripEditPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/drive-planner"
              element={
               <EnhancedDrivePlanner />}
             />

          <Route
            path="/trips/:id"
            element={
              <PrivateRoute>
                <TripDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/road-trips"
            element={
              <PrivateRoute>
                <RoadTripsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/road-trips/:id"
            element={
              <PrivateRoute>
                <RoadTripDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/campgrounds"
            element={
                <CampgroundsPage />
            }
          />
          <Route
            path="/campgrounds/:id"
            element={
                <CampgroundDetailPage />
            }
          />
          <Route
            path="/albums"
            element={
              <PrivateRoute>
                <AlbumsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/albums/:albumId"
            element={
              <PrivateRoute>
                <AlbumDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/recipes"
            element={
              <PrivateRoute>
                <RecipesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/recipes/:recipeId"
            element={
              <PrivateRoute>
                <RecipeDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/travel"
            element={
              <PrivateRoute>
                <TravelMapPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/map/:username"
            element={
              <PrivateRoute>
                <MapViewPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/jobs"
            element={
              <PrivateRoute>
                <JobBoardPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/gear"
            element={
              <PrivateRoute>
                <GearPackingPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/friends"
            element={
              <PrivateRoute>
                <FriendsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/messages"
            element={
              <PrivateRoute>
                <MessagesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/maintenance"
            element={
              <PrivateRoute>
                <MaintenancePage />
              </PrivateRoute>
            }
          />
          <Route path="/search" element={<PrivateRoute><SearchPage /></PrivateRoute>} />
          <Route path="/trips/:eventId/story" element={<TripStoryPage />} />
          <Route path="/rv-setup" element={<PrivateRoute><div className="min-h-screen bg-gray-50 py-8 px-4"><RVOnboardingFlow /></div></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><NotificationCenterPage /></PrivateRoute>} />
          <Route path="/admin/badges" element={<PrivateRoute><AdminBadgeApprovalPage /></PrivateRoute>} />
          <Route path="/" element={!user ? <LandingPage /> : <Navigate to="/basecamp" />} />
        </Routes>
      </Suspense>

      {/* Booking follow-up notification - asks if user booked after clicking Campspot */}
      {user && <BookingFollowUpNotification />}
      {user && (
        <>
          <GlobalCameraButton />
        </>
      )}
    </div>
  );
}

function App() {
  return (
    <HelmetProvider>
      <Helmet>
        <title>RVUnicorn — The Social Platform for RV Campers</title>
        <meta name="description" content="RVUnicorn is the social platform for RV enthusiasts. Discover campgrounds, plan road trips, connect with fellow campers, and track your adventures across America." />
        <meta property="og:title" content="RVUnicorn — The Social Platform for RV Campers" />
        <meta property="og:description" content="Discover campgrounds, plan road trips, connect with fellow campers, and track your adventures across America." />
        <meta property="og:image" content="https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/Logo_RVUnicorn.png" />
        <meta property="og:type" content="website" />
      </Helmet>
      <AuthProvider>
        <DrivingSessionProvider>
          <Router>
            <ToastProvider>
              <AppContent />
            </ToastProvider>
            <HitchFloatingChat />
            <MobileBottomNav />
            <DriveCompanionWidget />
            <OnboardingTrigger />
          </Router>
        </DrivingSessionProvider>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
