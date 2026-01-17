import FeedPage from './pages/FeedPage';
import ThreadDetailPage from './pages/ThreadDetailPage';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import OnboardingWizard from './components/OnboardingWizard';
import api from './services/api';
import Navbar from './components/Navbar';
import CampsiteBusinessPage from './components/CampsiteBusinessPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ProfilePage from './pages/ProfilePage';
import UserRecipesPage from './pages/UserRecipesPage';
import UserGearPage from './pages/UserGearPage';
import TripsPage from './pages/TripsPage';
import MyRVPage from "./pages/MyRVPage";
import TripEditPage from './pages/TripEditPage';
import TripDetailPage from './pages/TripDetailPage';
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
import CreatorPage from './pages/CreatorPage';
import CreatorLeaderboardPage from './pages/CreatorLeaderboardPage';
import CreatorDashboardPage from './pages/CreatorDashboardPage';
import CreatorContentEditorPage from './pages/CreatorContentEditorPage';
import BasecampPage from './pages/BasecampPage';
import BusinessBasecampPage from "./pages/BusinessBasecampPage";
import SettingsPage from "./pages/SettingsPage";
import DrivePlanner from './components/DrivePlanner';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import BlockedUsersPage from './pages/BlockedUsersPage';
import MutedSettingsPage from './pages/MutedSettingsPage';
import AccountActivityLogPage from './pages/AccountActivityLogPage';
import AccountDeletionPage from './pages/AccountDeletionPage';
import BadgesPage from './pages/BadgesPage';
import VideoPlayerPage from './pages/VideoPlayerPage';
import BookingFollowUpNotification from './components/BookingFollowUpNotification';

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
  const [onboardingChecked, setOnboardingChecked] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      if (user && !onboardingChecked) {
        try {
          const { data } = await api.get('/onboarding/status');
          setOnboardingChecked(true);
          if (!data.completed) {
            setShowOnboarding(true);
          }
        } catch (error) {
          console.error('Check onboarding error:', error);
          setOnboardingChecked(true);
        }
      }
    };
    checkOnboarding();
  }, [user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {user && <Navbar />}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={handleOnboardingComplete}
          onSkip={handleOnboardingComplete}
        />
      )}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
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
        <Route path="/business/:campgroundId" element={<BusinessBasecampPage />} />

        <Route path="/groups" element={<GroupsPage />} />

        <Route path="/feed" element={<FeedPage />} />
        <Route path="/hashtag/:tag" element={<HashtagPage />} />

        <Route path="/threads/:id" element={<ThreadDetailPage />} />
        <Route path="/settings/privacy" element={<PrivacySettingsPage />} />
        <Route path="/settings/blocked" element={<BlockedUsersPage />} />
        <Route path="/settings/muted" element={<MutedSettingsPage />} />
        <Route path="/settings/activity" element={<AccountActivityLogPage />} />
        <Route path="/settings/delete-account" element={<AccountDeletionPage />} />
        <Route path="/badges" element={<BadgesPage />} />
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
          path="/trips"
          element={
            <PrivateRoute>
              <TripsPage />
            </PrivateRoute>
          }
        />
        <Route path="/explore" element={<ExplorePage />} />
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
             <DrivePlanner />} 
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
          path="/campgrounds"
          element={
            <PrivateRoute>
              <CampgroundsPage />
            </PrivateRoute>
          }
        />
        <Route
          path="/campgrounds/:id"
          element={
            <PrivateRoute>
              <CampgroundDetailPage />
            </PrivateRoute>
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
        <Route path="/" element={<Navigate to="/basecamp" />} />
      </Routes>
      
      {/* Booking follow-up notification - asks if user booked after clicking Campspot */}
      {user && <BookingFollowUpNotification />}
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;
