import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle, XCircle, Eye, MapPin } from 'lucide-react';
import api from '../services/api';

const HOST_TYPE_ICONS: Record<string,string> = {
  WINERY:'🍷', BREWERY:'🍺', FARM:'🌾', DISTILLERY:'🥃', RANCH:'🐄',
  MUSEUM:'🏛️', ATTRACTION:'🎡', ORCHARD:'🍎', EVENT_VENUE:'🎪', OTHER:'🌿',
};

export default function AdminHostListingsPage() {
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('PENDING');
  const [rejectModal, setRejectModal] = useState<{id: string, name: string} | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const fetchHosts = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/hosts?status=${statusFilter}`);
      setHosts(data);
    } catch { setHosts([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchHosts(); }, [statusFilter]);

  const approve = async (id: string) => {
    await api.put(`/admin/hosts/${id}/approve`);
    fetchHosts();
  };

  const reject = async () => {
    if (!rejectModal) return;
    await api.put(`/admin/hosts/${rejectModal.id}/reject`, { reason: rejectReason });
    setRejectModal(null);
    setRejectReason('');
    fetchHosts();
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🏡 Host Listings</h1>
          <p className="text-sm text-gray-500">Review and approve RV host location submissions</p>
        </div>
        <Link to="/admin/campgrounds" className="text-sm text-gray-500 hover:text-gray-700">← Admin Home</Link>
      </div>

      {/* Status tabs */}
      <div className="flex gap-2 mb-6">
        {['PENDING', 'ACTIVE', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className={`px-4 py-2 rounded-full text-sm font-semibold transition ${statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s === 'PENDING' ? '⏳' : s === 'ACTIVE' ? '✅' : '❌'} {s}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading...</div>
      ) : hosts.length === 0 ? (
        <div className="text-center py-16 bg-gray-50 rounded-2xl">
          <p className="text-4xl mb-2">🏡</p>
          <p className="text-gray-500">No {statusFilter.toLowerCase()} listings</p>
        </div>
      ) : (
        <div className="space-y-4">
          {hosts.map(host => (
            <div key={host.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="flex gap-4 p-5">
                {host.imageUrl ? (
                  <img src={host.imageUrl} alt={host.name} className="w-24 h-24 rounded-xl object-cover shrink-0" />
                ) : (
                  <div className="w-24 h-24 rounded-xl bg-green-50 flex items-center justify-center text-4xl shrink-0">
                    {HOST_TYPE_ICONS[host.hostType] || '🌿'}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="font-bold text-gray-900">{host.name}</h3>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{host.hostType}</span>
                        {host.networkType !== 'INDEPENDENT' && (
                          <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{host.networkType}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-sm text-gray-500 mb-1">
                        <MapPin className="w-3.5 h-3.5" />
                        {[host.address, host.city, host.state].filter(Boolean).join(', ')}
                      </div>
                      {host.description && (
                        <p className="text-sm text-gray-600 line-clamp-2">{host.description}</p>
                      )}
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">{new Date(host.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap gap-3 mt-3 text-xs text-gray-500">
                    {host.maxRvLength && <span>🚐 Max {host.maxRvLength}ft</span>}
                    {host.maxRvs && <span>🅿️ {host.maxRvs} rigs</span>}
                    {host.hookups && <span>⚡ Hookups</span>}
                    {host.website && <a href={host.website} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">🌐 Website</a>}
                    <span>💬 {host.reviews?.length || 0} reviews</span>
                    {host.claimedByUserId ? <span className="text-green-600">✅ Claimed</span> : <span className="text-amber-600">⚠️ Unclaimed</span>}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 px-5 pb-4">
                <Link to={`/hosts/${host.id}`} target="_blank"
                  className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition">
                  <Eye className="w-4 h-4" /> Preview
                </Link>
                {statusFilter === 'PENDING' && (
                  <>
                    <button onClick={() => approve(host.id)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">
                      <CheckCircle className="w-4 h-4" /> Approve
                    </button>
                    <button onClick={() => setRejectModal({ id: host.id, name: host.name })}
                      className="flex items-center gap-1.5 px-4 py-2 bg-red-50 text-red-600 border border-red-200 text-sm font-semibold rounded-lg hover:bg-red-100 transition">
                      <XCircle className="w-4 h-4" /> Reject
                    </button>
                  </>
                )}
                {statusFilter === 'REJECTED' && (
                  <button onClick={() => approve(host.id)}
                    className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">
                    <CheckCircle className="w-4 h-4" /> Approve Now
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="font-bold text-gray-900 mb-2">Reject "{rejectModal.name}"</h3>
            <p className="text-sm text-gray-500 mb-3">Optionally tell the host what needs to be updated:</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)}
              placeholder="Please add more photos and a description of your location..."
              rows={3} className="w-full text-sm border border-gray-200 rounded-xl px-4 py-3 resize-none mb-4" />
            <div className="flex gap-3">
              <button onClick={reject}
                className="flex-1 py-2.5 bg-red-600 text-white font-semibold rounded-xl hover:bg-red-700 transition">
                Send Rejection
              </button>
              <button onClick={() => setRejectModal(null)}
                className="flex-1 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl hover:bg-gray-50 transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
