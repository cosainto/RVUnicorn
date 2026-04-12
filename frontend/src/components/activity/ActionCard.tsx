import { useState } from 'react';
import { Bookmark, Clock, Users, ChevronRight } from 'lucide-react';
import api from '../../services/api';

interface ActionableContent {
  id: string;
  activityType: string;
  title: string;
  description?: string;
  durationMinutes?: number;
  difficulty?: string;
  whatToBring: string[];
  bestTimeOfDay?: string;
  kidsOk: boolean;
  dogsOk: boolean;
  saveCount: number;
  joinCount: number;
  completionCount: number;
  creator?: { id: string; firstName: string; profilePicture?: string; username?: string };
  contentId?: string;
}

interface ActiveInstance {
  id: string;
  scheduledTime?: string;
  status: string;
  organizer?: { id: string; firstName: string; profilePicture?: string };
  _count?: { participants: number };
}

interface FriendUser {
  id: string;
  firstName: string;
  profilePicture?: string;
}

interface ActionCardProps {
  actionable: ActionableContent;
  hitchReason?: string;
  activeInstance?: ActiveInstance | null;
  friendsWhoDidThis?: FriendUser[];
  context?: 'campground' | 'trip' | 'basecamp' | 'discovery';
  userSaved?: boolean;
  onSave?: () => void;
  onJoin?: (instanceId: string) => void;
  onStartActivity?: () => void;
  compact?: boolean;
}

const ACTIVITY_EMOJI: Record<string, string> = {
  HIKE: '🥾', KAYAK: '🚣', SWIM: '🏊', FISH: '🎣', BIKE: '🚲',
  STARGAZING: '🔭', CAMPFIRE: '🔥', PHOTOGRAPHY: '📸',
  WILDLIFE: '🦅', OFFROAD: '🚗', SOCIAL: '👥', FOOD: '🍽️', OTHER: '🎯',
};

const DIFFICULTY_COLORS: Record<string, string> = {
  EASY: 'bg-green-100 text-green-700',
  MODERATE: 'bg-amber-100 text-amber-700',
  HARD: 'bg-red-100 text-red-700',
  ANY: 'bg-gray-100 text-gray-600',
};

export default function ActionCard({
  actionable,
  hitchReason,
  activeInstance,
  friendsWhoDidThis,
  userSaved = false,
  onSave,
  onJoin,
  onStartActivity,
  compact = false,
}: ActionCardProps) {
  const [saved, setSaved] = useState(userSaved);
  const [saving, setSaving] = useState(false);

  const emoji = ACTIVITY_EMOJI[actionable.activityType] || '🎯';

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data } = await api.post(`/actionable/${actionable.id}/save`);
      setSaved(data.saved);
      onSave?.();
    } catch (e) {
      console.error('Save failed:', e);
    } finally {
      setSaving(false);
    }
  };

  const handleJoin = async () => {
    if (!activeInstance) return;
    try {
      await api.post(`/actionable/instances/${activeInstance.id}/join`, { status: 'JOINED' });
      onJoin?.(activeInstance.id);
    } catch (e) {
      console.error('Join failed:', e);
    }
  };

  return (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${compact ? 'p-3 min-w-[260px]' : 'p-4'}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-lg">{emoji}</span>
          <h3 className={`font-semibold text-gray-900 truncate ${compact ? 'text-sm' : 'text-base'}`}>
            {actionable.title}
          </h3>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className={`flex-shrink-0 p-1 rounded-lg transition-all ${
            saved ? 'text-amber-500' : 'text-gray-400 hover:text-amber-500'
          } ${saving ? 'animate-bounce' : ''}`}
        >
          <Bookmark size={18} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Badges row */}
      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
        {actionable.difficulty && actionable.difficulty !== 'ANY' && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[actionable.difficulty] || DIFFICULTY_COLORS.ANY}`}>
            {actionable.difficulty.charAt(0) + actionable.difficulty.slice(1).toLowerCase()}
          </span>
        )}
        {actionable.durationMinutes && (
          <span className="text-xs text-gray-500 flex items-center gap-0.5">
            <Clock size={12} />
            {actionable.durationMinutes < 60
              ? `${actionable.durationMinutes}min`
              : `${Math.round(actionable.durationMinutes / 60)}hr`}
          </span>
        )}
        {actionable.kidsOk && <span className="text-xs">👨‍👩‍👧</span>}
        {actionable.dogsOk && <span className="text-xs">🐕</span>}
      </div>

      {/* Hitch reason */}
      {hitchReason && (
        <p className="text-sm text-amber-600 italic mt-2">{hitchReason}</p>
      )}

      {/* Description (non-compact only) */}
      {!compact && actionable.description && (
        <p className="text-sm text-gray-600 mt-2 line-clamp-2">{actionable.description}</p>
      )}

      {/* What to bring */}
      {actionable.whatToBring?.length > 0 && !compact && (
        <div className="mt-2 flex items-center gap-1 flex-wrap">
          <span className="text-xs text-gray-500">📦 Bring:</span>
          {actionable.whatToBring.slice(0, 3).map((item, i) => (
            <span key={i} className="text-xs bg-gray-50 text-gray-600 px-1.5 py-0.5 rounded">
              {item}
            </span>
          ))}
          {actionable.whatToBring.length > 3 && (
            <span className="text-xs text-gray-400">+{actionable.whatToBring.length - 3} more</span>
          )}
        </div>
      )}

      {/* Active instance */}
      {activeInstance && (
        <div className="mt-3 bg-primary-50 rounded-lg p-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Users size={14} className="text-primary-600" />
              <span className="text-sm font-medium text-primary-700">
                {activeInstance._count?.participants || 1} people doing this
                {activeInstance.scheduledTime && (
                  <> · {new Date(activeInstance.scheduledTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
                )}
              </span>
            </div>
          </div>
          {activeInstance.organizer && (
            <p className="text-xs text-primary-600 mt-1">
              Organized by {activeInstance.organizer.firstName}
            </p>
          )}
          <button
            onClick={handleJoin}
            className="mt-2 w-full bg-primary-600 text-white text-sm font-medium py-1.5 px-3 rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-1"
          >
            Join Them <ChevronRight size={14} />
          </button>
        </div>
      )}

      {/* Friends who did this */}
      {friendsWhoDidThis && friendsWhoDidThis.length > 0 && !activeInstance && (
        <div className="mt-3 flex items-center gap-1.5">
          <div className="flex -space-x-2">
            {friendsWhoDidThis.slice(0, 3).map((f) => (
              <img
                key={f.id}
                src={f.profilePicture || '/default-avatar.png'}
                alt={f.firstName}
                className="w-6 h-6 rounded-full border-2 border-white object-cover"
              />
            ))}
          </div>
          <span className="text-xs text-gray-600">
            {friendsWhoDidThis[0].firstName}
            {friendsWhoDidThis.length > 1 && ` and ${friendsWhoDidThis.length - 1} others`} did this
          </span>
        </div>
      )}

      {/* Bottom actions (non-compact, no active instance) */}
      {!activeInstance && !compact && (
        <div className="mt-3 flex items-center gap-2">
          <button
            onClick={onStartActivity}
            className="flex-1 bg-campfire-500 text-white text-sm font-medium py-2 px-3 rounded-lg hover:bg-campfire-600 transition-colors"
          >
            Start This Activity
          </button>
        </div>
      )}

      {/* Completions count */}
      {actionable.completionCount > 0 && !compact && (
        <div className="mt-2 flex items-center gap-1 text-xs text-gray-500">
          <span>✓ {actionable.completionCount} people completed this</span>
        </div>
      )}
    </div>
  );
}
