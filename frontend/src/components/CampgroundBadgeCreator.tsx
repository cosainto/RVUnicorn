import { useState, useEffect } from 'react';
import { Award, Plus, Trash2, Edit, Clock, CheckCircle, XCircle, Star, Lock, Sparkles, AlertTriangle } from 'lucide-react';
import api from '../services/api';

interface CampgroundBadge {
  id: string;
  name: string;
  description: string;
  imageUrl?: string;
  iconEmoji: string;
  backgroundColor: string;
  borderColor: string;
  badgeType: string;
  triggerValue: number;
  isLimitedEdition: boolean;
  maxIssues?: number;
  issuedCount: number;
  expiresAt?: string;
  status: string;
  rejectionReason?: string;
  _count: { awards: number };
}

interface TierInfo {
  tier: string;
  maxBadges: number;
  canLimitedEdition: boolean;
  canCustomCriteria: boolean;
  currentBadgeCount: number;
  remainingBadges: number;
}

const BADGE_TYPES = [
  { value: 'CHECK_IN', label: 'Check-In', desc: 'Auto-awarded when a camper checks in', icon: '📍' },
  { value: 'REPEAT_VISITOR', label: 'Repeat Visitor', desc: 'Awarded after X check-ins', icon: '🔁' },
  { value: 'NIGHTS_STAYED', label: 'Nights Stayed', desc: 'Awarded after X nights total', icon: '🌙' },
  { value: 'EVENT_ATTENDED', label: 'Event Attended', desc: 'Awarded for attending events', icon: '🎪' },
  { value: 'CUSTOM', label: 'Manual Award', desc: 'You award this to specific campers', icon: '🎁' },
];

