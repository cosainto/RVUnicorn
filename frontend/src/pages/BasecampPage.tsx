import LandingPage from './LandingPage';
import { useState, useEffect, useCallback, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Home,
  Activity,
  Wrench,
  MapPin,
  Camera,
  MessageSquare,
  FolderPlus,
  Heart,
  Tent,
  CalendarPlus,
  User,
  ChevronRight,
  Clock,
  Truck,
  AlertTriangle,
  Edit,
  Package,
  Check,
  X,
  Trash2,
  RotateCcw,
  Award,
  Star,
  Plus,
  Settings,
  GripVertical,
  Users,
  Rss,
  ChefHat,
  Briefcase,
  Calendar,
  Bookmark,
  Globe,
  Link as LinkIcon,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Send,
  AtSign,
  Navigation,
  Share2,
  Smile} from 'lucide-react';
import api from '../services/api';
import { User as UserType } from '../services/auth.service';
import TravelMap from '../components/TravelMap';
import TripCalendarWidget from '../components/TripCalendarWidget';
import InventoryPackingModal from '../components/InventoryPackingModal';
import PackingAssignments from '../components/PackingAssignments';
import QuickCaptureModal from '../components/QuickCaptureModal';
import BasecampActivityFeed from '../components/BasecampActivityFeed';
import CampgroundUpdatesFeed from '../components/CampgroundUpdatesFeed';
import PackUpTasksWidget from "../components/PackUpTasksWidget";
import WishlistWidget from "../components/WishlistWidget";
import Top8Friends from '../components/Top8Friends';
import SocialFeed from '../components/SocialFeed';
import { TrendingHashtags } from '../components/HashtagDisplay';
import { CreatorToggleSection } from '../components/CreatorComponents';
import BasecampTour from '../components/BasecampTour';
import DrivingMode from '../components/DrivingMode';
import CreatorFeed from '../components/CreatorFeed';
import StargazingCard from '../components/StargazingCard';
import { useAuth } from '../contexts/AuthContext';
import CampfireChannel from '../components/CampfireChannel';
import CampgroundCommunity from '../components/CampgroundCommunity';
import ThingsToDoSection from '../components/ThingsToDoSection';
import LocationEventsCalendar from '../components/LocationEventsCalendar';
import MealPlanner from '../components/MealPlanner';
import EventAlbum from '../components/EventAlbum';
import CampfireChat from '../components/CampfireChat';
import CampfireTriviaOverlay from '../components/CampfireTriviaOverlay';
import WeatherActivities from '../components/WeatherActivities';
import SupplyList from '../components/SupplyList';
import CampMarket from '../components/CampMarket';
import LastMinuteDeals from '../components/LastMinuteDeals';
import WelcomeKit from '../components/WelcomeKit';
import NatureInsightCards from '../components/NatureInsightCards';
import BasecampTriviaCard from '../components/BasecampTriviaCard';

// Inline compact wrapper so we don't need to pass compact prop differently
function SupplyListCompact({ eventId }: { eventId: string }) {
  return <SupplyList eventId={eventId} compact />;
}
import InviteFriends from '../components/InviteFriends';

