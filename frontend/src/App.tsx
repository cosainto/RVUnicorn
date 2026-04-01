import FeedPage from './pages/FeedPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import TripCalendarWidget from './components/TripCalendarWidget';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { HelmetProvider, Helmet } from 'react-helmet-async';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import ToastProvider from './components/ToastProvider';
import RVOnboardingFlow from './components/RVOnboardingFlow';
import TripStoryPage from './pages/TripStoryPage';
import NotificationCenterPage from './pages/NotificationCenterPage';
import Navbar from './components/Navbar';
import GuideUnlockToast from './components/GuideUnlockToast';
import HitchOnboarding from './components/HitchOnboarding';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import WelcomePage from './pages/WelcomePage';
import ProfilePage from './pages/ProfilePage';
import UserRecipesPage from './pages/UserRecipesPage';
import UserGearPage from './pages/UserGearPage';
import TripsPage from './pages/TripsPage';
import MyRVPage from "./pages/MyRVPage";
import TripEditPage from './pages/TripEditPage';
import TripDetailPage from './pages/TripDetailPage';
import RoadTripsPage from './pages/RoadTripsPage';
import RoadTripDetailPage from './pages/RoadTripDetailPage';
import CampgroundsPage from './pages/CampgroundsPage';
import AlbumsPage from './pages/AlbumsPage';
import AlbumDetailPage from './pages/AlbumDetailPage';
import RecipesPage from './pages/RecipesPage';
import RecipeDetailPage from './pages/RecipeDetailPage';
import TravelMapPage from './pages/TravelMapPage';
import GearPackingPage from './pages/GearPackingPage';
import FriendsPage from './pages/FriendsPage';
import HashtagPage from "./pages/HashtagPage";
import MessagesPage from './pages/MessagesPage';
import MaintenancePage from './pages/MaintenancePage';
import JobBoardPage from './pages/JobBoardPage';
import ExplorePage from './pages/ExplorePage';
import MapViewPage from './pages/MapViewPage';
import GroupsPage from './pages/GroupsPage';
import GroupDetailPage from './pages/GroupDetailPage';
import GroupEditPage from './pages/GroupEditPage';
import GroupInvitesPage from './pages/GroupInvitesPage';
import CampgroundDetailPage from './pages/CampgroundDetailPage';
import HostDetailPage from './pages/HostDetailPage';
import OvernightSpotDetailPage from './pages/OvernightSpotDetailPage';
import CreateHostPage from './pages/CreateHostPage';
import HitchAIPage from './pages/HitchAIPage';
import HitchFloatingChat from './components/HitchFloatingChat';
import CreatorPage from './pages/CreatorPage';
import CreatorLeaderboardPage from './pages/CreatorLeaderboardPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import CreatorContentEditorPage from './pages/CreatorContentEditorPage';
import BasecampPage from './pages/BasecampPage';
import CommunityPage from './pages/CommunityPage';
import LandingPage from './pages/LandingPage';
import BusinessBasecampPage from "./pages/BusinessBasecampPage";
import SettingsPage from "./pages/SettingsPage";
import EnhancedDrivePlanner from './components/EnhancedDrivePlanner';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import HouseholdSettingsPage from './pages/HouseholdSettingsPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsPage from './pages/TermsPage';
import SMSTermsPage from './pages/SMSTermsPage';
import BlockedUsersPage from './pages/BlockedUsersPage';
import MutedSettingsPage from './pages/MutedSettingsPage';
import AccountActivityLogPage from './pages/AccountActivityLogPage';
import AccountDeletionPage from './pages/AccountDeletionPage';
import BadgesPage from './pages/BadgesPage';
import VideoPlayerPage from './pages/VideoPlayerPage';
import MediaAlbumsPage from './pages/MediaAlbumsPage';
import MediaAlbumDetailPage from './pages/MediaAlbumDetailPage';
import BookingFollowUpNotification from './components/BookingFollowUpNotification';
import QuickCaptureModal from './components/QuickCaptureModal';
import React from 'react';
import { Camera } from 'lucide-react';

function GlobalCameraButton() {
  const [showCapture, setShowCapture] = React.useState(false);
  return (
    <>
      <button
        onClick={() => setShowCapture(true)}
        className="fixed bottom-24 right-6 w-14 h-14 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white rounded-full shadow-lg hover:shadow-xl transform hover:scale-105 transition-all z-40 flex items-center justify-center"
        title="Quick Capture - Take photo or video"
      >
        <Camera className="w-7 h-7" />
      </button>
      <QuickCaptureModal
        isOpen={showCapture}
        onClose={() => setShowCapture(false)}
        onUploadComplete={() => setShowCapture(false)}
      />
    </>
  );
}

import SearchPage from './pages/SearchPage';
import ItineraryPage from './pages/ItineraryPage';
import AdminBadgeApprovalPage from "./components/AdminBadgeApproval";
import AdminCampgroundsPage from './pages/AdminCampgroundsPage';
import AdminSponsorCampaignsPage from './pages/AdminSponsorCampaignsPage';
import AdminHostListingsPage from './pages/AdminHostListingsPage';
import CampgroundQuizPage from './pages/CampgroundQuizPage';

// Redirect component to properly handle /events/:id -> /trips/:id
function EventToTripRedirect() {
  const { id } = useParams();
  return <Navigate to={`/trips/${id}`} replace />;
}

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return user ? <>{children}</> : <Navigate to="/login" />;
}

function AppContent() {
  const { user } = useAuth();
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (user && !(user as any).rvType) {
      const done = localStorage.getItem('hitch_onboarding_done');
      if (!done) setShowOnboarding(true);
    }
  }, [user]);

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      <GuideUnlockToast />
      {showOnboarding && (
        <HitchOnboarding onComplete={() => {
          localStorage.setItem('hitch_onboarding_done', '1');
          setShowOnboarding(false);
        }} />
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/welcome" element={<WelcomePage />} />
        <Route path="/find-my-campground" element={<CampgroundQuizPage />} />
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
        <Route path="/creators" element={<PrivateRoute><CreatorLeaderboardPage /></PrivateRoute>} />
        <Route path="/creators/leaderboard" element={<PrivateRoute><CreatorLeaderboardPage /></PrivateRoute>} />
        <Route path="/creators/:username" element={<PrivateRoute><CreatorPage /></PrivateRoute>} />
        <Route path="/creators/:creatorUsername/content/:contentId" element={<PrivateRoute><VideoPlayerPage /></PrivateRoute>} />
        <Route path="/creator/dashboard" element={<PrivateRoute><CreatorDashboardPage /></PrivateRoute>} />
        <Route path="/creator/new" element={<PrivateRoute><CreatorContentEditorPage /></PrivateRoute>} />
        <Route path="/creator/edit/:contentId" element={<PrivateRoute><CreatorContentEditorPage /></PrivateRoute>} />        





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
        <Router>
          <ToastProvider>
            <AppContent />
          </ToastProvider>
          <HitchFloatingChat />
        </Router>
      </AuthProvider>
    </HelmetProvider>
  );
}

export default App;
