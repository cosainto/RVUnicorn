import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell, MessageCircle, Users, MapPin, Settings, Check, CheckCheck,
  Send, X, ChevronRight, Trash2, MoreHorizontal, Zap, Tent
} from 'lucide-react';
import api from '../services/api';

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

interface UnreadCounts {
  count: number;
  messages: number;
  friends: number;
  campground: number;
  system: number;
  events: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onUnreadUpdate: (counts: UnreadCounts) => void;
}

const TABS = [
  { key: 'all', label: 'All', icon: Bell },
  { key: 'EVENT', label: 'Trips', icon: Tent },
  { key: 'MESSAGE', label: 'Messages', icon: MessageCircle },
  { key: 'FRIEND', label: 'Friends', icon: Users },
  { key: 'CAMPGROUND', label: 'Campgrounds', icon: MapPin },
  { key: 'SYSTEM', label: 'System', icon: Zap },
];

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function getCategoryIcon(category: string) {
  switch (category) {
    case 'EVENT': return <Tent className="w-4 h-4 text-orange-500" />;
    case 'MESSAGE': return <MessageCircle className="w-4 h-4 text-blue-500" />;
    case 'FRIEND': return <Users className="w-4 h-4 text-purple-500" />;
    case 'CAMPGROUND': return <MapPin className="w-4 h-4 text-emerald-500" />;
    case 'SYSTEM': return <Zap className="w-4 h-4 text-amber-500" />;
    default: return <Bell className="w-4 h-4 text-gray-400" />;
  }
}

function getCategoryColor(category: string) {
  switch (category) {
    case 'EVENT': return 'bg-orange-100';
    case 'MESSAGE': return 'bg-blue-100';
    case 'FRIEND': return 'bg-purple-100';
    case 'CAMPGROUND': return 'bg-emerald-100';
    case 'SYSTEM': return 'bg-amber-100';
    default: return 'bg-gray-100';
  }
}

