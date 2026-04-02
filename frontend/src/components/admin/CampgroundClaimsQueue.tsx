import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, MapPin, Mail, Phone, Clock } from 'lucide-react';
import api from '../../services/api';

interface Claim {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  location: string | null;
  claimedAt: string | null;
  claimedById: string;
  verificationStatus: string;
  businessEmail: string | null;
  businessPhone: string | null;
  claimedBy: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    username: string | null;
  } | null;
}

type Filter = 'ALL' | 'PENDING' | 'VERIFIED' | 'UNCLAIMED';

export default function CampgroundClaimsQueue() {
  const [claims, setClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('ALL');
  const [acting, setActing] = useState<string | null>(null);

  const loadClaims = async () => {
    try {
      const { data } = await api.get('/admin/campground-claims');
      setClaims(data.claims || []);
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { loadClaims(); }, []);

  const handleAction = async (campgroundId: string, status: 'APPROVED' | 'REJECTED') => {
    setActing(campgroundId);
    try {
      await api.patch(`/admin/campground-claims/${campgroundId}`, { status });
      loadClaims();
    } catch {}
    finally { setActing(null); }
  };

  const filtered = claims.filter(c => {
    if (filter === 'ALL') return true;
    if (filter === 'PENDING') return c.verificationStatus === 'PENDING';
    if (filter === 'VERIFIED') return c.verificationStatus === 'VERIFIED';
    if (filter === 'UNCLAIMED') return c.verificationStatus === 'UNCLAIMED';
    return true;
  });

  const counts = {
    ALL: claims.length,
    PENDING: claims.filter(c => c.verificationStatus === 'PENDING').length,
    VERIFIED: claims.filter(c => c.verificationStatus === 'VERIFIED').length,
    UNCLAIMED: claims.filter(c => c.verificationStatus === 'UNCLAIMED').length,
  };

  if (loading) return <div className="flex justify-center py-8"><div className="w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-xl">
        {(['ALL', 'PENDING', 'VERIFIED', 'UNCLAIMED'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`flex-1 py-2 px-2 rounded-lg text-xs font-semibold transition ${
              filter === f ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {f === 'ALL' ? 'All' : f === 'PENDING' ? 'Pending' : f === 'VERIFIED' ? 'Approved' : 'Rejected'}
            <span className="ml-1 text-gray-400">({counts[f]})</span>
          </button>
        ))}
      </div>

      {/* Claims list */}
      {filtered.length === 0 ? (
        <div className="text-center py-8 text-gray-400 text-sm">No claims found</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(claim => {
            const isPending = claim.verificationStatus === 'PENDING';
            const isApproved = claim.verificationStatus === 'VERIFIED';
            const isRejected = claim.verificationStatus === 'UNCLAIMED' && !claim.claimedById;

            return (
              <div
                key={claim.id}
                className={`bg-white rounded-xl border p-4 transition ${
                  isPending ? 'border-amber-200' : isApproved ? 'border-green-200 opacity-60' : 'border-gray-100 opacity-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-sm text-gray-900 truncate">{claim.name}</h3>
                      <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        isPending ? 'bg-amber-100 text-amber-700' :
                        isApproved ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-600'
                      }`}>
                        {isPending ? 'PENDING' : isApproved ? 'APPROVED' : 'REJECTED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-2">
                      <MapPin className="w-3 h-3" />
                      <span>{[claim.city, claim.state].filter(Boolean).join(', ') || claim.location || 'No location'}</span>
                    </div>

                    {claim.claimedBy && (
                      <div className="bg-gray-50 rounded-lg px-3 py-2 mb-2">
                        <p className="text-xs font-semibold text-gray-700">
                          Claimed by: {claim.claimedBy.firstName} {claim.claimedBy.lastName}
                          <span className="text-gray-400 font-normal ml-1">@{claim.claimedBy.username}</span>
                        </p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-gray-400">
                          <span className="flex items-center gap-0.5"><Mail className="w-3 h-3" />{claim.claimedBy.email}</span>
                          {claim.claimedAt && (
                            <span className="flex items-center gap-0.5">
                              <Clock className="w-3 h-3" />
                              {new Date(claim.claimedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        {claim.businessEmail && (
                          <p className="text-[10px] text-gray-400 mt-1">Business: {claim.businessEmail} {claim.businessPhone && `· ${claim.businessPhone}`}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {isPending && (
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleAction(claim.id, 'APPROVED')}
                      disabled={acting === claim.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      <CheckCircle className="w-3.5 h-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => handleAction(claim.id, 'REJECTED')}
                      disabled={acting === claim.id}
                      className="flex-1 flex items-center justify-center gap-1.5 bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg text-xs font-bold transition disabled:opacity-50"
                    >
                      <XCircle className="w-3.5 h-3.5" /> Reject
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
