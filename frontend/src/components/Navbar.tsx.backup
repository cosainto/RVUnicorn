import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, 
  Menu, 
  X, 
  User, 
  LogOut, 
  Settings, 
  ChevronDown,
  Search,
  Home,
  Flame,
  Compass,
  Backpack,
  Users,
  MapPin,
  Calendar,
  Briefcase,
  Map,
  Camera,
  UtensilsCrossed,
  Package,
  Wrench,
  MessageCircle,
  UsersRound,
  Award,
  Shield,
  Sparkles,
  Heart,
  Play
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';

interface Notification {
  id: string;
  type: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

interface DropdownItem {
  icon: React.ReactNode;
  label: string;
  to: string;
  description?: string;
  badge?: string;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setActiveDropdown(null);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Load notifications
  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
    setActiveDropdown(null);
  }, [location.pathname]);

  const loadNotifications = async () => {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data);
      setUnreadCount(data.filter((n: Notification) => !n.read).length);
    } catch (error) {
      console.error('Load notifications error:', error);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleNotificationClick = async (notification: Notification) => {
    try {
      if (!notification.read) {
        await api.put(`/notifications/${notification.id}/read`);
        loadNotifications();
      }
      setNotificationsOpen(false);
      // Navigate based on notification link
      if (notification.link) {
        navigate(notification.link);
      }
    } catch (error) {
      console.error('Mark notification read error:', error);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      loadNotifications();
    } catch (error) {
      console.error('Mark all read error:', error);
    }
  };

  // Dropdown menu configurations - matched to actual App.tsx routes
  const exploreItems: DropdownItem[] = [
    { icon: <MapPin className="w-4 h-4" />, label: 'Campgrounds', to: '/campgrounds', description: 'Browse 5,500+ campgrounds' },
    { icon: <Calendar className="w-4 h-4" />, label: 'Trips & Events', to: '/trips', description: 'Group trips & rallies' },
    { icon: <Map className="w-4 h-4" />, label: 'Travel Map', to: '/travel', description: 'Track states visited' },
    { icon: <Compass className="w-4 h-4" />, label: 'Drive Planner', to: '/drive-planner', description: 'Plan your routes' },
    { icon: <Briefcase className="w-4 h-4" />, label: 'Jobs', to: '/jobs', description: 'Campground jobs & gigs' },
  ];

  const campfireItems: DropdownItem[] = [
    { icon: <Sparkles className="w-4 h-4" />, label: 'Browse Creators', to: '/creators/leaderboard', description: 'Discover RV content creators' },
    { icon: <Heart className="w-4 h-4" />, label: 'Following', to: '/following', description: 'Creators you follow' },
    { icon: <Play className="w-4 h-4" />, label: 'My Creator Page', to: '/creator/dashboard', description: 'Manage your content', badge: 'CREATE' },
  ];

  const myStuffItems: DropdownItem[] = [
    { icon: <Camera className="w-4 h-4" />, label: 'Albums', to: '/media-albums', description: 'Your photo albums' },
    { icon: <UtensilsCrossed className="w-4 h-4" />, label: 'Recipes', to: '/recipes', description: 'Camp cooking recipes' },
    { icon: <Package className="w-4 h-4" />, label: 'Gear', to: '/gear', description: 'Gear & packing lists' },
    { icon: <Wrench className="w-4 h-4" />, label: 'My RV', to: '/my-rv', description: 'RV specs & showcase' },
    { icon: <Settings className="w-4 h-4" />, label: 'Maintenance', to: '/maintenance', description: 'Service records' },
  ];

  const socialItems: DropdownItem[] = [
    { icon: <Users className="w-4 h-4" />, label: 'Friends', to: '/friends', description: 'Your camping buddies' },
    { icon: <MessageCircle className="w-4 h-4" />, label: 'Messages', to: '/messages', description: 'Direct messages' },
    { icon: <UsersRound className="w-4 h-4" />, label: 'Groups', to: '/groups', description: 'Camping communities' },
    { icon: <Award className="w-4 h-4" />, label: 'Badges', to: '/badges', description: 'Your achievements' },
  ];

  const NavDropdown = ({ 
    label, 
    items, 
    id 
  }: { 
    label: string; 
    items: DropdownItem[]; 
    id: string;
  }) => (
    <div className="relative" ref={activeDropdown === id ? dropdownRef : null}>
      <button
        onClick={() => setActiveDropdown(activeDropdown === id ? null : id)}
        className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
          activeDropdown === id 
            ? 'bg-primary-800 text-gold-400' 
            : 'text-white/90 hover:text-white hover:bg-white/10'
        }`}
      >
        {label}
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${activeDropdown === id ? 'rotate-180' : ''}`} />
      </button>
      
      {activeDropdown === id && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
          {items.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setActiveDropdown(null)}
              className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
            >
              <div className="p-2 rounded-lg bg-primary-50 text-primary-600 group-hover:bg-primary-100 transition-colors">
                {item.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{item.label}</span>
                  {item.badge && (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-campfire-500 text-white rounded-full">
                      {item.badge}
                    </span>
                  )}
                </div>
                {item.description && (
                  <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );

  if (!user) return null;

  return (
    <>
      <nav className="bg-gradient-to-r from-primary-900 via-primary-800 to-primary-900 shadow-lg sticky top-0 z-50 border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo */}
            <Link 
              to="/basecamp" 
              className="flex items-center gap-2 group"
            >
              <img 
                src="/images/Logo_RVUnicorn.png" 
                alt="RVUnicorn" 
                className="h-10 w-auto transition-transform group-hover:scale-105"
                onError={(e) => {
                  // Fallback if logo image doesn't exist
                  e.currentTarget.style.display = 'none';
                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                }}
              />
              <span className="hidden text-2xl">🦄</span>
              <span className="text-xl font-bold text-white hidden sm:block">
                <span className="text-gold-400">RV</span>Unicorn
              </span>
            </Link>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-1">
              {/* Basecamp */}
              <Link
                to="/basecamp"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/basecamp'
                    ? 'bg-primary-800 text-gold-400'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <Home className="w-4 h-4" />
                Basecamp
              </Link>

              {/* Feed */}
              <Link
                to="/feed"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                  location.pathname === '/feed'
                    ? 'bg-primary-800 text-gold-400'
                    : 'text-white/90 hover:text-white hover:bg-white/10'
                }`}
              >
                <Flame className="w-4 h-4" />
                Feed
              </Link>

              {/* Dropdowns */}
              <NavDropdown label="Explore" items={exploreItems} id="explore" />
              <NavDropdown label="Campfire" items={campfireItems} id="campfire" />
              <NavDropdown label="My Stuff" items={myStuffItems} id="mystuff" />
              <NavDropdown label="Social" items={socialItems} id="social" />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-2">
              
              {/* Search Button */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors hidden sm:flex"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Badges Quick View */}
              <Link
                to="/badges"
                className="p-2 text-white/80 hover:text-gold-400 hover:bg-white/10 rounded-lg transition-colors hidden sm:flex"
                title="Your Badges"
              >
                <Award className="w-5 h-5" />
              </Link>

              {/* Notifications */}
              <div className="relative" ref={notificationsRef}>
                <button
                  onClick={() => setNotificationsOpen(!notificationsOpen)}
                  className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-campfire-500 rounded-full animate-pulse">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>

                {/* Notifications Dropdown */}
                {notificationsOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <h3 className="font-semibold text-gray-900">Notifications</h3>
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllRead}
                          className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                        >
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-4 py-8 text-center text-gray-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.slice(0, 10).map((notification) => (
                          <button
                            key={notification.id}
                            onClick={() => handleNotificationClick(notification)}
                            className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors border-b border-gray-50 last:border-0 ${
                              !notification.read ? 'bg-primary-50/50' : ''
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              {!notification.read && (
                                <span className="mt-1.5 w-2 h-2 rounded-full bg-primary-500 flex-shrink-0" />
                              )}
                              <div className={!notification.read ? '' : 'ml-5'}>
                                <p className="text-sm font-medium text-gray-900 line-clamp-1">
                                  {notification.content}
                                </p>
                                
                                <p className="text-[10px] text-gray-400 mt-1">
                                  {new Date(notification.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                    {notifications.length > 0 && (
                      <Link
                        to="/notifications"
                        onClick={() => setNotificationsOpen(false)}
                        className="block px-4 py-3 text-center text-sm font-medium text-primary-600 hover:bg-gray-50 border-t border-gray-100"
                      >
                        View all notifications
                      </Link>
                    )}
                  </div>
                )}
              </div>

              {/* Profile Dropdown */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture}
                      alt={user.firstName}
                      className="w-8 h-8 rounded-full object-cover ring-2 ring-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gold-400 flex items-center justify-center ring-2 ring-white/20">
                      <span className="text-primary-900 font-semibold text-sm">
                        {user.firstName?.[0]}{user.lastName?.[0]}
                      </span>
                    </div>
                  )}
                  <ChevronDown className={`w-4 h-4 text-white/70 hidden sm:block transition-transform ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Profile Menu */}
                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-2xl border border-gray-100 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    {/* User Info Header */}
                    <div className="px-4 py-3 border-b border-gray-100">
                      <p className="font-semibold text-gray-900">{user.firstName} {user.lastName}</p>
                      <p className="text-sm text-gray-500 truncate">@{user.username || user.email}</p>
                    </div>

                    <div className="py-1">
                      <Link
                        to={`/profile/${user.username || user.id}`}
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <User className="w-4 h-4" />
                        <span>My Profile</span>
                      </Link>
                      <Link
                        to="/my-rv"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Settings className="w-4 h-4" />
                        <span>My RV</span>
                      </Link>
                      <Link
                        to="/settings/privacy"
                        onClick={() => setProfileOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <Shield className="w-4 h-4" />
                        <span>Privacy Settings</span>
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 pt-1">
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 w-full px-4 py-2.5 text-red-600 hover:bg-red-50 transition-colors"
                      >
                        <LogOut className="w-4 h-4" />
                        <span>Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              >
                {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar (when open) */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-primary-900/50 backdrop-blur-sm">
            <div className="max-w-3xl mx-auto px-4 py-3">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search campgrounds, users, events..."
                  className="w-full pl-12 pr-4 py-3 bg-white rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gold-400"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && searchQuery.trim()) {
                      navigate(`/search?q=${encodeURIComponent(searchQuery)}`);
                      setSearchOpen(false);
                      setSearchQuery('');
                    }
                    if (e.key === 'Escape') {
                      setSearchOpen(false);
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          
          {/* Menu Panel */}
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-900 to-primary-800">
              <div className="flex items-center gap-3">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover ring-2 ring-white/20" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gold-400 flex items-center justify-center">
                    <span className="text-primary-900 font-semibold">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                  </div>
                )}
                <div>
                  <p className="font-semibold text-white">{user.firstName} {user.lastName}</p>
                  <p className="text-sm text-white/70">@{user.username || 'user'}</p>
                </div>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="p-4 border-b border-gray-100">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.target as HTMLInputElement).value.trim()) {
                      navigate(`/search?q=${encodeURIComponent((e.target as HTMLInputElement).value)}`);
                      setMobileMenuOpen(false);
                    }
                  }}
                />
              </div>
            </div>

            {/* Main Nav Links */}
            <div className="px-2 py-3">
              <MobileNavLink to="/basecamp" icon={<Home className="w-5 h-5" />} label="Basecamp" />
              <MobileNavLink to="/feed" icon={<Flame className="w-5 h-5" />} label="Feed" />
            </div>

            {/* Explore Section */}
            <MobileNavSection title="Explore">
              {exploreItems.map(item => (
                <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} badge={item.badge} />
              ))}
            </MobileNavSection>

            {/* Campfire Section */}
            <MobileNavSection title="Campfire">
              {campfireItems.map(item => (
                <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} badge={item.badge} />
              ))}
            </MobileNavSection>

            {/* My Stuff Section */}
            <MobileNavSection title="My Stuff">
              {myStuffItems.map(item => (
                <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
              ))}
            </MobileNavSection>

            {/* Social Section */}
            <MobileNavSection title="Social">
              {socialItems.map(item => (
                <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
              ))}
            </MobileNavSection>

            {/* Settings & Logout */}
            <div className="px-2 py-3 border-t border-gray-100 mt-2">
              <MobileNavLink to={`/profile/${user.username || user.id}`} icon={<User className="w-5 h-5" />} label="My Profile" />
              <MobileNavLink to="/my-rv" icon={<Settings className="w-5 h-5" />} label="My RV" />
              <MobileNavLink to="/settings/privacy" icon={<Shield className="w-5 h-5" />} label="Privacy Settings" />
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 w-full px-4 py-3 text-red-600 hover:bg-red-50 rounded-lg transition-colors mt-2"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Helper Components
function MobileNavLink({ 
  to, 
  icon, 
  label, 
  badge 
}: { 
  to: string; 
  icon: React.ReactNode; 
  label: string; 
  badge?: string;
}) {
  const location = useLocation();
  const isActive = location.pathname === to;
  
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive 
          ? 'bg-primary-50 text-primary-700' 
          : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className={isActive ? 'text-primary-600' : 'text-gray-400'}>{icon}</span>
      <span className="font-medium flex-1">{label}</span>
      {badge && (
        <span className="px-2 py-0.5 text-[10px] font-bold bg-campfire-500 text-white rounded-full">
          {badge}
        </span>
      )}
    </Link>
  );
}

function MobileNavSection({ 
  title, 
  children 
}: { 
  title: string; 
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-gray-100">
      <p className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-50">
        {title}
      </p>
      <div className="px-2 py-2">
        {children}
      </div>
    </div>
  );
}
