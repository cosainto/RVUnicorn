import { useState, useEffect } from 'react';
import { Users, Send, Check, X, LogOut, Home } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function HouseholdSettingsPage() {
  const { user } = useAuth();
  const [household, setHousehold] = useState<any>(null);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteUsername, setInviteUsername] = useState('');
  const [showRVSync, setShowRVSync] = useState(false);
  const [rvForm, setRvForm] = useState({ rvYear: '', rvModel: '', rvType: '', rvMpg: '', rvFuelType: 'gas' });
  const [syncing, setSyncing] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState('');
  const [msgType, setMsgType] = useState<'success' | 'error'>('success');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      const { data } = await api.get('/household/my');
      setHousehold(data.household);
      setPendingInvites(data.pendingInvites || []);
    } catch {}
    finally { setLoading(false); }
  };

  const showMsg = (text: string, type: 'success' | 'error' = 'success') => {
    setMsg(text); setMsgType(type);
    setTimeout(() => setMsg(''), 4000);
  };

  const openRVSync = () => {
    if (!household?.members) return;
    // Pre-fill with current user's data
    const me = household.members.find((m: any) => m.id === user?.id);
    if (me) {
      setRvForm({
        rvYear: me.rvYear ? String(me.rvYear) : '',
        rvModel: me.rvModel || '',
        rvType: me.rvType || 'CLASS_A',
        rvMpg: me.rvMpg ? String(me.rvMpg) : '',
        rvFuelType: me.rvFuelType || 'gas',
      });
    }
    setShowRVSync(true);
  };

  const syncRV = async () => {
    setSyncing(true);
    try {
      const { data } = await api.post('/household/sync-rv', rvForm);
      showMsg(data.message || 'RV synced!');
      setShowRVSync(false);
      await load();
    } catch (e: any) {
      showMsg(e?.response?.data?.error || 'Sync failed', 'error');
    } finally { setSyncing(false); }
  };

  const sendInvite = async () => {
    if (!inviteUsername.trim()) return;
    setSending(true);
    try {
      const { data } = await api.post('/household/invite', { username: inviteUsername.trim() });
      showMsg(data.message || 'Invite sent!');
      setInviteUsername('');
    } catch (e: any) {
      showMsg(e?.response?.data?.error || 'Failed to send invite', 'error');
    } finally { setSending(false); }
  };

  const acceptInvite = async (inviteId: string) => {
    try {
      const { data } = await api.post(`/household/accept/${inviteId}`);
      showMsg(data.message || 'Household linked!');
      await load();
    } catch (e: any) {
      showMsg(e?.response?.data?.error || 'Failed to accept', 'error');
    }
  };

  const declineInvite = async (inviteId: string) => {
    try {
      await api.post(`/household/decline/${inviteId}`);
      setPendingInvites(prev => prev.filter(i => i.id !== inviteId));
    } catch {}
  };

  const leaveHousehold = async () => {
    if (!confirm('Leave your household? This will unlink you from your travel partner.')) return;
    try {
      await api.delete('/household/leave');
      setHousehold(null);
      showMsg('You have left the household');
    } catch (e: any) {
      showMsg(e?.response?.data?.error || 'Failed to leave', 'error');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;

  return (
    <><style>{`.pg-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}.pg-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}.pg-dark .bg-gray-50,.pg-dark .bg-gray-100{background:#1B2E50!important}.pg-dark .bg-gray-200,.pg-dark .bg-gray-300{background:rgba(27,46,80,0.6)!important}.pg-dark .text-gray-900,.pg-dark .text-gray-800{color:#F5F0E8!important}.pg-dark .text-gray-700,.pg-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}.pg-dark .text-gray-500,.pg-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}.pg-dark .text-gray-300{color:rgba(245,240,232,0.25)!important}.pg-dark .border-gray-100,.pg-dark .border-gray-200,.pg-dark .border-gray-300{border-color:rgba(232,168,56,0.08)!important}.pg-dark .shadow-lg,.pg-dark .shadow-xl{box-shadow:0 4px 20px rgba(0,0,0,0.4)!important}.pg-dark .shadow-md,.pg-dark .shadow-sm,.pg-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}.pg-dark input,.pg-dark textarea,.pg-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}.pg-dark .btn-primary,.pg-dark .bg-primary-600,.pg-dark .bg-primary-500{background:#E8622A!important;color:white!important}.pg-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}.pg-dark .text-primary-600,.pg-dark .text-primary-700{color:#E8A838!important}.pg-dark .hover\:bg-gray-50:hover,.pg-dark .hover\:bg-gray-100:hover{background:rgba(27,46,80,0.6)!important}.pg-dark .bg-green-50,.pg-dark .bg-blue-50,.pg-dark .bg-amber-50,.pg-dark .bg-red-50,.pg-dark .bg-purple-50,.pg-dark .bg-orange-50,.pg-dark .bg-yellow-50{background:rgba(27,46,80,0.4)!important}.pg-dark .bg-primary-50,.pg-dark .bg-primary-100{background:rgba(232,168,56,0.08)!important}`}</style>

    <div className="pg-dark max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
          <Home className="w-5 h-5 text-orange-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Household</h1>
          <p className="text-sm text-gray-500">Link with your travel partner to share trips automatically</p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl text-sm font-medium ${msgType === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {msg}
        </div>
      )}

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4 mb-6">
          <p className="text-sm font-semibold text-orange-800 mb-3">🔔 Pending Household Invites</p>
          {pendingInvites.map(invite => (
            <div key={invite.id} className="flex items-center gap-3 bg-white rounded-xl p-3 border border-orange-100">
              {invite.sender?.profilePicture
                ? <img src={invite.sender.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold">{invite.sender?.firstName?.[0]}</div>
              }
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm">{invite.sender?.firstName} {invite.sender?.lastName}</p>
                <p className="text-xs text-gray-500">@{invite.sender?.username}</p>
              </div>
              <button onClick={() => acceptInvite(invite.id)} className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition">
                <Check className="w-4 h-4" /> Accept
              </button>
              <button onClick={() => declineInvite(invite.id)} className="p-2 text-gray-400 hover:text-red-500 transition">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {household ? (
        /* Household members */
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Your Household 🏕️</p>
          <div className="space-y-3">
            {household.members?.map((member: any) => (
              <div key={member.id} className="flex items-center gap-4 p-3 bg-gray-50 rounded-xl">
                <div className="relative">
                  {member.profilePicture
                    ? <img src={member.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" />
                    : <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-bold text-lg">{member.firstName?.[0]}</div>
                  }
                  {member.id === user?.id && (
                    <span className="absolute -bottom-1 -right-1 bg-primary-600 text-white text-xs px-1.5 py-0.5 rounded-full">You</span>
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-gray-900">{member.firstName} {member.lastName}</p>
                  <p className="text-xs text-gray-500">@{member.username}</p>
                  {(member.rvModel || member.rvYear) && (
                    <p className="text-xs text-primary-600 mt-0.5">🚐 {member.rvYear} {member.rvModel}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Shared RV photo */}
          {household.members?.some((m: any) => m.rvShowcase?.photos?.length > 0) && (
            <div className="mt-4 pt-4 border-t border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Your Rig</p>
              <div className="relative rounded-xl overflow-hidden">
                <img
                  src={household.members.find((m: any) => m.rvShowcase?.photos?.length > 0)?.rvShowcase.photos[0]}
                  alt="Shared RV"
                  className="w-full h-40 object-cover"
                />
                {/* Overlapping profile pics */}
                <div className="absolute bottom-3 left-3 flex -space-x-2">
                  {household.members.map((m: any) => (
                    m.profilePicture
                      ? <img key={m.id} src={m.profilePicture} alt="" className="w-9 h-9 rounded-full border-2 border-white object-cover" />
                      : <div key={m.id} className="w-9 h-9 rounded-full border-2 border-white bg-primary-500 flex items-center justify-center text-white font-bold text-sm">{m.firstName?.[0]}</div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* RV Conflict Detection */}
          {(() => {
            const members = household.members || [];
            const years = [...new Set(members.map((m: any) => m.rvYear).filter(Boolean))];
            const models = [...new Set(members.map((m: any) => m.rvModel).filter(Boolean))];
            const hasConflict = years.length > 1 || models.length > 1;
            return hasConflict ? (
              <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                <p className="text-sm font-semibold text-amber-800 mb-2">⚠️ RV Info Mismatch</p>
                <div className="space-y-2 mb-3">
                  {members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 text-sm text-amber-700">
                      <span className="font-medium">{m.firstName}:</span>
                      <span>{m.rvYear || '?'} {m.rvModel || 'No model'}</span>
                    </div>
                  ))}
                </div>
                <button onClick={openRVSync}
                  className="w-full bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold py-2 rounded-xl transition">
                  🔧 Agree on One RV & Sync Both Profiles
                </button>
              </div>
            ) : (
              <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-3">
                <p className="text-xs text-green-700 font-medium">✅ RV info matches across both profiles</p>
                <button onClick={openRVSync} className="text-xs text-green-600 hover:text-green-800 mt-1 underline">
                  Update shared RV info
                </button>
              </div>
            );
          })()}

          {/* RV Sync Modal */}
          {showRVSync && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-1">Agree on Your Rig</h3>
                <p className="text-sm text-gray-500 mb-4">This will update both profiles with the same RV info.</p>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Year</label>
                      <input type="number" placeholder="2022" value={rvForm.rvYear}
                        onChange={e => setRvForm(f => ({...f, rvYear: e.target.value}))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Type</label>
                      <select value={rvForm.rvType} onChange={e => setRvForm(f => ({...f, rvType: e.target.value}))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                        <option value="CLASS_A">Class A</option>
                        <option value="CLASS_B">Class B</option>
                        <option value="CLASS_C">Class C</option>
                        <option value="FIFTH_WHEEL">Fifth Wheel</option>
                        <option value="TRAVEL_TRAILER">Travel Trailer</option>
                        <option value="POP_UP">Pop-Up</option>
                        <option value="TRUCK_CAMPER">Truck Camper</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600 mb-1 block">Make & Model</label>
                    <input type="text" placeholder="Coachman Pursuit 31bh" value={rvForm.rvModel}
                      onChange={e => setRvForm(f => ({...f, rvModel: e.target.value}))}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">Fuel</label>
                      <select value={rvForm.rvFuelType} onChange={e => setRvForm(f => ({...f, rvFuelType: e.target.value}))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm">
                        <option value="gas">Gas</option>
                        <option value="diesel">Diesel</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-600 mb-1 block">MPG</label>
                      <input type="number" placeholder="8" value={rvForm.rvMpg}
                        onChange={e => setRvForm(f => ({...f, rvMpg: e.target.value}))}
                        className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm" />
                    </div>
                  </div>
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => setShowRVSync(false)}
                    className="flex-1 py-2.5 border border-gray-300 rounded-xl text-gray-700 font-medium hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={syncRV} disabled={syncing}
                    className="flex-1 py-2.5 bg-primary-600 text-white rounded-xl font-semibold hover:bg-primary-700 disabled:opacity-50">
                    {syncing ? 'Syncing...' : '🔧 Sync Both Profiles'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <button onClick={leaveHousehold} className="mt-4 flex items-center gap-2 text-sm text-red-500 hover:text-red-700 transition">
            <LogOut className="w-4 h-4" /> Leave Household
          </button>
        </div>
      ) : (
        /* Invite form */
        <div className="bg-white rounded-2xl border border-gray-200 p-6">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-1">Invite a Travel Partner</p>
          <p className="text-sm text-gray-500 mb-4">Link with your partner or spouse to automatically share trips and show your combined RV profile.</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={inviteUsername}
              onChange={e => setInviteUsername(e.target.value)}
              placeholder="Enter their @username"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              className="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button onClick={sendInvite} disabled={sending || !inviteUsername.trim()}
              className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
              {sending ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              Invite
            </button>
          </div>
          <div className="mt-4 bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
            <p className="font-semibold mb-1">✨ What linking does:</p>
            <ul className="space-y-1">
              <li>• Future trips auto-added for both of you</li>
              <li>• Shared RV photo with both profile pics on trip pages</li>
              <li>• You appear as travel partners on your profiles</li>
            </ul>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
