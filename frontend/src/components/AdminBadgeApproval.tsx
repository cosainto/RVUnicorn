import { useState, useEffect } from 'react';
import { Award, CheckCircle, XCircle, Clock, AlertTriangle, ExternalLink, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface PendingBadge {
  id: string;
  name: string;
  description: string;
  iconEmoji: string;
  backgroundColor: string;
  badgeType: string;
  triggerValue: number;
  isLimitedEdition: boolean;
  maxIssues?: number;
  expiresAt?: string;
  createdAt: string;
  campground: { id: string; name: string; state: string; tier: string; imageUrl?: string };
  createdBy: { id: string; firstName: string; lastName: string; email: string; username: string };
}

interface Stats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
  totalAwards: number;
  limitedEdition: number;
}

export default function AdminBadgeApproval() {
  const [pending, setPending] = useState<PendingBadge[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [pendingRes, statsRes] = await Promise.all([
        api.get('/campground-badges/admin/pending'),
        api.get('/campground-badges/admin/stats'),
      ]);
      setPending(pendingRes.data.pending || []);
      setStats(statsRes.data);
    } catch (e) {
      console.error('Load admin data error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (badgeId: string) => {
    try {
      await api.post(`/campground-badges/admin/${badgeId}/approve`);
      loadData();
    } catch (e) { alert('Failed to approve'); }
  };

  const handleReject = async (badgeId: string) => {
    try {
      await api.post(`/campground-badges/admin/${badgeId}/reject`, { reason: rejectReason });
      setRejectingId(null);
      setRejectReason('');
      loadData();
    } catch (e) { alert('Failed to reject'); }
  };

  const getBadgeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      CHECK_IN: '📍 Check-In', REPEAT_VISITOR: '🔁 Repeat Visitor',
      NIGHTS_STAYED: '🌙 Nights Stayed', EVENT_ATTENDED: '🎪 Event',
      CUSTOM: '🎁 Manual',
    };
    return labels[type] || type;
  };

  if (loading) return <div className="p-8 text-center text-gray-400">Loading...</div>;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3 mb-6">
        <Award className="w-7 h-7 text-amber-500" />
        Badge Approval Dashboard
      </h1>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
          {[
            { label: 'Total', value: stats.total, color: 'bg-gray-100 text-gray-700' },
            { label: 'Pending', value: stats.pending, color: 'bg-amber-100 text-amber-700' },
            { label: 'Approved', value: stats.approved, color: 'bg-green-100 text-green-700' },
            { label: 'Rejected', value: stats.rejected, color: 'bg-red-100 text-red-700' },
            { label: 'Awards Given', value: stats.totalAwards, color: 'bg-blue-100 text-blue-700' },
            { label: 'Limited Ed.', value: stats.limitedEdition, color: 'bg-purple-100 text-purple-700' },
          ].map(s => (
            <div key={s.label} className={`${s.color} rounded-xl p-3 text-center`}>
              <p className="text-2xl font-bold">{s.value}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pending Queue */}
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-500" />
        Pending Review ({pending.length})
      </h2>

      {pending.length === 0 ? (
        <div className="bg-green-50 border border-green-200 rounded-xl p-8 text-center">
          <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
          <p className="text-green-700 font-medium">All caught up! No badges pending review.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pending.map(badge => (
            <div key={badge.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Badge Preview */}
                  <div className="w-16 h-16 rounded-full flex items-center justify-center text-3xl border-4 flex-shrink-0 shadow-lg"
                    style={{ backgroundColor: badge.backgroundColor, borderColor: badge.backgroundColor }}>
                    {badge.iconEmoji}
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-gray-900">{badge.name}</h3>
                      {badge.isLimitedEdition && <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full font-medium">⭐ Limited ({badge.maxIssues})</span>}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{badge.description}</p>
                    <div className="flex flex-wrap gap-2 text-xs">
                      <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{getBadgeTypeLabel(badge.badgeType)}</span>
                      {badge.triggerValue > 1 && <span className="bg-blue-100 text-blue-600 px-2 py-1 rounded-full">Requires: {badge.triggerValue}</span>}
                      <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded-full">Tier: {badge.campground.tier}</span>
                    </div>

                    {/* Campground & Creator Info */}
                    <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                      <Link to={`/campgrounds/${badge.campground.id}`} className="hover:text-blue-600 flex items-center gap-1">
                        <ExternalLink className="w-3 h-3" /> {badge.campground.name}, {badge.campground.state}
                      </Link>
                      <span>•</span>
                      <Link to={`/profile/${badge.createdBy.username}`} className="hover:text-blue-600">
                        by {badge.createdBy.firstName} {badge.createdBy.lastName}
                      </Link>
                      <span>•</span>
                      <span>{new Date(badge.createdAt).toLocaleDateString()}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="bg-gray-50 px-5 py-3 flex items-center gap-3">
                <button onClick={() => handleApprove(badge.id)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition">
                  <CheckCircle className="w-4 h-4" /> Approve
                </button>
                {rejectingId === badge.id ? (
                  <div className="flex items-center gap-2 flex-1">
                    <input value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Rejection reason..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm" autoFocus />
                    <button onClick={() => handleReject(badge.id)}
                      className="px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">Reject</button>
                    <button onClick={() => setRejectingId(null)} className="px-3 py-2 text-gray-500 text-sm hover:text-gray-700">Cancel</button>
                  </div>
                ) : (
                  <button onClick={() => setRejectingId(badge.id)}
                    className="flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 hover:bg-red-50 rounded-lg text-sm font-medium transition">
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