export default function NotificationDropdown({ isOpen, onClose, onUnreadUpdate }: Props) {
  const [activeTab, setActiveTab] = useState('all');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [counts, setCounts] = useState<UnreadCounts>({ count: 0, messages: 0, friends: 0, campground: 0, system: 0, events: 0 });
  const [quickReplyId, setQuickReplyId] = useState<string | null>(null);
  const [quickReplyText, setQuickReplyText] = useState('');
  const [sending, setSending] = useState(false);
  const [actionMenuId, setActionMenuId] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const quickReplyRef = useRef<HTMLInputElement>(null);

  const loadNotifications = async () => {
    setLoading(true);
    try {
      const category = activeTab === 'all' ? '' : `&category=${activeTab}`;
      const { data } = await api.get(`/notifications?limit=15${category}`);
      setNotifications(data.notifications || data || []);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    }
    setLoading(false);
  };

  const loadCounts = async () => {
    try {
      const { data } = await api.get('/notifications/unread');
      setCounts(data);
      onUnreadUpdate(data);
    } catch {}
  };

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
      loadCounts();
    }
  }, [isOpen, activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen, onClose]);

  // Focus quick reply input
  useEffect(() => {
    if (quickReplyId) quickReplyRef.current?.focus();
  }, [quickReplyId]);

  const markAsRead = async (id: string) => {
    try {
      await api.put(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      loadCounts();
    } catch {}
  };

  const markAllRead = async () => {
    try {
      const category = activeTab === 'all' ? undefined : activeTab;
      await api.put('/notifications/read-all', { category });
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      loadCounts();
    } catch {}
  };

  const deleteNotification = async (id: string) => {
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications(prev => prev.filter(n => n.id !== id));
      setActionMenuId(null);
      loadCounts();
    } catch {}
  };

  const sendQuickReply = async (notif: Notification) => {
    if (!quickReplyText.trim() || sending) return;
    setSending(true);
    try {
      await api.post('/notifications/quick-reply', {
        notificationId: notif.id,
        recipientId: notif.actorId,
        content: quickReplyText.trim(),
      });
      setQuickReplyId(null);
      setQuickReplyText('');
      markAsRead(notif.id);
    } catch (e) {
      console.error('Quick reply failed:', e);
    }
    setSending(false);
  };

  const getTabCount = (key: string): number => {
    switch (key) {
      case 'all': return counts.count;
      case 'EVENT': return counts.events;
      case 'MESSAGE': return counts.messages;
      case 'FRIEND': return counts.friends;
      case 'CAMPGROUND': return counts.campground;
      case 'SYSTEM': return counts.system;
      default: return 0;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-2 w-96 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50"
      style={{ animation: 'slideDown 0.2s ease-out' }}
    >
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900">Notifications</h3>
          <div className="flex items-center gap-2">
            {counts.count > 0 && (
              <button
                onClick={markAllRead}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
            <Link
              to="/notifications"
              onClick={onClose}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              <Settings className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-hide">
          {TABS.map(tab => {
            const count = getTabCount(tab.key);
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-primary-100 text-primary-700'
                    : 'text-gray-500 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="w-3 h-3" />
                {tab.label}
                {count > 0 && (
                  <span className={`min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${
                    isActive ? 'bg-primary-600 text-white' : 'bg-gray-200 text-gray-600'
                  }`}>
                    {count > 99 ? '99+' : count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Notification List */}
      <div className="max-h-96 overflow-y-auto border-t border-gray-100">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-12">
            <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">
              {activeTab === 'all' ? 'No notifications yet' : `No ${activeTab.toLowerCase()} notifications`}
            </p>
          </div>
        ) : (
          notifications.map(notif => (
            <div key={notif.id} className="relative group">
              <div
                className={`flex items-start gap-3 px-4 py-3 transition border-b border-gray-50 ${
                  !notif.read ? 'bg-blue-50/40' : 'hover:bg-gray-50'
                }`}
              >
                {/* Avatar / Icon */}
                <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${getCategoryColor(notif.category)}`}>
                  {notif.actorAvatar ? (
                    <img src={notif.actorAvatar} alt="" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    getCategoryIcon(notif.category)
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <Link
                    to={notif.link || '#'}
                    onClick={() => { markAsRead(notif.id); onClose(); }}
                    className="block"
                  >
                    <p className={`text-sm leading-snug ${!notif.read ? 'text-gray-900 font-medium' : 'text-gray-600'}`}>
                      {notif.actorName && <span className="font-semibold">{notif.actorName} </span>}
                      {notif.content}
                    </p>
                    {notif.metadata?.preview && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1 italic">"{notif.metadata.preview}"</p>
                    )}
                  </Link>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] text-gray-400">{timeAgo(notif.createdAt)}</span>
                    {!notif.read && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}

                    {/* Quick Reply Button (only for messages with actorId) */}
                    {notif.category === 'MESSAGE' && notif.actorId && (
                      <button
                        onClick={() => { setQuickReplyId(quickReplyId === notif.id ? null : notif.id); setQuickReplyText(''); }}
                        className="text-[10px] text-blue-500 hover:text-blue-700 font-medium flex items-center gap-0.5"
                      >
                        <Send className="w-2.5 h-2.5" /> Reply
                      </button>
                    )}
                  </div>

                  {/* Quick Reply Input */}
                  {quickReplyId === notif.id && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <input
                        ref={quickReplyRef}
                        type="text"
                        value={quickReplyText}
                        onChange={(e) => setQuickReplyText(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && sendQuickReply(notif)}
                        placeholder="Type a quick reply..."
                        className="flex-1 text-xs px-2.5 py-1.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 focus:border-blue-400"
                      />
                      <button
                        onClick={() => sendQuickReply(notif)}
                        disabled={sending || !quickReplyText.trim()}
                        className="p-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-40 transition"
                      >
                        <Send className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => { setQuickReplyId(null); setQuickReplyText(''); }}
                        className="p-1.5 text-gray-400 hover:text-gray-600"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Action Menu */}
                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                  <button
                    onClick={() => setActionMenuId(actionMenuId === notif.id ? null : notif.id)}
                    className="p-1 text-gray-300 hover:text-gray-500 rounded"
                  >
                    <MoreHorizontal className="w-4 h-4" />
                  </button>
                  {actionMenuId === notif.id && (
                    <div className="absolute right-4 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-100 py-1 z-50">
                      {!notif.read && (
                        <button
                          onClick={() => { markAsRead(notif.id); setActionMenuId(null); }}
                          className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <Check className="w-3 h-3" /> Mark as read
                        </button>
                      )}
                      <button
                        onClick={() => deleteNotification(notif.id)}
                        className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-red-500 hover:bg-red-50"
                      >
                        <Trash2 className="w-3 h-3" /> Delete
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <Link
        to="/notifications"
        onClick={onClose}
        className="flex items-center justify-center gap-1 py-3 text-sm text-primary-600 hover:bg-gray-50 border-t border-gray-100 font-medium transition"
      >
        View all notifications <ChevronRight className="w-4 h-4" />
      </Link>

      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
