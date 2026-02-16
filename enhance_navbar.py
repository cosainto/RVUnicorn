#!/usr/bin/env python3
"""
RVUnicorn Navbar UX Enhancement
=================================
Run from: ~/Downloads/kindletribe-mvp/

Replaces the navbar with a cleaner, more user-friendly layout:
  - Promotes Campgrounds + Trips to top-level
  - Consolidates 3 dropdowns into 1 "More" menu
  - Moves personal items under profile avatar dropdown
  - Cleaner right-side icons (Search, Messages, Notifications, Avatar)
"""

import os, sys, shutil
from datetime import datetime

PROJECT_ROOT = os.getcwd()
NAVBAR_PATH = os.path.join(PROJECT_ROOT, "frontend", "src", "components", "Navbar.tsx")
BACKUP_DIR = os.path.join(PROJECT_ROOT, "backups", f"navbar-ux-{datetime.now().strftime('%Y%m%d-%H%M%S')}")

class C:
    GREEN = '\033[92m'; YELLOW = '\033[93m'; RED = '\033[91m'; BLUE = '\033[94m'; BOLD = '\033[1m'; END = '\033[0m'

def log(msg, color=C.GREEN): print(f"{color}{C.BOLD}▸{C.END} {msg}")
def header(msg): print(f"\n{C.BLUE}{C.BOLD}{'═'*60}\n  {msg}\n{'═'*60}{C.END}\n")

