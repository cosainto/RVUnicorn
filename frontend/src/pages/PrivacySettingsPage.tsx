import { useState, useEffect } from 'react';
import { 
  Shield, Eye, EyeOff, Users, UserX, Lock, Globe, 
  UserPlus, MapPin, ChefHat, Backpack, Truck, Camera,
  MessageSquare, Save, Loader2, AlertTriangle, Check
} from 'lucide-react';
import api from '../services/api';

interface PrivacySettings {
  profileVisibility: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  friendRequestSetting: 'EVERYONE' | 'FRIENDS_OF_FRIENDS' | 'NONE';
  showOnlineStatus: boolean;
  showLastActive: boolean;
  allowTagging: boolean;
  allowWallPosts: boolean;
  showTravelMap: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  showRecipes: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  showGear: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
  showRVDetails: 'PUBLIC' | 'FRIENDS' | 'PRIVATE';
}

const defaultSettings: PrivacySettings = {
  profileVisibility: 'PUBLIC',
  friendRequestSetting: 'EVERYONE',
  showOnlineStatus: true,
  showLastActive: true,
  allowTagging: true,
  allowWallPosts: true,
  showTravelMap: 'FRIENDS',
  showRecipes: 'PUBLIC',
  showGear: 'FRIENDS',
  showRVDetails: 'FRIENDS'
};

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState<PrivacySettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/privacy');
      setSettings({
        profileVisibility: data.profileVisibility || 'PUBLIC',
        friendRequestSetting: data.friendRequestSetting || 'EVERYONE',
        showOnlineStatus: data.showOnlineStatus ?? true,
        showLastActive: data.showLastActive ?? true,
        allowTagging: data.allowTagging ?? true,
        allowWallPosts: data.allowWallPosts ?? true,
        showTravelMap: data.showTravelMap || 'FRIENDS',
        showRecipes: data.showRecipes || 'PUBLIC',
        showGear: data.showGear || 'FRIENDS',
        showRVDetails: data.showRVDetails || 'FRIENDS'
      });
    } catch (err) {
      console.error('Error fetching privacy settings:', err);
      setError('Failed to load privacy settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.put('/privacy', settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving privacy settings:', err);
      setError('Failed to save privacy settings');
    } finally {
      setSaving(false);
    }
  };

  const VisibilitySelect = ({ 
    value, 
    onChange, 
    label, 
    icon: Icon 
  }: { 
    value: string; 
    onChange: (val: 'PUBLIC' | 'FRIENDS' | 'PRIVATE') => void;
    label: string;
    icon: any;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5 text-gray-500" />
        <span className="text-gray-700">{label}</span>
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as 'PUBLIC' | 'FRIENDS' | 'PRIVATE')}
        className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
      >
        <option value="PUBLIC">🌍 Everyone</option>
        <option value="FRIENDS">👥 Friends Only</option>
        <option value="PRIVATE">🔒 Only Me</option>
      </select>
    </div>
  );

  const Toggle = ({ 
    checked, 
    onChange, 
    label, 
    description,
    icon: Icon 
  }: { 
    checked: boolean; 
    onChange: (val: boolean) => void;
    label: string;
    description?: string;
    icon: any;
  }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-100">
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-gray-500 mt-0.5" />
        <div>
          <span className="text-gray-700 block">{label}</span>
          {description && (
            <span className="text-gray-500 text-sm">{description}</span>
          )}
        </div>
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-amber-500' : 'bg-gray-300'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }

  return (

    <div className="max-w-2xl mx-auto p-6">
      <div className="flex items-center gap-3 mb-6">
        <Shield className="w-8 h-8 text-amber-600" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Settings</h1>
          <p className="text-gray-600">Control who can see your information</p>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center gap-3 text-red-700">
          <AlertTriangle className="w-5 h-5" />
          {error}
        </div>
      )}

      {saved && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3 text-green-700">
          <Check className="w-5 h-5" />
          Settings saved successfully!
        </div>
      )}

      {/* Profile Visibility */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5" />
          Profile Visibility
        </h2>
        
        <div className="space-y-1">
          <VisibilitySelect
            value={settings.profileVisibility}
            onChange={(val) => setSettings({ ...settings, profileVisibility: val })}
            label="Who can see my profile"
            icon={Globe}
          />
          <VisibilitySelect
            value={settings.showTravelMap}
            onChange={(val) => setSettings({ ...settings, showTravelMap: val })}
            label="Who can see my travel map"
            icon={MapPin}
          />
          <VisibilitySelect
            value={settings.showRecipes}
            onChange={(val) => setSettings({ ...settings, showRecipes: val })}
            label="Who can see my recipes"
            icon={ChefHat}
          />
          <VisibilitySelect
            value={settings.showGear}
            onChange={(val) => setSettings({ ...settings, showGear: val })}
            label="Who can see my gear"
            icon={Backpack}
          />
          <VisibilitySelect
            value={settings.showRVDetails}
            onChange={(val) => setSettings({ ...settings, showRVDetails: val })}
            label="Who can see my RV details"
            icon={Truck}
          />
        </div>
      </div>

      {/* Friend Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <UserPlus className="w-5 h-5" />
          Friend Requests
        </h2>
        
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Users className="w-5 h-5 text-gray-500" />
            <span className="text-gray-700">Who can send me friend requests</span>
          </div>
          <select
            value={settings.friendRequestSetting}
            onChange={(e) => setSettings({ 
              ...settings, 
              friendRequestSetting: e.target.value as 'EVERYONE' | 'FRIENDS_OF_FRIENDS' | 'NONE' 
            })}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          >
            <option value="EVERYONE">Everyone</option>
            <option value="FRIENDS_OF_FRIENDS">Friends of Friends</option>
            <option value="NONE">No One</option>
          </select>
        </div>
      </div>

      {/* Online Status */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <EyeOff className="w-5 h-5" />
          Online Status
        </h2>
        
        <div className="space-y-1">
          <Toggle
            checked={settings.showOnlineStatus}
            onChange={(val) => setSettings({ ...settings, showOnlineStatus: val })}
            label="Show when I'm online"
            description="Others will see a green dot when you're active"
            icon={Eye}
          />
          <Toggle
            checked={settings.showLastActive}
            onChange={(val) => setSettings({ ...settings, showLastActive: val })}
            label="Show last active time"
            description="Others will see when you were last online"
            icon={Eye}
          />
        </div>
      </div>

      {/* Interactions */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Interactions
        </h2>
        
        <div className="space-y-1">
          <Toggle
            checked={settings.allowTagging}
            onChange={(val) => setSettings({ ...settings, allowTagging: val })}
            label="Allow others to tag me in photos"
            icon={Camera}
          />
          <Toggle
            checked={settings.allowWallPosts}
            onChange={(val) => setSettings({ ...settings, allowWallPosts: val })}
            label="Allow others to post on my wall"
            icon={MessageSquare}
          />
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              Save Changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
