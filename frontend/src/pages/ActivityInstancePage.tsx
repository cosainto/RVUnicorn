import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Clock, MapPin, Users, Send,
  CheckCircle,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const ACTIVITY_EMOJI: Record<string, string> = {
  HIKE: '🥾', KAYAK: '🚣', SWIM: '🏊', FISH: '🎣', BIKE: '🚲',
  STARGAZING: '🔭', CAMPFIRE: '🔥', PHOTOGRAPHY: '📸',
  WILDLIFE: '🦅', OFFROAD: '🚗', SOCIAL: '👥', FOOD: '🍽️', OTHER: '🎯',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  HARD: 'bg-red-100 text-red-700',
};

export default function ActivityInstancePage() {
  const { instanceId } = useParams<{ instanceId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [instance, setInstance] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [showComplete, setShowComplete] = useState(false);
  const [completionNote, setCompletionNote] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadInstance = useCallback(async () => {
    try {
      const { data } = await api.get(`/actionable/instances/${instanceId}`);
      setInstance(data);
    } catch (e) {
      console.error('Failed to load instance:', e);
    } finally {
      setLoading(false);
    }
  }, [instanceId]);

  useEffect(() => {
    loadInstance();
    const interval = setInterval(loadInstance, 10000); // Poll every 10s
    return () => clearInterval(interval);
  }, [loadInstance]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [instance?.messages]);

  const handleJoin = async () => {
    try {
      await api.post(`/actionable/instances/${instanceId}/join`, { status: 'JOINED' });
      loadInstance();
    } catch (e) {
      console.error('Join failed:', e);
    }
  };

  const handleDecline = async () => {
    try {
      await api.post(`/actionable/instances/${instanceId}/join`, { status: 'DECLINED' });
      loadInstance();
    } catch (e) {
      console.error('Decline failed:', e);
    }
  };

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await api.post(`/actionable/instances/${instanceId}/messages`, { content: message });
      setMessage('');
      loadInstance();
    } catch (e) {
      console.error('Send failed:', e);
    } finally {
      setSending(false);
    }
  };

  const handleComplete = async () => {
    try {
      await api.post(`/actionable/${instance.actionableId}/complete`, {
        instanceId,
        note: completionNote || null,
      });
      setShowComplete(false);
      loadInstance();
    } catch (e) {
      console.error('Complete failed:', e);
    }
  };

  const handleStatusChange = async (status: string) => {
    try {
      await api.patch(`/actionable/instances/${instanceId}`, { status });
      loadInstance();
    } catch (e) {
      console.error('Status change failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!instance) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">Activity not found</p>
      </div>
    );
  }

  const actionable = instance.actionable;
  const campground = actionable?.campground;
  const isOrganizer = user?.id === instance.organizerId;
  const isJoined = instance.userStatus === 'JOINED';
  const isParticipant = instance.userStatus === 'JOINED' || instance.userStatus === 'INTERESTED';
  const emoji = ACTIVITY_EMOJI[actionable?.activityType] || '🎯';

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-1 text-gray-600">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <h1 className="font-bold text-gray-900 truncate">
              {emoji} {actionable?.title}
            </h1>
            {instance.status === 'HAPPENING_NOW' && (
              <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                Happening Now
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-4 space-y-4">
        {/* Info section */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          {campground && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
              <MapPin size={14} />
              {campground.name}
            </div>
          )}

          {instance.scheduledTime && (
            <div className="flex items-center gap-1.5 text-sm text-gray-600 mb-2">
              <Clock size={14} />
              {new Date(instance.scheduledTime).toLocaleString([], {
                weekday: 'long',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </div>
          )}

          <div className="flex items-center gap-2 mb-3">
            {instance.organizer?.profilePicture ? (
              <img src={instance.organizer.profilePicture} alt="" className="w-6 h-6 rounded-full object-cover" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                {instance.organizer?.firstName?.[0]}
              </div>
            )}
            <span className="text-sm text-gray-600">
              Organized by <span className="font-medium">{instance.organizer?.firstName}</span>
            </span>
          </div>

          {instance.note && (
            <p className="text-sm text-gray-700 bg-gray-50 rounded-lg p-3">{instance.note}</p>
          )}
        </div>

        {/* Activity details (collapsed) */}
        {actionable && (
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 flex-wrap">
              {actionable.difficulty && actionable.difficulty !== 'ANY' && (
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[actionable.difficulty] || ''}`}>
                  {actionable.difficulty}
                </span>
              )}
              {actionable.durationMinutes && (
                <span className="text-xs text-gray-500">
                  {actionable.durationMinutes < 60 ? `${actionable.durationMinutes}min` : `${Math.round(actionable.durationMinutes / 60)}hr`}
                </span>
              )}
            </div>
            {actionable.whatToBring?.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-gray-500 mb-1">📦 What to bring:</p>
                <div className="flex flex-wrap gap-1">
                  {actionable.whatToBring.map((item: string, i: number) => (
                    <span key={i} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Participants */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 flex items-center gap-1.5">
              <Users size={16} />
              {instance.participants?.filter((p: any) => p.status === 'JOINED').length || 0} joined
            </h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {instance.participants
              ?.filter((p: any) => p.status === 'JOINED')
              .map((p: any) => (
                <div key={p.userId} className="flex items-center gap-1.5 bg-gray-50 rounded-full px-2 py-1">
                  {p.user?.profilePicture ? (
                    <img src={p.user.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center text-[10px]">
                      {p.user?.firstName?.[0]}
                    </div>
                  )}
                  <span className="text-xs font-medium text-gray-700">{p.user?.firstName}</span>
                  {p.user?.rvType && <span className="text-[10px] text-gray-400">{p.user.rvType}</span>}
                </div>
              ))}
          </div>

          {/* Join / Leave buttons */}
          <div className="mt-3 flex gap-2">
            {!isJoined && instance.status !== 'COMPLETED' && instance.status !== 'CANCELLED' && (
              <button
                onClick={handleJoin}
                className="flex-1 bg-primary-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-primary-700 transition-colors"
              >
                Join →
              </button>
            )}
            {isJoined && (
              <div className="flex-1 bg-green-50 text-green-700 text-sm font-medium py-2 rounded-lg text-center flex items-center justify-center gap-1">
                <CheckCircle size={14} /> You're In
              </div>
            )}
            {isJoined && !isOrganizer && (
              <button
                onClick={handleDecline}
                className="text-sm text-gray-500 hover:text-red-500 px-3 py-2 rounded-lg border border-gray-200"
              >
                Can't Make It
              </button>
            )}
          </div>
        </div>

        {/* Organizer controls */}
        {isOrganizer && instance.status === 'OPEN' && (
          <div className="flex gap-2">
            <button
              onClick={() => handleStatusChange('HAPPENING_NOW')}
              className="flex-1 bg-green-600 text-white text-sm font-medium py-2 rounded-lg"
            >
              Start Now
            </button>
            <button
              onClick={() => handleStatusChange('CANCELLED')}
              className="text-sm text-red-600 border border-red-200 px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Mark complete */}
        {isParticipant && (instance.status === 'HAPPENING_NOW' || instance.status === 'OPEN') && (
          <div>
            {!showComplete ? (
              <button
                onClick={() => setShowComplete(true)}
                className="w-full bg-campfire-500 text-white font-medium py-2.5 rounded-xl hover:bg-campfire-600 transition-colors flex items-center justify-center gap-2"
              >
                <CheckCircle size={16} /> Mark as Complete
              </button>
            ) : (
              <div className="bg-white rounded-xl p-4 shadow-sm">
                <h3 className="font-semibold text-gray-900 mb-2">How was it?</h3>
                <textarea
                  value={completionNote}
                  onChange={(e) => setCompletionNote(e.target.value)}
                  placeholder="Share how it went..."
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mb-3 resize-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <div className="flex gap-2">
                  <button
                    onClick={handleComplete}
                    className="flex-1 bg-campfire-500 text-white text-sm font-medium py-2 rounded-lg"
                  >
                    Log Completion
                  </button>
                  <button
                    onClick={() => setShowComplete(false)}
                    className="text-sm text-gray-500 px-3 py-2 rounded-lg border border-gray-200"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Group Chat */}
        {isParticipant && (
          <div className="bg-white rounded-xl shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">Group Chat</h3>
            </div>
            <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
              {(!instance.messages || instance.messages.length === 0) && (
                <p className="text-sm text-gray-400 text-center py-4">
                  {instance.organizer?.firstName} will share details here.
                  Ask a question or say you're coming!
                </p>
              )}
              {instance.messages?.map((msg: any) => (
                <div key={msg.id} className="flex gap-2">
                  {msg.user?.profilePicture ? (
                    <img src={msg.user.profilePicture} alt="" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs flex-shrink-0">
                      {msg.user?.firstName?.[0]}
                    </div>
                  )}
                  <div>
                    <p className="text-xs font-medium text-gray-700">{msg.user?.firstName}</p>
                    <p className="text-sm text-gray-800">{msg.content}</p>
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
            <div className="px-4 py-3 border-t border-gray-100 flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Type a message..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button
                onClick={handleSendMessage}
                disabled={sending || !message.trim()}
                className="bg-primary-600 text-white p-2 rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
