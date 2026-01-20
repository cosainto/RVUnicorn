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
  Sparkles,
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
  Image,
  Smile,
  Navigation,
  Share2,
} from 'lucide-react';
import api from '../services/api';
import { User as UserType } from '../services/auth.service';
import TravelMap from '../components/TravelMap';
import InventoryPackingModal from '../components/InventoryPackingModal';
import PackingAssignments from '../components/PackingAssignments';
import BasecampActivityFeed from '../components/BasecampActivityFeed';
import Top8Friends from '../components/Top8Friends';
import PackingList from '../components/PackingList';
import SocialFeed from '../components/SocialFeed';
import { TrendingHashtags } from '../components/HashtagDisplay';
import { CreatorToggleSection } from '../components/CreatorComponents';
import CreatorFeed from '../components/CreatorFeed';
import { useAuth } from '../contexts/AuthContext';

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
    <div className="space-y-3">
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
  THREAD_CREATED: { label: 'started a discussion', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  THREAD_POST: { label: 'replied to', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  EVENT_CREATED: { label: 'created an event', icon: <CalendarPlus className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-600' },
  EVENT_JOINED: { label: 'is attending', icon: <Heart className="w-4 h-4" />, color: 'bg-yellow-100 text-yellow-600' },
  POST: { label: 'posted', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-gray-100 text-gray-600' },
  RECIPE_COMMENT_THREAD: { label: 'commented on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-orange-100 text-orange-600' },
  RECIPE_MENTION: { label: 'mentioned you on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  THREAD_REPLY: { label: 'replied to', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  THREAD_COMMENT: { label: 'commented on', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-cyan-100 text-cyan-600' },
  THREAD_MENTION: { label: 'mentioned you in', icon: <MessageSquare className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
  RECIPE_SHARED: { label: 'shared a recipe', icon: <Share2 className="w-4 h-4" />, color: 'bg-green-100 text-green-600' },
  RECIPE_TAGGED: { label: 'tagged you in a recipe', icon: <AtSign className="w-4 h-4" />, color: 'bg-purple-100 text-purple-600' },
};

const PACK_CATEGORIES = [
  'General', 'Clothing', 'Kitchen', 'Safety', 'Electronics',
  'Toiletries', 'Outdoor Gear', 'Bedding', 'Tools', 'Food',
  'Documents', 'Entertainment', 'Pet Supplies', 'Kids', 'Other',
];

export default function BasecampPage({ user }: BasecampProps) {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  
  const [showPackingModal, setShowPackingModal] = useState(false);
  // Activity Feed State
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  // Top 8 Friends State
  const [topFriends, setTopFriends] = useState<Friend[]>([]);

  // Event Countdown State
  const [nextEvent, setNextEvent] = useState<UpcomingEvent | null>(null);
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  // Random quote for when no trip is planned
  const [randomQuote] = useState(() => 
    INSPIRATIONAL_QUOTES[Math.floor(Math.random() * INSPIRATIONAL_QUOTES.length)]
  );

  // Planned Events State (non-wishlist upcoming events + future state visits)
  const [plannedTrips, setPlannedTrips] = useState<PlannedTrip[]>([]);
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
  const [maintenanceStats, setMaintenanceStats] = useState<MaintenanceStats | null>(null);

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
        setUserBadges(badgeRes.data?.earned || []);
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary-900 via-primary-800 to-primary-900">
        {/* Navigation */}
        <nav className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="h-10 w-auto" />
            <div className="flex items-center gap-4">
              <Link to="/login" className="text-white/80 hover:text-white font-medium transition-colors">
                Log In
              </Link>
              <Link to="/register" className="bg-gradient-to-r from-gold-400 to-gold-500 hover:from-gold-500 hover:to-gold-600 text-white font-semibold px-5 py-2 rounded-full transition-all shadow-lg">
                Join Free
              </Link>
            </div>
          </div>
        </nav>

        {/* Hero - Large Logo Centered */}
        <div className="relative py-12 md:py-20">
          <div className="max-w-5xl mx-auto px-4 text-center">
            {/* Large Logo */}
            <img 
              src="/images/Logo_RVUnicorn.png" 
              alt="RVUnicorn - Your Kind of People" 
              className="w-full max-w-3xl mx-auto mb-8 drop-shadow-2xl"
            />
            
            {/* Tagline */}
            <p className="text-2xl md:text-3xl text-primary-100 max-w-2xl mx-auto mb-10">
              The invite-only social network for <span className="text-gold-400 font-semibold">RV enthusiasts</span> & <span className="text-campfire-400 font-semibold">campers</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register" className="bg-gradient-to-r from-campfire-500 to-campfire-600 hover:from-campfire-600 hover:to-campfire-700 text-white font-bold px-10 py-4 rounded-full text-xl transition-all shadow-xl hover:shadow-2xl hover:scale-105 inline-flex items-center justify-center gap-2">
                🦄 Join the Tribe — It's Free
              </Link>
              <Link to="/login" className="bg-white/10 hover:bg-white/20 border-2 border-white/30 text-white font-semibold px-8 py-4 rounded-full text-lg transition-all inline-flex items-center justify-center">
                I Have an Account
              </Link>
            </div>
          </div>
        </div>

        {/* Why Join Section */}
        <div className="relative z-10 bg-white py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
                Why Join <span className="text-primary-600">RVUnicorn</span>?
              </h2>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Everything you need to plan, share, and connect with your camping community
              </p>
            </div>

            {/* Perks Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {/* Perk 1 */}
              <div className="bg-gradient-to-br from-primary-50 to-white rounded-2xl p-8 border border-primary-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">🏕️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">5,500+ Campgrounds</h3>
                <p className="text-gray-600">
                  Browse detailed campground listings with photos, amenities, real reviews, and insider tips from fellow RVers.
                </p>
              </div>

              {/* Perk 2 */}
              <div className="bg-gradient-to-br from-gold-50 to-white rounded-2xl p-8 border border-gold-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">👥</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Find Your Tribe</h3>
                <p className="text-gray-600">
                  Connect with like-minded campers. Follow friends, share updates, and build your camping community.
                </p>
              </div>

              {/* Perk 3 */}
              <div className="bg-gradient-to-br from-campfire-50 to-white rounded-2xl p-8 border border-campfire-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">🗺️</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Trip Planning</h3>
                <p className="text-gray-600">
                  Plan routes, create packing lists, coordinate with friends, and discover pit stops along the way.
                </p>
              </div>

              {/* Perk 4 */}
              <div className="bg-gradient-to-br from-forest-50 to-white rounded-2xl p-8 border border-forest-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">🍳</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Camp Recipes</h3>
                <p className="text-gray-600">
                  Share and discover delicious camping recipes. Plan meals for trips with our built-in meal planner.
                </p>
              </div>

              {/* Perk 5 */}
              <div className="bg-gradient-to-br from-twilight-50 to-white rounded-2xl p-8 border border-twilight-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">📍</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Track Your Travels</h3>
                <p className="text-gray-600">
                  Log states visited, mark campgrounds on your map, and build your ultimate camping journal.
                </p>
              </div>

              {/* Perk 6 */}
              <div className="bg-gradient-to-br from-rose-50 to-white rounded-2xl p-8 border border-rose-100 hover:shadow-xl transition-all group">
                <div className="text-5xl mb-4">📅</div>
                <h3 className="text-xl font-bold text-gray-900 mb-2">Events & Rallies</h3>
                <p className="text-gray-600">
                  Join group trips, RSVP to events, and meet up with your RV community in person.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Feature Showcase with Images */}
        <div className="bg-gray-50 py-20">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Feature 1 */}
            <div className="grid md:grid-cols-2 gap-12 items-center mb-20">
              <div>
                <span className="text-campfire-500 font-semibold text-sm uppercase tracking-wider">Adventure Awaits</span>
                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">
                  Plan Epic Road Trips
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  Our drive planner helps you map out your route, find campgrounds along the way, and discover roadside attractions you won't want to miss.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-forest-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    Multi-stop route planning
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-forest-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    Campground recommendations
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-forest-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    Share trips with friends
                  </li>
                </ul>
              </div>
              <div className="relative">
                <img 
                  src="/images/RV_Hiking.png" 
                  alt="RVUnicorn hiking adventure" 
                  className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl"
                />
              </div>
            </div>

            {/* Feature 2 */}
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div className="order-2 md:order-1 relative">
                <img 
                  src="/images/BBQ_RV.png" 
                  alt="RVUnicorn BBQ" 
                  className="w-full max-w-lg mx-auto rounded-2xl shadow-2xl"
                />
              </div>
              <div className="order-1 md:order-2">
                <span className="text-campfire-500 font-semibold text-sm uppercase tracking-wider">Community Features</span>
                <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mt-2 mb-4">
                  Share the Good Times
                </h3>
                <p className="text-lg text-gray-600 mb-6">
                  Post updates, share photos, swap recipes, and keep your camping crew in the loop. It's social media made for campers.
                </p>
                <ul className="space-y-3">
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-campfire-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    Photo sharing & albums
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-campfire-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    @mention friends
                  </li>
                  <li className="flex items-center gap-3 text-gray-700">
                    <div className="w-6 h-6 bg-campfire-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <Check className="w-4 h-4 text-white" />
                    </div>
                    Top 8 friends (like MySpace!)
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="bg-gradient-to-r from-primary-800 to-twilight-800 py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <img 
              src="/images/Hitch_OutsideTV.png" 
              alt="RVUnicorn relaxing" 
              className="w-64 h-64 object-contain mx-auto mb-8"
            />
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Ready to Find Your Tribe?
            </h2>
            <p className="text-xl text-primary-200 mb-8 max-w-xl mx-auto">
              Join thousands of RV enthusiasts who've already discovered their camping community.
            </p>
            <Link to="/register" className="bg-gradient-to-r from-gold-400 to-campfire-500 hover:from-gold-500 hover:to-campfire-600 text-white font-bold px-12 py-5 rounded-full text-xl transition-all shadow-xl hover:shadow-2xl hover:scale-105 inline-flex items-center justify-center gap-3">
              🦄 Join RVUnicorn — 100% Free
            </Link>
            <p className="text-primary-300 mt-4 text-sm">
              No credit card required. Start exploring today.
            </p>
          </div>
        </div>

        {/* Footer */}
        <footer className="bg-primary-950 border-t border-white/10 py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="h-8 w-auto" />
              <p className="text-primary-400 text-sm">
                © 2024 RVUnicorn. Your Kind of People.
              </p>
              <div className="flex items-center gap-6">
                <a href="#" className="text-primary-400 hover:text-white transition-colors text-sm">Privacy</a>
                <a href="#" className="text-primary-400 hover:text-white transition-colors text-sm">Terms</a>
                <a href="#" className="text-primary-400 hover:text-white transition-colors text-sm">Contact</a>
              </div>
            </div>
          </div>
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Event Countdown Banner OR Inspirational Quote */}
      {nextEvent ? (
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
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* User Status */}
        {userProfile && (
          <div className="bg-white rounded-lg shadow-md p-4 mb-8">
            <EnhancedStatusBar 
              user={user}
              profile={userProfile}
              onUpdate={loadRVInfo}
              onPost={loadFeed}
            />
          </div>
        )}

        {/* Customizable Quick Links */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">Quick Links</h2>
            <button
              onClick={() => setEditingLinks(!editingLinks)}
              className={`p-2 rounded-lg transition-colors ${editingLinks ? 'bg-green-100 text-green-600' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
              title={editingLinks ? 'Done editing' : 'Edit quick links'}
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>

          {/* Edit Mode Panel */}
          {editingLinks && (
            <div className="mb-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-gray-600">
                  <GripVertical className="w-4 h-4 inline mr-1" />
                  Drag to reorder • Click ✕ to remove
                </p>
                <button
                  onClick={resetQuickLinks}
                  className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset to Default
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-xs text-gray-500 mr-2">Add:</span>
                {AVAILABLE_LINKS
                  .filter((l) => !quickLinks.find((q) => q.id === l.id))
                  .map((link) => (
                    <button
                      key={link.id}
                      onClick={() => addQuickLink(link)}
                      className="text-xs bg-white border border-gray-300 px-2 py-1 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors"
                    >
                      + {link.label}
                    </button>
                  ))}
              </div>
            </div>
          )}

          {/* Quick Links Grid */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {quickLinks.map((link, index) => {
              const IconComponent = iconMap[link.icon] || Home;
              const colorClasses = colorMap[link.color] || colorMap.blue;
              
              return (
                <div
                  key={link.id}
                  draggable={editingLinks}
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative ${editingLinks ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  {/* Remove Button (Edit Mode) */}
                  {editingLinks && (
                    <button
                      onClick={() => removeQuickLink(link.id)}
                      className="absolute -top-2 -right-2 z-10 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 shadow-md"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  
                  {/* Drag Handle (Edit Mode) */}
                  {editingLinks && (
                    <div className="absolute top-1/2 left-1 -translate-y-1/2 text-gray-400 z-10">
                      <GripVertical className="w-4 h-4" />
                    </div>
                  )}

                  <Link
                    to={editingLinks ? '#' : getQuickLinkPath(link.path)}
                    onClick={(e) => editingLinks && e.preventDefault()}
                    className={`bg-white rounded-lg shadow-sm border border-gray-100 p-4 hover:shadow-md transition flex items-center gap-3 ${editingLinks ? 'opacity-90 ring-2 ring-dashed ring-gray-300' : ''}`}
                  >
                    <div className={`p-3 rounded-full ${colorClasses}`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-900">{link.label}</h3>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </div>


        {/* Creator Mode Section */}
        <div className="mb-8">
          <CreatorToggleSection
            isCreator={userProfile?.isCreator || false}
            username={user?.username || ""}
            onToggle={async () => { await refreshUser(); loadRVInfo(); }}
          />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content - Left 2 Columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Map Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <MapPin className="w-6 h-6 text-primary-600" />
                  Your Travel Map
                </h2>
                <Link
                  to="/travel"
                  className="text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Home className="w-4 h-4" />
                  Full Map
                </Link>
              </div>
              <TravelMap userId={user.id} isOwnProfile={true} />
            </div>

             {/* Planned Events List - NEW SECTION */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setPlannedTripsExpanded(!plannedTripsExpanded)}
                className="w-full p-6 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Calendar className="w-6 h-6 text-blue-600" />
                  Planned Camping Trips
                  {plannedTrips.length > 0 && (
                    <span className="text-sm font-normal text-gray-500">({plannedTrips.length})</span>
                  )}
                </h2>
                <div className="flex items-center gap-3">
                  <Link
                    to="/trips"
                    onClick={(e) => e.stopPropagation()}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    View All
                  </Link>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${plannedTripsExpanded ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {plannedTripsExpanded && (
              <div className="px-6 pb-6">           

              {plannedTrips.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                  <p className="text-gray-500 mb-2">No upcoming trips planned</p>
                  <Link
                    to="/trips"
                    className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium"
                  >
                    <Plus className="w-4 h-4" />
                    Plan a Trip
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {plannedTrips.map((trip) => (
                    <div
                      key={`${trip.type}-${trip.id}`}
                      className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-blue-200 hover:bg-blue-50/50 transition-colors group"
                    >
                      {/* Trip Info - Clickable Link */}
                      <Link
                        to={trip.type === 'event' ? `/trips/${trip.id}` : `/travel`}
                        className="flex items-center gap-4 flex-1 min-w-0"
                      >
                        {/* Date Badge */}
                        <div className={`flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center text-white shadow-sm ${
                          trip.type === 'event' 
                            ? 'bg-gradient-to-br from-blue-500 to-blue-600' 
                            : 'bg-gradient-to-br from-emerald-500 to-teal-600'
                        }`}>
                          <span className="text-xs font-medium uppercase">
                            {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short' })}
                          </span>
                          <span className="text-xl font-bold leading-none">
                            {new Date(trip.startDate).getDate()}
                          </span>
                        </div>

                        {/* Trip Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                                                         {trip.title} <h3 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors truncate">
                              {trip.title}
                            </h3>
                            
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
                            {trip.campground ? (
                              <>
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="truncate">
                                  {trip.campground.name}
                                  {trip.campground.state && `, ${trip.campground.state}`}
                                </span>
                              </>
                            ) : trip.location ? (
                              <>
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="truncate">{trip.location}</span>
                              </>
                            ) : trip.state ? (
                              <>
                                <MapPin className="w-4 h-4 text-gray-400" />
                                <span className="truncate">{trip.state}</span>
                              </>
                            ) : (
                              <span className="text-gray-400 italic">No location set</span>
                            )}
                          </div>
                          {trip.endDate && trip.endDate !== trip.startDate && (
                            <p className="text-xs text-gray-400 mt-1">
                              {new Date(trip.startDate).toLocaleDateString()} - {new Date(trip.endDate).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </Link>

                      {/* Plan Route Button */}
                      {(trip.campground || trip.location) && (
                        <button
                          onClick={() => {
                            const params = new URLSearchParams();
                            params.set('eventId', trip.id);
                            params.set('eventTitle', trip.title);
                            if (trip.campground) {
                              params.set('campgroundId', trip.campground.id);
                              params.set('campgroundName', trip.campground.name);
                              if (trip.campground.state) params.set('campgroundState', trip.campground.state);
                            } else if (trip.location) {
                              params.set('destination', trip.location);
                            }
                            if (trip.startDate) params.set('startDate', trip.startDate);
                            navigate(`/travel?tab=drive-planner&${params.toString()}`);
                          }}
                          className="flex-shrink-0 px-3 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm rounded-lg flex items-center gap-1.5 transition-colors"
                          title="Plan route to this destination"
                        >
                          <Navigation className="w-4 h-4" />
                          <span className="hidden sm:inline">Plan Route</span>
                        </button>
                      )}

                      {/* Arrow */}
                      <Link to={trip.type === 'event' ? `/trips/${trip.id}` : `/travel`}>
                        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                      </Link>
                    </div>
                  ))}
             


                    </div>
                   )}
                   </div>
                    )}
                   </div>




            {/* Activity Wall */}
            {/* Creator Videos from people you follow */}
            <CreatorFeed limit={6} showHeader={true} />

            <SocialFeed username={user?.username || ""} isOwnProfile={true} includePacking={true} />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
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
                    <img src="/images/showusyourrig.png" alt="Show us your rig" className="w-full h-full object-cover" />
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
              
             <Top8Friends username={user?.username} />

            {/* Trending Topics */}
            <TrendingHashtags />

            {/* Social Links Widget */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setEditingSocial(!editingSocial)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-indigo-500" />
                  <h3 className="font-bold text-gray-800">My Social Links</h3>
                </div>
                <div className="flex items-center gap-2">
                  {/* Show existing link icons when collapsed */}
                  {!editingSocial && hasSocialLinks && (
                    <div className="flex items-center gap-1">
                      {socialLinks.website && (
                        <Globe className="w-4 h-4 text-gray-400" />
                      )}
                      {socialLinks.facebookUrl && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      )}
                      {socialLinks.instagramUrl && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      )}
                      {socialLinks.twitterUrl && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      )}
                      {socialLinks.youtubeUrl && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      )}
                      {socialLinks.tiktokUrl && (
                        <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                      )}
                    </div>
                  )}
                  {!editingSocial && !hasSocialLinks && (
                    <span className="text-xs text-gray-400">Add links</span>
                  )}
                  {editingSocial ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded Edit View */}
              {editingSocial && (
                <div className="px-4 pb-4 space-y-3">
                  {/* Website */}
                  <div className="flex items-center gap-2">
                    <Globe className="w-5 h-5 text-gray-400 flex-shrink-0" />
                    <input
                      type="url"
                      value={socialLinks.website}
                      onChange={(e) => setSocialLinks({ ...socialLinks, website: e.target.value })}
                      placeholder="Website URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Facebook */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                    <input
                      type="url"
                      value={socialLinks.facebookUrl}
                      onChange={(e) => setSocialLinks({ ...socialLinks, facebookUrl: e.target.value })}
                      placeholder="Facebook URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Instagram */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-pink-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                    <input
                      type="url"
                      value={socialLinks.instagramUrl}
                      onChange={(e) => setSocialLinks({ ...socialLinks, instagramUrl: e.target.value })}
                      placeholder="Instagram URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Twitter/X */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-800 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                    <input
                      type="url"
                      value={socialLinks.twitterUrl}
                      onChange={(e) => setSocialLinks({ ...socialLinks, twitterUrl: e.target.value })}
                      placeholder="X (Twitter) URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* YouTube */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                    <input
                      type="url"
                      value={socialLinks.youtubeUrl}
                      onChange={(e) => setSocialLinks({ ...socialLinks, youtubeUrl: e.target.value })}
                      placeholder="YouTube URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* TikTok */}
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-800 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                    <input
                      type="url"
                      value={socialLinks.tiktokUrl}
                      onChange={(e) => setSocialLinks({ ...socialLinks, tiktokUrl: e.target.value })}
                      placeholder="TikTok URL"
                      className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>

                  {/* Visibility Toggles */}
                  <div className="border-t border-gray-200 pt-3 mt-3 space-y-3">
                    <p className="text-sm font-medium text-gray-700">Show social links on:</p>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-600">My Profile Page</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={socialLinks.showSocialOnProfile}
                          onChange={(e) => setSocialLinks({ ...socialLinks, showSocialOnProfile: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                    </label>
                    <label className="flex items-center justify-between cursor-pointer">
                      <span className="text-sm text-gray-600">My Creator Page</span>
                      <div className="relative">
                        <input
                          type="checkbox"
                          checked={socialLinks.showSocialOnCreator}
                          onChange={(e) => setSocialLinks({ ...socialLinks, showSocialOnCreator: e.target.checked })}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[\] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </div>
                    </label>
                  </div>


                  {/* Save Button */}
                  <button
                    onClick={saveSocialLinks}
                    disabled={savingSocial}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {savingSocial ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        Save Links
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Compact Link View (when has links and not editing) */}
              {!editingSocial && hasSocialLinks && (
                <div className="px-4 pb-4 flex flex-wrap gap-2">
                  {socialLinks.website && (
                    <a
                      href={socialLinks.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                    >
                      <Globe className="w-4 h-4" />
                      <span>Website</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                  {socialLinks.facebookUrl && (
                    <a
                      href={buildSocialUrl(socialLinks.facebookUrl, "facebook")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-100 hover:bg-blue-200 rounded-full text-sm text-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      <span>Facebook</span>
                    </a>
                  )}
                  {socialLinks.instagramUrl && (
                    <a
                      href={buildSocialUrl(socialLinks.instagramUrl, "instagram")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-pink-100 hover:bg-pink-200 rounded-full text-sm text-pink-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                      <span>Instagram</span>
                    </a>
                  )}
                  {socialLinks.twitterUrl && (
                    <a
                      href={buildSocialUrl(socialLinks.twitterUrl, "twitter")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                      <span>X</span>
                    </a>
                  )}
                  {socialLinks.youtubeUrl && (
                    <a
                      href={buildSocialUrl(socialLinks.youtubeUrl, "youtube")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-100 hover:bg-red-200 rounded-full text-sm text-red-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                      <span>YouTube</span>
                    </a>
                  )}
                  {socialLinks.tiktokUrl && (
                    <a
                      href={buildSocialUrl(socialLinks.tiktokUrl, "tiktok")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full text-sm text-gray-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>
                      <span>TikTok</span>
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Recipe Box Widget */}
            <div className="bg-white rounded-lg shadow-md overflow-hidden">
              <button
                onClick={() => setRecipeBoxExpanded(!recipeBoxExpanded)}
                className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <ChefHat className="w-5 h-5 text-orange-500" />
                  <h3 className="font-bold text-gray-800">My Recipe Box</h3>
                </div>
                <div className="flex items-center gap-2">
                  {!recipeBoxExpanded && savedRecipes.length > 0 && (
                    <span className="text-sm text-gray-400">{savedRecipes.length} saved</span>
                  )}
                  {!recipeBoxExpanded && savedRecipes.length === 0 && (
                    <span className="text-xs text-gray-400">Add recipes</span>
                  )}
                  {recipeBoxExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </button>

              {/* Expanded View */}
              {recipeBoxExpanded && (
                <div className="px-4 pb-4">
                  {savedRecipes.length === 0 ? (
                    <div className="text-center py-4">
                      <ChefHat className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                      <p className="text-sm text-gray-400">No saved recipes yet</p>
                      <Link 
                        to="/recipes" 
                        className="text-xs text-orange-500 hover:text-orange-600 mt-2 inline-block"
                      >
                        Browse recipes to save →
                      </Link>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedRecipes.map((saved) => (
                        <Link
                          key={saved.id}
                          to={`/recipes/${saved.recipe.id}`}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-orange-50 transition-colors group"
                        >
                          {saved.recipe.imageUrl ? (
                            <img
                              src={saved.recipe.imageUrl.startsWith('http') ? saved.recipe.imageUrl : `${saved.recipe.imageUrl}`}
                              alt={saved.recipe.title}
                              className="w-12 h-12 rounded-lg object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center">
                              <ChefHat className="w-6 h-6 text-orange-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-medium text-gray-800 truncate group-hover:text-orange-600 transition-colors">
                                {saved.recipe.title}
                              </p>
                              {saved.favorite && (
                                <Heart className="w-4 h-4 text-red-500 fill-red-500 flex-shrink-0" />
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-400">
                              {saved.recipe.prepTime && saved.recipe.cookTime && (
                                <span>{saved.recipe.prepTime + saved.recipe.cookTime} min</span>
                              )}
                              {saved.recipe.author && (
                                <span>by {saved.recipe.author.firstName}</span>
                              )}
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-orange-500" />
                        </Link>
                      ))}
                      
                      <Link
                        to="/recipes?tab=saved"
                        className="block text-center text-sm text-orange-600 hover:text-orange-700 mt-2 pt-2 border-t border-gray-100"
                      >
                        View all saved recipes →
                      </Link>
                    </div>
                  )}
                </div>
              )}

              {/* Compact View - show mini recipe thumbnails when collapsed */}
              {!recipeBoxExpanded && savedRecipes.length > 0 && (
                <div className="px-4 pb-4 flex items-center gap-2">
                  {savedRecipes.slice(0, 4).map((saved) => (
                    <Link
                      key={saved.id}
                      to={`/recipes/${saved.recipe.id}`}
                      className="relative group"
                      title={saved.recipe.title}
                    >
                      {saved.recipe.imageUrl ? (
                        <img
                          src={saved.recipe.imageUrl.startsWith('http') ? saved.recipe.imageUrl : `${saved.recipe.imageUrl}`}
                          alt={saved.recipe.title}
                          className="w-10 h-10 rounded-lg object-cover hover:scale-110 transition-transform"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center hover:scale-110 transition-transform">
                          <ChefHat className="w-5 h-5 text-orange-400" />
                        </div>
                      )}
                      {saved.favorite && (
                        <Heart className="absolute -top-1 -right-1 w-3 h-3 text-red-500 fill-red-500" />
                      )}
                    </Link>
                  ))}
                  {savedRecipes.length > 4 && (
                    <Link
                      to="/recipes?tab=saved"
                      className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                      +{savedRecipes.length - 4}
                    </Link>
                  )}
                </div>
              )}
            </div>
            

            {/* Badge Bulletin Board */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  My Badges
                </h3>
                <span className="text-sm text-gray-500">{userBadges.length + userStickers.length} earned</span>
              </div>

              {userBadges.length === 0 && userStickers.length === 0 ? (
                <div className="text-center py-6">
                  <Award className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">No badges earned yet</p>
                  <p className="text-xs text-gray-300 mt-1">Complete activities to earn badges!</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {/* Platform Badges */}
                  {userBadges.slice(0, 8).map((badge) => (
                    <div
                      key={badge.id}
                      className="relative group cursor-pointer"
                      title={`${badge.name}
${badge.description || ''}
Earned: ${new Date(badge.earnedAt).toLocaleDateString()}`}
                    >
                      <div className="aspect-square rounded-lg bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-300 flex items-center justify-center hover:scale-110 transition-transform hover:shadow-lg overflow-hidden">
                        {badge.imageUrl ? (
                          <img 
                            src={badge.imageUrl} 
                            alt={badge.name} 
                            className="w-full h-full object-cover" 
                          />
                        ) : (
                          <Award className="w-6 h-6 text-amber-400" />
                        )}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {badge.name}
                      </div>
                    </div>
                  ))}
                  
                  {/* Campground Stickers */}
                  {userStickers.slice(0, Math.max(0, 8 - userBadges.length)).map((us) => (
                    <div
                      key={us.id}
                      className="relative group cursor-pointer"
                      title={`${us.sticker.name}
${us.sticker.description || ''}
Earned: ${new Date(us.earnedAt).toLocaleDateString()}`}
                    >
                      <div className="aspect-square rounded-lg bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 flex items-center justify-center hover:scale-110 transition-transform hover:shadow-lg">
                        {us.sticker.emoji ? (
                          <span className="text-2xl">{us.sticker.emoji}</span>
                        ) : us.sticker.imageUrl ? (
                          <img src={us.sticker.imageUrl} alt={us.sticker.name} className="w-8 h-8 object-contain" />
                        ) : (
                          <Star className="w-6 h-6 text-green-400" />
                        )}
                      </div>
                      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                        {us.sticker.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(userBadges.length + userStickers.length) > 8 && (
                <Link
                  to="/badges"
                  className="block text-center text-sm text-amber-600 hover:text-amber-700 mt-3"
                >
                  View all {userBadges.length + userStickers.length} badges →
                </Link>
              )}
            </div>

            {/* Wishlist Box - NEW SECTION */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Bookmark className="w-5 h-5 text-pink-500" />
                  My Wishlist
                </h3>
                <span className="text-sm text-gray-500">{wishlistEvents.length} trips</span>
              </div>

              {wishlistEvents.length === 0 ? (
                <div className="text-center py-6">
                  <Bookmark className="w-12 h-12 mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">No wishlist trips yet</p>
                  <p className="text-xs text-gray-300 mt-1">Save trips you'd love to take!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {wishlistEvents.slice(0, 5).map((event) => (
                    <Link
                      key={event.id}
                      to={`/trips/${event.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-pink-50 transition-colors group"
                    >
                      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-pink-100 to-rose-100 flex items-center justify-center flex-shrink-0">
                        <Heart className="w-5 h-5 text-pink-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate group-hover:text-pink-600 transition-colors">
                          {event.title || event.name}
                        </p>
                        {event.campground ? (
                          <p className="text-xs text-gray-400 truncate">
                            {event.campground.name}
                          </p>
                        ) : event.location ? (
                          <p className="text-xs text-gray-400 truncate">
                            {event.location}
                          </p>
                        ) : null}
                      </div>
                      <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-pink-500" />
                    </Link>
                  ))}
                </div>
              )}

              {wishlistEvents.length > 5 && (
                <Link
                  to="/trips?filter=wishlist"
                  className="block text-center text-sm text-pink-600 hover:text-pink-700 mt-3"
                >
                  View all {wishlistEvents.length} wishlist trips →
                </Link>
              )}
            </div>

            {/* My Groups */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-500" />
                  My Groups
                </h3>
                <Link to="/groups" className="text-blue-500 hover:text-blue-600 text-sm">
                  All Groups
                </Link>
              </div>

              {userGroups.length === 0 ? (
                <div className="relative aspect-video bg-gray-100 rounded-lg overflow-hidden">
                  <img 
                    src="/images/Find_Your_Herd_Default_Poppy.png" 
                    alt="Find your herd" 
                    className="w-full h-full object-cover"
                  />
                  <Link
                    to="/groups"
                    className="absolute inset-0 flex items-center justify-center bg-black/30 hover:bg-black/40 transition"
                  >
                    <span className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg font-semibold flex items-center gap-2">
                      <Plus className="w-5 h-5" />
                      Find Your Herd
                    </span>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {userGroups.slice(0, 5).map((group) => (
                    <Link
                      key={group.id}
                      to={`/groups/${group.slug || group.id}`}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-blue-50 transition-colors group"
                    >
                      {group.imageUrl ? (
                        <img
                          src={group.imageUrl.startsWith('http') ? group.imageUrl : `${group.imageUrl}`}
                          alt={group.name}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <Users className="w-5 h-5 text-blue-500" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                          {group.name}
                        </p>
                        <p className="text-xs text-gray-400">
                          {group._count?.members || group.memberCount || 0} members
                        </p>
                      </div>
                      {group.unreadCount && group.unreadCount > 0 ? (
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full min-w-[20px] text-center">
                          {group.unreadCount}
                        </span>
                      ) : (
                        <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-500" />
                      )}
                    </Link>
                  ))}
                </div>
              )}

              {userGroups.length > 5 && (
                <Link
                  to="/groups"
                  className="block text-center text-sm text-blue-600 hover:text-blue-700 mt-3"
                >
                  View all {userGroups.length} groups →
                </Link>
              )}
            </div>

            {/* Packing List */}
            <div className="bg-white rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  Packing List
                </h3>
                <button
                  onClick={() => setShowPackingModal(true)}
                  className="text-sm text-green-600 hover:text-green-700 font-medium"
                >
                  Manage →
                </button>
              </div>
              <div className="text-center py-4">
                <button
                  onClick={() => setShowPackingModal(true)}
                  className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"
                >
                  📦 Inventory & Packing
                </button>
              </div>
            </div>

            {/* Packing Assignments */}
            <PackingAssignments />

            {/* Basecamp Activity */}
            <BasecampActivityFeed maxItems={10} showHeader={true} />

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <Link
                  to="/trips"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <CalendarPlus className="w-5 h-5 text-blue-600" />
                  <span className="text-sm text-gray-700">Plan a Trip</span>
                </Link>
                <Link
                  to="/campgrounds"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <Tent className="w-5 h-5 text-green-600" />
                  <span className="text-sm text-gray-700">Find Campgrounds</span>
                </Link>
                <Link
                  to="/feed"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <MessageSquare className="w-5 h-5 text-purple-600" />
                  <span className="text-sm text-gray-700">View Discussions</span>
                </Link>
                <Link
                  to="/trips"
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 transition"
                >
                  <CalendarPlus className="w-5 h-5 text-yellow-600" />
                  <span className="text-sm text-gray-700">Browse Trips</span>
                </Link>
              </div>
            </div>

            {/* Campground Updates */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Tent className="w-5 h-5 text-green-600" />
                Campground Updates
              </h3>
              <p className="text-sm text-gray-500">
                Updates from campgrounds you follow will appear in your activity wall.
              </p>
              <Link
                to="/campgrounds"
                className="text-sm text-primary-600 hover:text-primary-700 mt-2 inline-block"
              >
                Browse Campgrounds →
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Packing Modal */}
      <InventoryPackingModal
        isOpen={showPackingModal}
        onClose={() => setShowPackingModal(false)}
        mode="inventory"
      />
    </div>
  );
}