// Upcoming Events sidebar card
function UpcomingEventsCard() {
  const [events, setEvents] = useState<any[]>([]);
  useEffect(() => {
    api.get('/events-v2?upcoming=true&limit=2')
      .then(({ data }) => setEvents(data.events || []))
      .catch(() => {});
  }, []);
  if (events.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-base">🎪</span>
        <h3 className="font-bold text-sm text-gray-900">Upcoming Events</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {events.map((e: any) => (
          <Link key={e.id} to={`/events-v2/${e.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{e.title}</p>
              <p className="text-[10px] text-gray-400">{new Date(e.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · {e._count?.attendees || 0} attending</p>
            </div>
            <ChevronRight className="w-3 h-3 text-gray-300 flex-shrink-0" />
          </Link>
        ))}
      </div>
      <Link to="/events-v2" className="block text-center py-2 text-xs text-orange-600 font-semibold hover:bg-orange-50 transition">Browse events →</Link>
    </div>
  );
}

// Friends heading somewhere you know — sidebar card
function FriendsTipPromptCard() {
  const [matches, setMatches] = useState<any[]>([]);
  useEffect(() => {
    api.get('/events?friendTrips=true&upcoming=true&limit=10')
      .then(async ({ data }) => {
        const trips = data.events || data || [];
        const myCheckins = await api.get('/checkins/history?limit=100').catch(() => ({ data: [] }));
        const myIds = new Set((myCheckins.data || []).map((c: any) => c.campgroundId));
        const found = trips.filter((t: any) => t.campgroundId && myIds.has(t.campgroundId)).slice(0, 3);
        setMatches(found);
      })
      .catch(() => {});
  }, []);

  if (matches.length === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <span className="text-base">🔥</span>
        <h3 className="font-bold text-sm text-gray-900">Friends going somewhere you know</h3>
      </div>
      <div className="divide-y divide-gray-50">
        {matches.map((trip: any) => (
          <div key={trip.id} className="px-4 py-2.5 flex items-center gap-3">
            {trip.organizer?.profilePicture ? (
              <img src={trip.organizer.profilePicture} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
            ) : (
              <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">{trip.organizer?.firstName?.[0] || '?'}</div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{trip.organizer?.firstName} → {trip.campground?.name || trip.title}</p>
            </div>
            <Link to={`/campgrounds/${trip.campgroundId}?tip=true`} className="text-[10px] bg-orange-100 text-orange-700 px-2 py-1 rounded-full font-semibold hover:bg-orange-200 transition flex-shrink-0">
              Drop a tip
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

interface BasecampProps {
  user: UserType | null;
}

interface FeedItem {
  id: string;
  type: string;
  actor: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  content?: string;
  title?: string;
  targetName?: string;
  targetLink?: string;
  createdAt: string;
  activityType?: string;
  activityIcon?: string;
  activityLabel?: string;
  imageUrl?: string;
  campground?: {
    id: string;
    name: string;
    location?: string;
    state?: string;
  };
}

interface Friend {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture?: string;
}

interface UpcomingEvent {
  id: string;
  title: string;
  name?: string;
  startDate: string;
  endDate?: string;
  location?: string;
  isWishlist?: boolean;
  campground?: {
    id: string;
    name: string;
    state?: string;
  };
}

interface PlannedTrip {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  location?: string;
  type: 'event' | 'stateVisit';
  campground?: {
    id: string;
    name: string;
    state?: string;
  };
  state?: string;
}

interface MaintenanceStats {
  totalRecords: number;
  totalSpent: number;
  overdueCount: number;
  upcomingCount: number;
  lastService?: {
    id: string;
    serviceType: string;
    serviceDate: string;
  };
}

interface PackItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isPacked: boolean;
}

interface PackStats {
  total: number;
  packed: number;
  unpacked: number;
  progress: number;
}

interface UserSticker {
  id: string;
  earnedAt: string;
  sticker: {
    id: string;
    name: string;
    description?: string;
    imageUrl?: string;
    emoji?: string;
  };
}

interface UserGroup {
  id: string;
  name: string;
  description?: string;
  imageUrl?: string;
  slug?: string;
  _count?: {
    members: number;
  };
  memberCount?: number;
  unreadCount?: number;
}

interface SavedRecipe {
  id: string;
  recipeId: string;
  favorite: boolean;
  createdAt: string;
  recipe: {
    id: string;
    title: string;
    imageUrl?: string;
    prepTime?: number;
    cookTime?: number;
    author?: {
      username: string;
      firstName: string;
      lastName: string;
    };
  };
}

interface QuickLink {
  id: string;
  label: string;
  icon: string;
  path: string;
  color: string;
}

// Icon mapping for dynamic quick links
const iconMap: { [key: string]: React.ComponentType<any> } = {
  User,
  Home,
  Wrench,
  MapPin,
  Camera,
  Calendar: CalendarPlus,
  Users,
  MessageSquare,
  ChefHat,
  Rss,
  Briefcase,
  Tent,
};

// Color mapping for quick links
const colorMap: { [key: string]: string } = {
  green: 'bg-green-100 text-green-600',
  blue: 'bg-blue-100 text-blue-600',
  orange: 'bg-orange-100 text-orange-600',
  purple: 'bg-purple-100 text-purple-600',
  pink: 'bg-pink-100 text-pink-600',
  yellow: 'bg-yellow-100 text-yellow-600',
  cyan: 'bg-cyan-100 text-cyan-600',
  indigo: 'bg-indigo-100 text-indigo-600',
  red: 'bg-red-100 text-red-600',
  teal: 'bg-teal-100 text-teal-600',
  gray: 'bg-gray-100 text-gray-600',
  violet: 'bg-violet-100 text-violet-600',
  amber: 'bg-amber-100 text-amber-600',
};

const DEFAULT_QUICK_LINKS: QuickLink[] = [
  { id: 'profile', label: 'Profile', icon: 'User', path: '/profile/{username}', color: 'green' },
  { id: 'home', label: 'Home', icon: 'Home', path: '/travel', color: 'blue' },
  { id: 'rvlog', label: 'RV Log', icon: 'Wrench', path: '/maintenance', color: 'orange' },
  { id: 'campgrounds', label: 'Campgrounds', icon: 'MapPin', path: '/campgrounds', color: 'purple' },
  { id: 'photos', label: 'Photos', icon: 'Camera', path: '/albums', color: 'pink' },
];

const AVAILABLE_LINKS: QuickLink[] = [
  { id: 'profile', label: 'Profile', icon: 'User', path: '/profile/{username}', color: 'green' },
  { id: 'home', label: 'Home', icon: 'Home', path: '/travel', color: 'blue' },
  { id: 'rvlog', label: 'RV Log', icon: 'Wrench', path: '/maintenance', color: 'orange' },
  { id: 'campgrounds', label: 'Campgrounds', icon: 'MapPin', path: '/campgrounds', color: 'purple' },
  { id: 'photos', label: 'Photos', icon: 'Camera', path: '/albums', color: 'pink' },
  { id: 'trips', label: 'Trips', icon: 'Calendar', path: '/trips', color: 'yellow' },
  { id: 'friends', label: 'Friends', icon: 'Users', path: '/friends', color: 'cyan' },
  { id: 'messages', label: 'Messages', icon: 'MessageSquare', path: '/messages', color: 'indigo' },
  { id: 'recipes', label: 'Recipes', icon: 'ChefHat', path: '/recipes', color: 'red' },
  { id: 'feed', label: 'Feed', icon: 'Rss', path: '/feed', color: 'gray' },
];

// Inspirational camping quotes for when no trip is planned
const INSPIRATIONAL_QUOTES = [
  { quote: "In every walk with nature one receives far more than he seeks.", author: "John Muir" },
  { quote: "The mountains are calling and I must go.", author: "John Muir" },
  { quote: "Not all those who wander are lost.", author: "J.R.R. Tolkien" },
  { quote: "Leave the road, take the trails.", author: "Pythagoras" },
  { quote: "Adopt the pace of nature: her secret is patience.", author: "Ralph Waldo Emerson" },
  { quote: "Wilderness is not a luxury but a necessity of the human spirit.", author: "Edward Abbey" },
  { quote: "Life is either a daring adventure or nothing at all.", author: "Helen Keller" },
  { quote: "He who can no longer wonder and stand rapt in awe is as good as dead.", author: "Albert Einstein" },
  { quote: "Look deep into nature, and then you will understand everything better.", author: "Albert Einstein" },
  { quote: "Climb the mountain not to plant your flag, but to embrace the challenge.", author: "Unknown" },
  { quote: "We don't inherit the earth from our ancestors, we borrow it from our children.", author: "Native American Proverb" },
  { quote: "Going to the woods is going home.", author: "John Muir" },
  { quote: "The clearest way into the Universe is through a forest wilderness.", author: "John Muir" },
  { quote: "To sit in the shade on a fine day and look upon verdure is the most perfect refreshment.", author: "Jane Austen" },
  { quote: "It is not down in any map; true places never are.", author: "Herman Melville" },
  { quote: "A walk in nature walks the soul back home.", author: "Mary Davis" },
  { quote: "Between every two pines is a doorway to a new world.", author: "John Muir" },
  { quote: "One touch of nature makes the whole world kin.", author: "William Shakespeare" },
  { quote: "Only those who risk going too far can possibly find out how far one can go.", author: "T.S. Eliot" },
  { quote: "The best journeys answer questions that in the beginning you didn't even think to ask.", author: "Jeff Johnson" },
  { quote: "Man cannot discover new oceans unless he has the courage to lose sight of the shore.", author: "André Gide" },
  { quote: "Live in the sunshine, swim the sea, drink the wild air.", author: "Ralph Waldo Emerson" },
  { quote: "To forget how to dig the earth and tend the soil is to forget ourselves.", author: "Mahatma Gandhi" },
  { quote: "There is pleasure in the pathless woods.", author: "Lord Byron" },
  { quote: "Wherever you go becomes a part of you somehow.", author: "Anita Desai" },
];

// Enhanced Status Bar Component
interface EnhancedStatusBarProps {
  user: any;
  profile: any;
  onUpdate?: () => void;
  onPost?: () => void;
}

const STATUS_EMOJIS = [
  '🏕️', '🏠', '🚐', '⛺', '🔥', '🌲', '🌄', '🎣', 
  '🥾', '🌙', '☀️', '💤', '🍳', '📍', '🗺️', '✨',
  '🎉', '😊', '🌅', '🦌', '🐻', '🌊', '⛰️', '🏔️'
];

function EnhancedStatusBar({ user, profile, onUpdate, onPost }: EnhancedStatusBarProps) {
  const [statusText, setStatusText] = useState('');
  const [selectedEmoji, setSelectedEmoji] = useState(profile?.statusEmoji || '🏕️');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCheckIn, setShowCheckIn] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionResults, setMentionResults] = useState<any[]>([]);
  const [selectedCampground, setSelectedCampground] = useState<any>(null);
  const [showCampgroundInStatus, setShowCampgroundInStatus] = useState(true);
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [campgroundResults, setCampgroundResults] = useState<any[]>([]);
  const [searchingCampgrounds, setSearchingCampgrounds] = useState(false);
  const [posting, setPosting] = useState(false);
  const [friends, setFriends] = useState<any[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionRef = useRef<HTMLDivElement>(null);


  // Load friends for mentions
  useEffect(() => {
    const loadFriends = async () => {
      try {
        const { data } = await api.get('/friends');
        setFriends(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error('Failed to load friends:', error);
      }
    };
    loadFriends();
  }, []);

  // Handle @ mentions
  const handleTextChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setStatusText(text);

    // Check for @ mention
    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = text.slice(0, cursorPos);
    const userMentionMatch = textBeforeCursor.match(/@(\w*)$/);
    const campgroundMentionMatch = textBeforeCursor.match(/#(\w*)$/);

    if (userMentionMatch) {
      const query = userMentionMatch[1];
      setMentionQuery(query);
      if (query.length >= 1) {
        try {
          const { data } = await api.get(`/mentions/search/users?q=${encodeURIComponent(query)}`);
          setMentionResults(data.slice(0, 5));
          setShowMentions(true);
        } catch (err) {
          console.error("Search users error:", err);
        }
      } else {
        setMentionResults([]);
        setShowMentions(true);
      }
    } else if (campgroundMentionMatch) {
      const query = campgroundMentionMatch[1];
      setMentionQuery(query);
      if (query.length >= 1) {
        try {
          const { data } = await api.get(`/mentions/search/campgrounds?q=${encodeURIComponent(query)}`);
          setMentionResults(data.map((c: any) => ({ ...c, isCampground: true })).slice(0, 5));
          setShowMentions(true);
        } catch (err) {
          console.error("Search campgrounds error:", err);
        }
      } else {
        setMentionResults([]);
        setShowMentions(true);
      }
    } else {
      setShowMentions(false);
      setMentionResults([]);
    }
  };

  // Insert mention (user or campground)
  const insertMention = (item: any) => {
    const cursorPos = textareaRef.current?.selectionStart || 0;
    const textBeforeCursor = statusText.slice(0, cursorPos);
    const textAfterCursor = statusText.slice(cursorPos);
    
    // Check if it is a user mention (@) or campground mention (#)
    const userMatch = textBeforeCursor.match(/@(\w*)$/);
    const campgroundMatch = textBeforeCursor.match(/#(\w*)$/);
    
    if (userMatch) {
      const newTextBefore = textBeforeCursor.slice(0, -userMatch[0].length);
      const mention = `@${item.username} `;
      setStatusText(newTextBefore + mention + textAfterCursor);
    } else if (campgroundMatch) {
      const newTextBefore = textBeforeCursor.slice(0, -campgroundMatch[0].length);
      const mention = `#${item.slug} `;
      setStatusText(newTextBefore + mention + textAfterCursor);
    }
    
    setShowMentions(false);
    setMentionResults([]);
    textareaRef.current?.focus();
  };

  // Search campgrounds
  const searchCampgrounds = async (query: string) => {
    if (query.length < 2) {
      setCampgroundResults([]);
      return;
    }
    
    setSearchingCampgrounds(true);
    try {
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(query)}&limit=5`);
      setCampgroundResults(data.campgrounds || data || []);
    } catch (error) {
      console.error('Campground search error:', error);
    } finally {
      setSearchingCampgrounds(false);
    }
  };

  // Debounced campground search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (campgroundSearch) {
        searchCampgrounds(campgroundSearch);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [campgroundSearch]);

  // Post status/update - handles @user mentions
  const handlePost = async () => {
    if (!statusText.trim() && !selectedCampground) return;
    
    setPosting(true);
    try {
      const text = statusText.trim();
      
      // Parse @user mentions from text
      const userMentions = text.match(/@(\w+)/g)?.map(m => m.slice(1)) || [];
      const hasMentions = userMentions.length > 0;
      
      // Only update status if NOT mentioning someone (mentions go to walls, not status)
      if (!hasMentions) {
        await api.put("/profile/" + profile.username + "/status", {
          status: text || null,
          statusEmoji: selectedEmoji,
          statusType: selectedCampground ? 'AUTO_CAMPING' : 'CUSTOM',
          currentCampsite: selectedCampground && showCampgroundInStatus ? selectedCampground.name : null,
        });
      }

      // If there's text content, create posts
      if (text) {
        // If mentioning users, post to their walls
        if (hasMentions) {
          for (const username of userMentions) {
            try {
              await api.post("/profile/" + username + "/wall", { content: text });
            } catch (e) {
              console.error("Failed to post to " + username + "'s wall:", e);
            }
          }
        }
        
        // Always create a regular post for the user's own feed
        try {
          await api.post('/posts', {
            content: text,
            campgroundId: selectedCampground?.id || null,
          });
        } catch (e) {
          console.error('Post creation failed:', e);
        }
      }

      // If checking into a campground, create a check-in
      if (selectedCampground) {
        try {
          await api.post('/checkin', {
            campgroundId: selectedCampground.id,
          });
        } catch (e) {
          console.error('Check-in failed:', e);
        }
      }

      // Reset form
      setStatusText('');
      setSelectedCampground(null);
      setShowCheckIn(false);
      setShowCampgroundInStatus(true);
      
      if (onUpdate) onUpdate();
      if (onPost) onPost();
    } catch (error) {
      console.error('Post error:', error);
      alert('Failed to post update');
    } finally {
      setPosting(false);
    }
  };

  // Current status display
  const getCurrentStatus = () => {
    if (profile?.statusType === 'AUTO_CAMPING' && profile?.currentCampsite) {
      return `🏕️ Camping at ${profile.currentCampsite}`;
    }
    if (profile?.statusType === 'AUTO_CAMPING' && !profile?.currentCampsite) {
      return '🏕️ Camping';
    }
    if (profile?.statusType === 'AUTO_HOME') {
      return '🏠 Home';
    }
    if (profile?.status) {
      return `${profile.statusEmoji || ''} ${profile.status}`;
    }
    return null;
  };

  const currentStatus = getCurrentStatus();

  return (
    <>
      <style>{`
        .bc-dark { background: #0F1C35 !important; color: #F5F0E8 !important; min-height: 100vh; padding-bottom: 2rem; }
        .bc-dark .bg-white { background: rgba(15,28,53,0.95) !important; color: #F5F0E8 !important; }
        .bc-dark .bg-gray-50, .bc-dark .bg-gray-100 { background: #1B2E50 !important; color: #F5F0E8 !important; }
        .bc-dark .bg-gray-200, .bc-dark .bg-gray-300 { background: rgba(27,46,80,0.6) !important; }
        .bc-dark .bg-green-50, .bc-dark .bg-blue-50, .bc-dark .bg-amber-50, .bc-dark .bg-orange-50, .bc-dark .bg-purple-50, .bc-dark .bg-red-50, .bc-dark .bg-yellow-50, .bc-dark .bg-indigo-50 { background: rgba(27,46,80,0.4) !important; }
        .bc-dark .bg-primary-50, .bc-dark .bg-primary-100 { background: rgba(232,168,56,0.08) !important; }
        .bc-dark .bg-gradient-to-r.from-primary-50, .bc-dark .bg-gradient-to-r.from-green-50, .bc-dark .bg-gradient-to-r.from-blue-50 { background: rgba(27,46,80,0.4) !important; }
        .bc-dark .text-gray-900, .bc-dark .text-gray-800 { color: #F5F0E8 !important; }
        .bc-dark .text-gray-700, .bc-dark .text-gray-600 { color: rgba(245,240,232,0.65) !important; }
        .bc-dark .text-gray-500, .bc-dark .text-gray-400 { color: rgba(245,240,232,0.4) !important; }
        .bc-dark .text-gray-300 { color: rgba(245,240,232,0.25) !important; }
        .bc-dark .text-primary-700, .bc-dark .text-primary-600, .bc-dark .text-primary-500 { color: #E8A838 !important; }
        .bc-dark .text-green-700, .bc-dark .text-green-600 { color: #10B981 !important; }
        .bc-dark .text-blue-700, .bc-dark .text-blue-600 { color: #60A5FA !important; }
        .bc-dark .text-orange-700, .bc-dark .text-orange-600 { color: #E8622A !important; }
        .bc-dark .border-gray-100, .bc-dark .border-gray-200, .bc-dark .border-gray-300 { border-color: rgba(232,168,56,0.08) !important; }
        .bc-dark .border-green-200, .bc-dark .border-blue-200, .bc-dark .border-orange-200, .bc-dark .border-amber-200, .bc-dark .border-purple-200 { border-color: rgba(232,168,56,0.12) !important; }
        .bc-dark .shadow-lg, .bc-dark .shadow-xl, .bc-dark .shadow-2xl { box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important; }
        .bc-dark .shadow-md, .bc-dark .shadow-sm, .bc-dark .shadow { box-shadow: 0 2px 10px rgba(0,0,0,0.3) !important; }
        .bc-dark input, .bc-dark textarea, .bc-dark select { background: #1B2E50 !important; border-color: rgba(232,168,56,0.12) !important; color: #F5F0E8 !important; }
        .bc-dark .btn-primary, .bc-dark .bg-primary-600, .bc-dark .bg-primary-500 { background: #E8622A !important; color: white !important; }
        .bc-dark .btn-secondary { background: transparent !important; border-color: rgba(255,255,255,0.1) !important; color: rgba(245,240,232,0.5) !important; }
        .bc-dark .hover\\:bg-gray-50:hover, .bc-dark .hover\\:bg-gray-100:hover { background: rgba(27,46,80,0.6) !important; }
        .bc-dark .hover\\:text-primary-600:hover, .bc-dark .hover\\:text-primary-700:hover { color: #E8A838 !important; }
        .bc-dark .rounded-xl, .bc-dark .rounded-lg, .bc-dark .rounded-2xl { border-color: rgba(232,168,56,0.06); }
        .bc-dark .bg-gradient-to-r.from-orange-500, .bc-dark .bg-gradient-to-r.from-amber-500 { background: linear-gradient(to right, #E8622A, #E8A838) !important; }
        .bc-dark .bg-gradient-to-r.from-green-400, .bc-dark .bg-gradient-to-br.from-green-400 { background: linear-gradient(to right, #1B4332, #1B2E50) !important; }
        .bc-dark .bg-gradient-to-r.from-purple-500 { background: linear-gradient(to right, #5B21B6, #1B2E50) !important; }
        .bc-dark .prose { color: rgba(245,240,232,0.7) !important; }
        .bc-dark .divide-gray-100 > * + *, .bc-dark .divide-gray-200 > * + * { border-color: rgba(232,168,56,0.06) !important; }
      `}</style>
      {typeof showTour !== 'undefined' && showTour && user && <BasecampTour firstName={user.firstName} onComplete={handleTourComplete} />}
    <div className="bc-dark space-y-3">
      {/* Current Status Display */}
      {currentStatus && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Current status:</span>
          <span className="bg-gradient-to-r from-primary-50 to-blue-50 text-primary-700 px-3 py-1 rounded-full font-medium">
            {currentStatus}
          </span>
        </div>
      )}

      {/* Main Input Area */}
      <div className="flex gap-3">
        {/* User Avatar */}
        <div className="flex-shrink-0">
          {user?.profilePicture ? (
            <img
              src={`${user.profilePicture}`}
              alt={user.firstName}
              className="w-12 h-12 rounded-full object-cover border-2 border-primary-100"
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
              <User className="w-6 h-6 text-white" />
            </div>
          )}
        </div>

        {/* Input Container */}
        <div className="flex-1">
          <div className="relative">
            <div className="bg-gray-50 rounded-2xl border border-gray-200 focus-within:border-primary-400 focus-within:ring-2 focus-within:ring-primary-100 transition-all">
              {/* Check-in Banner */}
              {selectedCampground && (
                <div className="px-4 py-2 bg-green-50 border-b border-green-100 rounded-t-2xl">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-green-700 font-medium">
                      Checking in at {selectedCampground.name}
                    </span>
                    <button
                      onClick={() => setSelectedCampground(null)}
                      className="ml-auto text-green-600 hover:text-green-800"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showCampgroundInStatus}
                      onChange={(e) => setShowCampgroundInStatus(e.target.checked)}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <span className="text-xs text-green-700">Show campground name in my status</span>
                  </label>
                </div>
              )}

              {/* Textarea */}
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={statusText}
                  onChange={handleTextChange}
                  placeholder="What's happening? @mention friends to post on their wall..."
                  className="w-full px-4 py-3 bg-transparent border-0 resize-none focus:ring-0 text-gray-800 placeholder-gray-400"
                  rows={2}
                  maxLength={500}
                />

                {/* Mention Dropdown */}
                {showMentions && mentionResults.length > 0 && (
                  <div 
                    ref={mentionRef}
                    className="absolute left-4 bottom-full mb-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 w-64"
                  >
                    {mentionResults.map((item) => (
                      <button
                        key={item.id}
                        onClick={() => insertMention(item)}
                        className="w-full flex items-center gap-2 p-2 hover:bg-gray-50 text-left"
                      >
                        {item.isCampground ? (
                          <>
                            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                              <MapPin className="w-4 h-4 text-green-600" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-800">{item.name}</p>
                              <p className="text-xs text-gray-500">#{item.slug}</p>
                            </div>
                          </>
                        ) : (
                          <>
                            {item.profilePicture ? (
                              <img
                                src={`${item.profilePicture}`}
                                alt={item.firstName}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="w-4 h-4 text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-800">
                                {item.firstName} {item.lastName}
                              </p>
                              <p className="text-xs text-gray-500">@{item.username}</p>
                            </div>
                          </>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                <div className="flex items-center gap-1">
                  {/* Emoji Picker */}
                  <div className="relative">
                    <button
                      onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                      className="p-2 hover:bg-gray-200 rounded-full transition-colors text-2xl"
                      title="Add emoji"
                    >
                      {selectedEmoji}
                    </button>
                    {showEmojiPicker && (
                      <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-20 grid grid-cols-8 gap-1">
                        {STATUS_EMOJIS.map((emoji) => (
                          <button
                            key={emoji}
                            onClick={() => {
                              setSelectedEmoji(emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="text-xl p-1 hover:bg-gray-100 rounded"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Check-in Button */}
                  <button
                    onClick={() => setShowCheckIn(!showCheckIn)}
                    className={`p-2 rounded-full transition-colors flex items-center gap-1 ${
                      showCheckIn || selectedCampground
                        ? 'bg-green-100 text-green-600'
                        : 'hover:bg-gray-200 text-gray-500'
                    }`}
                    title="Check in to campground"
                  >
                    <MapPin className="w-5 h-5" />
                  </button>

                  {/* Mention Button */}
                  <button
                    onClick={() => {
                      setStatusText(statusText + '@');
                      textareaRef.current?.focus();
                    }}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    title="Mention someone"
                  >
                    <AtSign className="w-5 h-5" />
                  </button>

                  {/* Quick Capture Button */}
                  <button
                    onClick={() => setShowQuickCapture(true)}
                    className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                    title="Take photo or video"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Post Button */}
                <button
                  onClick={handlePost}
                  disabled={posting || (!statusText.trim() && !selectedCampground)}
                  className="bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-full font-medium text-sm transition-colors flex items-center gap-2"
                >
                  {posting ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  Post
                </button>
              </div>
            </div>

            {/* Check-in Search Panel */}
            {showCheckIn && !selectedCampground && (
              <div className="mt-2 bg-white border border-gray-200 rounded-xl shadow-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Tent className="w-5 h-5 text-green-600" />
                  <span className="font-medium text-gray-800">Check in to a campground</span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={campgroundSearch}
                    onChange={(e) => setCampgroundSearch(e.target.value)}
                    placeholder="Search campgrounds..."
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  />
                  {searchingCampgrounds && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                </div>
                {campgroundResults.length > 0 && (
                  <div className="mt-2 max-h-48 overflow-y-auto">
                    {campgroundResults.map((cg) => (
                      <button
                        key={cg.id}
                        onClick={() => {
                          setSelectedCampground(cg);
                          setShowCheckIn(false);
                          setCampgroundSearch('');
                          setCampgroundResults([]);
                        }}
                        className="w-full flex items-center gap-3 p-2 hover:bg-green-50 rounded-lg text-left"
                      >
                        <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                          <Tent className="w-5 h-5 text-green-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-800 truncate">{cg.name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {cg.location || cg.state}
                          </p>
                        </div>
                        <MapPin className="w-4 h-4 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
                {campgroundSearch && campgroundResults.length === 0 && !searchingCampgrounds && (
                  <p className="text-sm text-gray-500 text-center py-3">
                    No campgrounds found
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Character Count */}
          {statusText.length > 0 && (
            <div className="flex justify-end mt-1">
              <span className={`text-xs ${statusText.length > 450 ? 'text-orange-500' : 'text-gray-400'}`}>
                {statusText.length}/500
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
    </>
  );
}

const ACTIVITY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  TRIP_PLANNED: { label: 'planned a trip to', icon: <CalendarPlus className="w-4 h-4" />, color: 'bg-blue-100 text-blue-600' },
  TRIP_SAVED: { label: 'saved a trip to', icon: <Heart className="w-4 h-4" />, color: 'bg-pink-100 text-pink-600' },
  COMMENT_ADDED: { label: 'commented on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-green-100 text-green-600' },
  PHOTO_UPLOADED: { label: 'added a photo', icon: <Camera className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  ALBUM_CREATED: { label: 'created an album', icon: <FolderPlus className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-600' },
  CAMPGROUND_POST: { label: 'posted about', icon: <Tent className="w-4 h-4" />, color: 'bg-orange-100 text-orange-600' },
  CAMPGROUND_UPDATE: { label: 'update from', icon: <MapPin className="w-4 h-4" />, color: 'bg-emerald-100 text-emerald-600' },
  THREAD_POST: { label: 'replied to', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  EVENT_CREATED: { label: 'created an event', icon: <CalendarPlus className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-600' },
  EVENT_JOINED: { label: 'is attending', icon: <Heart className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-600' },
  POST: { label: 'posted', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600' },
  RECIPE_COMMENT_THREAD: { label: 'commented on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-orange-100 text-orange-600' },
  RECIPE_MENTION: { label: 'mentioned you on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  THREAD_REPLY: { label: 'replied to', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  THREAD_COMMENT: { label: 'commented on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  THREAD_MENTION: { label: 'mentioned you in', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  THREAD_CREATED: { label: 'started a thread', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-blue-100 text-blue-600' },
  FRIEND_THREAD_CREATED: { label: 'started a new thread', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-indigo-100 text-indigo-600' },
  FRIEND_THREAD_COMMENT: { label: 'is talking in', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-teal-100 text-teal-600' },
  RECIPE_SHARED: { label: 'shared a recipe', icon: <Share2 className="w-4 h-4" />, color: 'bg-green-100 text-green-600' },
  RECIPE_TAGGED: { label: 'tagged you in a recipe', icon: <AtSign className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  RECIPE_SHARE_TAG: { label: 'shared a recipe with you', icon: <Share2 className="w-4 h-4" />, color: 'bg-green-100 text-green-600' },
  BADGE_EARNED: { label: 'earned a badge', icon: <Award className="w-4 h-4" />, color: 'bg-amber-100 text-amber-600' },
};

const PACK_CATEGORIES = [
  'General', 'Clothing', 'Kitchen', 'Safety', 'Electronics',
  'Toiletries', 'Outdoor Gear', 'Bedding', 'Tools', 'Food',
  'Documents', 'Entertainment', 'Pet Supplies', 'Kids', 'Other',
];


// ─── RV Owner Manual URL Generator ───────────────────────────────────────────
function getRvManualUrl(make?: string, model?: string, year?: number | string): string | null {
  if (!make || !model || !year) return null;

  const makeClean = make.toLowerCase().trim();
  const modelSlug = model.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const yr = String(year);

  // Forest River family (uses forestriverinc.help)
  const forestRiverBrands: Record<string, string> = {
    'coachmen': 'coachmenrv',
    'coachman': 'coachmenrv',
    'forest river': 'forestriver',
    'flagstaff': 'flagstaff',
    'rockwood': 'rockwood',
    'cherokee': 'cherokee',
    'grey wolf': 'greywolf',
    'wildwood': 'wildwood',
    'surveyor': 'surveyor',
    'sunseeker': 'sunseeker',
    'forester': 'forester',
    'georgetown': 'georgetown',
    'legacy': 'legacy',
    'palomino': 'palomino',
  };

  for (const [brand, slug] of Object.entries(forestRiverBrands)) {
    if (makeClean.includes(brand)) {
      return `https://forestriverinc.help/#/${slug}/guide/${yr}/${modelSlug}/browse/tags/Owner's%20Manual`;
    }
  }

  // Thor Industries
  const thorBrands: Record<string, string> = {
    'airstream': 'https://www.airstream.com/support/owners-manuals/',
    'jayco': `https://www.jayco.com/owners/manuals/`,
    'keystone': `https://www.keystonerv.com/owners/manuals/`,
    'heartland': `https://www.heartlandrv.com/owners-corner/manuals/`,
    'dutchmen': `https://www.dutchmenrv.com/owner-resources/`,
    'thor motor coach': `https://www.thormotorcoach.com/owner-resources/`,
    'thor': `https://www.thormotorcoach.com/owner-resources/`,
  };

  for (const [brand, url] of Object.entries(thorBrands)) {
    if (makeClean.includes(brand)) return url;
  }

  // Winnebago Industries
  if (makeClean.includes('winnebago') || makeClean.includes('grand design') || makeClean.includes('newmar')) {
    return `https://www.winnebago.com/owners/manuals`;
  }

  // Tiffin
  if (makeClean.includes('tiffin')) return 'https://www.tiffinmotorhomes.com/owner-resources';

  // Gulf Stream
  if (makeClean.includes('gulf stream')) return 'https://www.gulfstreamcoach.com/owner-support';

  // Generic Google search fallback
  const query = encodeURIComponent(`${year} ${make} ${model} owner manual PDF`);
  return `https://www.google.com/search?q=${query}`;
}


// ── Campfire Photo Strip ─────────────────────────────────────────────────────
function CampfirePhotoStrip({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const [photos, setPhotos] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/photos/event/${eventId}`)
      .then(({ data }) => setPhotos(data.photos || []))
      .catch(() => {});
  }, [eventId]);

  if (photos.length === 0) return null;


  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-base">📸</span>
          <h3 className="font-bold text-gray-900 text-sm">Trip Photos</h3>
          <span className="text-xs text-gray-400">{eventTitle}</span>
        </div>
        <span className="text-xs text-gray-400">{photos.length} photo{photos.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
        {photos.map((photo: any, i: number) => (
          <a
            key={photo.id || i}
            href={`/trips/${eventId}?tab=photos`}
            className="flex-shrink-0 relative group"
            title={photo.caption || photo.user?.firstName || 'View photo'}
          >
            <img
              src={photo.imageUrl || photo.url}
              alt={photo.caption || ''}
              className="w-24 h-24 object-cover rounded-lg border border-gray-100 group-hover:opacity-90 transition"
            />
            {photo.user?.profilePicture && (
              <img
                src={photo.user.profilePicture}
                alt=""
                className="absolute bottom-1 left-1 w-5 h-5 rounded-full border border-white object-cover"
              />
            )}
          </a>
        ))}
      </div>
    </div>
  );
}
// ─────────────────────────────────────────────────────────────────────────────

export default function BasecampPage({ user }: BasecampProps) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    if (!user) return;
    const tourKey = 'basecampTourDone_' + user.id;
    if (!localStorage.getItem(tourKey)) {
      const timer = setTimeout(() => setShowTour(true), 800);
      return () => clearTimeout(timer);
    }
  }, [user?.id]);

  const handleTourComplete = () => {
    if (user) localStorage.setItem('basecampTourDone_' + user.id, 'true');
    setShowTour(false);
  };
  
  const [activeCheckIn, setActiveCheckIn] = useState<any>(null);

  // ── Mode constants (Phase 2: Basecamp redesign) ──────────────────────────
  const isCamping  = !!activeCheckIn;
  const [isDriving, setIsDriving] = useState(() => localStorage.getItem('rvunicorn_driving') === 'true');
  const [drivingMinimized, setDrivingMinimized] = useState(false);
  const [proximityAlertShown, setProximityAlertShown] = useState(false);
  const [proximityToast, setProximityToast] = useState(false);
  const [showProximityCheckIn, setShowProximityCheckIn] = useState(false);
  const [proximitySiteNumber, setProximitySiteNumber] = useState('');
  const [proximityCheckingIn, setProximityCheckingIn] = useState(false);
  const [proximityCheckedIn, setProximityCheckedIn] = useState(false);

  const isPlanning = !isCamping; // kept for existing sections

  // Event Countdown State (declared early — used in proximity useEffect below)
  const [nextEvent, setNextEvent] = useState<UpcomingEvent | null>(null);

  // Proximity alert — watch GPS when driving, alert when ~1hr from campground
  useEffect(() => {
    if (!isDriving || !nextEvent?.campground || proximityAlertShown) return;
    const cg = nextEvent.campground as any;
    if (!cg?.latitude || !cg?.longitude) return;
    const check = () => {
      navigator.geolocation?.getCurrentPosition(pos => {
        const lat1 = pos.coords.latitude * Math.PI / 180;
        const lat2 = (cg.latitude as number) * Math.PI / 180;
        const dLat = lat2 - lat1;
        const dLng = ((cg.longitude as number) - pos.coords.longitude) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
        const miles = 3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        if (miles <= 55 && !proximityAlertShown) {
          setProximityAlertShown(true);
          setProximityToast(true);
          setShowProximityCheckIn(true);
          setTimeout(() => setProximityToast(false), 12000);
        }
      }, undefined, { timeout: 5000 });
    };
    const interval = setInterval(check, 5 * 60 * 1000); // check every 5 min
    check();
    return () => clearInterval(interval);
  }, [isDriving, nextEvent?.campground, proximityAlertShown]);



  // Scroll to top when camping mode activates
  useEffect(() => {
    if (isCamping) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [isCamping]);
  const [campingTab, setCampingTab] = useState<'campfire' | 'network' | 'camp'>('campfire');
  const [mealRsvpLoading, setMealRsvpLoading] = useState(false);

  const handleMealRSVP = async (mealId: string, status: string) => {
    setMealRsvpLoading(true);
    try {
      await api.post(`/event-meals/${mealId}/rsvp`, { status });
      // Refresh nextMeal rsvps
      if (linkedEvent) {
        api.get(`/event-meals/${linkedEvent.id}`).then(({ data }) => {
          const meals = data || [];
          const updated = meals.find((m: any) => m.id === mealId);
          if (updated) setNextMeal(updated);
        }).catch(() => {});
      }
    } catch {}
    setMealRsvpLoading(false);
  };
  const [tonightData, setTonightData] = useState<any>(null);
  const [tonightSkyPost, setTonightSkyPost] = useState<any>(null);
  const [linkedEvent, setLinkedEvent] = useState<any>(null);
  const [linkedEventMealCount, setLinkedEventMealCount] = useState(0);
  const [linkedEventActivityCount, setLinkedEventActivityCount] = useState(0);
  const [nextMeal, setNextMeal] = useState<any>(null);

  useEffect(() => {
    if (isCamping && activeCheckIn?.campground?.id) {
      // Find the auto-created event for this check-in
      api.get('/trips/my').then(({ data }) => {
        const match = data.find((e: any) =>
          e.campground?.id === activeCheckIn.campground.id &&
          e.title?.startsWith('Staying at')
        );
        setLinkedEvent(match || null);
        if (match) {
          api.get(`/event-meals/${match.id}`).then(({ data }) => {
            const meals = data || [];
            setLinkedEventMealCount(meals.length);
            // API returns meals sorted by scheduledAt asc — just take the first one
            setNextMeal(meals[0] || null);
          }).catch(() => {});
          api.get(`/events/${match.id}/activities`).then(({ data }) => {
            setLinkedEventActivityCount((data || []).length);
          }).catch(() => {});
        }
      }).catch(() => {});
    } else {
      setLinkedEvent(null);
    }
  }, [isCamping, activeCheckIn?.campground?.id]);

  useEffect(() => {
    if (isCamping && activeCheckIn?.campground?.id) {
      api.get(`/checkins/tonight/${activeCheckIn.campground.id}`)
        .then(({ data }) => setTonightData(data))

      // Load today's Walter stargazing post for Campfire tab
      api.get('/basecamp/feed?page=1&limit=30')
        .then(({ data }) => {
          const skyPost = (data.feedItems || []).find((item: any) => item.type === 'STARGAZING' || item.activityType === 'STARGAZING');
          setTonightSkyPost(skyPost || null);
        })
        .catch((e) => console.error("checkins/active failed:", e));
    } else {
      setTonightData(null);
      setTonightSkyPost(null);
    }
  }, [isCamping, activeCheckIn?.campground?.id]);
  const [showCampfireModal, setShowCampfireModal] = useState(false);
  const [showRversHere, setShowRversHere] = useState(false);
  const [rversHereList, setRversHereList] = useState<any[]>([]);

  useEffect(() => {
    if (showRversHere && activeCheckIn?.campground?.id) {
      api.get(`/campgrounds/${activeCheckIn.campground.id}`)
        .then(({ data }) => {
          const checkins = data.checkIns || data.activeCheckIns || [];
          setRversHereList(checkins);
        })
        .catch(() => {
          // Fallback: fetch from checkins endpoint
          api.get(`/checkins/campground/${activeCheckIn.campground.id}`)
            .then(({ data }) => setRversHereList(data.checkIns || data || []))
            .catch(() => {});
        });
    }
  }, [showRversHere, activeCheckIn?.campground?.id]);

  const [communityPosts, setCommunityPosts] = useState<any[]>([]);
  const [campfireVibeMsg, setCampfireVibeMsg] = useState<string | null>(null);
  const [campfireUnread, setCampfireUnread] = useState(0);
  const [triviaCountdown, setTriviaCountdown] = useState<string | null>(null);
  // Load community posts for discovery feed
  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
    fetch((import.meta.env.VITE_API_URL || '') + '/api/boards/posts/all?sort=hot&limit=5', {
      headers: token ? { Authorization: 'Bearer ' + token } : {},
    }).then(r => r.json()).then(d => { if (d.posts) setCommunityPosts(d.posts); }).catch((e) => console.error("checkins/active failed:", e));
  }, []);

  // Trivia countdown — only show when checked in at a campground
  useEffect(() => {
    const check = () => {
      if (!activeCheckIn?.campground) { setTriviaCountdown(null); return; }
      const now = new Date();
      const central = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
      const hours = central.getHours();
      const minutes = central.getMinutes();
      const totalMins = hours * 60 + minutes;
      const triviaSessions = [7 * 60 + 30, 12 * 60 + 25, 17 * 60 + 30];
      const sessionDuration = 30;
      let found = false;
      for (const start of triviaSessions) {
        const diff = start - totalMins;
        if (totalMins >= start && totalMins < start + sessionDuration) {
          setTriviaCountdown('🔥 Trivia LIVE'); found = true; break;
        } else if (diff > 0 && diff <= 30) {
          setTriviaCountdown(`🎯 Trivia in ${diff}min`); found = true; break;
        }
      }
      if (!found) setTriviaCountdown(null);
    };
    check();
    const interval = setInterval(check, 60000);
    return () => clearInterval(interval);
  }, [activeCheckIn]);



  const [newCampfirePosts, setNewCampfirePosts] = useState(0);
  const [showPackingModal, setShowPackingModal] = useState(false);
  const [showQuickCapture, setShowQuickCapture] = useState(false);

  useEffect(() => {
    if (user) {
      api.get('/checkins/active')
        .then(r => {
          const checkIn = r.data?.checkIn || null;
          setActiveCheckIn(checkIn);

          if (checkIn?.campground?.id) {
            const token = localStorage.getItem('token') || localStorage.getItem('authToken') || '';
            fetch(`${import.meta.env.VITE_API_URL || ''}/api/campfire/${checkIn.campground.id}/daily-vibe`, {
              headers: token ? { Authorization: `Bearer ${token}` } : {},
            }).then(r => r.json()).then(d => { if (d.message) setCampfireVibeMsg(d.message); }).catch((e) => console.error("checkins/active failed:", e));
          }
        })
        .catch((e) => console.error("checkins/active failed:", e));
    }
  }, [user?.id]);
  // Activity Feed State
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Top 8 Friends State
  const [topFriends, setTopFriends] = useState<Friend[]>([]);
  const [nearbyCampers, setNearbyCampers] = useState<any[]>([]);

  // Trip Planning Mode — enriched data
  const [planningData, setPlanningData] = useState<{
    activityCount: number;
    mealCount: number;
    attendees: Array<{ id: string; firstName: string; lastName: string; profilePicture?: string; status: string }>;
    packingTotal: number;
    packingDone: number;
    weather: { temperature: number; temperatureUnit: string; shortForecast: string } | null;
  } | null>(null);

  // Derived mode flags (computed after nextEvent is declared)
  const hasFutureTrip = !isCamping && !!nextEvent;

  const isDefaultMode = !isCamping && !nextEvent;

  // New user detection
  const isNewUser = user && user.createdAt && (Date.now() - new Date(user.createdAt).getTime() < 7 * 24 * 60 * 60 * 1000);
  const welcomeDismissed = localStorage.getItem('rvu_welcome_dismissed') === 'true';
  const completionDismissed = localStorage.getItem('rvu_completion_dismissed') === 'true';
  const [quizPicks, setQuizPicks] = useState<any[]>([]);
  const [creatingDraft, setCreatingDraft] = useState(false);

  // Resume onboarding state
  const [onboardingResume, setOnboardingResume] = useState<{ step: number; completed: boolean } | null>(null);
  const onboardingSkippedToday = localStorage.getItem('rvu_onboarding_skip_date') === new Date().toISOString().slice(0, 10);

  useEffect(() => {
    if (!user) return;
    api.get('/auth/me').then(({ data }) => {
      if (data && !data.onboardingCompleted && data.onboardingStep > 0) {
        setOnboardingResume({ step: data.onboardingStep, completed: data.onboardingCompleted });
      }
    }).catch(() => {});
  }, [user]);

  // Load quiz picks from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem('rvu_quiz_recommendations');
      if (stored) setQuizPicks(JSON.parse(stored));
    } catch {}
  }, []);

  // Profile completion score
  const completionScore = user ? [
    user.profilePicture ? 20 : 0,
    (user as any)?.rvType ? 20 : 0,
    (user as any)?.homeState ? 10 : 0,
    nextEvent ? 20 : 0,
    (user as any)?._count?.friends > 0 ? 15 : 0,
    user.bio ? 15 : 0,
  ].reduce((a, b) => a + b, 0) : 0;

  const missingItems = user ? [
    !user.profilePicture && { emoji: '📸', label: 'Add a profile photo', link: `/profile/${user.username}` },
    !(user as any)?.rvType && { emoji: '🚐', label: 'Complete your rig setup', link: '/rv-setup' },
    !nextEvent && { emoji: '🗺️', label: 'Plan your first trip', link: '/trips' },
    { emoji: '👥', label: 'Find camping friends', link: '/community' },
    !user.bio && { emoji: '✏️', label: 'Write a bio', link: `/profile/${user.username}` },
    !(user as any)?.homeState && { emoji: '📍', label: 'Set your home state', link: `/profile/${user.username}` },
  ].filter(Boolean) : [];

  const handleCreateDraftTrip = async (campground?: any) => {
    setCreatingDraft(true);
    try {
      const title = campground ? `My First Trip to ${campground.name}` : 'My First Trip';
      const { data } = await api.post('/events', {
        title,
        campgroundId: campground?.id,
        status: 'DRAFT',
        startDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      });
      navigate(`/trips/${data.id || data.event?.id}`);
    } catch { navigate('/trips'); }
    finally { setCreatingDraft(false); }
  };

  // Listen for localStorage changes (e.g. rig nudge dismiss) to trigger re-render
  const [, forceUpdate] = useState(0);
  useEffect(() => {
    const handler = () => forceUpdate(n => n + 1);
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // Load enriched Planning Mode data when nextEvent changes
  useEffect(() => {
    if (!hasFutureTrip || !nextEvent) { setPlanningData(null); return; }
    const eventId = nextEvent.id;
    let weather = null;

    Promise.allSettled([
      api.get(`/events/${eventId}/activities`),
      api.get(`/event-meals/${eventId}`),
      api.get(`/trips/${eventId}/attendees`),
      api.get(`/trip-packing/event/${eventId}`).catch(() => null),
    ]).then(async ([activitiesRes, mealsRes, attendeesRes, packingRes]) => {
      const activities = activitiesRes.status === 'fulfilled' ? (activitiesRes.value?.data || []) : [];
      const meals = mealsRes.status === 'fulfilled' ? (mealsRes.value?.data || []) : [];
      const attendees = attendeesRes.status === 'fulfilled' ? (attendeesRes.value?.data || []) : [];
      const packingData = packingRes?.status === 'fulfilled' ? (packingRes.value?.data || {}) : {};
      const packingItems = packingData.items || [];
      const packingStats = packingData.stats || null;

      // Try weather if campground has coords
      if (nextEvent.campground?.id) {
        try {
          const cgRes = await api.get(`/campgrounds/${nextEvent.campground.id}`);
          const cg = cgRes.data;
          if (cg?.latitude && cg?.longitude) {
            const wRes = await api.get(`/weather/forecast?lat=${cg.latitude}&lon=${cg.longitude}`);
            weather = wRes.data?.current || null;
          }
        } catch {}
      }

      setPlanningData({
        activityCount: activities.length,
        mealCount: meals.length,
        attendees: Array.isArray(attendees) ? attendees.map((a: any) => ({
          id: a.userId,
          firstName: a.user?.firstName || '',
          lastName: a.user?.lastName || '',
          profilePicture: a.user?.profilePicture || null,
          status: a.status,
        })) : [],
        packingTotal: packingStats ? packingStats.total : packingItems.length,
        packingDone: packingStats ? packingStats.packed : packingItems.filter((i: any) => i.isPacked || i.packed).length,
        weather,
      });
    });
  }, [nextEvent?.id, isCamping]);


  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Weather alert fetch — NWS API for next trip destination or home
  useEffect(() => {
    const fetchWeatherAlert = async () => {
      try {
        let lat: number | null = null;
        let lng: number | null = null;

        // Use next trip's campground coords if available
        if (nextEvent?.campground?.latitude && nextEvent?.campground?.longitude) {
          lat = Number(nextEvent.campground.latitude);
          lng = Number(nextEvent.campground.longitude);
        } else {
          // No trip coords — skip alert check
          return;
        }

        if (!lat || !lng) return;

        const res = await fetch(
          `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}&limit=5`,
          { headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' } }
        );
        if (!res.ok) return;

        const data = await res.json();
        const SEVERE = new Set(['Extreme', 'Severe']);
        const URGENT = new Set(['Immediate', 'Expected']);

        const alert = (data.features || []).find((f: any) => {
          const p = f.properties;
          return SEVERE.has(p.severity) || URGENT.has(p.urgency);
        });

        if (alert) {
          const p = alert.properties;
          setWeatherAlert({
            event: p.event || 'Weather Alert',
            headline: (p.headline || p.description || '').slice(0, 120),
            severity: p.severity || 'Severe',
          });
        } else {
          setWeatherAlert(null);
        }
      } catch {
        setWeatherAlert(null);
      }
    };

    fetchWeatherAlert();
    const interval = setInterval(fetchWeatherAlert, 60 * 60 * 1000); // refresh hourly
    return () => clearInterval(interval);
  }, [nextEvent?.campground?.latitude, nextEvent?.campground?.longitude]);

  // Random quote for when no trip is planned
  const [randomQuote] = useState(() => 
    INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]
  );

  // Planned Events State (non-wishlist upcoming events + future state visits)
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>([]);
  const [visitedStatesCount, setVisitedStatesCount] = useState(0);
  const [plannedTripsExpanded, setPlannedTripsExpanded] = useState(false);

  // Wishlist Events State
  const [wishlistEvents, setWishlistEvents] = useState<UpcomingEvent[]>([]);

  // RV Info State
  const [rvInfo, setRvInfo] = useState<any>(null);
  const [rvShowcase, setRvShowcase] = useState<any>(null);
  const [rvTab, setRvTab] = useState<'overview' | 'edit' | 'log'>('overview');
  const [rvEditData, setRvEditData] = useState({
    rvType: '',
    rvYear: '',
    rvMake: '',
    rvModel: '',
    rvLength: '',
    rvWidth: '',
    rvHeight: '',
    licensePlate: '',
    licensePlateState: '',
    tagExpiration: '',
    rvOdometer: '',
    homeCity: '',
    homeState: '',
    homeZipCode: '',
    travelPartyType: '',
    hasPets: false,
  });
  const [savingRv, setSavingRv] = useState(false);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [rvManualUrl, setRvManualUrl] = useState<string | null>(null);
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats | null>(null);
  const [weatherAlert, setWeatherAlert] = useState<{ event: string; headline: string; severity: string } | null>(null);

  // Packing List State
  const [packItems, setPackItems] = useState<PackItem[]>([]);
  const [packStats, setPackStats] = useState<PackStats>({ total: 0, packed: 0, unpacked: 0, progress: 0 });
  const [loadingPack, setLoadingPack] = useState(true);
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [showAddItem, setShowAddItem] = useState(false);
  const [userTrips, setUserTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);
  const [newItemTripId, setNewItemTripId] = useState<string>("");

  // Quick Links State
  const [quickLinks, setQuickLinks] = useState<QuickLink[]>(DEFAULT_QUICK_LINKS);
  const [editingLinks, setEditingLinks] = useState(false);
  const [composerExpanded, setComposerExpanded] = useState(false);
  const [feedTab, setFeedTab] = useState<'friends' | 'community' | 'campgrounds'>('friends');
  const [friendsHasNew, setFriendsHasNew] = useState(false);
  const [postTripNudge, setPostTripNudge] = useState<{ tripName: string } | null>(null);
  const [nudgeDismissed, setNudgeDismissed] = useState(false);
  const [communityHasNew, setCommunityHasNew] = useState(false);

  // Detect post-trip nudge: trip ended in last 7 days, no post since
  useEffect(() => {
    const dismissed = localStorage.getItem('rvu_nudge_dismissed_until');
    if (dismissed && parseInt(dismissed) > Date.now()) {
      setNudgeDismissed(true);
      return;
    }

    if (!plannedTrips.length) return;

    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    const recentTrip = plannedTrips.find(trip => {
      if (!trip.endDate) return false;
      const end = new Date(trip.endDate).getTime();
      return end < now && now - end < sevenDaysMs;
    });

    if (!recentTrip) return;

    // Check if user has posted since trip ended
    const tripEnd = new Date(recentTrip.endDate!).getTime();
    const hasPostedSince = feedItems.some(item => {
      const itemTime = new Date(item.createdAt).getTime();
      return itemTime > tripEnd && item.actor?.id === user?.id;
    });

    if (!hasPostedSince) {
      setPostTripNudge({ tripName: recentTrip.title || recentTrip.name || 'your recent trip' });
    }
  }, [plannedTrips.length, feedItems.length, user?.id]);

  // Pick the tab with the most recent post on load + set unread dots
  useEffect(() => {
    if (feedItems.length === 0 && communityPosts.length === 0) return;
    const friendsLatest = feedItems[0]?.createdAt ? new Date(feedItems[0].createdAt).getTime() : 0;
    const communityLatest = communityPosts[0]?.createdAt ? new Date(communityPosts[0].createdAt).getTime() : 0;
    const lastViewed = parseInt(localStorage.getItem('rvu_feed_last_viewed') || '0');
    if (friendsLatest > lastViewed) setFriendsHasNew(true);
    if (communityLatest > lastViewed) setCommunityHasNew(true);
    if (friendsLatest >= communityLatest && feedItems.length > 0) {
      setFeedTab('friends');
    } else if (communityLatest > friendsLatest && communityPosts.length > 0) {
      setFeedTab('community');
    }
  }, [feedItems.length, communityPosts.length]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Stickers/Badges State
  const [userStickers, setUserStickers] = useState<UserSticker[]>([]);
  const [userBadges, setUserBadges] = useState<any[]>([]);

  // Groups State
  const [userGroups, setUserGroups] = useState<UserGroup[]>([]);

  // Social Links State
  const [socialLinks, setSocialLinks] = useState({
    website: '',
    facebookUrl: '',
    instagramUrl: '',
    twitterUrl: '',
    youtubeUrl: '',
    $tiktokUrl: '',
    showSocialOnProfile: true,
    showSocialOnCreator: true,
  });
  const [editingSocial, setEditingSocial] = useState(false);
  const [savingSocial, setSavingSocial] = useState(false);

  // Helper to build full social URLs from handles
  const buildSocialUrl = (handle: string, platform: string): string => {
    if (!handle) return "";
    if (handle.startsWith("http")) return handle;
    const cleaned = handle.replace(/^@/, "").trim();
    const bases: Record<string, string> = {
      facebook: "https://facebook.com/",
      instagram: "https://instagram.com/",
      twitter: "https://x.com/",
      youtube: "https://youtube.com/@",
      tiktok: "https://tiktok.com/@",
    };
    return bases[platform] ? bases[platform] + cleaned : handle;
  };

  // Recipe Box State
  const [savedRecipes, setSavedRecipes] = useState<SavedRecipe[]>([]);
  const [recipeBoxExpanded, setRecipeBoxExpanded] = useState(false);

  // Load Activity Feed
  const loadFeed = async (pageNum = 1) => {
    try {
      setLoading(true);
      const { data } = await api.get(`/basecamp/feed?page=${pageNum}&limit=20`);
      
      if (pageNum === 1) {
        setFeedItems(data.feedItems || []);
      } else {
        setFeedItems(prev => [...prev, ...(data.feedItems || [])]);
      }
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (error) {
      console.error('Load feed error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load Nearby Campers
  useEffect(() => {
    api.get('/checkins/nearby-friends')
      .then(({ data }) => setNearbyCampers(data || []))
      .catch(() => {});
  }, []);

  // Load Top 8 Friends
  const loadTopFriends = useCallback(async () => {
    if (!user?.username) return;
    try {
      const { data } = await api.get("/top-friends");
      setTopFriends((data.friends || data || []).slice(0, 8));
    } catch (error) {
      console.error('Failed to load friends:', error);
    }
  }, [user?.username]);

  // Load Events and State Visits (upcoming, wishlist, and next event for countdown)
  const loadEvents = useCallback(async () => {
    try {
      // Load all user's events
      const { data: eventsData } = await api.get('/trips/my');
      const events = Array.isArray(eventsData) ? eventsData : [];
      
      // Get today's date at midnight for comparison
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      // Filter upcoming/ongoing non-wishlist events (for planned events list and countdown)
      const upcomingEvents = events
        .filter((e: UpcomingEvent) => {
          if (e.isWishlist) return false;
          
          const startDate = new Date(e.startDate);
          startDate.setHours(0, 0, 0, 0);
          
          const endDate = e.endDate ? new Date(e.endDate) : startDate;
          endDate.setHours(23, 59, 59, 999);
          
          return startDate >= today || endDate >= new Date();
        })
        .sort((a: UpcomingEvent, b: UpcomingEvent) => 
          new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
        );
      
      // Filter wishlist events
      const wishlist = events.filter((e: UpcomingEvent) => e.isWishlist === true);
      setWishlistEvents(wishlist);
      
      // Set next event for countdown - only future events
      const now = new Date();
      const futureEvents = upcomingEvents.filter((e: UpcomingEvent) => new Date(e.startDate) > now);
      if (futureEvents.length > 0) {
        setNextEvent(futureEvents[0]);
      } else {
        setNextEvent(null);
      }

      // Convert events to PlannedTrip format
      const eventTrips: PlannedTrip[] = upcomingEvents.map((e: UpcomingEvent) => ({
        id: e.id,
        title: e.title || e.name || 'Untitled Trip',
        startDate: e.startDate,
        endDate: e.endDate,
        location: e.location,
        type: 'event' as const,
        campground: e.campground,
      }));

      // Load state visits for future planned trips
      let stateVisitTrips: PlannedTrip[] = [];
      try {
        if (user?.id) {
          const { data: travelData } = await api.get(`/travel-map/${user.id}`);
          const stateVisits = travelData.stateVisits || [];
          setVisitedStatesCount(stateVisits.length);
          
          // Filter future state visits
          const futureVisits = stateVisits.filter((visit: any) => {
            const visitDate = new Date(visit.startDate);
            visitDate.setHours(0, 0, 0, 0);
            return visitDate >= today;
          });

          stateVisitTrips = futureVisits.map((visit: any) => ({
            id: visit.id,
            title: visit.campsite?.name || visit.notes || `Trip to ${visit.state}`,
            startDate: visit.startDate,
            endDate: visit.endDate,
            location: visit.campsite?.location || visit.state,
            type: 'stateVisit' as const,
            campground: visit.campsite ? {
              id: visit.campsite.id,
              name: visit.campsite.name,
              state: visit.state,
            } : undefined,
            state: visit.state,
          }));
        }
      } catch (err) {
        console.error('Failed to load state visits:', err);
      }

      // Combine and sort by date
      const allTrips = [...eventTrips, ...stateVisitTrips]
        .sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
      
      setPlannedTrips(allTrips.slice(0, 3));

    } catch (error) {
      console.error('Failed to load events:', error);
      // Fallback to /trips/upcoming endpoint
      try {
        const { data } = await api.get('/trips/upcoming');
        if (data && data.length > 0) {
          setNextEvent(data[0]);
          setPlannedTrips(data.slice(0, 3).map((e: UpcomingEvent) => ({
            id: e.id,
            title: e.title || e.name || 'Untitled Trip',
            startDate: e.startDate,
            endDate: e.endDate,
            type: 'event' as const,
            campground: e.campground,
          })));
        }
      } catch (err) {
        console.error('Failed to load upcoming events:', err);
      }
    }
  }, [user?.id]);

  // Load RV Info and Social Links
  const loadRVInfo = useCallback(async () => {
    if (!user?.username) return;
    try {
      const { data: profile } = await api.get(`/profile/${user.username}`);
      setUserProfile(profile);
      setRvInfo({
        rvType: profile.rvType,
        rvYear: profile.rvYear,
        rvMake: profile.rvMake,
        rvModel: profile.rvModel,
      });

      // Fetch manual URL from database
      try {
        if (profile.rvMake) {
          const { data: manualData } = await api.get(`/rv/manual?makeName=${encodeURIComponent(profile.rvMake)}`);
          setRvManualUrl(manualData.manualUrl || null);
        }
      } catch (e) {
        // ignore
      }

      // Populate edit form data
      setRvEditData({
        rvType: profile.rvType || '',
        rvYear: profile.rvYear || '',
        rvMake: profile.rvMake || '',
        rvModel: profile.rvModel || '',
        rvLength: profile.rvLength || '',
        rvWidth: profile.rvWidth || '',
        rvHeight: profile.rvHeight || '',
        licensePlate: profile.licensePlate || '',
        licensePlateState: profile.licensePlateState || '',
        tagExpiration: profile.tagExpiration || '',
        rvOdometer: profile.rvOdometer || '',
        homeCity: profile.homeCity || '',
        homeState: profile.homeState || '',
        homeZipCode: profile.homeZipCode || '',
        travelPartyType: profile.travelPartyType || '',
        hasPets: profile.hasPets || false,
      });

      // Load social links
      setSocialLinks({
        website: profile.website || '',
        facebookUrl: profile.facebookUrl || '',
        instagramUrl: profile.instagramUrl || '',
        twitterUrl: profile.twitterUrl || '',
        youtubeUrl: profile.youtubeUrl || '',
        tiktokUrl: profile.tiktokUrl || '',
        showSocialOnProfile: profile.showSocialOnProfile ?? true,
        showSocialOnCreator: profile.showSocialOnCreator ?? true,
      });

      try {
        const { data: showcase } = await api.get(`/rv-showcase/user/${user.id}`);
        setRvShowcase(showcase);
      } catch (e) {
        // RV showcase might not exist
      }
    } catch (error) {
      console.error('Failed to load RV info:', error);
    }
  }, [user?.username, user?.id]);

  // Load Maintenance Stats
  const loadMaintenanceStats = useCallback(async () => {
    try {
      const { data } = await api.get('/maintenance/stats');
      setMaintenanceStats(data);
    } catch (error) {
      console.error('Failed to load maintenance stats:', error);
    }
  }, []);

  // Load Packing List
  const loadPackingList = useCallback(async () => {
    try {
      const { data } = await api.get('/personal-pack');
      setPackItems(data.items || []);
      setPackStats(data.stats || { total: 0, packed: 0, unpacked: 0, progress: 0 });
    } catch (error) {
      console.error('Failed to load packing list:', error);
    } finally {
      setLoadingPack(false);
    }
  }, []);

  const loadUserTrips = useCallback(async () => {
    try {
      const { data } = await api.get("/trips/upcoming");
      setUserTrips(Array.isArray(data) ? data : data ? [data] : []);
    } catch (error) {
      console.error("Failed to load trips:", error);
    }
  }, []);

  // Load Quick Links Preferences
  const loadQuickLinks = useCallback(async () => {
    try {
      const { data } = await api.get('/preferences');
      if (data.quickLinks && data.quickLinks.length > 0) {
        setQuickLinks(data.quickLinks);
      }
    } catch (error) {
      console.error('Failed to load quick links:', error);
    }
  }, []);

  // Load User Stickers/Badges
  const loadUserStickers = useCallback(async () => {
    try {
      const { data } = await api.get('/stickers/my-stickers');
      setUserStickers(data || []);
      
      // Load badges
      try {
        const badgeRes = await api.get('/badges/my');
        setUserBadges(badgeRes.data?.badges || badgeRes.data?.earned || []);
      } catch (err) {
        console.error('Failed to load badges:', err);
      }
    } catch (error) {
      console.error('Failed to load stickers:', error);
    }
  }, []);

  // Load User's Groups
  const loadUserGroups = useCallback(async () => {
    try {
      const { data } = await api.get('/groups/my');
      setUserGroups(data || []);
    } catch (error) {
      console.error('Failed to load groups:', error);
    }
  }, []);

  // Load Saved Recipes
  const loadSavedRecipes = useCallback(async () => {
    try {
      const { data } = await api.get('/recipes/saved');
      // Sort by favorite first, then by most recent
      const sorted = (data || []).sort((a: SavedRecipe, b: SavedRecipe) => {
        if (a.favorite && !b.favorite) return -1;
        if (!a.favorite && b.favorite) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setSavedRecipes(sorted.slice(0, 5));
    } catch (error) {
      console.error('Failed to load saved recipes:', error);
    }
  }, []);

  // Countdown Timer Effect
  useEffect(() => {
    if (!nextEvent?.startDate) {
      // No next event - reload to check for new ones
      return;
    }

    const eventDate = new Date(nextEvent.startDate).getTime();
    
    // If event already started, reload events to get the next one
    if (eventDate <= Date.now()) {
      loadEvents();
      return;
    }

    const calculateCountdown = () => {
      const now = new Date().getTime();
      const diff = eventDate - now;

      if (diff <= 0) {
        // Event has started - reload events to get next one
        loadEvents();
        return;
      }

      setCountdown({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      });
    };

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);
    return () => clearInterval(interval);
  }, [nextEvent, loadEvents]);

  // Initial Data Load
  useEffect(() => {
    if (user) {
      loadFeed();
      loadTopFriends();
      loadEvents();
      loadRVInfo();
      loadMaintenanceStats();
      loadPackingList();
      loadQuickLinks();
      loadUserStickers();
      loadUserGroups();
      loadSavedRecipes();
    }
  }, [user, loadTopFriends, loadEvents, loadRVInfo, loadMaintenanceStats, loadPackingList, loadQuickLinks, loadUserStickers, loadUserGroups, loadSavedRecipes]);

  // Packing List Functions
  const addPackItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await api.post('/personal-pack', {
        name: newItemName.trim(),
        category: newItemCategory,
      });
      setNewItemName('');
      setShowAddItem(false);
      loadPackingList();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const togglePackItem = async (id: string) => {
    try {
      await api.post(`/personal-pack/${id}/toggle`);
      loadPackingList();
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const deletePackItem = async (id: string) => {
    try {
      await api.delete(`/personal-pack/${id}`);
      loadPackingList();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const unpackAll = async () => {
    try {
      await api.post('/personal-pack/unpack-all', {});
      loadPackingList();
    } catch (error) {
      console.error('Failed to unpack all:', error);
    }
  };

  // Quick Links Functions
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newLinks = [...quickLinks];
    const draggedItem = newLinks[draggedIndex];
    newLinks.splice(draggedIndex, 1);
    newLinks.splice(index, 0, draggedItem);
    setQuickLinks(newLinks);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    try {
      await api.put('/preferences/quick-links', { quickLinks });
    } catch (error) {
      console.error('Failed to save quick links:', error);
    }
  };

  const resetQuickLinks = async () => {
    setQuickLinks(DEFAULT_QUICK_LINKS);
    try {
      await api.post('/preferences/reset-quick-links');
    } catch (error) {
      console.error('Failed to reset quick links:', error);
    }
  };

  const addQuickLink = async (link: QuickLink) => {
    if (quickLinks.find((l) => l.id === link.id)) return;
    const newLinks = [...quickLinks, link];
    setQuickLinks(newLinks);
    try {
      await api.put('/preferences/quick-links', { quickLinks: newLinks });
    } catch (error) {
      console.error('Failed to add quick link:', error);
    }
  };

  const removeQuickLink = async (linkId: string) => {
    const newLinks = quickLinks.filter((l) => l.id !== linkId);
    setQuickLinks(newLinks);
    try {
      await api.put('/preferences/quick-links', { quickLinks: newLinks });
    } catch (error) {
      console.error('Failed to remove quick link:', error);
    }
  };

  const getQuickLinkPath = (path: string) => {
    return path.replace('{username}', user?.username || '');
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    return date.toLocaleDateString();
  };

  const getActivityConfig = (item: FeedItem) => {
    const type = item.activityType || item.type;
    return ACTIVITY_CONFIG[type] || { 
      label: 'did something', 
      icon: <Activity className="w-4 h-4" />, 
      color: 'bg-gray-100 text-gray-600' 
    };
  };

  // Save Social Links
  const saveSocialLinks = async () => {
    setSavingSocial(true);
    try {
      await api.put(`/profile/${user?.username}`, socialLinks);
      setEditingSocial(false);
    } catch (error) {
      console.error('Failed to save social links:', error);
    } finally {
      setSavingSocial(false);
    }
  };

  // Check if user has any social links
  const hasSocialLinks = socialLinks.website || socialLinks.facebookUrl || 
    socialLinks.instagramUrl || socialLinks.twitterUrl || 
    socialLinks.youtubeUrl || socialLinks.tiktokUrl;

  if (!user) {
    return <LandingPage />;
  }


  if (isDriving && !drivingMinimized) {
    return (
      <DrivingMode
        nextEvent={nextEvent}
        rvMpg={(user as any)?.rvMpg || undefined}
        onMinimize={() => setDrivingMinimized(true)}
        onExit={() => {
          setIsDriving(false);
          setDrivingMinimized(false);
          setProximityAlertShown(false);
          localStorage.removeItem('rvunicorn_driving');
          localStorage.removeItem('rvunicorn_drive_start');
          localStorage.removeItem('rvunicorn_drive_role');
        }}
      />
    );
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">
      {/* ── CAMPING MODE HEADER BANNER (Phase 3) ─────────────────────────── */}
      {isCamping && activeCheckIn?.campground && (
        <div className="bg-gradient-to-r from-green-800 via-green-700 to-emerald-700 text-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">

              {/* Left: Campground identity */}
              <div className="flex items-center gap-4">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <span className="text-2xl">🏕️</span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold leading-tight">
                      <Link to={`/campgrounds/${activeCheckIn.campground.id}`} className="hover:underline">{activeCheckIn.campground.name}</Link>
                    </h2>
                    <span className="text-xs bg-green-500/50 border border-green-400/40 px-2 py-0.5 rounded-full font-medium">
                      ✅ Checked In
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-green-100 text-sm mt-0.5">
                    {activeCheckIn.campground.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {activeCheckIn.campground.city
                          ? `${activeCheckIn.campground.city}, ${activeCheckIn.campground.state}`
                          : activeCheckIn.campground.state || activeCheckIn.campground.location}
                      </span>
                    )}
                    {activeCheckIn.checkInDate && (
                      <span>📅 Checked in {new Date(activeCheckIn.checkInDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                    {activeCheckIn.checkOutDate && (
                      <span>→ {new Date(activeCheckIn.checkOutDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                    {activeCheckIn.siteNumber && (
                      <span>🪧 Site {activeCheckIn.siteNumber}</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                {linkedEvent ? (
                  <a
                    href={`/trips/${linkedEvent.id}`}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg font-semibold transition text-sm shadow-sm"
                  >
                    📅 My Trip
                  </a>
                ) : (
                  <button
                    onClick={() => document.getElementById('camp-marketplace')?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex items-center gap-2 bg-orange-500 hover:bg-orange-400 text-white px-4 py-2 rounded-lg font-semibold transition text-sm shadow-sm"
                  >
                    🛒 Campsite Marketplace
                  </button>
                )}
                <a
                  href={`/campgrounds/${activeCheckIn.campground.id}`}
                  className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 text-white border border-white/20 px-3 py-2 rounded-lg text-sm font-medium transition"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Campground Page
                </a>
                <button
                  onClick={() => {
                    if (window.confirm('Check out of ' + activeCheckIn.campground.name + '?')) {
                      import('../services/api').then(({ default: apiService }) => {
                        apiService.delete('/checkins/active').then(() => {
                          setActiveCheckIn(null);
                          window.location.reload();
                        }).catch(() => alert('Failed to check out'));
                      });
                    }
                  }}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-red-500/70 text-white/80 hover:text-white border border-white/15 px-3 py-2 rounded-lg text-sm font-medium transition"
                  title="Check out"
                >
                  🚪 Check Out
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Welcome Kit (shown when camping) ────────────────────────── */}
      {isCamping && activeCheckIn?.campground?.id && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4">
          <WelcomeKit
            campgroundId={activeCheckIn.campground.id}
            campgroundName={activeCheckIn.campground.name}
            checkInDate={activeCheckIn.checkInDate}
            checkOutDate={activeCheckIn.checkOutDate}
          />
        </div>
      )}

      {/* ── Return to Driving Mode banner (minimized) ─────────────────── */}
      {isDriving && drivingMinimized && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-blue-900 border-b border-blue-700 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xl">🚐</span>
            <div>
              <p className="text-sm font-bold text-white">Guardian Mode Active</p>
              <p className="text-xs text-blue-300">Your drive is still being tracked</p>
            </div>
          </div>
          <button
            onClick={() => setDrivingMinimized(false)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-xl transition"
          >
            Return →
          </button>
        </div>
      )}

      {/* ── Proximity Check-In Modal ─────────────────────────────────── */}
      {showProximityCheckIn && nextEvent && !proximityCheckedIn && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">🏕️</span>
                  <div>
                    <p className="font-black text-white text-lg leading-tight">Almost there!</p>
                    <p className="text-green-100 text-xs">~1 hour from your campground</p>
                  </div>
                </div>
                <button onClick={() => setShowProximityCheckIn(false)} className="text-white/70 hover:text-white">✕</button>
              </div>
            </div>
            <div className="px-5 py-5 space-y-4">
              <div>
                <p className="font-bold text-gray-900 text-base">{(nextEvent.campground as any)?.name || nextEvent.title}</p>
                <p className="text-sm text-gray-500">Ready to check in when you arrive?</p>
              </div>
              {/* Site number */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Your Site Number <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  value={proximitySiteNumber}
                  onChange={e => setProximitySiteNumber(e.target.value)}
                  placeholder="e.g. 42, A14, Loop B"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 text-sm"
                />
              </div>
              {/* Call campground */}
              {(nextEvent.campground as any)?.phone && (
                <a href={`tel:${(nextEvent.campground as any).phone}`}
                  className="flex items-center gap-2 text-sm text-green-600 hover:text-green-700 font-medium">
                  📞 Call to confirm: {(nextEvent.campground as any).phone}
                </a>
              )}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setShowProximityCheckIn(false)}
                  className="flex-1 py-3 border border-gray-200 text-gray-600 rounded-xl text-sm font-medium hover:bg-gray-50 transition"
                >
                  Check In Later
                </button>
                <button
                  onClick={async () => {
                    if (!(nextEvent.campground as any)?.id) return;
                    setProximityCheckingIn(true);
                    try {
                      await api.post('/checkins', {
                        campgroundId: (nextEvent.campground as any).id,
                        siteNumber: proximitySiteNumber || null,
                      });
                      setProximityCheckedIn(true);
                      setShowProximityCheckIn(false);
                      // Refresh check-in status
                      const { data } = await api.get('/checkins/active');
                      setActiveCheckIn(data?.checkIn || null);
                    } catch (e) {
                      console.error('Proximity check-in failed:', e);
                    }
                    setProximityCheckingIn(false);
                  }}
                  disabled={proximityCheckingIn}
                  className="flex-1 py-3 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white rounded-xl text-sm font-bold transition"
                >
                  {proximityCheckingIn ? 'Checking in...' : "🏕️ Check In Now"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pre-Trip Intelligence + Start Driving Mode */}
      {(hasFutureTrip || isCamping) && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-4 space-y-2">
          {hasFutureTrip && nextEvent && (() => {
            const rvMpg = (user as any)?.rvMpg || 8;
            const daysUntil = nextEvent.startDate ? Math.ceil((new Date(nextEvent.startDate).getTime() - Date.now()) / 86400000) : null;
            const weather = planningData?.weather;
            const hour = new Date().getHours();
            const isNightDrive = hour >= 20 || hour < 6;
            const risks: string[] = [];
            if (isNightDrive) risks.push('🌙 Night driving detected');
            if (daysUntil !== null && daysUntil === 0) risks.push('⚡ Drive day — take breaks every 2h');
            try {
              const hist = JSON.parse(localStorage.getItem('rvu_drive_history') || '[]');
              const yesterday = hist[hist.length - 1];
              if (yesterday?.hours > 6) risks.push(`😴 You drove ${yesterday.hours.toFixed(1)}h yesterday`);
            } catch {}
            return (
              <div className="bg-blue-950 border border-blue-800 rounded-2xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">🛡️</span>
                  <p className="text-sm font-bold text-blue-200">Pre-Trip Intelligence</p>
                  {daysUntil !== null && (
                    <span className={`ml-auto text-xs font-semibold px-2 py-0.5 rounded-full ${daysUntil === 0 ? 'bg-green-700 text-green-100' : 'bg-blue-800 text-blue-200'}`}>
                      {daysUntil === 0 ? 'Drive day!' : `${daysUntil}d away`}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="bg-blue-900/50 rounded-xl p-2 text-center">
                    <p className="text-lg">⏱️</p>
                    <p className="text-xs text-blue-300 mt-0.5">Break every</p>
                    <p className="text-sm font-bold text-white">2 hrs</p>
                  </div>
                  <div className="bg-blue-900/50 rounded-xl p-2 text-center">
                    <p className="text-lg">⛽</p>
                    <p className="text-xs text-blue-300 mt-0.5">Your MPG</p>
                    <p className="text-sm font-bold text-white">{rvMpg} mpg</p>
                  </div>
                  <div className="bg-blue-900/50 rounded-xl p-2 text-center">
                    <p className="text-lg">{weather ? (weather.shortForecast?.toLowerCase().includes('rain') ? '🌧️' : '☀️') : '🌡️'}</p>
                    <p className="text-xs text-blue-300 mt-0.5">At camp</p>
                    <p className="text-sm font-bold text-white">{weather ? `${weather.temperature}°` : '—'}</p>
                  </div>
                </div>
                {risks.length > 0 ? (
                  <div className="space-y-1">{risks.map((r, i) => <p key={i} className="text-xs text-amber-300">{r}</p>)}</div>
                ) : (
                  <p className="text-xs text-green-400">✅ No risk flags — have a great drive!</p>
                )}
              </div>
            );
          })()}
          {hasFutureTrip && nextEvent?.campground?.id && (
            <CampMarket campgroundId={nextEvent.campground.id} compact />
          )}
          <button
            onClick={() => { setIsDriving(true); localStorage.setItem('rvunicorn_driving', 'true'); }}
            className="w-full flex items-center gap-3 bg-white border border-primary-200 rounded-2xl px-4 py-3.5 hover:border-primary-400 hover:shadow-sm transition-all text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 text-xl">🚐</div>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Start Driving Mode</p>
              <p className="text-gray-500 text-xs">Guardian Mode · Fatigue score · Co-pilot</p>
            </div>
            <span className="text-primary-400 text-sm font-semibold">Start →</span>
          </button>
        </div>
      )}

      {/* Event Countdown Banner OR Inspirational Quote — Planning Mode only */}
      {isPlanning && (nextEvent ? (
        <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white py-4">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-3">
                <Clock className="w-6 h-6" />
                <div>
                  <p className="text-sm text-blue-100">Countdown to</p>
                  <Link to={`/trips/${nextEvent.id}`} className="font-bold hover:underline">
                    {nextEvent.title || nextEvent.name}
                  </Link>
                  {nextEvent.campground && (
                    <p className="text-xs text-blue-200">at {nextEvent.campground.name}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-center bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.days}</div>
                  <div className="text-xs text-blue-100">Days</div>
                </div>
                <div className="text-center bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.hours}</div>
                  <div className="text-xs text-blue-100">Hours</div>
                </div>
                <div className="text-center bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.minutes}</div>
                  <div className="text-xs text-blue-100">Min</div>
                </div>
                <div className="text-center bg-white/20 rounded-lg px-3 py-2 min-w-[60px]">
                  <div className="text-2xl font-bold">{countdown.seconds}</div>
                  <div className="text-xs text-blue-100">Sec</div>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-blue-100">Starting</p>
                <p className="font-medium">
                  {new Date(nextEvent.startDate).toLocaleDateString('en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric',
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-start gap-4 flex-1">
                <div className="p-3 bg-white/20 rounded-full">
                  <Tent className="w-8 h-8" />
                </div>
                <div className="flex-1">
                  <p className="text-lg md:text-xl font-medium italic">
                    "{randomQuote.quote}"
                  </p>
                  <p className="text-emerald-200 mt-1">— {randomQuote.author}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Link
                  to="/trips"
                  className="bg-white text-emerald-700 hover:bg-emerald-50 px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <CalendarPlus className="w-5 h-5" />
                  Plan a Trip
                </Link>
                <Link
                  to="/campgrounds"
                  className="bg-white/20 hover:bg-white/30 text-white px-4 py-2 rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  <MapPin className="w-5 h-5" />
                  Explore
                </Link>
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* ── TRIP PLANNING MODE PANEL ─────────────────────────────── */}
      {hasFutureTrip && nextEvent && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="bg-gradient-to-br from-primary-50 to-blue-50 border border-primary-200 rounded-2xl p-5 mb-4">

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">🗺️</span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-primary-500">Planning Mode</p>
                  <h3 className="font-bold text-gray-900 text-lg leading-tight">{nextEvent.title || nextEvent.name}</h3>
                  {nextEvent.campground && <p className="text-sm text-gray-500">at {nextEvent.campground.name}</p>}
                </div>
              </div>
              <Link to={`/trips/${nextEvent.id}`} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                Open Trip →
              </Link>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              <div className="bg-white rounded-xl p-3 text-center border border-primary-100">
                <div className="text-2xl font-bold text-primary-700">{countdown.days}</div>
                <div className="text-xs text-gray-500 font-medium">Days Away</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-primary-100">
                <div className="text-2xl font-bold text-primary-700">{planningData?.activityCount ?? '—'}</div>
                <div className="text-xs text-gray-500 font-medium">Activities</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-primary-100">
                <div className="text-2xl font-bold text-primary-700">{planningData?.mealCount ?? '—'}</div>
                <div className="text-xs text-gray-500 font-medium">Meals</div>
              </div>
              <div className="bg-white rounded-xl p-3 text-center border border-primary-100">
                <div className="text-2xl font-bold text-primary-700">{planningData?.attendees.length ?? '—'}</div>
                <div className="text-xs text-gray-500 font-medium">Attendees</div>
              </div>
            </div>

            {/* Packing progress */}
            {planningData && planningData.packingTotal > 0 && (
              <div className="bg-white rounded-xl p-3 border border-primary-100 mb-3">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold text-gray-700">🎒 Packing Progress</span>
                  <span className="text-xs text-gray-500">{planningData.packingDone} / {planningData.packingTotal} packed</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-2">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.round((planningData.packingDone / planningData.packingTotal) * 100)}%` }}
                  />
                </div>
              </div>
            )}

            {/* Attendee RSVP Readiness */}
            {planningData && planningData.attendees.length > 0 && (() => {
              const confirmed = planningData.attendees.filter(a => a.status === 'going' || a.status === 'ATTENDING');
              const maybe = planningData.attendees.filter(a => a.status === 'maybe' || a.status === 'MAYBE');
              const pending = planningData.attendees.filter(a => !['going','ATTENDING','maybe','MAYBE'].includes(a.status));
              const total = planningData.attendees.length;
              const allReady = pending.length === 0;
              return (
                <div className="bg-white rounded-xl p-3 border border-primary-100 mb-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-semibold text-gray-700">👥 Who's Going</p>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${allReady ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                      {allReady ? '✓ Everyone confirmed!' : `${pending.length} awaiting response`}
                    </span>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mb-2">
                    <div className="h-full bg-gradient-to-r from-green-400 to-green-500 rounded-full transition-all"
                      style={{ width: `${total > 0 ? (confirmed.length / total) * 100 : 0}%` }} />
                  </div>

                  {/* Confirmed avatars */}
                  <div className="flex items-center gap-1.5 flex-wrap mb-2">
                    {confirmed.map((a) => (
                      <div key={a.id} className="flex items-center gap-1 bg-green-50 rounded-full px-2 py-0.5 border border-green-200">
                        {a.profilePicture
                          ? <img src={a.profilePicture} alt="" className="w-4 h-4 rounded-full object-cover" />
                          : <div className="w-4 h-4 rounded-full bg-green-200 flex items-center justify-center text-green-700 text-xs font-bold">{a.firstName?.[0]}</div>
                        }
                        <span className="text-xs text-green-800 font-medium">{a.firstName}</span>
                        <span className="text-green-500 text-xs">✓</span>
                      </div>
                    ))}
                    {maybe.map((a) => (
                      <div key={a.id} className="flex items-center gap-1 bg-yellow-50 rounded-full px-2 py-0.5 border border-yellow-200">
                        {a.profilePicture
                          ? <img src={a.profilePicture} alt="" className="w-4 h-4 rounded-full object-cover" />
                          : <div className="w-4 h-4 rounded-full bg-yellow-200 flex items-center justify-center text-yellow-700 text-xs font-bold">{a.firstName?.[0]}</div>
                        }
                        <span className="text-xs text-yellow-800 font-medium">{a.firstName}</span>
                        <span className="text-yellow-500 text-xs">?</span>
                      </div>
                    ))}
                  </div>

                  {/* Pending / no response */}
                  {pending.length > 0 && (
                    <div className="border-t border-gray-100 pt-2 mt-1">
                      <p className="text-xs text-gray-500 mb-1.5">⏳ Awaiting response:</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {pending.map((a) => (
                          <div key={a.id} className="flex items-center gap-1 bg-gray-50 rounded-full px-2 py-0.5 border border-gray-200">
                            {a.profilePicture
                              ? <img src={a.profilePicture} alt="" className="w-4 h-4 rounded-full object-cover opacity-60" />
                              : <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">{a.firstName?.[0]}</div>
                            }
                            <span className="text-xs text-gray-500">{a.firstName}</span>
                            <span className="text-gray-400 text-xs">—</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Summary line */}
                  <p className="text-xs text-gray-400 mt-2">
                    {confirmed.length} confirmed{maybe.length > 0 ? ` · ${maybe.length} maybe` : ''}{pending.length > 0 ? ` · ${pending.length} no response` : ''}
                  </p>
                </div>
              );
            })()}

            {/* Weather preview */}
            {planningData?.weather && (
              <div className="bg-white rounded-xl p-3 border border-primary-100 mb-3 flex items-center gap-3">
                <span className="text-2xl">{planningData.weather.shortForecast?.toLowerCase().includes('rain') ? '🌧️' : planningData.weather.shortForecast?.toLowerCase().includes('snow') ? '❄️' : planningData.weather.shortForecast?.toLowerCase().includes('cloud') ? '☁️' : '☀️'}</span>
                <div>
                  <p className="text-xs font-semibold text-gray-700">Current weather at {nextEvent.campground?.name}</p>
                  <p className="text-sm text-gray-600">{planningData.weather.temperature}°{planningData.weather.temperatureUnit} · {planningData.weather.shortForecast}</p>
                </div>
              </div>
            )}

            {/* Supply List compact */}
            <SupplyListCompact eventId={nextEvent.id} />

            {/* Quick action links */}
            <div className="flex flex-wrap gap-2">
              <Link to={`/trips/${nextEvent.id}?tab=schedule`} className="flex items-center gap-1.5 bg-white border border-primary-200 text-primary-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-50 transition">📅 Schedule</Link>
              <Link to={`/trips/${nextEvent.id}?tab=pack`} className="flex items-center gap-1.5 bg-white border border-primary-200 text-primary-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-50 transition">🎒 Packing</Link>
              <Link to={`/trips/${nextEvent.id}?tab=meals`} className="flex items-center gap-1.5 bg-white border border-primary-200 text-primary-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-50 transition">🍽️ Meals</Link>
              {nextEvent.campground && (
                <Link to={`/campgrounds/${nextEvent.campground.id}`} className="flex items-center gap-1.5 bg-white border border-primary-200 text-primary-700 text-sm font-medium px-3 py-2 rounded-xl hover:bg-primary-50 transition">🏕️ Campground</Link>
              )}
            </div>

          </div>
          {nextEvent.campground?.id && (
            <div className="mt-4">
              <CampMarket campgroundId={nextEvent.campground.id} compact />
            </div>
          )}
        </div>
      )}
      {/* ── END TRIP PLANNING MODE PANEL ──────────────────────────── */}

      {/* ── TRIP PLANNING MODE PANEL ─────────────────────────────── */}
      
      {isPlanning && (<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Status - Collapsed Composer */}
        {userProfile && (
          <div className="bg-white rounded-lg shadow-md mb-6 overflow-hidden">
            {!composerExpanded ? (
              <button
                onClick={() => setComposerExpanded(true)}
                className="w-full p-3 flex items-center gap-3 hover:bg-gray-50 transition-colors text-left"
              >
                {user?.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-9 h-9 rounded-full object-cover border border-gray-200" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center">
                    <User className="w-4 h-4 text-white" />
                  </div>
                )}
                <span className="text-gray-400 text-sm flex-1">What's on your mind, {user?.firstName || 'camper'}?</span>
                <div className="flex items-center gap-2 text-gray-300">
                  <Camera className="w-4 h-4" />
                  <MapPin className="w-4 h-4" />
                  <Smile className="w-4 h-4" />
                </div>
              </button>
            ) : (
              <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-500">Create a post</span>
                  <button onClick={() => setComposerExpanded(false)} className="text-gray-400 hover:text-gray-600 p-1">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <EnhancedStatusBar 
                  user={user}
                  profile={userProfile}
                  onUpdate={loadRVInfo}
                  onPost={() => { loadFeed(); setComposerExpanded(false); }}
                />
              </div>
            )}
          </div>
        )}

        {/* ── Welcome Banner for New Users ── */}
        {isNewUser && !welcomeDismissed && isDefaultMode && (
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 rounded-2xl p-5 mb-4 relative overflow-hidden">
            <button onClick={() => { localStorage.setItem('rvu_welcome_dismissed', 'true'); forceUpdate(n => n + 1); }}
              className="absolute top-3 right-3 text-white/60 hover:text-white"><X className="w-5 h-5" /></button>
            <div className="flex items-center gap-4">
              <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1774218289/rvunicorn/guides/hitch_guide.png" className="w-14 h-14 rounded-full border-2 border-white/30 object-cover flex-shrink-0" alt="" />
              <div className="flex-1 min-w-0">
                <p className="text-white font-bold text-lg">Welcome to the campfire, {user?.firstName || 'friend'}! 🔥</p>
                <p className="text-orange-100 text-sm">Hitch is fired up and ready to roll.</p>
                <button onClick={() => handleCreateDraftTrip(quizPicks[0])} disabled={creatingDraft}
                  className="mt-3 inline-flex items-center gap-2 bg-white text-orange-600 px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-orange-50 transition shadow-sm">
                  🚐 {creatingDraft ? 'Creating...' : 'Plan your first trip →'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Resume Onboarding Banner ── */}
        {onboardingResume && !onboardingResume.completed && !onboardingSkippedToday && (
          <div className="bg-white border border-primary-200 rounded-2xl p-4 mb-4 flex items-center gap-4">
            <span className="text-2xl">👋</span>
            <div className="flex-1">
              <p className="font-bold text-gray-900 text-sm">Welcome back, {user?.firstName || 'friend'}!</p>
              <p className="text-xs text-gray-500">Want to finish setting up your profile?</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link to="/rv-setup" className="bg-primary-600 text-white px-4 py-2 rounded-xl text-xs font-semibold hover:bg-primary-700 transition">
                Continue setup →
              </Link>
              <button onClick={() => { localStorage.setItem('rvu_onboarding_skip_date', new Date().toISOString().slice(0, 10)); setOnboardingResume(null); }}
                className="text-xs text-gray-400 hover:text-gray-600">Skip</button>
            </div>
          </div>
        )}

        {/* ── Quiz Recommendations for New Users ── */}
        {quizPicks.length > 0 && isDefaultMode && (
          <div className="mb-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
              🎯 Hitch's picks for you
            </h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {quizPicks.slice(0, 8).map((cg: any) => (
                <Link key={cg.id} to={`/campgrounds/${cg.id}`}
                  className="flex-shrink-0 w-44 bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition">
                  <div className="h-24 bg-gray-100">
                    {cg.imageUrl ? <img src={cg.imageUrl} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center text-2xl">🏕️</div>}
                  </div>
                  <div className="p-2.5">
                    <p className="font-semibold text-gray-900 text-xs truncate">{cg.name}</p>
                    <p className="text-[10px] text-gray-400">{cg.state}</p>
                    {cg.reason && <p className="text-[10px] text-orange-600 mt-1 line-clamp-2 italic">"{cg.reason}"</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Today on RVUnicorn — personalized pill strip (Default Mode only) ── */}
        {isDefaultMode && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
            {nextEvent && (
              <Link
                to={`/trips/${nextEvent.id}`}
                className="flex-shrink-0 flex items-center gap-1.5 bg-blue-50 border border-blue-100 rounded-full px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition"
              >
                <Calendar className="w-3 h-3" />
                {nextEvent.title || nextEvent.name} in {countdown.days}d
              </Link>
            )}
            {maintenanceStats?.overdue > 0 && (
              <Link
                to="/travel?tab=rv-log"
                className="flex-shrink-0 flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-full px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition"
              >
                <Truck className="w-3 h-3" />
                {maintenanceStats.overdue} maintenance overdue
              </Link>
            )}
            {(user as any)?.rvType && (
              <span className="flex-shrink-0 flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 text-xs font-medium text-gray-600">
                🚐 {(user as any).rvType}
              </span>
            )}
            <Link
              to="/community"
              className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded-full px-3 py-1.5 text-xs font-medium text-emerald-700 hover:bg-emerald-100 transition"
            >
              <Users className="w-3 h-3" />
              Community
            </Link>
          </div>
        )}

        {/* Smart Action Cards — prioritized, mutually exclusive */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">

          {/* Slot 1: Weather alert overrides everything → Trip → RV Health urgency → Ask Hitch */}
          {weatherAlert ? (
            <div className="bg-gradient-to-br from-red-600 to-red-700 border-2 border-red-800 rounded-xl p-4 shadow-md col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-500 rounded-lg"><AlertTriangle className="w-4 h-4 text-white" /></div>
                <span className="text-xs font-bold text-red-100">⚠️ Weather Alert</span>
              </div>
              <p className="font-bold text-white text-sm">{weatherAlert.event}</p>
              {weatherAlert.headline && (
                <p className="text-xs text-red-100 mt-1 line-clamp-2">{weatherAlert.headline}</p>
              )}
              <p className="text-xs text-red-200 mt-1.5">Near your next destination</p>
            </div>
          ) : nextEvent ? (
            <Link to={`/trips/${nextEvent.id}`} className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-xl p-4 hover:shadow-md transition group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-blue-100 rounded-lg"><Calendar className="w-4 h-4 text-blue-600" /></div>
                <span className="text-xs font-medium text-blue-600">Next Trip</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm truncate">{nextEvent.title || nextEvent.name}</p>
              <p className="text-xs text-gray-500 mt-0.5">{countdown.days}d {countdown.hours}h away</p>
            </Link>
          ) : maintenanceStats?.overdue > 0 ? (
            <Link to="/travel?tab=rv-log" className="bg-gradient-to-br from-red-50 to-amber-50 border-2 border-red-200 rounded-xl p-4 hover:shadow-md transition group">
              <div className="flex items-center gap-2 mb-2">
                <div className="p-1.5 bg-red-100 rounded-lg"><Truck className="w-4 h-4 text-red-600" /></div>
                <span className="text-xs font-medium text-red-600">Fix Before Next Trip</span>
              </div>
              <p className="font-semibold text-red-700 text-sm">{maintenanceStats.overdue} items overdue</p>
              <p className="text-xs text-red-500 mt-0.5">Tap to view log ⚠️</p>
            </Link>
          ) : (
            <Link to="/hitch" className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 border-dashed rounded-xl p-4 hover:shadow-md transition group">
              <div className="flex items-center gap-2 mb-2">
                <img src="/hitch.png" alt="Hitch" className="w-5 h-5 rounded-full object-cover" />
                <span className="text-xs font-medium text-blue-600">No Trips Yet</span>
              </div>
              <p className="font-semibold text-gray-900 text-sm">Plan your next adventure</p>
              <p className="text-xs text-blue-500 mt-0.5 group-hover:underline">Ask Hitch →</p>
            </Link>
          )}

          {/* Slot 2: Friends Activity — replaces static Messages link */}
          <Link to="/network" className="bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-100 rounded-xl p-4 hover:shadow-md transition group">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-purple-100 rounded-lg"><Users className="w-4 h-4 text-purple-600" /></div>
              <span className="text-xs font-medium text-purple-600">Friends</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Friends Activity</p>
            <p className="text-xs text-purple-500 mt-0.5 group-hover:underline">See what's new →</p>
          </Link>

          {/* Slot 3: RV Health — color shifts red when overdue */}
          <Link
            to="/travel?tab=rv-log"
            className={`rounded-xl p-4 hover:shadow-md transition group border ${
              maintenanceStats?.overdue > 0
                ? 'bg-gradient-to-br from-red-50 to-amber-50 border-red-200'
                : 'bg-gradient-to-br from-amber-50 to-orange-50 border-amber-100'
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${maintenanceStats?.overdue > 0 ? 'bg-red-100' : 'bg-amber-100'}`}>
                <Truck className={`w-4 h-4 ${maintenanceStats?.overdue > 0 ? 'text-red-600' : 'text-amber-600'}`} />
              </div>
              <span className={`text-xs font-medium ${maintenanceStats?.overdue > 0 ? 'text-red-600' : 'text-amber-600'}`}>
                RV Health
              </span>
            </div>
            {maintenanceStats?.overdue > 0 ? (
              <>
                <p className="font-semibold text-red-700 text-sm">{maintenanceStats.overdue} items overdue</p>
                <p className="text-xs text-red-500 mt-0.5">Needs attention ⚠️</p>
              </>
            ) : maintenanceStats?.upcoming > 0 ? (
              <>
                <p className="font-semibold text-gray-900 text-sm">{maintenanceStats.upcoming} upcoming</p>
                <p className="text-xs text-amber-500 mt-0.5 group-hover:underline">View log →</p>
              </>
            ) : (
              <>
                <p className="font-semibold text-gray-900 text-sm">All good ✓</p>
                <p className="text-xs text-green-500 mt-0.5">No maintenance due</p>
              </>
            )}
          </Link>

          {/* Slot 4: Explore */}
          <Link to="/campgrounds" className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-100 rounded-xl p-4 hover:shadow-md transition group">
            <div className="flex items-center gap-2 mb-2">
              <div className="p-1.5 bg-green-100 rounded-lg"><Tent className="w-4 h-4 text-green-600" /></div>
              <span className="text-xs font-medium text-green-600">Explore</span>
            </div>
            <p className="font-semibold text-gray-900 text-sm">Find campgrounds</p>
            <p className="text-xs text-green-500 mt-0.5 group-hover:underline">Browse 31,000+ →</p>
          </Link>
        </div>

        {/* Creator Mode Section */}
        {/* ── Creator Milestone Nudge — contextual, not a marketing card ── */}
        {!nudgeDismissed && (
          <div className="mb-6">
            {postTripNudge ? (
              // Post-trip nudge — highest conversion moment
              <div className="flex items-center gap-3 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-2xl px-4 py-3">
                <span className="text-2xl flex-shrink-0">📸</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">You just got back from {postTripNudge.tripName}!</p>
                  <p className="text-xs text-gray-500 mt-0.5">Share a tip or photo — help the next camper who goes there.</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link
                    to={`/profile/${user?.username}`}
                    className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold rounded-lg transition"
                  >
                    Share →
                  </Link>
                  <button
                    onClick={() => {
                      localStorage.setItem('rvu_nudge_dismissed_until', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
                      setNudgeDismissed(true);
                      setPostTripNudge(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 text-xs transition"
                  >
                    Later
                  </button>
                </div>
              </div>
            ) : userProfile?.isCreator ? (
              // Active creator — show slim stats, not a pitch
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                <span className="text-lg flex-shrink-0">🎬</span>
                <p className="flex-1 text-sm text-gray-600">
                  <span className="font-semibold text-gray-900">Creator Mode on</span> — your content is reaching the community.
                </p>
                <Link to={`/creators/${user?.username}`} className="text-xs text-primary-600 font-semibold hover:underline flex-shrink-0">
                  View stats →
                </Link>
              </div>
            ) : (
              // Default slim prompt — not a full card
              <div className="flex items-center gap-3 bg-white border border-gray-100 rounded-2xl px-4 py-3 shadow-sm">
                <span className="text-lg flex-shrink-0">📸</span>
                <p className="flex-1 text-sm text-gray-500">
                  Share your RV story with the community →
                </p>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Link to={`/profile/${user?.username}`} className="text-xs text-primary-600 font-semibold hover:underline">
                    Post something
                  </Link>
                  <button
                    onClick={() => {
                      localStorage.setItem('rvu_nudge_dismissed_until', String(Date.now() + 30 * 24 * 60 * 60 * 1000));
                      setNudgeDismissed(true);
                    }}
                    className="text-gray-300 hover:text-gray-500 text-xs transition"
                  >
                    ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* What's New — Activity Feeds (moved above map) */}
            <CreatorFeed limit={6} showHeader={true} />
            {/* Hitch ambient nudge — iMessage-suggestion energy, no trip planned */}
            {isDefaultMode && (
              <Link
                to="/hitch"
                className="group flex items-center gap-3 bg-white border border-gray-100 hover:border-indigo-200 rounded-2xl px-4 py-3 shadow-sm hover:shadow-md transition-all"
              >
                <img src="/hitch.png" alt="Hitch" className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                <p className="flex-1 text-sm text-gray-600 group-hover:text-indigo-700 transition-colors">
                  <span className="font-semibold text-gray-900">Hitch</span> — no trip on the calendar yet.{' '}
                  <span className="text-indigo-500 group-hover:underline">Want to plan one?</span>
                </p>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors flex-shrink-0" />
              </Link>
            )}

            {/* Rig Profile Setup Nudge — show when no RV type set */}
            {!(user as any)?.rvType && !localStorage.getItem('rvu_rig_nudge_dismissed') && (
              <div className="bg-white border-2 border-dashed border-orange-300 rounded-2xl p-5">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-orange-100 flex items-center justify-center flex-shrink-0 text-2xl">🚐</div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 text-sm mb-1">Set up your Rig Profile</p>
                    <p className="text-gray-500 text-xs mb-3 leading-relaxed">
                      Add your RV details once — Hitch uses them for campsite filters, gas cost estimates, Guardian Mode fatigue tracking, and personalized trip planning.
                    </p>
                    <div className="flex flex-wrap gap-2 mb-3">
                      {['📐 Length & type','⛽ MPG & fuel','🗺️ Campsite filters','🛡️ Guardian Mode'].map(item => (
                        <span key={item} className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">{item}</span>
                      ))}
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href="/my-rv"
                        className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-sm font-bold transition"
                      >
                        🚐 Set Up My Rig
                      </a>
                      <button
                        onClick={() => {
                          localStorage.setItem('rvu_rig_nudge_dismissed', '1');
                          // Force re-render by dispatching a storage event
                          window.dispatchEvent(new Event('storage'));
                        }}
                        className="px-3 py-2.5 text-gray-400 hover:text-gray-600 text-xs transition"
                      >
                        Later
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {activeCheckIn?.campground && (
              <button
                onClick={() => { setShowCampfireModal(true); setCampfireUnread(0); }}
                className="w-full flex items-center gap-4 bg-gradient-to-r from-orange-500 to-amber-500 rounded-xl px-4 py-3 mb-4 hover:shadow-lg transition-all group text-left"
              >
                <div className="relative flex-shrink-0">
                  <span className="text-4xl">🔥</span>
                  {(campfireUnread > 0 || newCampfirePosts > 0) && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                      {campfireUnread + newCampfirePosts > 9 ? '9+' : campfireUnread + newCampfirePosts}
                    </span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div id="campfire-chat-anchor" className="text-white font-bold text-sm">You're at the Campfire! 🏕️</div>
                  <div className="text-orange-100 text-xs truncate">
                    {campfireVibeMsg || triviaCountdown || `${activeCheckIn.campground.name} — tap to chat`}
                  </div>
                </div>
                {triviaCountdown && (
                  <span className="bg-white/20 text-white text-xs font-bold px-2 py-1 rounded-full animate-pulse flex-shrink-0">
                    {triviaCountdown}
                  </span>
                )}
                <span className="text-white/70 group-hover:text-white transition flex-shrink-0">→</span>
              </button>
            )}
            {/* ── Feed Tabs: Friends / Community / Campgrounds ── */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Tab Headers */}
              <div className="flex border-b border-gray-100">
                {(['friends', 'community', 'campgrounds'] as const).map(tab => {
                  const labels: Record<string, string> = {
                    friends: '👥 Friends',
                    community: '🏕️ Community',
                    campgrounds: '📍 Campgrounds',
                  };
                  const hasNew = (tab === 'friends' && friendsHasNew) || (tab === 'community' && communityHasNew);
                  return (
                    <button
                      key={tab}
                      onClick={() => {
                        setFeedTab(tab);
                        localStorage.setItem('rvu_feed_last_viewed', Date.now().toString());
                        if (tab === 'friends') setFriendsHasNew(false);
                        if (tab === 'community') setCommunityHasNew(false);
                      }}
                      className={`flex-1 relative px-4 py-3 text-sm font-medium transition border-b-2 ${
                        feedTab === tab
                          ? 'border-primary-600 text-primary-700 bg-primary-50/50'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {labels[tab]}
                      {hasNew && feedTab !== tab && (
                        <span className="absolute top-2 right-2 w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Friends Tab */}
              {feedTab === 'friends' && (
                <div className="p-4">
                  <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />
                </div>
              )}

              {/* Community Tab */}
              {feedTab === 'community' && (
                <div className="p-4">
                  {communityPosts.length === 0 ? (
                    <div className="text-center py-12">
                      <span className="text-4xl mb-3 block">🏕️</span>
                      <p className="text-gray-500 text-sm mb-2">No community posts yet</p>
                      <Link to="/community" className="text-sm text-primary-600 font-semibold hover:underline">Start a discussion →</Link>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {communityPosts.map((post: any) => (
                        <Link key={post.id} to="/community" className="flex gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition">
                          <div className="flex-shrink-0 w-8 text-center pt-0.5">
                            <span className="text-sm font-bold text-orange-500">{post.voteScore}</span>
                            <div className="text-[10px] text-gray-400">pts</div>
                          </div>
                          <div className="flex-1 min-w-0">
                            {post.board && (
                              <div className="flex items-center gap-1 mb-0.5">
                                <span className="text-xs">{post.board.icon}</span>
                                <span className="text-xs text-gray-400">{post.board.name}</span>
                              </div>
                            )}
                            <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{post.title}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] text-gray-400">{post.author?.firstName} {post.author?.lastName}</span>
                              <span className="text-[10px] text-gray-300">·</span>
                              <span className="text-[10px] text-gray-400">{post.commentCount || 0} comments</span>
                            </div>
                          </div>
                        </Link>
                      ))}
                      <Link to="/community" className="flex items-center justify-center gap-1 py-3 text-sm text-primary-600 font-semibold hover:underline">
                        Browse all community posts →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Campgrounds Tab */}
              {feedTab === 'campgrounds' && (
                <div className="p-4">
                  <CampgroundUpdatesFeed maxItems={10} />
                  <div className="mt-4 text-center">
                    <Link to="/campgrounds" className="text-sm text-primary-600 font-semibold hover:underline">
                      Follow campgrounds to see their updates here →
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>


          {/* ── SIDEBAR ─────────────────────────────────────────── */}
          <div className="space-y-4">

            {/* ── Last-Minute Deals ────────────────────────────────── */}
            <LastMinuteDeals compact />

            {/* ── Profile Completion Score ─────────────────────────── */}
            {completionScore < 80 && !completionDismissed && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="relative w-12 h-12 flex-shrink-0">
                    <svg viewBox="0 0 36 36" className="w-12 h-12 -rotate-90">
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f3f4f6" strokeWidth="3" />
                      <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f59e0b" strokeWidth="3"
                        strokeDasharray={`${completionScore * 0.9745} 97.45`} strokeLinecap="round" />
                    </svg>
                    <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-gray-700">{completionScore}%</span>
                  </div>
                  <div>
                    <p className="font-bold text-sm text-gray-900">Complete your profile</p>
                    <p className="text-xs text-gray-400">{missingItems.length} item{missingItems.length !== 1 ? 's' : ''} remaining</p>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {(missingItems as any[]).map((item: any, i: number) => (
                    <Link key={i} to={item.link} className="flex items-center gap-2 text-xs text-gray-600 hover:text-primary-600 transition py-1">
                      <span>{item.emoji}</span>
                      <span className="font-medium">{item.label}</span>
                    </Link>
                  ))}
                </div>
                <button onClick={() => { localStorage.setItem('rvu_completion_dismissed', 'true'); forceUpdate(n => n + 1); }}
                  className="mt-3 text-[10px] text-gray-400 hover:text-gray-600">Don't show this again</button>
              </div>
            )}

            {/* ── 1. My RV ─────────────────────────────────────────── */}
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">🚐</span>
                  <h3 className="font-bold text-sm text-gray-900">My RV</h3>
                </div>
                <div className="flex items-center gap-2">
                  {maintenanceStats?.overdueCount > 0 ? (
                    <span className="flex items-center gap-1 bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">
                      <AlertTriangle className="w-3 h-3" /> {maintenanceStats.overdueCount} overdue
                    </span>
                  ) : maintenanceStats?.upcomingCount > 0 ? (
                    <span className="flex items-center gap-1 bg-amber-100 text-amber-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      <Truck className="w-3 h-3" /> {maintenanceStats.upcomingCount} upcoming
                    </span>
                  ) : maintenanceStats ? (
                    <span className="flex items-center gap-1 bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">
                      ✓ All good
                    </span>
                  ) : null}
                  <Link to="/my-rv" className="text-xs text-primary-600 font-medium hover:underline">View →</Link>
                </div>
              </div>
              {rvInfo?.rvMake ? (
                <div className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    {rvShowcase?.photos?.[0] ? (
                      <img src={rvShowcase.photos[0]} className="w-16 h-12 rounded-lg object-cover flex-shrink-0" alt="RV" />
                    ) : (
                      <div className="w-16 h-12 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0"><span className="text-2xl">🚐</span></div>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 text-sm truncate">{rvInfo.rvYear} {rvInfo.rvMake} {rvInfo.rvModel}</p>
                      {rvInfo.rvType && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{rvInfo.rvType?.replace('_', ' ')}</span>}
                    </div>
                  </div>
                  {maintenanceStats && (
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-lg font-bold text-gray-700">{maintenanceStats.totalRecords}</p><p className="text-[10px] text-gray-400">Records</p></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><p className={`text-lg font-bold ${maintenanceStats.overdueCount > 0 ? 'text-red-600' : 'text-gray-700'}`}>{maintenanceStats.overdueCount}</p><p className="text-[10px] text-gray-400">Overdue</p></div>
                      <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-lg font-bold text-blue-600">{maintenanceStats.upcomingCount}</p><p className="text-[10px] text-gray-400">Upcoming</p></div>
                    </div>
                  )}
                  {maintenanceStats?.overdueCount > 0 && (
                    <Link to="/maintenance" className="flex items-center gap-2 w-full bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700 font-semibold hover:bg-red-100 transition">
                      <AlertTriangle className="w-3 h-3" />
                      View {maintenanceStats.overdueCount} overdue item{maintenanceStats.overdueCount > 1 ? 's' : ''}
                    </Link>
                  )}
                </div>
              ) : (
                <div className="p-4 text-center"><p className="text-sm text-gray-500 mb-2">No rig set up yet</p><Link to="/my-rv" className="text-xs text-primary-600 font-semibold hover:underline">Set up your rig →</Link></div>
              )}
            </div>

            {/* ── 2. Travel Map ─────────────────────────────────────── */}
            {nextEvent && (
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700 font-medium mb-1">
                <span>📍</span>
                <span>Next stop: <span className="font-semibold">{nextEvent.title || nextEvent.name}</span> in {countdown.days}d</span>
              </div>
            )}
            {/* Travel Map - Compact */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 pb-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-bold text-gray-900 flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-primary-600" />
                    Travel Map
                  </h3>
                  <Link to="/travel" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                    Full Map →
                  </Link>
                </div>
                {/* Compact Stats */}
                <div className="flex items-center gap-3 mb-3 text-xs">
                  <span className="flex items-center gap-1 text-primary-600 font-semibold">
                    <MapPin className="w-3 h-3" /> {visitedStatesCount} states
                  </span>
                  <span className="text-gray-300">|</span>
                  <span className="text-gray-500">{50 - visitedStatesCount} to go</span>
                  <span className="text-gray-300">|</span>
                  <span className="text-emerald-600 font-medium">{Math.round((visitedStatesCount / 50) * 100)}%</span>
                </div>
              </div>
              <div className="px-2 pb-2" style={{ minHeight: '320px' }}>
                <TripCalendarWidget compact={true} />

                <TravelMap userId={user.id} isOwnProfile={true} compact={true} profilePicture={user?.profilePicture || undefined} />
              </div>
            </div>


            {/* ── 3. Upcoming Trips ─────────────────────────────────── */}
            {/* Upcoming Trips - Compact */}
            {plannedTrips.length > 0 && (
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="p-4 pb-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                      <Calendar className="w-5 h-5 text-blue-600" />
                      Upcoming Trips
                      <span className="text-xs font-normal text-gray-400">({plannedTrips.length})</span>
                    </h3>
                    <Link to="/trips" className="text-xs text-blue-600 hover:text-blue-700 font-medium">View All</Link>
                  </div>
                </div>
                <div className="px-4 pb-4 space-y-2">
                  {plannedTrips.slice(0, 3).map((trip) => (
                    <Link
                      key={`${trip.type}-${trip.id}`}
                      to={trip.type === 'event' ? `/trips/${trip.id}` : `/travel`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center flex-shrink-0">
                        <Calendar className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{trip.title}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          {trip.campground?.name && <><span> · </span><Link to={`/campgrounds/${trip.campground.id}`} className="hover:underline text-primary-600" onClick={e => e.stopPropagation()}>{trip.campground.name}</Link></>}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500 flex-shrink-0" />
                    </Link>
                  ))}
                </div>
              </div>
            )}


            {/* ── 4. Friends ────────────────────────────────────────── */}
             <Top8Friends username={user?.username} />

            {/* ── 4a. Upcoming Events card ──────────────────────── */}
            <UpcomingEventsCard />

            {/* ── 4b. Friends Going Somewhere You Know ────────────── */}
            <FriendsTipPromptCard />

            {/* ── 5. Camping Nearby ─────────────────────────────────── */}
            {/* Nearby Campers Card */}
            {nearbyCampers.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔥</span>
                    <span className="font-bold text-sm text-gray-900">Camping Nearby</span>
                    <span className="text-xs text-gray-400 font-normal">{nearbyCampers.length} friend{nearbyCampers.length !== 1 ? 's' : ''}</span>
                  </div>
                  <Link to="/travel" className="text-xs text-orange-500 hover:text-orange-600 font-semibold">Map →</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {nearbyCampers.slice(0, 5).map((camper: any) => (
                    <Link key={camper.id} to={`/profile/${camper.user.username}`}
                      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition">
                      {camper.user.profilePicture ? (
                        <img src={camper.user.profilePicture} className="w-9 h-9 rounded-full object-cover flex-shrink-0" alt="" />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-orange-600 font-bold text-sm">{camper.user.firstName[0]}</span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{camper.user.firstName} {camper.user.lastName}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {camper.sameCampground ? '📍 Same campground!' : camper.campground?.name || 'Camping'}
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {camper.sameCampground ? (
                          <span className="text-xs font-semibold text-green-600">Here!</span>
                        ) : camper.distanceMiles !== null ? (
                          <span className="text-xs text-gray-400">{camper.distanceMiles} mi</span>
                        ) : null}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Community Card */}
            {communityPosts.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔥</span>
                    <span className="font-bold text-sm text-gray-900">From the Community</span>
                  </div>
                  <Link to="/community" className="text-xs text-orange-500 hover:text-orange-600 font-semibold">See all →</Link>
                </div>
                <div className="divide-y divide-gray-50">
                  {communityPosts.map((post: any) => (
                    <Link key={post.id} to="/community" state={{ postId: post.id }}
                      className="flex gap-3 px-4 py-3 hover:bg-gray-50 transition">
                      <div className="flex flex-col items-center pt-0.5">
                        <span className="text-xs font-bold text-orange-500">{post.voteScore}</span>
                        <span className="text-[10px] text-gray-400">pts</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1 mb-0.5">
                          {post.board && <span className="text-xs">{post.board.icon}</span>}
                          {post.board && <span className="text-xs text-gray-400">{post.board.name}</span>}
                        </div>
                        <p className="text-xs font-semibold text-gray-800 line-clamp-2 leading-snug">{post.title}</p>
                        <span className="text-[10px] text-gray-400">{post.commentCount || 0} comments</span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Weather & Activities — shows when checked in */}
            {activeCheckIn?.campground?.latitude && activeCheckIn?.campground?.longitude && (
              <WeatherActivities
                lat={activeCheckIn.campground.latitude}
                lon={activeCheckIn.campground.longitude}
                campgroundName={activeCheckIn.campground.name}
                compact={true}
                onThingsToDo={() => {
                  const slug = activeCheckIn.campground?.slug || activeCheckIn.campground?.id;
                  if (slug) window.location.href = `/campgrounds/${slug}?tab=overview#things-to-do`;
                }}
              />
            )}

            {/* RV Information Card */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-slate-700 to-slate-800 text-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Truck className="w-5 h-5" />
                    <h3 className="font-bold">My RV</h3>
                  </div>
                  <Link
                    to={`/profile/${user.username}/edit`}
                    className="text-slate-300 hover:text-white"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </div>
                {/* Sub-tabs */}
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => setRvTab('overview')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      rvTab === 'overview' 
                        ? 'bg-white text-slate-800' 
                        : 'bg-slate-600 text-white hover:bg-slate-500'
                    }`}
                  >
                    Overview
                  </button>
                  <button
                    onClick={() => setRvTab('edit')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      rvTab === 'edit' 
                        ? 'bg-white text-slate-800' 
                        : 'bg-slate-600 text-white hover:bg-slate-500'
                    }`}
                  >
                    Details
                  </button>
                  <button
                    onClick={() => setRvTab('log')}
                    className={`px-3 py-1 rounded-full text-sm font-medium transition ${
                      rvTab === 'log' 
                        ? 'bg-white text-slate-800' 
                        : 'bg-slate-600 text-white hover:bg-slate-500'
                    }`}
                  >
                    RV Log
                  </button>
                </div>
              </div>

              {rvTab === 'overview' && (
              <>
              {/* RV Photo */}
              <div className="aspect-video bg-slate-100 relative">
                {rvShowcase?.photos?.[0] ? (
                  <img
                    src={rvShowcase.photos[0].startsWith('http') ? rvShowcase.photos[0] : `${rvShowcase.photos[0]}`}
                    alt="My RV"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full relative">
                    <img src="/images/showusyourrig.webp" alt="Show us your rig" className="w-full h-full object-cover" />
                    <Link
                      to={`/profile/${user.username}/edit`}
                      className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                    >
                      <span className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add Your Rig
                      </span>
                    </Link>
                  </div>
                )}
              </div>

              {/* RV Details */}
              <div className="p-4">
                {rvInfo?.rvYear || rvInfo?.rvMake || rvInfo?.rvModel ? (
                  <div className="mb-4">
                    <p className="text-lg font-bold text-gray-800">
                      {rvInfo.rvYear} {rvInfo.rvMake} {rvInfo.rvModel}
                    </p>
                    {rvInfo.rvType && (
                      <p className="text-sm text-gray-500 capitalize">{rvInfo.rvType}</p>
                    )}
                    {rvManualUrl && (
                      <a href={rvManualUrl} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 mt-1 text-sm text-blue-600 hover:text-blue-800 hover:underline">
                        📖 Owner's Manual
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-500 mb-4">No RV info added yet</p>
                )}

                {/* Maintenance Stats */}
                {maintenanceStats && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-slate-700">{maintenanceStats.totalRecords}</p>
                        <p className="text-xs text-slate-500">Service Records</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-600">${maintenanceStats.totalSpent?.toLocaleString() || 0}</p>
                        <p className="text-xs text-slate-500">Total Spent</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-blue-600">{maintenanceStats.upcomingCount}</p>
                        <p className="text-xs text-slate-500">Upcoming</p>
                      </div>
                      <div className="bg-slate-50 rounded-lg p-3 text-center">
                        <p className={`text-2xl font-bold ${maintenanceStats.overdueCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {maintenanceStats.overdueCount}
                        </p>
                        <p className="text-xs text-slate-500">Overdue</p>
                      </div>
                    </div>

                    {maintenanceStats.overdueCount > 0 && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                        <p className="text-sm text-red-700">
                          {maintenanceStats.overdueCount} overdue item{maintenanceStats.overdueCount > 1 ? 's' : ''}!
                        </p>
                      </div>
                    )}

                    {maintenanceStats.lastService && (
                      <div className="text-sm text-gray-500">
                        Last service: <span className="font-medium">{maintenanceStats.lastService.serviceType}</span>
                        {' '}on {new Date(maintenanceStats.lastService.serviceDate).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                )}

                {/* RV Photo Gallery */}
                {rvShowcase?.photos && rvShowcase.photos.length > 1 && (
                  <div className="mt-4 border-t pt-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">More Photos</h4>
                    <div className="grid grid-cols-4 gap-2">
                      {rvShowcase.photos.slice(1, 5).map((photo: string, index: number) => (
                        <div key={index} className="relative aspect-square rounded-lg overflow-hidden group">
                          <img
                            src={photo.startsWith('http') ? photo : photo}
                            alt={`RV photo ${index + 2}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-1">
                            <button
                              onClick={async () => {
                                try {
                                  await api.put(`/rv-showcase/${rvShowcase.id}/set-main`, { photoIndex: index + 1 });
                                  const { data } = await api.get(`/rv-showcase/user/${user?.id}`);
                                  setRvShowcase(data);
                                } catch (e) { console.error(e); }
                              }}
                              className="p-1 bg-white rounded text-xs"
                              title="Set as main"
                            >
                              <Star className="w-3 h-3" />
                            </button>
                            <button
                              onClick={async () => {
                                if (confirm('Delete this photo?')) {
                                  try {
                                    await api.delete(`/rv-showcase/${rvShowcase.id}/photo/${index + 1}`);
                                    const { data } = await api.get(`/rv-showcase/user/${user?.id}`);
                                    setRvShowcase(data);
                                  } catch (e) { console.error(e); }
                                }
                              }}
                              className="p-1 bg-white rounded text-xs text-red-600"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    {rvShowcase.photos.length > 5 && (
                      <p className="text-xs text-gray-500 mt-2 text-center">
                        +{rvShowcase.photos.length - 5} more photos
                      </p>
                    )}
                  </div>
                )}
                <Link
                  to={`/profile/${user?.username}/edit`}
                  className="mt-3 block text-center text-sm text-primary-600 hover:text-primary-700"
                >
                  Manage RV Photos
                </Link>
              </div>
              </>
              )}

              {/* Settings Tab */}
              {rvTab === 'edit' && (
                <div className="p-4 space-y-4">
                  {/* RV Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">RV Type</label>
                    <select
                      value={rvEditData.rvType}
                      onChange={(e) => setRvEditData({...rvEditData, rvType: e.target.value})}
                      className="w-full border rounded-lg p-2"
                    >
                      <option value="">Select type...</option>
                      <option value="class_a">Class A</option>
                      <option value="class_b">Class B</option>
                      <option value="class_c">Class C</option>
                      <option value="travel_trailer">Travel Trailer</option>
                      <option value="fifth_wheel">Fifth Wheel</option>
                      <option value="pop_up">Pop-up Camper</option>
                      <option value="truck_camper">Truck Camper</option>
                      <option value="teardrop">Teardrop</option>
                      <option value="toy_hauler">Toy Hauler</option>
                      <option value="tent">Tent Camping</option>
                      <option value="van">Camper Van</option>
                    </select>
                  </div>

                  {/* Year, Make, Model */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                      <input
                        type="text"
                        value={rvEditData.rvYear}
                        onChange={(e) => setRvEditData({...rvEditData, rvYear: e.target.value})}
                        placeholder="2020"
                        className="w-full border rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                      <input
                        type="text"
                        value={rvEditData.rvMake}
                        onChange={(e) => setRvEditData({...rvEditData, rvMake: e.target.value})}
                        placeholder="Airstream"
                        className="w-full border rounded-lg p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                      <input
                        type="text"
                        value={rvEditData.rvModel}
                        onChange={(e) => setRvEditData({...rvEditData, rvModel: e.target.value})}
                        placeholder="Basecamp"
                        className="w-full border rounded-lg p-2"
                      />
                    </div>
                  </div>

                  {/* RV Dimensions */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Dimensions (optional)</h4>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Length (ft)</label>
                        <input
                          type="text"
                          value={rvEditData.rvLength}
                          onChange={(e) => setRvEditData({...rvEditData, rvLength: e.target.value})}
                          placeholder="25"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Width (ft)</label>
                        <input
                          type="text"
                          value={rvEditData.rvWidth}
                          onChange={(e) => setRvEditData({...rvEditData, rvWidth: e.target.value})}
                          placeholder="8"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Height (ft)</label>
                        <input
                          type="text"
                          value={rvEditData.rvHeight}
                          onChange={(e) => setRvEditData({...rvEditData, rvHeight: e.target.value})}
                          placeholder="11"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* License & Registration */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">License & Registration</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">License Plate</label>
                        <input
                          type="text"
                          value={rvEditData.licensePlate}
                          onChange={(e) => setRvEditData({...rvEditData, licensePlate: e.target.value})}
                          placeholder="ABC-1234"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={rvEditData.licensePlateState}
                          onChange={(e) => setRvEditData({...rvEditData, licensePlateState: e.target.value})}
                          placeholder="CO"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Tag Expiration</label>
                      <input
                        type="date"
                        value={rvEditData.tagExpiration}
                        onChange={(e) => setRvEditData({...rvEditData, tagExpiration: e.target.value})}
                        className="w-full border rounded-lg p-2"
                      />
                      <p className="text-xs text-gray-500 mt-1">We'll remind you when it's time to renew</p>
                    </div>
                  </div>

                  {/* Odometer */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Odometer</h4>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Current Mileage</label>
                      <div className="relative">
                        <input
                          type="number"
                          value={rvEditData.rvOdometer}
                          onChange={(e) => setRvEditData({...rvEditData, rvOdometer: e.target.value})}
                          placeholder="45000"
                          className="w-full border rounded-lg p-2 pr-16"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">miles</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">Update periodically to track maintenance intervals</p>
                    </div>
                  </div>

                  {/* Home Base */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Home Base</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                        <input
                          type="text"
                          value={rvEditData.homeCity}
                          onChange={(e) => setRvEditData({...rvEditData, homeCity: e.target.value})}
                          placeholder="Denver"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                        <input
                          type="text"
                          value={rvEditData.homeState}
                          onChange={(e) => setRvEditData({...rvEditData, homeState: e.target.value})}
                          placeholder="CO"
                          className="w-full border rounded-lg p-2"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Travel Party */}
                  <div className="border-t pt-4">
                    <h4 className="font-semibold text-gray-800 mb-2">Travel Style</h4>
                    <select
                      value={rvEditData.travelPartyType}
                      onChange={(e) => setRvEditData({...rvEditData, travelPartyType: e.target.value})}
                      className="w-full border rounded-lg p-2 mb-2"
                    >
                      <option value="">Select travel party...</option>
                      <option value="solo">Solo Traveler</option>
                      <option value="couple">Couple</option>
                      <option value="family">Family</option>
                      <option value="group">Group/Friends</option>
                    </select>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={rvEditData.hasPets}
                        onChange={(e) => setRvEditData({...rvEditData, hasPets: e.target.checked})}
                        className="rounded"
                      />
                      <span className="text-sm text-gray-700">Traveling with pets</span>
                    </label>
                  </div>

                  {/* Save Button */}
                  <button
                    onClick={async () => {
                      setSavingRv(true);
                      try {
                        await api.put(`/profile/${user?.username}`, {
                          rvType: rvEditData.rvType,
                          rvYear: rvEditData.rvYear,
                          rvMake: rvEditData.rvMake,
                          rvModel: rvEditData.rvModel,
                          rvLength: rvEditData.rvLength,
                          rvWidth: rvEditData.rvWidth,
                          rvHeight: rvEditData.rvHeight,
                          licensePlate: rvEditData.licensePlate,
                          licensePlateState: rvEditData.licensePlateState,
                          tagExpiration: rvEditData.tagExpiration,
                          rvOdometer: rvEditData.rvOdometer ? parseInt(rvEditData.rvOdometer) : null,
                          homeCity: rvEditData.homeCity,
                          homeState: rvEditData.homeState,
                          travelPartyType: rvEditData.travelPartyType,
                          hasPets: rvEditData.hasPets,
                        });
                        setRvInfo({
                          rvType: rvEditData.rvType,
                          rvYear: rvEditData.rvYear,
                          rvMake: rvEditData.rvMake,
                          rvModel: rvEditData.rvModel,
                        });
                        setRvTab('overview');
                      } catch (error) {
                        console.error('Failed to save RV info:', error);
                      } finally {
                        setSavingRv(false);
                      }
                    }}
                    disabled={savingRv}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-semibold transition disabled:opacity-50"
                  >
                    {savingRv ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              )}

              {/* RV Log Tab */}
              {rvTab === 'log' && (
                <div className="p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-semibold text-gray-800">Maintenance Log</h4>
                    <Link
                      to="/maintenance"
                      className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                    >
                      Open Full Log <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                  
                  {maintenanceStats && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-slate-700">{maintenanceStats.totalRecords}</p>
                          <p className="text-xs text-slate-500">Service Records</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-green-600">${maintenanceStats.totalSpent?.toLocaleString() || 0}</p>
                          <p className="text-xs text-slate-500">Total Spent</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className="text-2xl font-bold text-blue-600">{maintenanceStats.upcomingCount}</p>
                          <p className="text-xs text-slate-500">Upcoming</p>
                        </div>
                        <div className="bg-slate-50 rounded-lg p-3 text-center">
                          <p className={`text-2xl font-bold ${maintenanceStats.overdueCount > 0 ? 'text-red-600' : 'text-slate-700'}`}>
                            {maintenanceStats.overdueCount}
                          </p>
                          <p className="text-xs text-slate-500">Overdue</p>
                        </div>
                      </div>

                      {maintenanceStats.overdueCount > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-center gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-500" />
                          <p className="text-sm text-red-700">
                            {maintenanceStats.overdueCount} overdue item{maintenanceStats.overdueCount > 1 ? 's' : ''}!
                          </p>
                        </div>
                      )}

                      {maintenanceStats.lastService && (
                        <div className="text-sm text-gray-500">
                          Last service: <span className="font-medium">{maintenanceStats.lastService.serviceType}</span>
                          {' '}on {new Date(maintenanceStats.lastService.serviceDate).toLocaleDateString()}
                        </div>
                      )}

                      <Link
                        to="/maintenance"
                        className="block w-full bg-slate-700 hover:bg-slate-800 text-white text-center py-2 rounded-lg transition-colors"
                      >
                        <Wrench className="w-4 h-4 inline mr-2" />
                        View Full Maintenance Log
                      </Link>
                    </div>
                  )}

                  {!maintenanceStats && (
                    <div className="text-center py-6 text-gray-500">
                      <Wrench className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                      <p>No maintenance records yet</p>
                      <Link
                        to="/maintenance"
                        className="mt-2 inline-block text-primary-600 hover:text-primary-700"
                      >
                        Add your first record
                      </Link>
                    </div>
                  )}
                </div>
              )}
            </div>
              

          </div>
        </div>
      </div>)}

      {/* ── CAMPING MODE LAYOUT ─────────────────────────────────────────── */}
      {isCamping && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">

          {/* Weather snapshot above Tonight at Camp */}
          {activeCheckIn?.campground?.latitude && activeCheckIn?.campground?.longitude && (
            <WeatherActivities
              lat={activeCheckIn.campground.latitude}
              lon={activeCheckIn.campground.longitude}
              campgroundName={activeCheckIn.campground.name}
              compact={true}
              eventId={linkedEvent?.id}
              onThingsToDo={() => {
                const slug = activeCheckIn.campground?.slug || activeCheckIn.campground?.id;
                if (slug) window.location.href = `/campgrounds/${slug}?tab=overview#things-to-do`;
              }}
            />
          )}

          {/* Tonight at Camp */}
          {activeCheckIn?.campground && (
            <div className="bg-gradient-to-r from-gray-800 to-gray-900 text-white rounded-xl p-4 mb-6">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">🔥</span>
                <h3 className="font-bold text-lg">Tonight at Camp</h3>
                <span className="text-xs bg-orange-500/30 border border-orange-400/30 px-2 py-0.5 rounded-full text-orange-200">
                  <Link to={`/campgrounds/${activeCheckIn.campground.id}`} className="hover:underline text-primary-600">{activeCheckIn.campground.name}</Link>
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                {activeCheckIn?.campground?.campgroundMapUrl ? (
                  <button
                    onClick={() => window.open(activeCheckIn.campground.campgroundMapUrl, '_blank')}
                    className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition w-full"
                  >
                    <div className="text-xl mb-1">🗺️</div>
                    <div className="text-white/60 text-xs">Camp Map</div>
                    <div className="font-medium text-xs mt-0.5 text-orange-300">Tap to view →</div>
                  </button>
                ) : (
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-xl mb-1">🎯</div>
                    <div className="text-white/60 text-xs">Trivia</div>
                    <div className="font-medium text-xs mt-0.5">{tonightData?.triviaStatus || triviaCountdown || '7:30 AM · 12:25 PM · 5:30 PM CT'}</div>
                  </div>
                )}
                {nextMeal ? (() => {
                  const userRsvp = nextMeal.rsvps?.find((r: any) => r.userId === user?.id);
                  const mealTime = nextMeal.scheduledTime
                    ? new Date(`2000-01-01T${nextMeal.scheduledTime}`).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
                    : null;
                  return (
                    <div className="bg-white/10 rounded-lg p-3 text-center">
                      <div className="text-xl mb-1">🍽️</div>
                      <a
                        href={linkedEvent ? `/trips/${linkedEvent.id}?tab=meals` : '#'}
                        className="text-white/80 hover:text-white text-xs capitalize font-semibold underline-offset-2 hover:underline transition"
                        onClick={e => e.stopPropagation()}
                      >
                        {nextMeal.mealType || 'Meal'}
                      </a>
                      <div className="font-medium text-xs mt-0.5">{mealTime || 'Time TBD'}</div>
                      {!userRsvp ? (
                        <div className="flex gap-1 mt-2 justify-center">
                          <button
                            onClick={() => handleMealRSVP(nextMeal.id, 'attending')}
                            disabled={mealRsvpLoading}
                            className="bg-green-500/80 hover:bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition"
                          >✓ Join</button>
                          <button
                            onClick={() => handleMealRSVP(nextMeal.id, 'not_attending')}
                            disabled={mealRsvpLoading}
                            className="bg-white/20 hover:bg-white/30 text-white text-[10px] font-bold px-2 py-0.5 rounded-full transition"
                          >✕ Skip</button>
                        </div>
                      ) : (
                        <div className="mt-1 text-[10px] font-semibold text-green-300">
                          {userRsvp.status === 'attending' ? '✓ Joining' : '✕ Skipping'}
                        </div>
                      )}
                    </div>
                  );
                })() : linkedEvent && linkedEventActivityCount > 0 ? (
                  <a href={`/trips/${linkedEvent.id}#schedule`} className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition block">
                    <div className="text-xl mb-1">📅</div>
                    <div className="text-white/60 text-xs">Schedule</div>
                    <div className="font-medium text-xs mt-0.5 text-orange-300">{linkedEventActivityCount} items →</div>
                  </a>
                ) : linkedEvent ? (
                  <a href={`/trips/${linkedEvent.id}?tab=meals`} className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition block">
                    <div className="text-xl mb-1">🍽️</div>
                    <div className="text-white/60 text-xs">Meals</div>
                    <div className="font-medium text-xs mt-0.5 text-orange-300">{linkedEventMealCount > 0 ? `${linkedEventMealCount} meals →` : 'View meals →'}</div>
                  </a>
                ) : (
                  <div className="bg-white/10 rounded-lg p-3 text-center">
                    <div className="text-xl mb-1">🔕</div>
                    <div className="text-white/60 text-xs">Quiet Hours</div>
                    <div className="font-medium text-xs mt-0.5">{tonightData?.quietHoursStart || '10:00 PM'}</div>
                  </div>
                )}
                <button
                  onClick={() => setShowRversHere(v => !v)}
                  className="bg-white/10 hover:bg-white/20 rounded-lg p-3 text-center transition"
                >
                  <div className="text-xl mb-1">👥</div>
                  <div className="text-white/60 text-xs">RVers Here</div>
                  <div className="font-medium text-xs mt-0.5">{tonightData?.rverCount ?? '...'} checked in</div>
                </button>
                <button
                  onClick={() => document.getElementById('camp-marketplace')?.scrollIntoView({ behavior: 'smooth' })}
                  className="bg-orange-500/30 hover:bg-orange-500/50 border border-orange-400/30 rounded-lg p-3 text-center transition"
                >
                  <div className="text-xl mb-1">🛒</div>
                  <div className="font-bold text-xs text-orange-300">Marketplace →</div>
                </button>
              </div>

              {/* RVers Here dropdown */}
              {showRversHere && (
                <div className="mt-3 bg-white/10 rounded-xl p-3 border border-white/10">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-white/80">👥 Campers Checked In</span>
                    <button onClick={() => setShowRversHere(false)} className="text-white/40 hover:text-white/70 text-xs">✕</button>
                  </div>
                  {rversHereList.length === 0 ? (
                    <p className="text-xs text-white/40 text-center py-2">Loading...</p>
                  ) : (
                    <div className="space-y-1.5 max-h-48 overflow-y-auto">
                      {rversHereList.map((c: any) => {
                        const u = c.user || c;
                        return (
                          <Link
                            key={u.id || c.id}
                            to={`/profile/${u.username || u.id}`}
                            className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/10 transition"
                          >
                            {u.profilePicture ? (
                              <img src={u.profilePicture} className="w-7 h-7 rounded-full object-cover" alt="" />
                            ) : (
                              <div className="w-7 h-7 rounded-full bg-orange-400/30 flex items-center justify-center text-[10px] font-bold text-white">
                                {(u.firstName || u.username || '?')[0].toUpperCase()}
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-white truncate">{u.firstName} {u.lastName || ''}</p>
                              {c.siteNumber && <p className="text-[10px] text-white/40">Site {c.siteNumber}</p>}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Three-Tab Navigation */}
          <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl">
            <button
              onClick={() => setCampingTab('campfire')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${campingTab === 'campfire' ? 'bg-white shadow text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🔥 Campfire
            </button>
            <button
              onClick={() => setCampingTab('network')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${campingTab === 'network' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              👥 Network
            </button>
            <button
              onClick={() => setCampingTab('camp')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-semibold transition ${campingTab === 'camp' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              🏕️ Campground
            </button>
          </div>

          {/* Hitch Pulse — always visible below tabs */}
          {campfireVibeMsg && (
            <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl px-5 py-4 mb-2">
              <div className="flex items-start gap-3">
                <img src="/hitch.png" alt="Hitch" className="w-9 h-9 rounded-full object-cover flex-shrink-0 mt-0.5" />
                <div>
                  <div className="text-white/80 text-xs font-semibold mb-1">🦄 Hitch's Campground Pulse</div>
                  <p className="text-white text-sm leading-relaxed">{campfireVibeMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* Campfire Tab */}
          {campingTab === 'campfire' && (
            <div className="space-y-6">
              {/* Campfire Trivia — standalone card */}
              {activeCheckIn?.campground && (
                <BasecampTriviaCard campgroundId={activeCheckIn.campground.id} />
              )}
              {/* Campfire Pulse Feed */}
              {activeCheckIn?.campground && (
                <CampfireChat
                  campgroundId={activeCheckIn.campground.id}
                  campgroundName={activeCheckIn.campground.name}
                />
              )}

              {/* Trip Photo Strip — horizontal scroll */}
              {linkedEvent && <CampfirePhotoStrip eventId={linkedEvent.id} eventTitle={linkedEvent.title} />}

              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🎮</span>
                    <h3 className="font-bold text-gray-900 text-sm">Campfire Games</h3>
                    <span className="text-xs bg-orange-50 text-orange-600 border border-orange-200 px-2 py-0.5 rounded-full font-medium">
                      {activeCheckIn?.campground?.name || 'Your Campground'}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">Multiplayer · campground only</span>
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { name: 'Campfire Trivia', desc: 'Test your camping & RV knowledge', emoji: '🎯', status: 'live', players: tonightData?.rverCount || 0 },
                    { name: 'Campground Bingo', desc: 'Spot amenities and earn your card', emoji: '🎲', status: 'coming_soon', players: 0 },
                    { name: 'Scavenger Hunt', desc: 'Explore the campground together', emoji: '🗺️', status: 'coming_soon', players: 0 },
                    { name: 'Would You Rather', desc: 'Campfire icebreakers for the group', emoji: '🔥', status: 'coming_soon', players: 0 },
                  ].map((game) => (
                    <div key={game.name} className={`flex items-center gap-3 p-3 rounded-xl border transition ${game.status === 'live' ? 'border-orange-200 bg-orange-50/50 hover:bg-orange-50 cursor-pointer' : 'border-gray-100 bg-gray-50/50'}`}
                      onClick={() => game.status === 'live' && setShowCampfireModal(true)}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${game.status === 'live' ? 'bg-orange-100' : 'bg-gray-100'}`}>
                        {game.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900">{game.name}</span>
                          {game.status === 'live' ? (
                            <span className="text-xs bg-green-100 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full font-medium animate-pulse">LIVE</span>
                          ) : (
                            <span className="text-xs bg-gray-100 text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded-full font-medium">Soon</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">{game.desc}</p>
                        {game.status === 'live' && game.players > 0 && (
                          <p className="text-xs text-orange-600 mt-0.5 font-medium">{game.players} campers available</p>
                        )}
                      </div>
                      {game.status === 'live' && (
                        <span className="text-orange-400 text-sm flex-shrink-0">→</span>
                      )}
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-100 text-center">
                  <p className="text-xs text-gray-400">More games coming as we license them — suggestions welcome 🦄</p>
                </div>
              </div>

              {/* ── Tonight's Sky — Walter stargazing card ── */}
              {tonightSkyPost && (() => {
                let meta: any = {};
                try { meta = typeof tonightSkyPost.metadata === 'string' ? JSON.parse(tonightSkyPost.metadata) : (tonightSkyPost.metadata || {}); } catch {}
                return (
                  <div className="bg-white rounded-xl border border-indigo-100 overflow-hidden">
                    <div className="px-3 py-2 border-b border-indigo-100 flex items-center gap-1.5 bg-gradient-to-r from-indigo-50 to-purple-50">
                      <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1773969595/rvunicorn/walter-stargazing.png" className="w-5 h-5 rounded-full object-cover" alt="Walter" />
                      <span className="font-bold text-xs text-indigo-900">Tonight's Sky</span>
                      <span className="text-[10px] text-indigo-400 ml-auto">{meta.moonPhase || '🌟'}</span>
                    </div>
                    <div className="p-2">
                      <StargazingCard
                        content={tonightSkyPost.content || ''}
                        metadata={{
                          imageUrl: meta.imageUrl || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773960904/rvunicorn/stargazing.png',
                          walterImage: meta.walterImage || 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773969595/rvunicorn/walter-stargazing.png',
                          campgroundName: meta.campgroundName || activeCheckIn?.campground?.name || '',
                          moonPhase: meta.moonPhase || '🌟',
                          date: meta.date || new Date().toISOString().split('T')[0],
                        }}
                      />
                    </div>
                  </div>
                );
              })()}

              {/* ── Nature Insight Cards ── */}
              <NatureInsightCards
                lat={activeCheckIn?.campground?.latitude ? Number(activeCheckIn.campground.latitude) : null}
                lng={activeCheckIn?.campground?.longitude ? Number(activeCheckIn.campground.longitude) : null}
                weather={planningData?.weather || null}
              />

              {/* Camp Market on campfire tab */}
              {activeCheckIn?.campground?.id && (
                <div id="camp-marketplace">
                  <CampMarket campgroundId={activeCheckIn.campground.id} />
                </div>
              )}
            </div>
          )}

          {/* Network Tab */}
          {campingTab === 'network' && (
            <div className="space-y-6">
              {activeCheckIn?.campground?.id && (
                <CampMarket campgroundId={activeCheckIn.campground.id} />
              )}
              <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={false} />
              <BasecampActivityFeed maxItems={10} showHeader={true} />
              <CampgroundUpdatesFeed maxItems={10} />
            </div>
          )}

          {/* Camp Tab */}
          {campingTab === 'camp' && (
            <div className="space-y-6">

              {/* Campground shortcuts + map */}
              {activeCheckIn?.campground && (
                <div className="bg-white rounded-xl border border-gray-100 p-4">
                  <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <span>🏕️</span> Campground Shortcuts
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <a href={`/campgrounds/${activeCheckIn.campground.id}`} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-medium text-gray-700">
                      <MapPin className="w-4 h-4 text-green-600" /> Campground Page
                    </a>
                    {activeCheckIn.campground.latitude && (
                      <a href={`https://www.google.com/maps/dir/?api=1&destination=${activeCheckIn.campground.latitude},${activeCheckIn.campground.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-medium text-gray-700">
                        <Navigation className="w-4 h-4 text-blue-600" /> Directions
                      </a>
                    )}
                    <a href={`/campgrounds/${activeCheckIn.campground.id}#map`} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-medium text-gray-700">
                      <Map className="w-4 h-4 text-purple-600" /> Map
                    </a>
                    {linkedEvent && (
                      <a href={`/trips/${linkedEvent.id}`} className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition text-sm font-medium text-gray-700">
                        <Calendar className="w-4 h-4 text-orange-600" /> My Trip
                      </a>
                    )}
                  </div>
                </div>
              )}

              {/* News & Events Calendar */}
              {activeCheckIn?.campground?.id && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-base">📅</span>
                    <h3 className="font-bold text-sm text-gray-900">News & Events</h3>
                  </div>
                  <div className="p-4">
                    <LocationEventsCalendar
                      locationId={activeCheckIn.campground.id}
                      locationType="campground"
                      locationName={activeCheckIn.campground.name}
                      eventId={linkedEvent?.id}
                      onActivityAdded={() => {}}
                    />
                  </div>
                </div>
              )}

              {/* Meal Plan — if linked event exists */}
              {linkedEvent && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-base">🍽️</span>
                    <h3 className="font-bold text-sm text-gray-900">Meal Plan</h3>
                    <span className="text-xs text-gray-400">{linkedEvent.title}</span>
                  </div>
                  <div className="p-4">
                    <MealPlanner
                      eventId={linkedEvent.id}
                      startDate={linkedEvent.startDate}
                      endDate={linkedEvent.endDate}
                      isOrganizer={linkedEvent.organizerId === user?.id}
                    />
                  </div>
                </div>
              )}

              {/* Trip Photo Album */}
              {linkedEvent && (
                <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-base">📸</span>
                    <h3 className="font-bold text-sm text-gray-900">Trip Photos</h3>
                    <span className="text-xs text-gray-400">{linkedEvent.title}</span>
                  </div>
                  <div className="p-4">
                    <EventAlbum
                      eventId={linkedEvent.id}
                      canUpload={true}
                      campgroundName={activeCheckIn?.campground?.name}
                      eventTitle={linkedEvent.title}
                    />
                  </div>
                </div>
              )}

              {/* Wildlife Sightings */}
              {activeCheckIn?.campground?.id && (
                <WildlifeSightings campgroundId={activeCheckIn.campground.id} />
              )}

              {/* PackUp + Wishlist */}
              <PackUpTasksWidget />
              <WishlistWidget />

              {/* Things To Do Nearby */}
              {activeCheckIn?.campground?.id && (
                <div className="bg-white rounded-xl border border-gray-100">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
                    <span className="text-base">🗺️</span>
                    <h3 className="font-bold text-sm text-gray-900">Things To Do Nearby</h3>
                  </div>
                  <ThingsToDoSection
                    campgroundId={activeCheckIn.campground.id}
                    campgroundName={activeCheckIn.campground.name}
                    eventId={linkedEvent?.id}
                  />
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* Campfire Chat Modal */}
      {showCampfireModal && activeCheckIn?.campground && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowCampfireModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[85vh] overflow-hidden shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
            {/* Modal header */}
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-3 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-xl">🔥</span>
                <div>
                  <div className="text-white font-bold text-sm">Campfire Chat</div>
                  <div className="text-orange-100 text-xs">{activeCheckIn.campground.name}</div>
                </div>
              </div>
              <button onClick={() => setShowCampfireModal(false)} className="text-white/80 hover:text-white text-xl leading-none">✕</button>
            </div>
            {/* Trivia card */}
            <div className="px-4 pt-3 flex-shrink-0">
              <CampfireTriviaOverlay
                socket={null}
                userId={user?.id || ''}
                campgroundId={activeCheckIn.campground.id}
              />
            </div>
            {/* Chat */}
            <div className="flex-1 overflow-hidden">
              <CampfireChat
                campgroundId={activeCheckIn.campground.id}
                campgroundName={activeCheckIn.campground.name}
                isUserCheckedIn={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Packing Modal */}
      <InventoryPackingModal
        isOpen={showPackingModal}
        onClose={() => setShowPackingModal(false)}
        mode="inventory"
      />


    </div>
    </>
  );
}