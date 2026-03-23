import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { 
  Bell, Menu, X, User, LogOut, Settings, ChevronDown, Search,
  Home, Flame, MapPin, Calendar, Map, Camera, UtensilsCrossed,
  Package, Wrench, Users, UsersRound, MessageCircle, Award,
  Shield, Sparkles, Play, Briefcase, Backpack, Heart, MoreHorizontal,
  Tent, BookOpen, Star
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import NotificationDropdown from './NotificationDropdown';

interface Notification {
  id: string; type: string; title: string; message: string;
  read: boolean; createdAt: string; data?: any;
}

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifCounts, setNotifCounts] = useState({ count: 0, messages: 0, friends: 0, campground: 0, system: 0 });
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const moreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleLogout = () => { logout(); navigate('/login'); };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery(''); setSearchOpen(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try {
        const { data } = await api.get('/notifications?limit=10');
        setNotifications(data.notifications || data || []);
        setUnreadCount((data.notifications || data || []).filter((n: Notification) => !n.read).length);
      } catch {}
    };
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetch = async () => {
      try { const { data } = await api.get('/messages/unread-count'); setUnreadMessages(data.count || 0); } catch {}
    };
    fetch();
    const i = setInterval(fetch, 30000);
    return () => clearInterval(i);
  }, [user]);

  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    setMobileMenuOpen(false); setMoreOpen(false); setProfileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  if (!user) return null;

  const primaryLinks = [
    { to: '/basecamp', icon: Home, label: 'Basecamp' },
    { to: '/events', icon: Calendar, label: 'My Trips' },
    { to: '/community', icon: Flame, label: 'Community' },
    { to: '/hitch', icon: Sparkles, label: 'Hitch', isHitch: true },
    { to: '/campgrounds', icon: Tent, label: 'Campgrounds' },
    { to: '/travel', icon: Map, label: 'Travel' },
  ];

  return (
    <>
      <nav className="sticky top-0 z-50" style={{ background: 'linear-gradient(135deg, #1a1f2e 0%, #1e2535 50%, #1a1f2e 100%)', borderBottom: '1px solid rgba(255,255,255,0.06)', boxShadow: '0 4px 24px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)' }}>
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-16 gap-4">

            {/* Logo */}
            <Link to="/basecamp" className="flex items-center gap-2.5 flex-shrink-0 group">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden transition-transform duration-200 group-hover:scale-105" style={{ boxShadow: '0 2px 12px rgba(245,158,11,0.2)' }}>
                  <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="h-8 w-auto" />
                </div>
              </div>
              <div className="hidden md:flex flex-col leading-none">
                <span className="text-[15px] font-black tracking-tight" style={{ color: '#fff', letterSpacing: '-0.02em' }}>
                  RV<span style={{ color: '#f59e0b' }}>Unicorn</span>
                </span>
                <span className="text-[9px] font-semibold uppercase tracking-widest" style={{ color: 'rgba(255,255,255,0.35)' }}>Your camping community</span>
              </div>
            </Link>

            {/* Primary Nav */}
            <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
              {primaryLinks.map(({ to, icon: Icon, label, ...rest }) => {
                const isHitch = (rest as any).isHitch;
                const active = isActive(to);
                return (
                  <Link key={to} to={to} className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${to === '/hitch' ? 'bg-gradient-to-r from-primary-50 to-purple-50 text-primary-700' : ''}`}
                    style={{
                      color: active ? '#f59e0b' : 'rgba(255,255,255,0.65)',
                      background: active ? 'rgba(245,158,11,0.12)' : 'transparent',
                    }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.65)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
                  >
                    {isHitch ? <img src="/hitch.png" className="w-5 h-5 rounded-full object-cover flex-shrink-0" alt="Hitch" /> : <Icon className="w-4 h-4 flex-shrink-0" />}
                    <span>{label}</span>
                    {active && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full" style={{ background: '#f59e0b' }} />
                    )}
                  </Link>
                );
              })}

              {/* More Dropdown */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  onMouseEnter={() => { if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current); setMoreOpen(true); }}
                  onMouseLeave={() => { moreTimeoutRef.current = setTimeout(() => setMoreOpen(false), 250); }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-semibold transition-all duration-200"
                  style={{ color: moreOpen ? '#f59e0b' : 'rgba(255,255,255,0.65)', background: moreOpen ? 'rgba(245,158,11,0.12)' : 'transparent' }}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span>More</span>
                  <ChevronDown className="w-3 h-3 transition-transform duration-200" style={{ transform: moreOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                </button>

                {moreOpen && (
                  <div
                    onMouseEnter={() => { if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current); }}
                    onMouseLeave={() => { moreTimeoutRef.current = setTimeout(() => setMoreOpen(false), 250); }}
                    className="absolute top-full left-0 mt-2 w-[320px] rounded-2xl overflow-hidden z-50"
                    style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.25), 0 0 0 1px rgba(0,0,0,0.06)', animation: 'dropIn 0.15s ease-out' }}
                  >
                    <DropSection label="Create & Share">
                      <DropItem to="/albums" onClick={() => setMoreOpen(false)} icon={<Camera className="w-4 h-4" />} iconBg="#fdf2f8" iconColor="#ec4899" label="Albums" desc="Photos & memories" />
                      <DropItem to="/recipes" onClick={() => setMoreOpen(false)} icon={<UtensilsCrossed className="w-4 h-4" />} iconBg="#fff7ed" iconColor="#f97316" label="Recipes" desc="Camp cooking" />
                      <DropItem to="/creators" onClick={() => setMoreOpen(false)} icon={<Play className="w-4 h-4" />} iconBg="#f5f3ff" iconColor="#8b5cf6" label="Creator Pages" desc="Videos & content" />
                    </DropSection>
                    <DropSection label="Tools">
                      <DropItem to="/gear" onClick={() => setMoreOpen(false)} icon={<Package className="w-4 h-4" />} iconBg="#f0fdf4" iconColor="#22c55e" label="Gear" desc="Marketplace" />
                      <DropItem to="/packing" onClick={() => setMoreOpen(false)} icon={<Backpack className="w-4 h-4" />} iconBg="#eff6ff" iconColor="#3b82f6" label="Packing Lists" desc="Trip checklists" />
                      <DropItem to="/rv-log" onClick={() => setMoreOpen(false)} icon={<Wrench className="w-4 h-4" />} iconBg="#fffbeb" iconColor="#f59e0b" label="RV Log" desc="Maintenance tracker" />
                    </DropSection>
                    <DropSection label="Community" last>
                      <DropItem to="/friends" onClick={() => setMoreOpen(false)} icon={<Users className="w-4 h-4" />} iconBg="#eef2ff" iconColor="#6366f1" label="Friends" desc="Camping buddies" />
                      <DropItem to="/groups" onClick={() => setMoreOpen(false)} icon={<UsersRound className="w-4 h-4" />} iconBg="#f0fdfa" iconColor="#14b8a6" label="Groups" desc="Community groups" />
                      <DropItem to="/jobs" onClick={() => setMoreOpen(false)} icon={<Briefcase className="w-4 h-4" />} iconBg="#f8fafc" iconColor="#64748b" label="Jobs" desc="RV & camping careers" />
                    </DropSection>
                  </div>
                )}
              </div>
            </div>

            {/* Right Actions */}
            <div className="flex items-center gap-1">
              {/* Search */}
              <button onClick={() => setSearchOpen(!searchOpen)}
                className="hidden sm:flex p-2.5 rounded-lg transition-all duration-200"
                style={{ color: searchOpen ? '#f59e0b' : 'rgba(255,255,255,0.55)', background: searchOpen ? 'rgba(245,158,11,0.12)' : 'transparent' }}
                onMouseEnter={e => { if (!searchOpen) { (e.currentTarget as HTMLElement).style.color = '#fff'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}}
                onMouseLeave={e => { if (!searchOpen) { (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.55)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}}
              >
                <Search className="w-[18px] h-[18px]" />
              </button>

              {/* Messages */}
              <Link to="/messages" className="relative p-2.5 rounded-lg transition-all duration-200"
                style={{ color: unreadMessages > 0 ? '#f59e0b' : 'rgba(255,255,255,0.55)', background: unreadMessages > 0 ? 'rgba(245,158,11,0.12)' : 'transparent' }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = unreadMessages > 0 ? 'rgba(245,158,11,0.12)' : 'transparent'; }}
              >
                <MessageCircle className="w-[18px] h-[18px]" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-black text-white rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <div ref={notifRef} className="relative">
                <button onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2.5 rounded-lg transition-all duration-200"
                  style={{ color: unreadCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.55)', background: unreadCount > 0 ? 'rgba(245,158,11,0.12)' : 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = unreadCount > 0 ? 'rgba(245,158,11,0.12)' : 'transparent'; }}
                >
                  <Bell className="w-[18px] h-[18px]" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[9px] font-black text-white rounded-full flex items-center justify-center animate-pulse" style={{ background: '#ef4444' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
                <NotificationDropdown isOpen={showNotifications} onClose={() => setShowNotifications(false)} onUnreadUpdate={(counts) => { setUnreadCount(counts.count); setNotifCounts(counts); }} />
              </div>

              {/* Divider */}
              <div className="w-px h-6 mx-1 hidden sm:block" style={{ background: 'rgba(255,255,255,0.1)' }} />

              {/* Profile */}
              <div ref={profileRef} className="relative">
                <button onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all duration-200"
                  style={{ background: profileOpen ? 'rgba(255,255,255,0.1)' : 'transparent' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = profileOpen ? 'rgba(255,255,255,0.1)' : 'transparent'; }}
                >
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" style={{ border: '2px solid rgba(245,158,11,0.5)' }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                      <span className="text-xs font-black text-white">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                    </div>
                  )}
                  <span className="hidden md:block text-sm font-semibold" style={{ color: 'rgba(255,255,255,0.85)' }}>{user.firstName}</span>
                  <ChevronDown className="hidden sm:block w-3.5 h-3.5 transition-transform duration-200" style={{ color: 'rgba(255,255,255,0.4)', transform: profileOpen ? 'rotate(180deg)' : 'rotate(0)' }} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-60 rounded-2xl overflow-hidden z-50"
                    style={{ background: '#fff', boxShadow: '0 20px 60px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.06)', animation: 'dropIn 0.15s ease-out' }}>
                    {/* User header */}
                    <div className="px-4 py-3.5" style={{ background: 'linear-gradient(135deg, #1a1f2e, #1e2535)' }}>
                      <div className="flex items-center gap-3">
                        {user.profilePicture ? (
                          <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" style={{ border: '2px solid rgba(245,158,11,0.6)' }} />
                        ) : (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                            <span className="text-sm font-black text-white">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                          </div>
                        )}
                        <div>
                          <p className="text-sm font-bold text-white">{user.firstName} {user.lastName}</p>
                          <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>@{user.username}</p>
                        </div>
                      </div>
                    </div>
                    <div className="p-2">
                      <ProfileLink to={`/profile/${user.username}`} onClick={() => setProfileOpen(false)} icon={<User className="w-4 h-4" />} label="My Profile" />
                      <ProfileLink to="/my-rv" onClick={() => setProfileOpen(false)} icon={<Wrench className="w-4 h-4" />} label="RV Settings" />
                      <ProfileLink to="/badges" onClick={() => setProfileOpen(false)} icon={<Award className="w-4 h-4" />} label="Badges" />
                      <ProfileLink to="/settings" onClick={() => setProfileOpen(false)} icon={<Settings className="w-4 h-4" />} label="Account Settings" />
                    </div>
                    <div className="p-2 border-t" style={{ borderColor: '#f1f5f9' }}>
                      <button onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-150 text-left"
                        style={{ color: '#ef4444' }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#fef2f2'; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                      >
                        <LogOut className="w-4 h-4" />
                        <span className="text-sm font-semibold">Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2.5 rounded-lg transition-all duration-200 ml-0.5"
                style={{ color: 'rgba(255,255,255,0.7)', background: mobileMenuOpen ? 'rgba(255,255,255,0.1)' : 'transparent' }}
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Expand */}
        {searchOpen && (
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)', animation: 'slideDown 0.2s ease-out' }}>
            <div className="max-w-7xl mx-auto px-4 py-3">
              <form onSubmit={handleSearch} className="relative max-w-2xl mx-auto">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9ca3af' }} />
                <input
                  type="text" autoFocus
                  placeholder="Search campgrounds, people, recipes, events..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-12 py-3 text-sm rounded-xl outline-none"
                  style={{ background: 'rgba(255,255,255,0.95)', color: '#111827', border: 'none', boxShadow: '0 2px 12px rgba(0,0,0,0.3)' }}
                />
                <button type="button" onClick={() => setSearchOpen(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-md transition"
                  style={{ color: '#9ca3af' }}
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </nav>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setMobileMenuOpen(false)}>
          <div className="absolute right-0 top-0 h-full w-80 max-w-[88vw] overflow-y-auto" style={{ background: '#fff', boxShadow: '-20px 0 60px rgba(0,0,0,0.3)', animation: 'slideLeft 0.25s ease-out' }} onClick={e => e.stopPropagation()}>
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4" style={{ background: 'linear-gradient(135deg, #1a1f2e, #1e2535)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-3">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-11 h-11 rounded-full object-cover" style={{ border: '2px solid rgba(245,158,11,0.6)' }} />
                ) : (
                  <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>
                    <span className="text-base font-black text-white">{user.firstName?.[0]}{user.lastName?.[0]}</span>
                  </div>
                )}
                <div>
                  <p className="text-white font-bold text-sm">{user.firstName} {user.lastName}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.45)' }}>@{user.username}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="p-2 rounded-lg" style={{ color: 'rgba(255,255,255,0.6)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="p-3" style={{ borderBottom: '1px solid #f1f5f9' }}>
              <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#9ca3af' }} />
                  <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl outline-none"
                    style={{ background: '#f8fafc', border: '1px solid #e2e8f0', color: '#111827' }} />
                </div>
              </form>
            </div>

            {/* Nav Sections */}
            <MobileSection label="Navigate">
              <MobileLink to="/basecamp" icon={<Home className="w-5 h-5" />} label="Basecamp" active={isActive('/basecamp')} />
              <MobileLink to="/campgrounds" icon={<Tent className="w-5 h-5" />} label="Campgrounds" active={isActive('/campgrounds')} />
              <MobileLink to="/community" icon={<Flame className="w-5 h-5" />} label="Community" active={isActive('/community')} />
              <MobileLink to="/events" icon={<Calendar className="w-5 h-5" />} label="Trips & Events" active={isActive('/events')} />
              <MobileLink to="/hitch" icon={<img src="/hitch.png" className="w-5 h-5 rounded-full object-cover" alt="Hitch" />} label="Hitch" active={isActive('/hitch')} />
              <MobileLink to="/travel" icon={<Map className="w-5 h-5" />} label="Travel & Routes" active={isActive('/travel')} />
            </MobileSection>

            <MobileSection label="Create & Share">
              <MobileLink to="/albums" icon={<Camera className="w-5 h-5" />} label="Albums" active={isActive('/albums')} />
              <MobileLink to="/recipes" icon={<UtensilsCrossed className="w-5 h-5" />} label="Recipes" active={isActive('/recipes')} />
              <MobileLink to="/creators" icon={<Play className="w-5 h-5" />} label="Creator Pages" active={isActive('/creators')} />
            </MobileSection>

            <MobileSection label="Tools">
              <MobileLink to="/gear" icon={<Package className="w-5 h-5" />} label="Gear" active={isActive('/gear')} />
              <MobileLink to="/packing" icon={<Backpack className="w-5 h-5" />} label="Packing Lists" active={isActive('/packing')} />
              <MobileLink to="/rv-log" icon={<Wrench className="w-5 h-5" />} label="RV Log" active={isActive('/rv-log')} />
            </MobileSection>

            <MobileSection label="Community">
              <MobileLink to="/friends" icon={<Users className="w-5 h-5" />} label="Friends" active={isActive('/friends')} />
              <MobileLink to="/groups" icon={<UsersRound className="w-5 h-5" />} label="Groups" active={isActive('/groups')} />
              <MobileLink to="/messages" icon={<MessageCircle className="w-5 h-5" />} label="Messages" active={isActive('/messages')} badge={unreadMessages} />
              <MobileLink to="/jobs" icon={<Briefcase className="w-5 h-5" />} label="Jobs" active={isActive('/jobs')} />
            </MobileSection>

            <MobileSection label="Account">
              <MobileLink to={`/profile/${user.username}`} icon={<User className="w-5 h-5" />} label="My Profile" active={false} />
              <MobileLink to="/my-rv" icon={<Wrench className="w-5 h-5" />} label="RV Settings" active={isActive('/my-rv')} />
              <MobileLink to="/badges" icon={<Award className="w-5 h-5" />} label="Badges" active={isActive('/badges')} />
              <MobileLink to="/settings" icon={<Settings className="w-5 h-5" />} label="Account Settings" active={isActive('/settings')} />
            </MobileSection>

            <div className="p-4" style={{ borderTop: '1px solid #f1f5f9' }}>
              <button onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-semibold text-sm transition"
                style={{ background: '#fef2f2', color: '#ef4444' }}
              >
                <LogOut className="w-5 h-5" />
                Log Out
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes dropIn {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-6px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideLeft {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
    </>
  );
}

function DropSection({ label, children, last }: { label: string; children: React.ReactNode; last?: boolean }) {
  return (
    <div className={"p-2" + (last ? "" : " border-b")}>
      <p className="text-[10px] uppercase tracking-widest font-bold px-3 py-1.5" style={{ color: '#94a3b8' }}>{label}</p>
      {children}
    </div>
  );
}

function DropItem({ to, onClick, icon, iconBg, iconColor, label, desc }: {
  to: string; onClick: () => void; icon: React.ReactNode;
  iconBg: string; iconColor: string; label: string; desc: string;
}) {
  return (
    <Link to={to} onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: iconBg, color: iconColor }}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-semibold" style={{ color: '#0f172a' }}>{label}</p>
        <p className="text-xs" style={{ color: '#94a3b8' }}>{desc}</p>
      </div>
    </Link>
  );
}

function MobileSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2" style={{ borderTop: '1px solid #f1f5f9' }}>
      <p className="text-[10px] uppercase tracking-widest font-bold px-5 py-2" style={{ color: '#94a3b8' }}>{label}</p>
      {children}
    </div>
  );
}

function ProfileLink({ to, onClick, icon, label }: { to: string; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <Link to={to} onClick={onClick}
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-150"
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
    >
      <span style={{ color: '#64748b' }}>{icon}</span>
      <span className="text-sm font-semibold" style={{ color: '#334155' }}>{label}</span>
    </Link>
  );
}

function MobileLink({ to, icon, label, active, badge }: {
  to: string; icon: React.ReactNode; label: string; active: boolean; badge?: number;
}) {
  return (
    <Link to={to}
      className="flex items-center gap-3 px-5 py-3 transition-all duration-150"
      style={{ background: active ? '#fffbeb' : 'transparent', borderRight: active ? '3px solid #f59e0b' : '3px solid transparent' }}
    >
      <span style={{ color: active ? '#d97706' : '#94a3b8' }}>{icon}</span>
      <span className="text-sm font-semibold flex-1" style={{ color: active ? '#92400e' : '#374151' }}>{label}</span>
      {badge && badge > 0 ? (
        <span className="min-w-[20px] h-5 px-1.5 text-[10px] font-black text-white rounded-full flex items-center justify-center" style={{ background: '#ef4444' }}>
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </Link>
  );
}
