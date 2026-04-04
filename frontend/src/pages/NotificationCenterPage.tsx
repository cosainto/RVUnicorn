import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, MessageCircle, Users, MapPin, Zap, Check, CheckCheck,
  Trash2, Search, Filter, ChevronDown, MoreHorizontal, ArrowLeft,
  Volume2, VolumeX, Settings
} from 'lucide-react';
import api from '../services/api';
import { useToast } from '../components/ToastProvider';

interface Notification {
  id: string;
  type: string;
  content: string;
  link?: string;
  read: boolean;
  category: string;
  actorId?: string;
  actorName?: string;
  actorAvatar?: string;
  metadata?: any;
  createdAt: string;
}

const CATEGORIES = [
  { key: 'all', label: 'All', icon: Bell, color: 'text-gray-600' },
  { key: 'MESSAGE', label: 'Messages', icon: MessageCircle, color: 'text-blue-600' },
  { key: 'FRIEND', label: 'Friends', icon: Users, color: 'text-purple-600' },
  { key: 'CAMPGROUND', label: 'Campgrounds', icon: MapPin, color: 'text-emerald-600' },
  { key: 'SYSTEM', label: 'System', icon: Zap, color: 'text-amber-600' },
];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function getCategoryStyle(category: string) {
  switch (category) {
    case 'MESSAGE': return { icon: MessageCircle, color: 'text-blue-500', bg: 'bg-blue-100', label: 'Message' };
    case 'FRIEND': return { icon: Users, color: 'text-purple-500', bg: 'bg-purple-100', label: 'Friend' };
    case 'CAMPGROUND': return { icon: MapPin, color: 'text-emerald-500', bg: 'bg-emerald-100', label: 'Campground' };
    case 'SYSTEM': return { icon: Zap, color: 'text-amber-500', bg: 'bg-amber-100', label: 'System' };
    default: return { icon: Bell, color: 'text-gray-500', bg: 'bg-gray-100', label: 'Other' };
  }
}

