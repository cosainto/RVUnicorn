import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { UserX, CalendarX, Tent, Trash2, Clock, RefreshCw, EyeOff } from 'lucide-react';
import api from '../services/api';

interface MutedEntity {
  id: string;
  snoozeDuration: string;
  snoozeUntil: string | null;
  isExpired: boolean;
  createdAt: string;
  mutedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  mutedCampground?: {
    id: string;
    name: string;
  };
  mutedEvent?: {
    id: string;
    title: string;
  };
}

const MutedSettingsPanel: React.FC = () => {
  const [mutes, setMutes] = useState<MutedEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'users' | 'events' | 'campgrounds'>('all');

  const loadMutes = async () => {
    try {
      const { data } = await api.get('/mute/list');
      setMutes(data);
    } catch (error) {
      console.error('Failed to load mutes:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMutes();
  }, []);

  const handleUnmute = async (id: string) => {
    try {
      await api.delete('/mute/' + id);
      setMutes(mutes.filter(m => m.id !== id));
    } catch (error) {
      console.error('Failed to unmute:', error);
    }
  };

  const formatDuration = (duration: string) => {
    switch (duration) {
      case '7_DAYS': return '7 days';
      case '30_DAYS': return '30 days';
      case '120_DAYS': return '120 days';
      case 'FOREVER': return 'Forever';
      default: return duration;
    }
  };

  const formatExpiry = (snoozeUntil: string | null) => {
    if (!snoozeUntil) return 'Forever';
    const date = new Date(snoozeUntil);
    const now = new Date();
    if (date < now) return 'Expired';
    const days = Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (days === 1) return '1 day left';
    return days + ' days left';
  };

  const filteredMutes = mutes.filter(m => {
    if (filter === 'all') return true;
    if (filter === 'users') return !!m.mutedUser;
    if (filter === 'events') return !!m.mutedEvent;
    if (filter === 'campgrounds') return !!m.mutedCampground;
    return true;
  });

  const activeMutes = filteredMutes.filter(m => !m.isExpired);
  const expiredMutes = filteredMutes.filter(m => m.isExpired);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Muted & Snoozed</h3>
        <p className="text-sm text-gray-500 mt-1">
          Manage users, events, and campgrounds you've snoozed from your Basecamp feed.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 p-4 border-b border-gray-100">
        {['all', 'users', 'events', 'campgrounds'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={'px-3 py-1.5 text-sm rounded-full transition-colors ' + 
              (filter === f 
                ? 'bg-navy-600 text-white' 
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              )
            }
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Active mutes */}
      <div className="divide-y divide-gray-100">
        {activeMutes.length === 0 && expiredMutes.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <EyeOff className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p>No muted items</p>
            <p className="text-sm mt-1">When you snooze users or events, they'll appear here.</p>
          </div>
        ) : (
          <>
            {activeMutes.map((mute) => (
              <div key={mute.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                <div className="flex items-center gap-3">
                  {mute.mutedUser && (
                    <>
                      <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                        {mute.mutedUser.profilePicture ? (
                          <img src={mute.mutedUser.profilePicture} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <UserX className="w-5 h-5 text-gray-500" />
                        )}
                      </div>
                      <div>
                        <Link 
                          to={'/profile/' + mute.mutedUser.username}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {mute.mutedUser.firstName} {mute.mutedUser.lastName}
                        </Link>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiry(mute.snoozeUntil)}
                        </div>
                      </div>
                    </>
                  )}

                  {mute.mutedEvent && (
                    <>
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <CalendarX className="w-5 h-5 text-blue-600" />
                      </div>
                      <div>
                        <Link 
                          to={'/events/' + mute.mutedEvent.id}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {mute.mutedEvent.title}
                        </Link>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiry(mute.snoozeUntil)}
                        </div>
                      </div>
                    </>
                  )}

                  {mute.mutedCampground && (
                    <>
                      <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                        <Tent className="w-5 h-5 text-green-600" />
                      </div>
                      <div>
                        <Link 
                          to={'/campgrounds/' + mute.mutedCampground.id}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {mute.mutedCampground.name}
                        </Link>
                        <div className="text-sm text-gray-500 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatExpiry(mute.snoozeUntil)}
                        </div>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => handleUnmute(mute.id)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}

            {/* Expired section */}
            {expiredMutes.length > 0 && (
              <>
                <div className="px-4 py-2 bg-gray-50 text-sm font-medium text-gray-500">
                  Expired
                </div>
                {expiredMutes.map((mute) => (
                  <div key={mute.id} className="p-4 flex items-center justify-between opacity-60 hover:bg-gray-50">
                    <div className="flex items-center gap-3">
                      {mute.mutedUser && (
                        <>
                          <UserX className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">
                            {mute.mutedUser.firstName} {mute.mutedUser.lastName}
                          </span>
                        </>
                      )}
                      {mute.mutedEvent && (
                        <>
                          <CalendarX className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">{mute.mutedEvent.title}</span>
                        </>
                      )}
                      {mute.mutedCampground && (
                        <>
                          <Tent className="w-5 h-5 text-gray-400" />
                          <span className="text-gray-600">{mute.mutedCampground.name}</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => handleUnmute(mute.id)}
                      className="text-sm text-gray-500 hover:text-red-500"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default MutedSettingsPanel;