NAVBAR_CODE = r'''import { useState, useEffect, useRef } from 'react';
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

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  data?: any;
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
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const moreTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Load notifications
  useEffect(() => {
    if (!user) return;
    const fetchNotifications = async () => {
      try {
        const { data } = await api.get('/notifications?limit=10');
        setNotifications(data.notifications || data || []);
        const unread = (data.notifications || data || []).filter((n: Notification) => !n.read);
        setUnreadCount(unread.length);
      } catch {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Load unread messages
  useEffect(() => {
    if (!user) return;
    const fetchMessages = async () => {
      try {
        const { data } = await api.get('/messages/unread-count');
        setUnreadMessages(data.count || 0);
      } catch {}
    };
    fetchMessages();
    const interval = setInterval(fetchMessages, 30000);
    return () => clearInterval(interval);
  }, [user]);

  // Mark notifications as read
  const markAllRead = async () => {
    try {
      await api.post('/notifications/mark-all-read');
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {}
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setProfileOpen(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifications(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Close mobile menu on navigation
  useEffect(() => {
    setMobileMenuOpen(false);
    setMoreOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/');

  const navLinkClass = (path: string) =>
    `flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? 'bg-white/15 text-gold-400'
        : 'text-white/80 hover:text-white hover:bg-white/10'
    }`;

  if (!user) return null;

  return (
    <>
      <nav className="bg-gradient-to-r from-primary-800 via-primary-700 to-primary-800 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-center justify-between h-14">
            
            {/* ═══ Left: Logo ═══ */}
            <Link to="/basecamp" className="flex items-center gap-2 group flex-shrink-0">
              <div className="relative">
                <div className="w-9 h-9 bg-gradient-to-br from-gold-400 to-gold-500 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-105 transition-transform">
                  <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="h-8 w-auto" />
                </div>
              </div>
              <span className="text-lg font-bold text-white hidden md:block">
                RV<span className="text-gold-400">Unicorn</span>
              </span>
            </Link>

            {/* ═══ Center: Primary Nav ═══ */}
            <div className="hidden lg:flex items-center gap-0.5">
              <Link to="/basecamp" className={navLinkClass('/basecamp')}>
                <Home className="w-4 h-4" />
                <span>Basecamp</span>
              </Link>

              <Link to="/campgrounds" className={navLinkClass('/campgrounds')}>
                <Tent className="w-4 h-4" />
                <span>Campgrounds</span>
              </Link>

              <Link to="/feed" className={navLinkClass('/feed')}>
                <Flame className="w-4 h-4" />
                <span>Feed</span>
              </Link>

              <Link to="/events" className={navLinkClass('/events')}>
                <Calendar className="w-4 h-4" />
                <span>Trips</span>
              </Link>

              <Link to="/travel" className={navLinkClass('/travel')}>
                <Map className="w-4 h-4" />
                <span>Map</span>
              </Link>

              {/* More dropdown */}
              <div ref={moreRef} className="relative">
                <button
                  onClick={() => setMoreOpen(!moreOpen)}
                  onMouseEnter={() => { if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current); setMoreOpen(true); }}
                  onMouseLeave={() => { moreTimeoutRef.current = setTimeout(() => setMoreOpen(false), 200); }}
                  className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                    moreOpen ? 'bg-white/15 text-gold-400' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <MoreHorizontal className="w-4 h-4" />
                  <span>More</span>
                  <ChevronDown className={`w-3 h-3 transition-transform ${moreOpen ? 'rotate-180' : ''}`} />
                </button>

                {moreOpen && (
                  <div
                    onMouseEnter={() => { if (moreTimeoutRef.current) clearTimeout(moreTimeoutRef.current); }}
                    onMouseLeave={() => { moreTimeoutRef.current = setTimeout(() => setMoreOpen(false), 200); }}
                    className="absolute top-full left-0 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50"
                  >
                    {/* Create & Share */}
                    <div className="p-2 border-b border-gray-100">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-3 py-1">Create & Share</p>
                      <Link to="/albums" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center"><Camera className="w-4 h-4 text-pink-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Albums</p><p className="text-xs text-gray-500">Photos & memories</p></div>
                      </Link>
                      <Link to="/recipes" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center"><UtensilsCrossed className="w-4 h-4 text-orange-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Recipes</p><p className="text-xs text-gray-500">Camp cooking</p></div>
                      </Link>
                      <Link to="/creators" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center"><Play className="w-4 h-4 text-purple-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Creator Pages</p><p className="text-xs text-gray-500">Videos & content</p></div>
                      </Link>
                    </div>

                    {/* Tools */}
                    <div className="p-2 border-b border-gray-100">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-3 py-1">Tools</p>
                      <Link to="/gear" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center"><Package className="w-4 h-4 text-green-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Gear</p><p className="text-xs text-gray-500">Marketplace</p></div>
                      </Link>
                      <Link to="/packing" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center"><Backpack className="w-4 h-4 text-blue-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Packing Lists</p><p className="text-xs text-gray-500">Trip checklists</p></div>
                      </Link>
                      <Link to="/rv-log" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center"><Wrench className="w-4 h-4 text-amber-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">RV Log</p><p className="text-xs text-gray-500">Maintenance tracker</p></div>
                      </Link>
                    </div>

                    {/* Community */}
                    <div className="p-2">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-3 py-1">Community</p>
                      <Link to="/friends" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center"><Users className="w-4 h-4 text-indigo-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Friends</p><p className="text-xs text-gray-500">Camping buddies</p></div>
                      </Link>
                      <Link to="/groups" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center"><UsersRound className="w-4 h-4 text-teal-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Groups</p><p className="text-xs text-gray-500">Community groups</p></div>
                      </Link>
                      <Link to="/jobs" onClick={() => setMoreOpen(false)} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition">
                        <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center"><Briefcase className="w-4 h-4 text-slate-500" /></div>
                        <div><p className="text-sm font-medium text-gray-900">Jobs</p><p className="text-xs text-gray-500">RV & camping careers</p></div>
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══ Right: Actions ═══ */}
            <div className="flex items-center gap-1">
              
              {/* Search */}
              <button
                onClick={() => setSearchOpen(!searchOpen)}
                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition hidden sm:flex"
              >
                <Search className="w-5 h-5" />
              </button>

              {/* Messages */}
              <Link
                to="/messages"
                className={`relative p-2 rounded-lg transition ${
                  unreadMessages > 0
                    ? 'text-gold-400 bg-white/10'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <MessageCircle className="w-5 h-5" />
                {unreadMessages > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-campfire-500 rounded-full flex items-center justify-center">
                    {unreadMessages > 9 ? '9+' : unreadMessages}
                  </span>
                )}
              </Link>

              {/* Notifications */}
              <div ref={notifRef} className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={`relative p-2 rounded-lg transition ${
                    unreadCount > 0
                      ? 'text-gold-400 bg-white/10'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 text-[10px] font-bold text-white bg-red-500 rounded-full flex items-center justify-center">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                      <h3 className="font-bold text-gray-900 text-sm">Notifications</h3>
                      {unreadCount > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                          Mark all read
                        </button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <p className="text-center py-8 text-gray-400 text-sm">No notifications yet</p>
                      ) : (
                        notifications.map(notif => (
                          <Link
                            key={notif.id}
                            to={notif.data?.link || '#'}
                            onClick={() => setShowNotifications(false)}
                            className={`block px-4 py-3 hover:bg-gray-50 transition border-b border-gray-50 ${!notif.read ? 'bg-blue-50/50' : ''}`}
                          >
                            <p className="text-sm text-gray-900 font-medium">{notif.title}</p>
                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{notif.message}</p>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {new Date(notif.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                            </p>
                          </Link>
                        ))
                      )}
                    </div>
                    <Link
                      to="/notifications"
                      onClick={() => setShowNotifications(false)}
                      className="block text-center py-2.5 text-sm text-primary-600 hover:bg-gray-50 border-t border-gray-100 font-medium"
                    >
                      View all notifications
                    </Link>
                  </div>
                )}
              </div>

              {/* Profile Avatar Dropdown */}
              <div ref={profileRef} className="relative ml-1">
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-lg hover:bg-white/10 transition"
                >
                  {user.profilePicture ? (
                    <img src={user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover border-2 border-white/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center">
                      <User className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <ChevronDown className={`w-3 h-3 text-white/60 hidden sm:block transition ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-50">
                    {/* User info */}
                    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
                      <p className="font-semibold text-gray-900 text-sm">{user.firstName} {user.lastName}</p>
                      <p className="text-xs text-gray-500">@{user.username}</p>
                    </div>
                    
                    <div className="p-2">
                      <Link to={`/profile/${user.username}`} onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                        <User className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">My Profile</span>
                      </Link>
                      <Link to="/badges" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                        <Award className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Badges</span>
                      </Link>
                      <Link to="/my-rv" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                        <Wrench className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">RV Settings</span>
                      </Link>
                      <Link to="/settings/privacy" onClick={() => setProfileOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-50 transition">
                        <Shield className="w-4 h-4 text-gray-500" />
                        <span className="text-sm text-gray-700">Privacy</span>
                      </Link>
                    </div>

                    <div className="border-t border-gray-100 p-2">
                      <button
                        onClick={() => { setProfileOpen(false); handleLogout(); }}
                        className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-red-50 transition w-full text-left"
                      >
                        <LogOut className="w-4 h-4 text-red-500" />
                        <span className="text-sm text-red-600">Log Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition ml-1"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Search Bar (expandable) */}
        {searchOpen && (
          <div className="border-t border-white/10 bg-primary-800/50">
            <div className="max-w-7xl mx-auto px-4 py-3">
              <form onSubmit={handleSearch} className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search campgrounds, people, recipes, events..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 rounded-xl bg-white/95 text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-gold-400"
                />
                <button
                  type="button"
                  onClick={() => setSearchOpen(false)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </nav>

      {/* ═══ Mobile Menu ═══ */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Mobile Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-100 bg-gradient-to-r from-primary-700 to-primary-800">
              <div className="flex items-center gap-3">
                {user.profilePicture ? (
                  <img src={user.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover border-2 border-white/30" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center">
                    <User className="w-5 h-5 text-white" />
                  </div>
                )}
                <div>
                  <p className="text-white font-semibold text-sm">{user.firstName} {user.lastName}</p>
                  <p className="text-white/60 text-xs">@{user.username}</p>
                </div>
              </div>
              <button onClick={() => setMobileMenuOpen(false)} className="text-white/80 hover:text-white p-1">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Search */}
            <div className="p-3 border-b border-gray-100">
              <form onSubmit={(e) => { handleSearch(e); setMobileMenuOpen(false); }}>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              </form>
            </div>

            {/* Mobile Nav Links */}
            <div className="py-2">
              <MobileLink to="/basecamp" icon={<Home className="w-5 h-5" />} label="Basecamp" active={isActive('/basecamp')} />
              <MobileLink to="/campgrounds" icon={<Tent className="w-5 h-5" />} label="Campgrounds" active={isActive('/campgrounds')} />
              <MobileLink to="/feed" icon={<Flame className="w-5 h-5" />} label="Feed" active={isActive('/feed')} />
              <MobileLink to="/events" icon={<Calendar className="w-5 h-5" />} label="Trips & Events" active={isActive('/events')} />
              <MobileLink to="/travel" icon={<Map className="w-5 h-5" />} label="Travel Map" active={isActive('/travel')} />
            </div>

            <div className="border-t border-gray-100 py-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-5 py-2">Create & Share</p>
              <MobileLink to="/albums" icon={<Camera className="w-5 h-5" />} label="Albums" active={isActive('/albums')} />
              <MobileLink to="/recipes" icon={<UtensilsCrossed className="w-5 h-5" />} label="Recipes" active={isActive('/recipes')} />
              <MobileLink to="/creators" icon={<Play className="w-5 h-5" />} label="Creator Pages" active={isActive('/creators')} />
            </div>

            <div className="border-t border-gray-100 py-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-5 py-2">Tools</p>
              <MobileLink to="/gear" icon={<Package className="w-5 h-5" />} label="Gear" active={isActive('/gear')} />
              <MobileLink to="/packing" icon={<Backpack className="w-5 h-5" />} label="Packing Lists" active={isActive('/packing')} />
              <MobileLink to="/rv-log" icon={<Wrench className="w-5 h-5" />} label="RV Log" active={isActive('/rv-log')} />
            </div>

            <div className="border-t border-gray-100 py-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-5 py-2">Community</p>
              <MobileLink to="/friends" icon={<Users className="w-5 h-5" />} label="Friends" active={isActive('/friends')} />
              <MobileLink to="/groups" icon={<UsersRound className="w-5 h-5" />} label="Groups" active={isActive('/groups')} />
              <MobileLink to="/messages" icon={<MessageCircle className="w-5 h-5" />} label="Messages" active={isActive('/messages')} badge={unreadMessages} />
              <MobileLink to="/jobs" icon={<Briefcase className="w-5 h-5" />} label="Jobs" active={isActive('/jobs')} />
            </div>

            <div className="border-t border-gray-100 py-2">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold px-5 py-2">Account</p>
              <MobileLink to={`/profile/${user.username}`} icon={<User className="w-5 h-5" />} label="My Profile" active={false} />
              <MobileLink to="/badges" icon={<Award className="w-5 h-5" />} label="Badges" active={isActive('/badges')} />
              <MobileLink to="/settings/privacy" icon={<Shield className="w-5 h-5" />} label="Settings" active={isActive('/settings')} />
            </div>

            <div className="border-t border-gray-100 p-4">
              <button
                onClick={() => { setMobileMenuOpen(false); handleLogout(); }}
                className="flex items-center gap-3 w-full px-4 py-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition"
              >
                <LogOut className="w-5 h-5" />
                <span className="font-medium text-sm">Log Out</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Mobile Link Component ──────────────────────────────────────────────────
function MobileLink({ to, icon, label, active, badge }: {
  to: string; icon: React.ReactNode; label: string; active: boolean; badge?: number;
}) {
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-5 py-3 transition ${
        active ? 'bg-primary-50 text-primary-700 border-r-3 border-primary-600' : 'text-gray-700 hover:bg-gray-50'
      }`}
    >
      <span className={active ? 'text-primary-600' : 'text-gray-400'}>{icon}</span>
      <span className="text-sm font-medium flex-1">{label}</span>
      {badge && badge > 0 && (
        <span className="min-w-[20px] h-5 px-1.5 text-[10px] font-bold text-white bg-campfire-500 rounded-full flex items-center justify-center">
          {badge > 9 ? '9+' : badge}
        </span>
      )}
    </Link>
  );
}
'''

