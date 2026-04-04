import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Settings, Eye, EyeOff, Save, Shield, UserX, Activity, Users,
  Trash2, ChevronRight, Lock, Bell, Mail, Phone, Key, Check, AlertCircle, MapPin
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { usePushNotifications } from '../hooks/usePushNotifications';

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [settings, setSettings] = useState({ showCampingStatus: true });

  // Account info state
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [homeCity, setHomeCity] = useState('');
  const [homeState, setHomeState] = useState('');
  const [homeZip, setHomeZip] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [contactSaving, setContactSaving] = useState(false);
  const [contactMsg, setContactMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Password change state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMsg, setPasswordMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showPasswords, setShowPasswords] = useState(false);
  const [emailPrefs, setEmailPrefs] = useState({
    emailOnMessage: true,
    emailOnNotification: true,
    emailOnFriendRequest: true,
    emailOnTripUpdate: true,
    emailOnMention: true,
  });
  const [emailPrefsSaving, setEmailPrefsSaving] = useState(false);
  const [emailPrefsMsg, setEmailPrefsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [smsWeatherAlerts, setSmsWeatherAlerts] = useState(false);
  const [smsSaving, setSmsSaving] = useState(false);
  const [smsMsg, setSmsMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/auth/me');
      setSettings({ showCampingStatus: data.showCampingStatus !== false });
      setEmail(data.email || '');
      setPhone(data.phoneNumber || '');
      setHomeCity(data.homeCity || '');
      setHomeState(data.homeState || '');
      setHomeZip(data.homeZipCode || '');
      setEmailPrefs({
        emailOnMessage: data.emailOnMessage !== false,
        emailOnNotification: data.emailOnNotification !== false,
        emailOnFriendRequest: data.emailOnFriendRequest !== false,
        emailOnTripUpdate: data.emailOnTripUpdate !== false,
        emailOnMention: data.emailOnMention !== false,
      });
      setSmsWeatherAlerts(data.smsWeatherAlerts === true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveEmailPrefs = async () => {
    setEmailPrefsSaving(true);
    setEmailPrefsMsg(null);
    try {
      await api.put(`/profile/${user?.username}`, emailPrefs);
      setEmailPrefsMsg({ type: 'success', text: 'Email preferences saved!' });
      setTimeout(() => setEmailPrefsMsg(null), 3000);
    } catch {
      setEmailPrefsMsg({ type: 'error', text: 'Failed to save preferences' });
    } finally {
      setEmailPrefsSaving(false);
    }
  };

  const saveSmsPrefs = async () => {
    setSmsSaving(true);
    setSmsMsg(null);
    try {
      await api.put(`/profile/${user?.username}`, { smsWeatherAlerts });
      setSmsMsg({ type: 'success', text: 'SMS preferences saved!' });
      setTimeout(() => setSmsMsg(null), 3000);
    } catch {
      setSmsMsg({ type: 'error', text: 'Failed to save SMS preferences' });
    } finally {
      setSmsSaving(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await api.put(`/profile/${user?.username}`, { showCampingStatus: settings.showCampingStatus });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const saveContactInfo = async () => {
    if (!currentPassword) {
      setContactMsg({ type: 'error', text: 'Please enter your current password to confirm changes' });
      return;
    }
    if (!email) {
      setContactMsg({ type: 'error', text: 'Email cannot be empty' });
      return;
    }
    setContactSaving(true);
    setContactMsg(null);
    try {
      await api.put('/auth/update-contact', { email, phoneNumber: phone, currentPassword });
      await api.put(`/profile/${user?.username}`, { homeCity, homeState, homeZipCode: homeZip });
      setContactMsg({ type: 'success', text: 'Contact info updated successfully!' });
      setCurrentPassword('');
      if (refreshUser) refreshUser();
      setTimeout(() => setContactMsg(null), 4000);
    } catch (err: any) {
      setContactMsg({ type: 'error', text: err.response?.data?.error || 'Failed to update contact info' });
    } finally {
      setContactSaving(false);
    }
  };

  const savePassword = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'All password fields are required' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: 'error', text: 'New passwords do not match' });
      return;
    }
    if (newPassword.length < 6) {
      setPasswordMsg({ type: 'error', text: 'New password must be at least 6 characters' });
      return;
    }
    setPasswordSaving(true);
    setPasswordMsg(null);
    try {
      await api.put('/auth/change-password', { currentPassword: oldPassword, newPassword });
      setPasswordMsg({ type: 'success', text: 'Password changed successfully!' });
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => setPasswordMsg(null), 4000);
    } catch (err: any) {
      setPasswordMsg({ type: 'error', text: err.response?.data?.error || 'Failed to change password' });
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const inputClass = "w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm transition-all";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="p-3 bg-primary-100 rounded-full">
          <Settings className="w-8 h-8 text-primary-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Manage your account and privacy</p>
        </div>
      </div>

      {/* ── Account Info ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Account Information</h2>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className={inputClass + " pl-10"} placeholder="you@example.com" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Phone Number <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                className={inputClass + " pl-10"} placeholder="(555) 555-5555" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Hometown</label>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-1">
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" value={homeCity} onChange={e => setHomeCity(e.target.value)}
                    className={inputClass + " pl-10"} placeholder="City" />
                </div>
              </div>
              <div className="col-span-1">
                <input type="text" value={homeState} onChange={e => setHomeState(e.target.value)}
                  className={inputClass} placeholder="State" maxLength={2} />
              </div>
              <div className="col-span-1">
                <input type="text" value={homeZip} onChange={e => setHomeZip(e.target.value)}
                  className={inputClass} placeholder="ZIP" maxLength={10} />
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Confirm with Current Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                className={inputClass + " pl-10"} placeholder="Enter your password to save changes" />
            </div>
          </div>

          {contactMsg && (
            <div className={"flex items-center gap-2 p-3 rounded-lg text-sm font-medium " + (contactMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
              {contactMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {contactMsg.text}
            </div>
          )}

          <button onClick={saveContactInfo} disabled={contactSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50">
            {contactSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Contact Info</>}
          </button>
        </div>
      </div>

      {/* ── Change Password ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Key className="w-5 h-5 text-primary-600" />
            <h2 className="text-lg font-semibold text-gray-900">Change Password</h2>
          </div>
          <button onClick={() => setShowPasswords(!showPasswords)}
            className="text-sm text-primary-600 hover:text-primary-700 font-medium">
            {showPasswords ? 'Hide' : 'Change password'}
          </button>
        </div>

        {showPasswords && (
          <div className="p-6 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                className={inputClass} placeholder="Your current password" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                className={inputClass} placeholder="At least 6 characters" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                className={inputClass} placeholder="Repeat new password" />
            </div>

            {passwordMsg && (
              <div className={"flex items-center gap-2 p-3 rounded-lg text-sm font-medium " + (passwordMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
                {passwordMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                {passwordMsg.text}
              </div>
            )}

            <button onClick={savePassword} disabled={passwordSaving}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50">
              {passwordSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Key className="w-4 h-4" />Update Password</>}
            </button>
          </div>
        )}
      </div>

      {/* ── Campfire Companions ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-lg">{'\u{1F525}'}</span>
          <h2 className="text-lg font-semibold text-gray-900">Campfire Companions</h2>
        </div>
        <div className="px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-900">AI Companions in Chat</p>
            <p className="text-xs text-gray-500">AI characters keep the campfire warm when chat is quiet</p>
          </div>
          <button
            onClick={async () => {
              try {
                const current = (settings as any).campfireCompanionsEnabled !== false;
                await api.put('/chat/companion-settings', { enabled: !current });
                setSettings((s: any) => ({ ...s, campfireCompanionsEnabled: !current }));
              } catch {}
            }}
            className={`relative w-11 h-6 rounded-full transition-colors ${(settings as any).campfireCompanionsEnabled !== false ? 'bg-[#E8622A]' : 'bg-gray-300'}`}>
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${(settings as any).campfireCompanionsEnabled !== false ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Privacy & Security Links ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Privacy & Security</h2>
        </div>
        <nav className="divide-y divide-gray-100">
          <SettingsLink to="/settings/household" icon={<Users className="w-5 h-5 text-orange-500" />} iconBg="bg-orange-50" label="Household" desc="Link with your travel partner" />
          <SettingsLink to="/settings/privacy" icon={<Shield className="w-5 h-5 text-blue-600" />} iconBg="bg-blue-50" label="Privacy Settings" desc="Control who can see your information" />
          <SettingsLink to="/settings/blocked" icon={<UserX className="w-5 h-5 text-red-500" />} iconBg="bg-red-50" label="Blocked Users" desc="Manage users you've blocked" />
          <SettingsLink to="/settings/muted" icon={<EyeOff className="w-5 h-5 text-purple-500" />} iconBg="bg-purple-50" label="Muted & Snoozed" desc="Manage snoozed users, events, and campgrounds" />
          <SettingsLink to="/settings/activity" icon={<Activity className="w-5 h-5 text-amber-500" />} iconBg="bg-amber-50" label="Account Activity" desc="Review security events and login history" />
        </nav>
      </div>

      {/* ── Camping Status ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Camping Status</h2>
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                {settings.showCampingStatus ? <Eye className="w-5 h-5 text-green-600" /> : <EyeOff className="w-5 h-5 text-gray-400" />}
                <span className="font-medium text-gray-900">Show my camping status</span>
              </div>
              <p className="text-sm text-gray-500 mt-1 ml-7">Others can see when you're camping or have upcoming trips</p>
            </div>
            <button onClick={() => setSettings({ ...settings, showCampingStatus: !settings.showCampingStatus })}
              className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (settings.showCampingStatus ? 'bg-green-500' : 'bg-gray-300')}>
              <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (settings.showCampingStatus ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>

          <div className="flex items-center justify-between">
            {saved && <span className="text-green-600 font-medium text-sm flex items-center gap-1"><Check className="w-4 h-4" />Saved!</span>}
            <button onClick={saveSettings} disabled={saving}
              className="ml-auto flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50">
              {saving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save</>}
            </button>
          </div>
        </div>
      </div>

      {/* ── Push Notifications ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Push Notifications</h2>
          {subscribed && <span className="ml-auto text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Enabled</span>}
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">Get notified about friend requests, messages, trip updates, and campfire activity — even when the app is closed.</p>
          {permission === 'denied' ? (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
              <p className="font-semibold mb-1">Notifications blocked</p>
              <p className="text-amber-600">Click the lock icon in your browser address bar and allow notifications for this site.</p>
            </div>
          ) : subscribed ? (
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-900">Push notifications are on</p>
                <p className="text-xs text-gray-400">You'll receive alerts even when the app is closed</p>
              </div>
              <button onClick={unsubscribe} className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm hover:bg-gray-50 transition">Turn Off</button>
            </div>
          ) : (
            <button onClick={subscribe} disabled={pushLoading}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg font-medium text-sm transition">
              {pushLoading
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Enabling...</>
                : <><Bell className="w-4 h-4" />Enable Push Notifications</>}
            </button>
          )}
        </div>
      </div>

      {/* ── SMS Notifications ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <span className="text-lg">📱</span>
          <h2 className="text-lg font-semibold text-gray-900">SMS Notifications</h2>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-500">Text alerts for time-sensitive situations when you're at a campground.</p>

          {!phone && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
              ⚠️ Add a phone number in your contact info above to enable SMS alerts.
            </div>
          )}

          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Severe weather alerts</p>
              <p className="text-xs text-gray-400">Tornado warnings, flash floods, extreme storms at your campground</p>
            </div>
            <button
              onClick={() => setSmsWeatherAlerts(v => !v)}
              disabled={!phone}
              className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-40 " + (smsWeatherAlerts ? 'bg-primary-600' : 'bg-gray-200')}
            >
              <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (smsWeatherAlerts ? 'translate-x-6' : 'translate-x-1')} />
            </button>
          </div>

          {smsMsg && (
            <div className={"flex items-center gap-2 p-3 rounded-lg text-sm font-medium " + (smsMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
              {smsMsg.text}
            </div>
          )}

          <button onClick={saveSmsPrefs} disabled={smsSaving || !phone}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 mt-2">
            {smsSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save SMS Preferences</>}
          </button>
        </div>
      </div>

      {/* ── Email Notifications ── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary-600" />
          <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
        </div>
        <div className="p-6 space-y-3">
          <p className="text-sm text-gray-500 mb-4">Choose which activities send you an email notification.</p>
          {[
            { key: 'emailOnMessage', label: 'New messages', desc: 'When someone sends you a direct message' },
            { key: 'emailOnNotification', label: 'Alerts & activity', desc: 'Likes, comments, event updates' },
            { key: 'emailOnFriendRequest', label: 'Friend requests', desc: 'When someone wants to connect' },
            { key: 'emailOnMention', label: 'Mentions', desc: 'When someone tags you in a post' },
            { key: 'emailOnTripUpdate', label: 'Trip updates', desc: 'Changes to trips you are part of' },
          ].map(({ key, label, desc }) => (
            <div key={key} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400">{desc}</p>
              </div>
              <button
                onClick={() => setEmailPrefs(p => ({ ...p, [key]: !p[key as keyof typeof p] }))}
                className={"relative inline-flex h-6 w-11 items-center rounded-full transition-colors " + (emailPrefs[key as keyof typeof emailPrefs] ? 'bg-primary-600' : 'bg-gray-200')}
              >
                <span className={"inline-block h-4 w-4 transform rounded-full bg-white transition-transform " + (emailPrefs[key as keyof typeof emailPrefs] ? 'translate-x-6' : 'translate-x-1')} />
              </button>
            </div>
          ))}

          {emailPrefsMsg && (
            <div className={"flex items-center gap-2 p-3 rounded-lg text-sm font-medium " + (emailPrefsMsg.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200')}>
              {emailPrefsMsg.type === 'success' ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {emailPrefsMsg.text}
            </div>
          )}

          <button onClick={saveEmailPrefs} disabled={emailPrefsSaving}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-sm transition disabled:opacity-50 mt-2">
            {emailPrefsSaving ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />Saving...</> : <><Save className="w-4 h-4" />Save Preferences</>}
          </button>
        </div>
      </div>

      {/* ── Danger Zone ── */}
      <div className="bg-white rounded-xl shadow-sm border border-red-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-red-100 bg-red-50 flex items-center gap-2">
          <Trash2 className="w-5 h-5 text-red-600" />
          <h2 className="text-lg font-semibold text-red-800">Danger Zone</h2>
        </div>
        <Link to="/settings/delete-account" className="flex items-center justify-between p-4 hover:bg-red-50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 rounded-lg"><Trash2 className="w-5 h-5 text-red-600" /></div>
            <div>
              <p className="font-medium text-red-700">Delete Account</p>
              <p className="text-sm text-red-400">Permanently delete your account and all data</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-red-400" />
        </Link>
      </div>
    </div>
  );
}

function SettingsLink({ to, icon, iconBg, label, desc }: { to: string; icon: React.ReactNode; iconBg: string; label: string; desc: string }) {
  return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

    <Link to={to} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
      <div className="pg-dark flex items-center gap-3">
        <div className={"p-2 rounded-lg " + iconBg}>{icon}</div>
        <div>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-sm text-gray-500">{desc}</p>
        </div>
      </div>
    </>
      <ChevronRight className="w-5 h-5 text-gray-400" />
    </Link>
  );
}
