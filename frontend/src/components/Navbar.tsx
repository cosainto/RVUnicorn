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
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  
  const notificationsRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch notifications
  useEffect(() => {
    if (user) {
      fetchNotifications();
      fetchUnreadMessages();
      const interval = setInterval(() => {
        fetchNotifications();
        fetchUnreadMessages();
      }, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notificationsRef.current && !notificationsRef.current.contains(e.target as Node)) {
        setNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.slice(0, 10));
      setUnreadCount(res.data.filter((n: Notification) => !n.read).length);
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const fetchUnreadMessages = async () => {
    try {
      const res = await api.get('/messages/unread-count');
      setUnreadMessages(res.data.count || 0);
    } catch (err) {
      console.error('Error fetching unread messages:', err);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
      setSearchOpen(false);
    }
  };

  const markAllRead = async () => {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Error marking notifications read:', err);
    }
  };

  // Dropdown items
  const exploreItems: DropdownItem[] = [
    { icon: <MapPin className="w-5 h-5" />, label: 'Campgrounds', to: '/campgrounds', description: '5,500+ campgrounds to explore' },
    { icon: <Calendar className="w-5 h-5" />, label: 'Events & Trips', to: '/events', description: 'Group trips & meetups' },
    { icon: <Play className="w-5 h-5" />, label: 'Creator Pages', to: '/creators', description: 'Videos & content creators' },
    { icon: <Briefcase className="w-5 h-5" />, label: 'Jobs', to: '/jobs', description: 'RV & camping careers' },
    { icon: <Map className="w-5 h-5" />, label: 'Travel Map', to: '/travel', description: 'Plan your adventures' },
  ];

  const myStuffItems: DropdownItem[] = [
    { icon: <Camera className="w-5 h-5" />, label: 'Albums', to: '/albums', description: 'Photos & videos' },
    { icon: <UtensilsCrossed className="w-5 h-5" />, label: 'Recipes', to: '/recipes', description: 'Camp cooking' },
    { icon: <Package className="w-5 h-5" />, label: 'Gear', to: '/gear', description: 'Gear & marketplace' },
    { icon: <Backpack className="w-5 h-5" />, label: 'Packing Lists', to: '/packing', description: 'Trip checklists' },
    { icon: <Wrench className="w-5 h-5" />, label: 'RV Log', to: '/rv-log', description: 'Maintenance tracker' },
  ];

  const socialItems: DropdownItem[] = [
    { icon: <Users className="w-5 h-5" />, label: 'Friends', to: '/friends', description: 'Your camping buddies' },
    { icon: <UsersRound className="w-5 h-5" />, label: 'Groups', to: '/groups', description: 'Community groups' },
  ];

  // Dropdown component
  const NavDropdown = ({ label, items, id }: { label: string; items: DropdownItem[]; id: string }) => {
    const isOpen = activeDropdown === id;
    
    const handleMouseEnter = () => {
      if (dropdownTimeoutRef.current) clearTimeout(dropdownTimeoutRef.current);
      setActiveDropdown(id);
    };
    
    const handleMouseLeave = () => {
      dropdownTimeoutRef.current = setTimeout(() => setActiveDropdown(null), 150);
    };

    return (
      <div 
        className="relative"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <button
          className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            isOpen 
              ? 'bg-primary-800 text-gold-400' 
              : 'text-white/90 hover:text-white hover:bg-white/10'
          }`}
        >
          {label}
          <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {isOpen && (
          <div className="absolute left-0 top-full pt-2 z-50">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-100 py-2 min-w-[240px] animate-in fade-in slide-in-from-top-2 duration-200">
              {items.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setActiveDropdown(null)}
                  className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <span className="text-primary-600 group-hover:text-primary-700 mt-0.5">{item.icon}</span>
                  <div className="flex-1">
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
          </div>
        )}
      </div>
    );
  };

  if (!user) return null;

  return (
    <>
      {/* Main Navbar */}
      <nav className="bg-gradient-to-r from-primary-700 via-primary-600 to-primary-700 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            
            {/* Left: Logo */}
            <Link to="/basecamp" className="flex items-center gap-2 group">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-gold-400 to-gold-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <span className="text-2xl">🦄</span>
                </div>
                <Sparkles className="w-3 h-3 text-gold-300 absolute -top-1 -right-1 animate-pulse" />
              </div>
              <span className="text-xl font-bold text-white hidden sm:block">
                RV<span className="text-gold-400">Unicorn</span>
              </span>
            </Link>

            {/* Center: Main Nav */}
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

              {/* Messages - Next to notifications with illumination */}
              <Link
                to="/messages"
                className={`relative p-2 rounded-lg transition-all duration-300 ${
                  unreadMessages > 0 
                    ? 'text-gold-400 hover:text-gold-300 bg-white/10 hover:bg-white/15' 
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}
                title="Messages"
              >
                <MessageCircle className={`w-5 h-5 ${unreadMessages > 0 ? 'animate-pulse' : ''}`} />
                {unreadMessages > 0 && (
                  <>
                    {/* Glow effect */}
                    <span className="absolute inset-0 rounded-lg bg-gold-400/20 animate-ping" style={{ animationDuration: '2s' }} />
                    {/* Badge */}
                    <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-campfire-500 rounded-full shadow-lg">
                      {unreadMessages > 99 ? '99+' : unreadMessages}
                    </span>
                  </>
                )}
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
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
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
                        <div className="py-8 text-center text-gray-500">
                          <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                          <p className="text-sm">No notifications yet</p>
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            className={`px-4 py-3 border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors ${
                              !notification.read ? 'bg-primary-50/50' : ''
                            }`}
                          >
                            <p className={`text-sm ${!notification.read ? 'font-medium text-gray-900' : 'text-gray-700'}`}>
                              {notification.content}
                            </p>
                            
                          </div>
                        ))
                      )}
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setNotificationsOpen(false)}
                      className="block text-center py-3 text-sm font-medium text-primary-600 hover:bg-gray-50 border-t border-gray-100"
                    >
                      View All Notifications
                    </Link>
                  </div>
                )}
              </div>

              {/* Profile */}
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                >
                  {user.profilePicture ? (
                    <img
                      src={user.profilePicture.startsWith('http') ? user.profilePicture : `${import.meta.env.VITE_API_URL?.replace('/api', '')}${user.profilePicture}`}
                      alt={user.firstName}
                      className="w-8 h-8 rounded-full object-cover border-2 border-white/20"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-sm font-bold text-primary-900">
                      {user.firstName?.[0]}
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
                        to={`/profile/${user.id}`}
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
                        <span>RV Settings</span>
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

        {/* Search Bar (Expandable) */}
        {searchOpen && (
          <div className="border-t border-primary-600/50 px-4 py-3 bg-primary-700/50">
            <form onSubmit={handleSearch} className="max-w-2xl mx-auto relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search campgrounds, users, events..."
                className="w-full px-4 py-2.5 pl-10 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-gold-400 focus:border-transparent"
                autoFocus
              />
              <Search className="w-5 h-5 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
            </form>
          </div>
        )}
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div 
            className="absolute right-0 top-0 bottom-0 w-80 bg-white shadow-xl overflow-y-auto animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 bg-gradient-to-r from-primary-600 to-primary-700">
              <span className="text-lg font-bold text-white">Menu</span>
              <button 
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 text-white/80 hover:text-white"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="px-4 py-3 border-b border-gray-100">
              <form onSubmit={handleSearch} className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search..."
                  className="w-full px-4 py-2 pl-10 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              </form>
            </div>

            {/* Mobile Nav Links */}
            <div className="py-2">
              <MobileNavLink to="/basecamp" icon={<Home className="w-5 h-5" />} label="Basecamp" />
              <MobileNavLink to="/feed" icon={<Flame className="w-5 h-5" />} label="Feed" />
              <MobileNavLink 
                to="/messages" 
                icon={<MessageCircle className="w-5 h-5" />} 
                label="Messages" 
                badge={unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : String(unreadMessages)) : undefined}
              />
            </div>

            {/* Explore Section */}
            <MobileNavSection title="Explore">
              {exploreItems.map(item => (
                <MobileNavLink key={item.to} to={item.to} icon={item.icon} label={item.label} />
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
              <MobileNavLink to={`/profile/${user.id}`} icon={<User className="w-5 h-5" />} label="My Profile" />
              <MobileNavLink to="/my-rv" icon={<Settings className="w-5 h-5" />} label="RV Settings" />
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
        <span className="px-2 py-0.5 text-[10px] font-bold bg-campfire-500 text-white rounded-full animate-pulse">
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
