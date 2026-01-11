import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Mail, UserPlus, MessageSquare, Heart, Calendar, CheckSquare, MapPin } from 'lucide-react';
import api from '../services/api';

interface Notification {
  id: string;
  type: string;
  content: string;
  link?: string;
  read: boolean;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  // Load unread count on mount
  useEffect(() => {
    loadUnreadCount();
    // Poll every 30 seconds
    const interval = setInterval(loadUnreadCount, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadUnreadCount = async () => {
    try {
      const { data } = await api.get('/notifications/unread');
      setUnreadCount(data.count);
    } catch (error) {
      console.error('Load unread count error:', error);
    }
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/notifications');
      setNotifications(data);
    } catch (error) {
      console.error('Load notifications error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleBellClick = () => {
    setShowDropdown(!showDropdown);
    if (!showDropdown) {
      loadNotifications();
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      await api.put(`/notifications/${notificationId}/read`);
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Mark as read error:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.put('/notifications/read-all');
      loadNotifications();
      loadUnreadCount();
    } catch (error) {
      console.error('Mark all as read error:', error);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'MESSAGE':
        return <Mail className="w-5 h-5 text-blue-500" />;
      case 'FRIEND_REQUEST':
        return <UserPlus className="w-5 h-5 text-green-500" />;
      case 'FRIEND_ACCEPT':
        return <UserPlus className="w-5 h-5 text-blue-500" />;
      case 'COMMENT':
      case 'COMMENT_ADDED':
        return <MessageSquare className="w-5 h-5 text-purple-500" />;
      case 'LIKE':
        return <Heart className="w-5 h-5 text-red-500" />;
      case 'EVENT_INVITE':
      case 'EVENT_UPDATE':
        return <Calendar className="w-5 h-5 text-orange-500" />;
      case 'NOTE_ADDED':
        return <MessageSquare className="w-5 h-5 text-blue-500" />;
      case 'CHECKLIST_ASSIGNED':
      case 'CHECKLIST_COMPLETED':
        return <CheckSquare className="w-5 h-5 text-green-500" />;
      case 'RSVP_CHANGE':
        return <UserPlus className="w-5 h-5 text-purple-500" />;
      case 'CAMPGROUND_ADDED':
        return <MapPin className="w-5 h-5 text-primary-500" />;
      default:
        return <Bell className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="relative z-50">
      {/* Bell Button */}
      <button
        onClick={handleBellClick}
        className="relative p-3 text-gray-700 hover:text-primary-600 focus:outline-none z-50"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full pointer-events-none">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {showDropdown && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />

          {/* Dropdown Panel */}
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl z-50 border-2 border-primary-600">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white p-4 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold">Notifications</h3>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-xs bg-white text-blue-600 px-3 py-1 rounded-full font-semibold hover:bg-blue-50"
                  >
                    Mark All Read
                  </button>
                )}
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-96 overflow-y-auto">
              {loading ? (
                <div className="p-6 text-center text-gray-600">
                  Loading...
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 text-center text-gray-600">
                  <Bell className="w-12 h-12 mx-auto text-gray-400 mb-2" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`p-4 hover:bg-gray-50 transition-colors ${
                        !notification.read ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-start space-x-3">
                        <div className="flex-shrink-0 mt-1">
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-700 whitespace-pre-line">
                            {notification.content}
                          </p>

                          <div className="flex items-center space-x-3 mt-2">
                            <span className="text-xs text-gray-500">
                              {new Date(notification.createdAt).toLocaleString()}
                            </span>
                            {!notification.read && (
                              <button
                                onClick={() => handleMarkAsRead(notification.id)}
                                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                              >
                                Mark as read
                              </button>
                            )}
                            {notification.link && (
                              <Link
                                to={notification.link}
                                onClick={() => {
                                  setShowDropdown(false);
                                  if (!notification.read) {
                                    handleMarkAsRead(notification.id);
                                  }
                                }}
                                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                View →
                              </Link>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="p-3 bg-gray-50 rounded-b-lg border-t border-gray-200 text-center">
                <button
                  onClick={() => setShowDropdown(false)}
                  className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