export default function NotificationCenterPage() {
  const { soundEnabled, toggleSound } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [category, setCategory] = useState('all');
  const [readFilter, setReadFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const [offset, setOffset] = useState(0);
  const [counts, setCounts] = useState({ count: 0, messages: 0, friends: 0, campground: 0, system: 0 });
  const limit = 30;

  const loadNotifications = useCallback(async (reset = false) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('offset', reset ? '0' : offset.toString());
      if (category !== 'all') params.set('category', category);
      if (readFilter === 'unread') params.set('read', 'false');
      if (readFilter === 'read') params.set('read', 'true');

      const { data } = await api.get(`/notifications?${params.toString()}`);
      const fetched = data.notifications || data || [];

      if (reset) {
        setNotifications(fetched);
        setOffset(limit);
      } else {
        setNotifications(prev => [...prev, ...fetched]);
        setOffset(prev => prev + limit);
      }
      setTotal(data.total || fetched.length);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
    setLoading(false);
  }, [category, readFilter, offset]);

  const loadCounts = useCallback(async () => {
    try {
      const { data } = await api.get('/notifications/unread');
      setCounts(data);
    } catch {}
  }, []);

  useEffect(() => {
    setOffset(0);
    loadNotifications(true);
    loadCounts();
  }, [category, readFilter]);

  const markAsRead = async (id: string) => {
    await api.put(`/notifications/${id}/read`).catch(() => {});
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    loadCounts();
  };

  const markAllRead = async () => {
    const cat = category === 'all' ? undefined : category;
    await api.put('/notifications/read-all', { category: cat }).catch(() => {});
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    loadCounts();
  };

  const deleteNotification = async (id: string) => {
    await api.delete(`/notifications/${id}`).catch(() => {});
    setNotifications(prev => prev.filter(n => n.id !== id));
    loadCounts();
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    await api.post('/notifications/bulk-delete', { ids }).catch(() => {});
    setNotifications(prev => prev.filter(n => !selectedIds.has(n.id)));
    setSelectedIds(new Set());
    setSelectMode(false);
    loadCounts();
  };

  const bulkMarkRead = async () => {
    for (const id of selectedIds) {
      await api.put(`/notifications/${id}/read`).catch(() => {});
    }
    setNotifications(prev => prev.map(n => selectedIds.has(n.id) ? { ...n, read: true } : n));
    setSelectedIds(new Set());
    setSelectMode(false);
    loadCounts();
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(n => n.id)));
    }
  };

  // Client-side search filter
  const filtered = notifications.filter(n => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      n.content.toLowerCase().includes(q) ||
      (n.actorName || '').toLowerCase().includes(q) ||
      (n.metadata?.preview || '').toLowerCase().includes(q)
    );
  });

  const getCatCount = (key: string) => {
    switch (key) {
      case 'all': return counts.count;
      case 'MESSAGE': return counts.messages;
      case 'FRIEND': return counts.friends;
      case 'CAMPGROUND': return counts.campground;
      case 'SYSTEM': return counts.system;
      default: return 0;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to="/basecamp" className="p-2 hover:bg-gray-100 rounded-lg transition">
              <ArrowLeft className="w-5 h-5 text-gray-500" />
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
              <p className="text-sm text-gray-500">{counts.count} unread</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSound}
              className={`p-2 rounded-lg transition ${soundEnabled ? 'text-primary-600 bg-primary-50' : 'text-gray-400 hover:bg-gray-100'}`}
              title={soundEnabled ? 'Sound on' : 'Sound off'}
            >
              {soundEnabled ? <Volume2 className="w-5 h-5" /> : <VolumeX className="w-5 h-5" />}
            </button>
            {counts.count > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1.5 px-3 py-2 text-sm text-primary-600 hover:bg-primary-50 rounded-lg transition font-medium"
              >
                <CheckCheck className="w-4 h-4" /> Mark all read
              </button>
            )}
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2">
          {CATEGORIES.map(cat => {
            const count = getCatCount(cat.key);
            const isActive = category === cat.key;
            return (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-white shadow-md text-gray-900 ring-1 ring-gray-200'
                    : 'text-gray-500 hover:bg-white/60'
                }`}
              >
                <cat.icon className={`w-4 h-4 ${isActive ? cat.color : 'text-gray-400'}`} />
                {cat.label}
                {count > 0 && (
                  <span className={`min-w-[20px] h-5 px-1.5 rounded-full text-[11px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-red-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Search + Filters Bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notifications..."
              className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Read Filter */}
          <div className="relative">
            <select
              value={readFilter}
              onChange={(e) => setReadFilter(e.target.value as any)}
              className="appearance-none pl-3 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 cursor-pointer"
            >
              <option value="all">All</option>
              <option value="unread">Unread</option>
              <option value="read">Read</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Select Mode Toggle */}
          <button
            onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
            className={`p-2.5 rounded-xl border transition ${
              selectMode ? 'bg-primary-50 border-primary-200 text-primary-600' : 'bg-white border-gray-200 text-gray-400 hover:text-gray-600'
            }`}
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>

        {/* Bulk Actions Bar */}
        {selectMode && selectedIds.size > 0 && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-primary-50 rounded-xl border border-primary-100">
            <button
              onClick={selectAll}
              className="text-xs text-primary-600 font-medium"
            >
              {selectedIds.size === filtered.length ? 'Deselect all' : 'Select all'}
            </button>
            <span className="text-xs text-gray-400">|</span>
            <span className="text-xs text-gray-600">{selectedIds.size} selected</span>
            <div className="flex-1" />
            <button
              onClick={bulkMarkRead}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-600 font-medium"
            >
              <Check className="w-3 h-3" /> Mark read
            </button>
            <button
              onClick={bulkDelete}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 text-red-600 font-medium"
            >
              <Trash2 className="w-3 h-3" /> Delete
            </button>
          </div>
        )}

        {/* Notification List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <Bell className="w-12 h-12 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">
                {searchQuery ? 'No notifications match your search' : 'No notifications yet'}
              </p>
            </div>
          ) : (
            <>
              {filtered.map(notif => {
                const style = getCategoryStyle(notif.category);
                const Icon = style.icon;
                const isSelected = selectedIds.has(notif.id);

                return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

                  <div
                    key={notif.id}
                    className={`flex items-start gap-3 px-4 py-4 border-b border-gray-50 transition group ${
                      !notif.read ? 'bg-blue-50/30' : 'hover:bg-gray-50'
                    } ${isSelected ? 'bg-primary-50/50 ring-1 ring-primary-200' : ''}`}
                  >
                    {/* Checkbox in select mode */}
                    {selectMode && (
                      <label className="flex-shrink-0 mt-1 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelect(notif.id)}
                          className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                        />
                      </label>
                    )}

                    {/* Avatar / Icon */}
                    <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${style.bg}`}>
                      {notif.actorAvatar ? (
                        <img src={notif.actorAvatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <Icon className={`w-5 h-5 ${style.color}`} />
                      )}
                    </div>

                    {/* Content */}
                    <div className="pg-dark flex-1 min-w-0">
                      <Link
                        to={notif.link || '#'}
                        onClick={() => markAsRead(notif.id)}
                        className="block"
                      >
                        <p className={`text-sm leading-snug ${!notif.read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                          {notif.actorName && <span className="font-semibold">{notif.actorName} </span>}
                          {notif.content}
                        </p>
                        {notif.metadata?.preview && (
                          <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 italic">"{notif.metadata.preview}"</p>
                        )}
                      </Link>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${style.bg} ${style.color}`}>
                          <Icon className="w-2.5 h-2.5" /> {style.label}
                        </span>
                        <span className="text-[11px] text-gray-400">{timeAgo(notif.createdAt)}</span>
                        {!notif.read && <span className="w-2 h-2 rounded-full bg-blue-500" />}
                      </div>
                    </div>

                    {/* Actions */}
                    {!selectMode && (
                      <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        {!notif.read && (
                          <button
                            onClick={() => markAsRead(notif.id)}
                            className="p-1.5 text-gray-300 hover:text-blue-500 rounded-lg hover:bg-blue-50 transition"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteNotification(notif.id)}
                          className="p-1.5 text-gray-300 hover:text-red-500 rounded-lg hover:bg-red-50 transition"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load More */}
              {filtered.length < total && (
                <button
                  onClick={() => loadNotifications(false)}
                  disabled={loading}
                  className="w-full py-3 text-sm text-primary-600 hover:bg-gray-50 font-medium transition"
                >
                  {loading ? 'Loading...' : 'Load more'}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
