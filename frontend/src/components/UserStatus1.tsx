import { useState } from 'react';
import { Edit2, Check, X, Home, Tent, MapPin } from 'lucide-react';
import api from '../services/api';

interface UserStatusProps {
  profile: {
    id: string;
    username: string;
    status?: string;
    statusEmoji?: string;
    statusType?: 'CUSTOM' | 'AUTO_CAMPING' | 'AUTO_HOME';
    currentCampsite?: string;
  };
  isOwnProfile: boolean;
  onUpdate?: () => void;
}

const STATUS_EMOJIS = [
  '🏕️', '🏠', '🚐', '⛺', '🔥', '🌲', '🌄', '🎣', 
  '🥾', '🌙', '☀️', '💤', '🍳', '📍', '🗺️', '✨'
];

export default function UserStatus({ profile, isOwnProfile, onUpdate }: UserStatusProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customStatus, setCustomStatus] = useState(profile.status || '');
  const [selectedEmoji, setSelectedEmoji] = useState(profile.statusEmoji || '🏕️');
  const [saving, setSaving] = useState(false);

  const getDisplayStatus = () => {
    if (profile.statusType === 'AUTO_CAMPING') {
      if (profile.currentCampsite) {
        return `Camping at ${profile.currentCampsite}`;
      }
      return 'Camping';
    }
    
    if (profile.statusType === 'AUTO_HOME') {
      return 'Home';
    }

    return profile.status || 'Set a status';
  };

  const getDisplayEmoji = () => {
    if (profile.statusType === 'AUTO_CAMPING') {
      return '🏕️';
    }
    if (profile.statusType === 'AUTO_HOME') {
      return '🏠';
    }
    return profile.statusEmoji || '';
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await api.put(`/profile/${profile.username}/status`, {
        status: customStatus.trim() || null,
        statusEmoji: selectedEmoji,
        statusType: 'CUSTOM',
      });
      
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Update status error:', error);
      alert('Failed to update status');
    } finally {
      setSaving(false);
    }
  };

  const handleClearStatus = async () => {
    try {
      setSaving(true);
      await api.put(`/profile/${profile.username}/status`, {
        status: null,
        statusEmoji: null,
        statusType: null,
      });
      
      setCustomStatus('');
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Clear status error:', error);
      alert('Failed to clear status');
    } finally {
      setSaving(false);
    }
  };

  const handleEnableAutoStatus = async () => {
    try {
      setSaving(true);
      await api.post(`/profile/${profile.username}/status/auto`);
      
      setIsEditing(false);
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error('Enable auto status error:', error);
      alert('Failed to enable automatic status');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {!isEditing ? (
        <>
          {/* Display Status */}
          <div className="flex items-center gap-2 bg-gray-100 px-3 py-1.5 rounded-full">
            <span className="text-lg">{getDisplayEmoji()}</span>
            <span className="text-sm font-medium text-gray-700">
              {getDisplayStatus()}
            </span>
            {profile.statusType === 'AUTO_CAMPING' && (
              <Tent className="w-3.5 h-3.5 text-primary-600" />
            )}
            {profile.statusType === 'AUTO_HOME' && (
              <Home className="w-3.5 h-3.5 text-gray-600" />
            )}
          </div>

          {isOwnProfile && (
            <button
              onClick={() => setIsEditing(true)}
              className="p-1.5 hover:bg-gray-100 rounded-full transition"
              title="Edit status"
            >
              <Edit2 className="w-4 h-4 text-gray-600" />
            </button>
          )}
        </>
      ) : (
        <>
          {/* Edit Status */}
          <div className="flex items-center gap-2 bg-white border-2 border-primary-500 px-3 py-1.5 rounded-full shadow-lg">
            {/* Emoji Selector */}
            <select
              value={selectedEmoji}
              onChange={(e) => setSelectedEmoji(e.target.value)}
              className="text-lg border-0 bg-transparent focus:ring-0 cursor-pointer p-0 pr-1"
              style={{ width: '2em' }}
            >
              {STATUS_EMOJIS.map((emoji) => (
                <option key={emoji} value={emoji}>
                  {emoji}
                </option>
              ))}
            </select>

            {/* Status Input */}
            <input
              type="text"
              value={customStatus}
              onChange={(e) => setCustomStatus(e.target.value)}
              placeholder="What are you up to?"
              className="text-sm font-medium text-gray-700 border-0 bg-transparent focus:ring-0 p-0"
              maxLength={50}
              autoFocus
              style={{ width: '200px' }}
            />

            {/* Action Buttons */}
            <button
              onClick={handleSave}
              disabled={saving}
              className="p-1 hover:bg-green-100 rounded-full transition text-green-600"
              title="Save"
            >
              <Check className="w-4 h-4" />
            </button>

            <button
              onClick={() => {
                setIsEditing(false);
                setCustomStatus(profile.status || '');
                setSelectedEmoji(profile.statusEmoji || '🏕️');
              }}
              className="p-1 hover:bg-red-100 rounded-full transition text-red-600"
              title="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Options Dropdown */}
          <div className="absolute mt-20 bg-white border border-gray-200 rounded-lg shadow-lg p-2 z-10 min-w-[200px]">
            <button
              onClick={handleEnableAutoStatus}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded flex items-center gap-2"
            >
              <Tent className="w-4 h-4 text-primary-600" />
              Enable auto-status
            </button>
            <button
              onClick={handleClearStatus}
              className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded flex items-center gap-2 text-red-600"
            >
              <X className="w-4 h-4" />
              Clear status
            </button>
            <div className="border-t border-gray-200 my-2"></div>
            <p className="px-3 py-1 text-xs text-gray-500">
              Auto-status updates when camping
            </p>
          </div>
        </>
      )}
    </div>
  );
}
