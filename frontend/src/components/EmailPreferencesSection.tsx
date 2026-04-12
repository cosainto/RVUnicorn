import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Mail, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface EmailPrefs {
  [key: string]: any;
}

const TOGGLE_GROUPS = [
  {
    title: 'Trip Emails',
    toggles: [
      { key: 'tripConfirmation', label: 'Trip confirmation emails', desc: 'When you create or save a new trip' },
      { key: 'tripPreDeparture', label: 'Pre-departure briefings', desc: '7-day and 48-hour intel reports' },
      { key: 'tripPostReturn', label: 'Post-trip recap prompts', desc: 'Reminders to upload photos and leave reviews' },
    ],
  },
  {
    title: 'Community',
    toggles: [
      { key: 'newFollower', label: 'New follower notifications', desc: 'When someone follows you' },
      { key: 'friendTripOverlap', label: 'Friend trip overlap alerts', desc: "When a friend is heading to the same campground" },
      { key: 'communityReplies', label: 'Community replies', desc: 'Replies to your posts and threads' },
      { key: 'weeklyDigest', label: 'Weekly community digest', desc: "What's happening on RVUnicorn this week" },
    ],
  },
  {
    title: 'Memories & Scrapbook',
    toggles: [
      { key: 'scrapbookViewed', label: 'Scrapbook views', desc: 'When someone views your shared scrapbook' },
      { key: 'scrapbookComments', label: 'Scrapbook comments', desc: 'When someone comments on your scrapbook' },
      { key: 'tripAnniversary', label: 'Trip anniversary reminders', desc: 'Relive your trips on their anniversary' },
      { key: 'scrapbookExport', label: 'PDF export ready', desc: 'When your scrapbook PDF is ready to download' },
    ],
  },
  {
    title: 'Badges & Achievements',
    toggles: [
      { key: 'badgeEarned', label: 'Badge earned notifications', desc: "When you earn a new badge" },
      { key: 'badgeClose', label: '"You\'re close" nudges', desc: 'When you\'re almost at a badge milestone' },
    ],
  },
  {
    title: 'Creator',
    toggles: [
      { key: 'creatorWeeklyDigest', label: 'Weekly creator digest', desc: 'Your content performance this week' },
      { key: 'tripKitSaved', label: 'Trip Kit saves', desc: 'When someone saves your trip kit' },
      { key: 'tripKitUsed', label: 'Trip Kit uses', desc: 'When someone creates a trip from your kit' },
      { key: 'firstContentPublished', label: 'First content published', desc: 'Celebration when you publish your first piece' },
    ],
    creatorOnly: true,
  },
  {
    title: 'Activity',
    toggles: [
      { key: 'activityInvite', label: 'Activity invites', desc: 'When someone organizes an activity you saved' },
      { key: 'activityDigest', label: 'Weekly activity digest', desc: 'Activities happening at campgrounds you follow' },
    ],
  },
];

const OWNER_GROUP = {
  title: 'Campground Owner',
  toggles: [
    { key: 'ownerWeeklyDigest', label: 'Weekly campground digest', desc: 'Check-ins, followers, reviews this week' },
    { key: 'ownerNewReview', label: 'New reviews', desc: 'When a guest leaves a review' },
    { key: 'ownerNewFollower', label: 'New campground followers', desc: 'When someone follows your campground' },
    { key: 'ownerGuestArriving', label: 'Guest arriving today', desc: 'RVUnicorn members arriving at your campground' },
    { key: 'ownerLowEngagement', label: 'Engagement alerts', desc: 'Tips when your campground engagement drops' },
    { key: 'ownerPostEvent', label: 'Post-event summaries', desc: 'Recap after events at your campground' },
    { key: 'ownerBroadcastConfirm', label: 'Broadcast confirmations', desc: 'Delivery confirmation for announcements' },
    { key: 'ownerPotentialEnergy', label: 'Campground insights', desc: 'Who is looking at your campground' },
  ],
};

