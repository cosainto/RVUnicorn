import React, { useState, useRef, useEffect } from 'react';
import { MoreHorizontal, X, Clock, UserX, CalendarX, EyeOff } from 'lucide-react';
import api from '../services/api';

interface ActivityMuteMenuProps {
  activityId: string;
  actorId?: string;
  actorName?: string;
  eventId?: string;
  eventTitle?: string;
  onDismiss?: () => void;
}

const ActivityMuteMenu: React.FC<ActivityMuteMenuProps> = ({
  activityId,
  actorId,
  actorName,
  eventId,
  eventTitle,
  onDismiss,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showUserSubmenu, setShowUserSubmenu] = useState(false);
  const [showEventSubmenu, setShowEventSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowUserSubmenu(false);
        setShowEventSubmenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleDismissActivity = async () => {
    try {
      await api.post('/mute/activity', { activityId });
      onDismiss?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to dismiss activity:', error);
    }
  };

  const handleMuteUser = async (duration: string) => {
    if (!actorId) return;
    try {
      await api.post('/mute/user', { mutedUserId: actorId, duration });
      onDismiss?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to mute user:', error);
    }
  };

  const handleMuteEvent = async (duration: string) => {
    if (!eventId) return;
    try {
      await api.post('/mute/event', { mutedEventId: eventId, duration });
      onDismiss?.();
      setIsOpen(false);
    } catch (error) {
      console.error('Failed to mute event:', error);
    }
  };

  const durationOptions = [
    { label: '7 days', value: '7_DAYS' },
    { label: '30 days', value: '30_DAYS' },
    { label: '120 days', value: '120_DAYS' },
    { label: 'Forever', value: 'FOREVER' },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
        title="More options"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-6 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-50 py-1">
          {/* Dismiss this activity */}
          <button
            onClick={handleDismissActivity}
            className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
          >
            <X className="w-4 h-4" />
            Dismiss this
          </button>

          {/* Mute user */}
          {actorId && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowUserSubmenu(!showUserSubmenu);
                  setShowEventSubmenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 justify-between"
              >
                <span className="flex items-center gap-2">
                  <UserX className="w-4 h-4" />
                  Snooze {actorName || 'user'}
                </span>
                <span className="text-gray-400">▸</span>
              </button>

              {showUserSubmenu && (
                <div className="absolute left-full top-0 w-40 bg-white rounded-lg shadow-lg border border-gray-200 ml-1 py-1">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleMuteUser(opt.value)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Clock className="w-3 h-3" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Mute event */}
          {eventId && (
            <div className="relative">
              <button
                onClick={() => {
                  setShowEventSubmenu(!showEventSubmenu);
                  setShowUserSubmenu(false);
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2 justify-between"
              >
                <span className="flex items-center gap-2">
                  <CalendarX className="w-4 h-4" />
                  Snooze event
                </span>
                <span className="text-gray-400">▸</span>
              </button>

              {showEventSubmenu && (
                <div className="absolute left-full top-0 w-40 bg-white rounded-lg shadow-lg border border-gray-200 ml-1 py-1">
                  {durationOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => handleMuteEvent(opt.value)}
                      className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Clock className="w-3 h-3" />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div className="border-t border-gray-100 my-1" />
          
          <button
            onClick={() => setIsOpen(false)}
            className="w-full px-4 py-2 text-left text-sm text-gray-500 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
};

export default ActivityMuteMenu;
