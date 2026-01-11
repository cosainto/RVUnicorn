import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Eye, EyeOff, Save, Shield, UserX, Activity, 
  Trash2, ChevronRight, Lock, Bell
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  
  const [settings, setSettings] = useState({
    showCampingStatus: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/me');
      setSettings({
        showCampingStatus: data.showCampingStatus !== false,
      });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put(`/profile/${user?.username}`, {
        showCampingStatus: settings.showCampingStatus,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="p-3 bg-primary-100 rounded-full">
          <Settings className="w-8 h-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and privacy</p>
        </div>
      </div>

      {/* Settings Navigation */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Lock className="w-5 h-5 text-primary-600" />
            Privacy & Security
          </h2>
        </div>
        
        <nav className="divide-y divide-gray-100">
          <Link 
            to="/settings/privacy" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Privacy Settings</p>
                <p className="text-sm text-gray-500">Control who can see your information</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          <Link 
            to="/settings/blocked" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 rounded-lg">
                <UserX className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Blocked Users</p>
                <p className="text-sm text-gray-500">Manage users you've blocked</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>

          <Link 
            to="/settings/activity" 
            className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg">
                <Activity className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900">Account Activity</p>
                <p className="text-sm text-gray-500">Review security events and login history</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-400" />
          </Link>
        </nav>
      </div>

      {/* Camping Status Section */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden mb-6">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Camping Status</h2>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  {settings.showCampingStatus ? (
                    <Eye className="w-5 h-5 text-green-600" />
                  ) : (
                    <EyeOff className="w-5 h-5 text-gray-400" />
                  )}
                  <span className="font-medium text-gray-900">Show my camping status</span>
                </div>
                <p className="text-sm text-gray-600 mt-1 ml-7">
                  When enabled, other users can see when you're camping at a campground or have upcoming trips.
                </p>
              </div>
              <button
                onClick={() => setSettings({ ...settings, showCampingStatus: !settings.showCampingStatus })}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  settings.showCampingStatus ? 'bg-green-500' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    settings.showCampingStatus ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Preview */}
            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm text-blue-800 font-medium mb-2">Preview:</p>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center">
                    <span className="text-gray-600 font-semibold">
                      {user?.firstName?.[0] || 'U'}
                    </span>
                  </div>
                  {settings.showCampingStatus && (
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[10px] font-bold whitespace-nowrap bg-green-500 text-white">
                      CAMPING
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900">{user?.firstName} {user?.lastName}</p>
                  <p className="text-sm text-gray-500">
                    {settings.showCampingStatus 
                      ? 'Others can see your camping status' 
                      : 'Your camping status is hidden'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="p-6 bg-gray-50 flex items-center justify-between">
          <div>
            {saved && (
              <span className="text-green-600 font-medium flex items-center gap-2">
                ✓ Settings saved!
              </span>
            )}
          </div>
          <button
            onClick={saveSettings}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Settings
              </>
            )}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden border border-red-200">
        <div className="p-4 border-b border-red-100 bg-red-50">
          <h2 className="text-lg font-semibold text-red-800 flex items-center gap-2">
            <Trash2 className="w-5 h-5" />
            Danger Zone
          </h2>
        </div>
        
        <Link 
          to="/settings/delete-account" 
          className="flex items-center justify-between p-4 hover:bg-red-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg">
              <Trash2 className="w-5 h-5 text-red-600" />
            </div>
            <div>
              <p className="font-medium text-red-700">Delete Account</p>
              <p className="text-sm text-red-500">Permanently delete your account and all data</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400" />
        </Link>
      </div>
    </div>
  );
}