export default function EmailPreferencesSection() {
  const { user } = useAuth() as any;
  const [searchParams, setSearchParams] = useSearchParams();
  const [prefs, setPrefs] = useState<EmailPrefs>({});
  const [loading, setLoading] = useState(true);
  const [savedKey, setSavedKey] = useState<string | null>(null);
  const [unsubBanner, setUnsubBanner] = useState<string | null>(null);
  const [hasCampground, setHasCampground] = useState(false);

  useEffect(() => {
    loadPrefs();
    // Check if user owns a campground
    api.get('/business/my').then(r => {
      if (r.data?.length > 0) setHasCampground(true);
    }).catch(() => {});
  }, []);

  // Handle unsubscribe query params
  useEffect(() => {
    const unsub = searchParams.get('unsub');
    const token = searchParams.get('token');
    if (unsub && token) {
      if (unsub === 'all') {
        setUnsubBanner("You've been unsubscribed from all RVUnicorn emails.");
        handleToggle('allEmails', false);
      } else {
        const friendlyNames: Record<string, string> = {
          WEEKLY_DIGEST: 'weekly digest', OWNER_WEEKLY: 'campground digest',
          BADGE_EARNED: 'badge notifications', TRIP_ANNIVERSARY: 'anniversary emails',
          ACTIVITY_INVITE: 'activity invites', CREATOR_WEEKLY: 'creator digest',
        };
        setUnsubBanner(`You've been unsubscribed from ${friendlyNames[unsub] || unsub} emails.`);
      }
      // Clear query params
      searchParams.delete('unsub');
      searchParams.delete('token');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams]);

  const loadPrefs = async () => {
    try {
      const { data } = await api.get('/email-preferences');
      setPrefs(data);
    } catch {
      // Create defaults on first load
      setPrefs({ allEmails: true });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = async (key: string, value?: boolean) => {
    const newValue = value !== undefined ? value : !prefs[key];
    setPrefs(p => ({ ...p, [key]: newValue }));
    try {
      await api.patch('/email-preferences', { [key]: newValue });
      setSavedKey(key);
      setTimeout(() => setSavedKey(null), 2000);
    } catch {
      // Revert on failure
      setPrefs(p => ({ ...p, [key]: !newValue }));
    }
  };

  const Toggle = ({ field }: { field: string }) => (
    <div className="flex items-center gap-2">
      {savedKey === field && (
        <span className="text-xs text-green-600 font-medium flex items-center gap-0.5">
          <Check size={12} /> Saved
        </span>
      )}
      <button
        onClick={() => handleToggle(field)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          prefs[field] !== false ? 'bg-primary-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          prefs[field] !== false ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </div>
  );

  if (loading) {
    return <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 animate-pulse h-32" />;
  }

  const groups = user?.isCreator
    ? TOGGLE_GROUPS
    : TOGGLE_GROUPS.filter(g => !g.creatorOnly);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-2">
        <Mail className="w-5 h-5 text-primary-600" />
        <h2 className="text-lg font-semibold text-gray-900">Email Notifications</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Unsubscribe confirmation banner */}
        {unsubBanner && (
          <div className="flex items-center gap-2 p-3 rounded-lg text-sm font-medium bg-green-50 text-green-700 border border-green-200">
            <Check className="w-4 h-4 shrink-0" />
            {unsubBanner}
          </div>
        )}

        <p className="text-sm text-gray-500">Choose which emails you receive from RVUnicorn. Password resets and security alerts always get through.</p>

        {/* Toggle groups */}
        {groups.map(group => (
          <div key={group.title}>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">{group.title}</h3>
            <div className="space-y-1">
              {group.toggles.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <Toggle field={key} />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Owner section */}
        {hasCampground && (
          <div>
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">{OWNER_GROUP.title}</h3>
            <div className="space-y-1">
              {OWNER_GROUP.toggles.map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{label}</p>
                    <p className="text-xs text-gray-400">{desc}</p>
                  </div>
                  <Toggle field={key} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Frequency */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wider mb-2">Frequency</h3>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Max emails per day</p>
              <p className="text-xs text-gray-400">Limits non-transactional emails</p>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 0].map(n => (
                <button
                  key={n}
                  onClick={() => handleToggle('maxEmailsPerDay', n as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                    (prefs.maxEmailsPerDay || 2) === n
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {n === 0 ? '\u221E' : n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center justify-between py-2">
            <div>
              <p className="text-sm font-medium text-gray-900">Digest frequency</p>
              <p className="text-xs text-gray-400">How often you receive digest emails</p>
            </div>
            <div className="flex gap-1">
              {['DAILY', 'WEEKLY', 'NEVER'].map(freq => (
                <button
                  key={freq}
                  onClick={() => handleToggle('digestFrequency', freq as any)}
                  className={`px-3 py-1 text-xs font-medium rounded-lg transition ${
                    (prefs.digestFrequency || 'WEEKLY') === freq
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {freq.charAt(0) + freq.slice(1).toLowerCase()}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Global kill switch */}
        <div className="pt-4 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-900">Receive all RVUnicorn emails</p>
              <p className="text-xs text-gray-400">
                Turning this off pauses all non-transactional emails. Password resets and security alerts always get through.
              </p>
            </div>
            <button
              onClick={() => handleToggle('allEmails')}
              className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors ${
                prefs.allEmails !== false ? 'bg-primary-600' : 'bg-red-400'
              }`}
            >
              <span className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform ${
                prefs.allEmails !== false ? 'translate-x-6' : 'translate-x-1'
              }`} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