def main():
    header("🧭 RVUnicorn Navbar UX Enhancement")

    if not os.path.exists(NAVBAR_PATH):
        print(f"{C.RED}ERROR: Navbar.tsx not found. Run from ~/Downloads/kindletribe-mvp/{C.END}")
        sys.exit(1)

    # Backup
    os.makedirs(BACKUP_DIR, exist_ok=True)
    shutil.copy2(NAVBAR_PATH, os.path.join(BACKUP_DIR, "Navbar.tsx"))
    log(f"Backed up to {os.path.relpath(BACKUP_DIR, PROJECT_ROOT)}/")

    # Write new navbar
    with open(NAVBAR_PATH, 'w', encoding='utf-8') as f:
        f.write(NAVBAR_CODE)
    log("✓ Written new Navbar.tsx")

    header("✅ Navbar Enhancement Complete!")
    print(f"""
{C.GREEN}{C.BOLD}New Layout:{C.END}

  Desktop:
  ┌──────────────────────────────────────────────────────────────────────┐
  │ 🦄 RVUnicorn  Basecamp  Campgrounds  Feed  Trips  Map  More▼  🔍 💬 🔔 [👤▼] │
  └──────────────────────────────────────────────────────────────────────┘

  Mobile (slide-out right panel):
  ┌──────────────────┐
  │ [Profile Header] │
  │ [Search Bar]     │
  │ ─ Basecamp       │
  │ ─ Campgrounds    │
  │ ─ Feed           │
  │ ─ Trips & Events │
  │ ─ Travel Map     │
  │ CREATE & SHARE   │
  │ ─ Albums         │
  │ ─ Recipes        │
  │ ─ Creator Pages  │
  │ TOOLS            │
  │ ─ Gear           │
  │ ─ Packing Lists  │
  │ ─ RV Log         │
  │ COMMUNITY        │
  │ ─ Friends        │
  │ ─ Groups         │
  │ ─ Messages       │
  │ ─ Jobs           │
  │ [Log Out]        │
  └──────────────────┘

{C.BOLD}Changes:{C.END}
  • Campgrounds promoted to top-level (your #1 feature)
  • Trips & Map promoted to top-level  
  • 3 dropdowns → 1 organized "More" menu
  • Badges/RV Settings moved under profile avatar
  • Slimmer height (h-14 vs h-16)
  • Categorized More dropdown (Create, Tools, Community)
  • Clean mobile slide-out with sections

{C.GREEN}Backup:{C.END} {os.path.relpath(BACKUP_DIR, PROJECT_ROOT)}/

{C.YELLOW}Test:{C.END} npm run dev
""")

if __name__ == "__main__":
    main()