const EMOJI_OPTIONS = ['🏕️', '⛺', '🔥', '🌲', '🏔️', '🌅', '🐻', '🦌', '🎣', '🚐', '⭐', '💎', '🏆', '🎯', '🌟', '🦅', '🐺', '🌊', '🌙', '🍃'];
const COLOR_OPTIONS = ['#10b981', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'];

export default function CampgroundBadgeCreator({ campgroundId }: { campgroundId: string }) {
  const [badges, setBadges] = useState<CampgroundBadge[]>([]);
  const [tierInfo, setTierInfo] = useState<TierInfo | null>(null);
  const [showCreator, setShowCreator] = useState(false);
  const [loading, setLoading] = useState(true);

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [iconEmoji, setIconEmoji] = useState('🏕️');
  const [backgroundColor, setBackgroundColor] = useState('#10b981');
  const [badgeType, setBadgeType] = useState('CHECK_IN');
  const [triggerValue, setTriggerValue] = useState(1);
  const [isLimitedEdition, setIsLimitedEdition] = useState(false);
  const [maxIssues, setMaxIssues] = useState(500);
  const [expiresAt, setExpiresAt] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { loadData(); }, [campgroundId]);

  const loadData = async () => {
    try {
      const [badgeRes, tierRes] = await Promise.all([
        api.get(`/campground-badges/${campgroundId}`),
        api.get(`/campground-badges/${campgroundId}/tier-info`),
      ]);
      setBadges(badgeRes.data.badges || []);
      setTierInfo(tierRes.data);
    } catch (e) {
      console.error('Load badges error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/campground-badges/${campgroundId}`, {
        name, description, iconEmoji, backgroundColor, borderColor: backgroundColor,
        badgeType, triggerValue,
        isLimitedEdition, maxIssues: isLimitedEdition ? maxIssues : null,
        expiresAt: isLimitedEdition ? expiresAt : null,
      });
      setShowCreator(false);
      setName(''); setDescription('');
      loadData();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create badge');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (badgeId: string) => {
    if (!confirm('Delete this badge? This cannot be undone.')) return;
    try {
      await api.delete(`/campground-badges/${campgroundId}/${badgeId}`);
      loadData();
    } catch (e) { alert('Failed to delete badge'); }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'APPROVED': return <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full"><CheckCircle className="w-3 h-3" />Live</span>;
      case 'PENDING_REVIEW': return <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending Review</span>;
      case 'REJECTED': return <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-100 px-2 py-0.5 rounded-full"><XCircle className="w-3 h-3" />Rejected</span>;
      default: return null;
    }
  };

  if (loading) return <div className="animate-pulse bg-gray-100 rounded-lg h-32" />;

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" />
              Custom Badges
            </h3>
            {tierInfo && (
              <p className="text-sm text-gray-500 mt-1">
                {tierInfo.currentBadgeCount}/{tierInfo.maxBadges} badges created
                {tierInfo.remainingBadges > 0 && <span className="text-green-600 ml-1">({tierInfo.remainingBadges} remaining)</span>}
              </p>
            )}
          </div>
          {tierInfo && tierInfo.remainingBadges > 0 && (
            <button
              onClick={() => setShowCreator(!showCreator)}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-lg text-sm font-medium hover:from-amber-400 hover:to-orange-500 transition"
            >
              <Plus className="w-4 h-4" />
              Create Badge
            </button>
          )}
        </div>
      </div>

      {/* Badge Creator Form */}
      {showCreator && (
        <div className="p-6 bg-gradient-to-br from-amber-50 to-orange-50 border-b border-amber-100">
          <h4 className="font-semibold text-gray-900 mb-4">Design Your Badge</h4>

          {/* Preview */}
          <div className="flex justify-center mb-6">
            <div className="text-center">
              <div
                className="w-20 h-20 rounded-full flex items-center justify-center text-3xl border-4 shadow-lg mx-auto"
                style={{ backgroundColor, borderColor: backgroundColor, boxShadow: `0 0 20px ${backgroundColor}40` }}
              >
                {iconEmoji}
              </div>
              <p className="mt-2 font-bold text-gray-900 text-sm">{name || 'Badge Name'}</p>
              <p className="text-xs text-gray-500">{description || 'Description'}</p>
              {isLimitedEdition && <p className="text-xs text-amber-600 font-medium mt-1">⭐ Limited Edition</p>}
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Badge Name</label>
              <input value={name} onChange={e => setName(e.target.value)} maxLength={40} placeholder="e.g. Explorer Badge"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)} maxLength={120} rows={2} placeholder="What does this badge represent?"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
            </div>

            {/* Emoji Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon</label>
              <div className="flex flex-wrap gap-2">
                {EMOJI_OPTIONS.map(e => (
                  <button key={e} onClick={() => setIconEmoji(e)}
                    className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition ${iconEmoji === e ? 'bg-amber-200 ring-2 ring-amber-400' : 'bg-white border border-gray-200 hover:bg-gray-50'}`}>
                    {e}
                  </button>
                ))}
              </div>
            </div>

            {/* Color Picker */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Color</label>
              <div className="flex flex-wrap gap-2">
                {COLOR_OPTIONS.map(c => (
                  <button key={c} onClick={() => setBackgroundColor(c)}
                    className={`w-8 h-8 rounded-full transition ${backgroundColor === c ? 'ring-2 ring-offset-2 ring-gray-400 scale-110' : 'hover:scale-110'}`}
                    style={{ backgroundColor: c }} />
                ))}
              </div>
            </div>

            {/* Badge Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Award Criteria</label>
              <div className="space-y-2">
                {BADGE_TYPES.map(bt => {
                  const disabled = bt.value !== 'CHECK_IN' && !tierInfo?.canCustomCriteria;
                  return (
                    <button key={bt.value} onClick={() => !disabled && setBadgeType(bt.value)} disabled={disabled}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border text-left transition ${
                        badgeType === bt.value ? 'border-amber-400 bg-amber-50' : disabled ? 'border-gray-100 bg-gray-50 opacity-50' : 'border-gray-200 hover:border-gray-300'
                      }`}>
                      <span className="text-xl">{bt.icon}</span>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">{bt.label}</p>
                        <p className="text-xs text-gray-500">{bt.desc}</p>
                      </div>
                      {disabled && <Lock className="w-4 h-4 text-gray-400" />}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Trigger Value (for non-CHECK_IN types) */}
            {badgeType !== 'CHECK_IN' && badgeType !== 'CUSTOM' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {badgeType === 'REPEAT_VISITOR' ? 'Number of visits required' :
                   badgeType === 'NIGHTS_STAYED' ? 'Number of nights required' :
                   'Number of events required'}
                </label>
                <input type="number" min={1} max={100} value={triggerValue} onChange={e => setTriggerValue(parseInt(e.target.value) || 1)}
                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm" />
              </div>
            )}

            {/* Limited Edition */}
            {tierInfo?.canLimitedEdition && (
              <div className="border border-amber-200 rounded-lg p-4 bg-amber-50/50">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={isLimitedEdition} onChange={e => setIsLimitedEdition(e.target.checked)}
                    className="w-4 h-4 text-amber-600 rounded" />
                  <div>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-1"><Sparkles className="w-4 h-4 text-amber-500" /> Limited Edition</p>
                    <p className="text-xs text-gray-500">Only a set number of campers can earn this badge</p>
                  </div>
                </label>

                {isLimitedEdition && (
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Max Issues (100-5,000)</label>
                      <input type="number" min={100} max={5000} step={50} value={maxIssues} onChange={e => setMaxIssues(parseInt(e.target.value) || 100)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Expires</label>
                      <input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button onClick={handleSubmit} disabled={submitting || !name.trim() || !description.trim()}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-600 text-white py-2.5 rounded-lg font-medium hover:from-amber-400 hover:to-orange-500 transition disabled:opacity-50">
                {submitting ? 'Submitting...' : 'Submit for Review'}
              </button>
              <button onClick={() => setShowCreator(false)} className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center">
              <AlertTriangle className="w-3 h-3 inline mr-1" />
              Badges are reviewed before going live. You'll be notified when approved.
            </p>
          </div>
        </div>
      )}

      {/* Existing Badges */}
      {badges.length > 0 ? (
        <div className="p-6 space-y-4">
          {badges.map(badge => (
            <div key={badge.id} className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 hover:border-gray-200 transition">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl border-3 flex-shrink-0"
                style={{ backgroundColor: badge.backgroundColor, borderColor: badge.borderColor }}>
                {badge.iconEmoji}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{badge.name}</p>
                  {getStatusBadge(badge.status)}
                  {badge.isLimitedEdition && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">⭐ Limited</span>}
                </div>
                <p className="text-sm text-gray-500 truncate">{badge.description}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                  <span>{badge._count.awards} awarded</span>
                  {badge.isLimitedEdition && badge.maxIssues && (
                    <span>{badge.maxIssues - badge.issuedCount} remaining</span>
                  )}
                  {badge.isLimitedEdition && badge.expiresAt && (
                    <span>Expires {new Date(badge.expiresAt).toLocaleDateString()}</span>
                  )}
                </div>
                {badge.status === 'REJECTED' && badge.rejectionReason && (
                  <p className="text-xs text-red-500 mt-1">Reason: {badge.rejectionReason}</p>
                )}
              </div>
              <button onClick={() => handleDelete(badge.id)} className="text-gray-300 hover:text-red-500 transition p-2">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-8 text-center">
          <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 mb-1">No custom badges yet</p>
          <p className="text-sm text-gray-400">Create a badge to reward campers who visit your campground!</p>
        </div>
      )}
    </div>
  );
}
