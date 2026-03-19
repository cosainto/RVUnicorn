import { useState, useEffect } from 'react';
import { Plus, Trash2, Check, X, Save, ChevronDown, ChevronUp, BarChart2, Tag, Eye, ThumbsUp, ThumbsDown } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const WILL_ID = 'cmlpeyk82005s3qause3sws7y';

const STATUS_COLORS: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-blue-100 text-blue-700',
  active: 'bg-green-100 text-green-700',
  expired: 'bg-red-100 text-red-600',
  rejected: 'bg-red-100 text-red-600',
};

const EMPTY_CAMPAIGN = {
  internalName: '', brandName: '', brandLogoUrl: '', brandLandingUrl: '',
  packageType: 'weekly', startDate: '', endDate: '',
  maxImpressions: '', maxRewardGrants: '', selectionWeight: '1',
  exclusivityType: '', internalNotes: '',
};

const EMPTY_QUESTION = {
  question: '', optionA: '', optionB: '', optionC: '', optionD: '',
  answer: 'A', rewardType: 'points', rewardValue: '', priority: '1', internalNotes: '',
};

export default function AdminSponsorCampaignsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCampaignForm, setShowCampaignForm] = useState(false);
  const [campaignForm, setCampaignForm] = useState<any>(EMPTY_CAMPAIGN);
  const [editCampaignId, setEditCampaignId] = useState<string | null>(null);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [campaignQuestions, setCampaignQuestions] = useState<Record<string, any[]>>({});
  const [campaignAnalytics, setCampaignAnalytics] = useState<Record<string, any>>({});
  const [campaignCodes, setCampaignCodes] = useState<Record<string, any>>({});
  const [showQForm, setShowQForm] = useState<string | null>(null);
  const [qForm, setQForm] = useState<any>(EMPTY_QUESTION);
  const [codesInput, setCodesInput] = useState('');
  const [showCodesInput, setShowCodesInput] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<Record<string, 'questions' | 'analytics' | 'codes'>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (!user || user.id !== WILL_ID) { navigate('/basecamp'); return; }
    fetchCampaigns();
  }, [user]);

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sponsor-campaigns');
      setCampaigns(data.campaigns || []);
    } catch { setMsg({ type: 'error', text: 'Failed to load campaigns' }); }
    finally { setLoading(false); }
  };

  const fetchCampaignDetails = async (id: string) => {
    const [qRes, aRes, cRes] = await Promise.all([
      api.get(`/sponsor-campaigns/${id}/questions`),
      api.get(`/sponsor-campaigns/${id}/analytics`),
      api.get(`/sponsor-campaigns/${id}/codes`),
    ]);
    setCampaignQuestions(p => ({ ...p, [id]: qRes.data.questions || [] }));
    setCampaignAnalytics(p => ({ ...p, [id]: aRes.data }));
    setCampaignCodes(p => ({ ...p, [id]: cRes.data }));
  };

  const toggleExpand = (id: string) => {
    if (expandedCampaign === id) { setExpandedCampaign(null); return; }
    setExpandedCampaign(id);
    setActiveView(p => ({ ...p, [id]: 'questions' }));
    fetchCampaignDetails(id);
  };

  const saveCampaign = async () => {
    if (!campaignForm.internalName || !campaignForm.brandName) {
      setMsg({ type: 'error', text: 'Internal name and brand name required' }); return;
    }
    setSaving(true);
    try {
      if (editCampaignId) {
        await api.put(`/sponsor-campaigns/${editCampaignId}`, campaignForm);
        setMsg({ type: 'success', text: 'Campaign updated!' });
      } else {
        await api.post('/sponsor-campaigns', campaignForm);
        setMsg({ type: 'success', text: 'Campaign created!' });
      }
      setShowCampaignForm(false);
      setCampaignForm(EMPTY_CAMPAIGN);
      setEditCampaignId(null);
      fetchCampaigns();
    } catch { setMsg({ type: 'error', text: 'Failed to save' }); }
    finally { setSaving(false); }
  };

  const updateCampaignStatus = async (id: string, updates: any) => {
    try {
      await api.put(`/sponsor-campaigns/${id}`, updates);
      fetchCampaigns();
      if (expandedCampaign === id) fetchCampaignDetails(id);
    } catch { setMsg({ type: 'error', text: 'Failed to update' }); }
  };

  const saveQuestion = async (campaignId: string) => {
    if (!qForm.question || !qForm.optionA || !qForm.optionB || !qForm.optionC || !qForm.optionD) {
      setMsg({ type: 'error', text: 'Fill all question fields' }); return;
    }
    setSaving(true);
    try {
      await api.post(`/sponsor-campaigns/${campaignId}/questions`, qForm);
      setMsg({ type: 'success', text: 'Question added!' });
      setShowQForm(null);
      setQForm(EMPTY_QUESTION);
      fetchCampaignDetails(campaignId);
    } catch { setMsg({ type: 'error', text: 'Failed to add question' }); }
    finally { setSaving(false); }
  };

  const approveQuestion = async (qId: string, campaignId: string) => {
    try {
      await api.post(`/sponsor-campaigns/questions/${qId}/approve`);
      fetchCampaignDetails(campaignId);
    } catch {}
  };

  const rejectQuestion = async (qId: string, campaignId: string) => {
    try {
      await api.post(`/sponsor-campaigns/questions/${qId}/reject`);
      fetchCampaignDetails(campaignId);
    } catch {}
  };

  const uploadCodes = async (campaignId: string) => {
    const codes = codesInput.split(/[\n,]/).map(c => c.trim()).filter(Boolean);
    if (!codes.length) return;
    try {
      const { data } = await api.post(`/sponsor-campaigns/${campaignId}/codes`, { codes });
      setMsg({ type: 'success', text: `Uploaded ${data.created} codes!` });
      setCodesInput('');
      setShowCodesInput(null);
      fetchCampaignDetails(campaignId);
    } catch { setMsg({ type: 'error', text: 'Failed to upload codes' }); }
  };

  const deleteCampaign = async (id: string) => {
    if (!confirm('Delete this campaign and all its data?')) return;
    try {
      await api.delete(`/sponsor-campaigns/${id}`);
      fetchCampaigns();
    } catch { setMsg({ type: 'error', text: 'Failed to delete' }); }
  };

  const cf = (k: string, v: any) => setCampaignForm((p: any) => ({ ...p, [k]: v }));
  const qf = (k: string, v: any) => setQForm((p: any) => ({ ...p, [k]: v }));

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🎁 Sponsor Campaigns</h1>
          <p className="text-sm text-gray-500 mt-1">Manage brand sponsorships for Campfire Trivia Bonus Rounds</p>
        </div>
        <div className="flex gap-2">
          <Link to="/admin/campgrounds" className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">← Admin</Link>
          <button onClick={() => { setShowCampaignForm(true); setCampaignForm(EMPTY_CAMPAIGN); setEditCampaignId(null); }}
            className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition font-semibold text-sm">
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-medium ${msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {msg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto"><X className="w-3 h-3" /></button>
        </div>
      )}

      {/* Campaign Form */}
      {showCampaignForm && (
        <div className="bg-white rounded-2xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="font-bold text-gray-800 mb-4">{editCampaignId ? 'Edit Campaign' : 'New Campaign'}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Internal Name *</label>
              <input value={campaignForm.internalName} onChange={e => cf('internalName', e.target.value)} placeholder="KOA Summer 2025" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Brand Name *</label>
              <input value={campaignForm.brandName} onChange={e => cf('brandName', e.target.value)} placeholder="KOA Campgrounds" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Brand Logo URL</label>
              <input value={campaignForm.brandLogoUrl} onChange={e => cf('brandLogoUrl', e.target.value)} placeholder="https://..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Brand Landing URL</label>
              <input value={campaignForm.brandLandingUrl} onChange={e => cf('brandLandingUrl', e.target.value)} placeholder="https://..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Package Type</label>
              <select value={campaignForm.packageType} onChange={e => cf('packageType', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom</option>
              </select></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Selection Weight</label>
              <input type="number" min="1" max="10" value={campaignForm.selectionWeight} onChange={e => cf('selectionWeight', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Start Date</label>
              <input type="date" value={campaignForm.startDate} onChange={e => cf('startDate', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">End Date</label>
              <input type="date" value={campaignForm.endDate} onChange={e => cf('endDate', e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Max Impressions</label>
              <input type="number" value={campaignForm.maxImpressions} onChange={e => cf('maxImpressions', e.target.value)} placeholder="Leave blank for unlimited" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
            <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Max Reward Grants</label>
              <input type="number" value={campaignForm.maxRewardGrants} onChange={e => cf('maxRewardGrants', e.target.value)} placeholder="Leave blank for unlimited" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" /></div>
          </div>
          <div className="mb-4"><label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Internal Notes</label>
            <textarea value={campaignForm.internalNotes} onChange={e => cf('internalNotes', e.target.value)} rows={2} placeholder="Notes for internal use only..." className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" /></div>
          <div className="flex gap-3">
            <button onClick={saveCampaign} disabled={saving} className="flex items-center gap-2 px-5 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 disabled:opacity-50 transition font-semibold text-sm">
              <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save Campaign'}
            </button>
            <button onClick={() => { setShowCampaignForm(false); setCampaignForm(EMPTY_CAMPAIGN); setEditCampaignId(null); }} className="px-5 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Cancel</button>
          </div>
        </div>
      )}

      {/* Campaigns List */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-2xl animate-pulse" />)}</div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">🎁</div>
          <p className="font-semibold text-gray-600">No campaigns yet</p>
          <p className="text-sm mt-1">Create your first sponsor campaign above</p>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map(c => (
            <div key={c.id} className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
              {/* Campaign header */}
              <div className="p-4 flex items-center gap-4">
                {c.brandLogoUrl && <img src={c.brandLogoUrl} className="w-10 h-10 rounded-xl object-contain border border-gray-100" alt="" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-800">{c.brandName}</span>
                    <span className="text-gray-400 text-xs">·</span>
                    <span className="text-sm text-gray-500">{c.internalName}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[c.status] || 'bg-gray-100 text-gray-500'}`}>{c.status}</span>
                    {c.isActive && <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 text-green-700">🟢 Live</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                    <span>{c.packageType}</span>
                    {c.startDate && <span>{new Date(c.startDate).toLocaleDateString()} – {c.endDate ? new Date(c.endDate).toLocaleDateString() : '∞'}</span>}
                    <span>{c._count?.impressions || 0} impressions</span>
                    <span>{c._count?.answers || 0} answers</span>
                    <span>{c._count?.rewardGrants || 0} rewards</span>
                    <span>{c.questions?.length || 0} questions</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Status actions */}
                  {c.status === 'draft' && <button onClick={() => updateCampaignStatus(c.id, { status: 'pending' })} className="text-xs px-3 py-1.5 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition font-medium">Submit for Review</button>}
                  {c.status === 'pending' && <><button onClick={() => updateCampaignStatus(c.id, { status: 'approved' })} className="text-xs px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition font-medium flex items-center gap-1"><ThumbsUp className="w-3 h-3" /> Approve</button>
                    <button onClick={() => updateCampaignStatus(c.id, { status: 'rejected' })} className="text-xs px-3 py-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition font-medium flex items-center gap-1"><ThumbsDown className="w-3 h-3" /> Reject</button></>}
                  {c.status === 'approved' && <button onClick={() => updateCampaignStatus(c.id, { status: 'active', isActive: true })} className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition font-medium">▶ Activate</button>}
                  {c.isActive && <button onClick={() => updateCampaignStatus(c.id, { isActive: false })} className="text-xs px-3 py-1.5 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition font-medium">⏸ Pause</button>}
                  <button onClick={() => toggleExpand(c.id)} className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition">
                    {expandedCampaign === c.id ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                  </button>
                  <button onClick={() => { setCampaignForm({ internalName: c.internalName, brandName: c.brandName, brandLogoUrl: c.brandLogoUrl || '', brandLandingUrl: c.brandLandingUrl || '', packageType: c.packageType, startDate: c.startDate?.substring(0,10) || '', endDate: c.endDate?.substring(0,10) || '', maxImpressions: c.maxImpressions || '', maxRewardGrants: c.maxRewardGrants || '', selectionWeight: c.selectionWeight || '1', exclusivityType: c.exclusivityType || '', internalNotes: c.internalNotes || '' }); setEditCampaignId(c.id); setShowCampaignForm(true); window.scrollTo(0,0); }} className="p-2 rounded-xl bg-blue-50 hover:bg-blue-100 transition text-blue-600"><Save className="w-4 h-4" /></button>
                  <button onClick={() => deleteCampaign(c.id)} className="p-2 rounded-xl bg-red-50 hover:bg-red-100 transition text-red-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>

              {/* Expanded panel */}
              {expandedCampaign === c.id && (
                <div className="border-t border-gray-100">
                  {/* Sub-nav */}
                  <div className="flex border-b border-gray-100">
                    {(['questions','analytics','codes'] as const).map(view => (
                      <button key={view} onClick={() => setActiveView(p => ({ ...p, [c.id]: view }))}
                        className={`px-4 py-2.5 text-sm font-medium transition ${activeView[c.id] === view ? 'border-b-2 border-orange-500 text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}>
                        {view === 'questions' ? '❓ Questions' : view === 'analytics' ? '📊 Analytics' : '🎟 Codes'}
                      </button>
                    ))}
                  </div>

                  <div className="p-4">
                    {/* Questions */}
                    {activeView[c.id] === 'questions' && (
                      <div className="space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-semibold text-gray-700">Sponsored Questions</span>
                          <button onClick={() => { setShowQForm(c.id); setQForm(EMPTY_QUESTION); }} className="text-xs px-3 py-1.5 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition font-medium flex items-center gap-1"><Plus className="w-3 h-3" /> Add Question</button>
                        </div>

                        {showQForm === c.id && (
                          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                            <textarea value={qForm.question} onChange={e => qf('question', e.target.value)} placeholder="Question text..." rows={2} className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400 resize-none" />
                            <div className="grid grid-cols-2 gap-2">
                              {['A','B','C','D'].map(k => (
                                <div key={k} className="flex gap-2">
                                  <input value={qForm[`option${k}`]} onChange={e => qf(`option${k}`, e.target.value)} placeholder={`Option ${k}`} className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                                  <button onClick={() => qf('answer', k)} className={`px-2 rounded-xl text-xs font-bold ${qForm.answer === k ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>✓</button>
                                </div>
                              ))}
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <select value={qForm.rewardType} onChange={e => qf('rewardType', e.target.value)} className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400">
                                <option value="points">Bonus Points</option>
                                <option value="badge">Badge</option>
                                <option value="discount">Discount Code</option>
                              </select>
                              <input value={qForm.rewardValue} onChange={e => qf('rewardValue', e.target.value)} placeholder="Value / code" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                              <input type="number" value={qForm.priority} onChange={e => qf('priority', e.target.value)} placeholder="Priority (1-10)" className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-orange-400" />
                            </div>
                            <div className="flex gap-2">
                              <button onClick={() => saveQuestion(c.id)} disabled={saving} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 disabled:opacity-50 transition">{saving ? 'Saving…' : 'Add Question'}</button>
                              <button onClick={() => setShowQForm(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Cancel</button>
                            </div>
                          </div>
                        )}

                        {(campaignQuestions[c.id] || []).map((q: any) => (
                          <div key={q.id} className={`rounded-xl border p-3 ${q.isActive ? 'border-green-200 bg-green-50' : 'border-gray-200'}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-500'}`}>{q.status}</span>
                                  <span className="text-xs text-gray-400">Priority: {q.priority}</span>
                                  <span className="text-xs text-gray-400">Reward: {q.rewardType} {q.rewardValue ? `(${q.rewardValue})` : ''}</span>
                                </div>
                                <p className="text-sm font-medium text-gray-800 mb-1">{q.question}</p>
                                <div className="grid grid-cols-2 gap-1">
                                  {['A','B','C','D'].map(k => (
                                    <div key={k} className={`text-xs px-2 py-1 rounded-lg ${q.answer === k ? 'bg-green-200 text-green-800 font-semibold' : 'bg-white text-gray-500'}`}>{k}) {q[`option${k}`]}</div>
                                  ))}
                                </div>
                              </div>
                              <div className="flex gap-1 flex-shrink-0">
                                {q.status === 'pending' && <>
                                  <button onClick={() => approveQuestion(q.id, c.id)} className="p-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition"><Check className="w-3.5 h-3.5" /></button>
                                  <button onClick={() => rejectQuestion(q.id, c.id)} className="p-1.5 bg-red-100 text-red-600 rounded-lg hover:bg-red-200 transition"><X className="w-3.5 h-3.5" /></button>
                                </>}
                              </div>
                            </div>
                          </div>
                        ))}
                        {(campaignQuestions[c.id] || []).length === 0 && <p className="text-sm text-gray-400 text-center py-4">No questions yet — add one above</p>}
                      </div>
                    )}

                    {/* Analytics */}
                    {activeView[c.id] === 'analytics' && campaignAnalytics[c.id] && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-4 gap-3">
                          {[
                            { label: 'Impressions', value: campaignAnalytics[c.id].summary?.totalImpressions },
                            { label: 'Answer Rate', value: `${campaignAnalytics[c.id].summary?.answerRate}%` },
                            { label: 'Correct Rate', value: `${campaignAnalytics[c.id].summary?.correctRate}%` },
                            { label: 'Rewards Granted', value: campaignAnalytics[c.id].summary?.totalRewards },
                            { label: 'Unique Players', value: campaignAnalytics[c.id].summary?.uniquePlayers },
                            { label: 'Total Answers', value: campaignAnalytics[c.id].summary?.totalAnswers },
                            { label: 'Correct Answers', value: campaignAnalytics[c.id].summary?.correctAnswers },
                          ].map((stat, i) => (
                            <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                              <div className="text-xl font-bold text-gray-800">{stat.value ?? '—'}</div>
                              <div className="text-xs text-gray-500 mt-0.5">{stat.label}</div>
                            </div>
                          ))}
                        </div>
                        {campaignAnalytics[c.id].questionBreakdown?.length > 0 && (
                          <div>
                            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Per Question</div>
                            <div className="space-y-2">
                              {campaignAnalytics[c.id].questionBreakdown.map((q: any) => (
                                <div key={q.id} className="flex items-center gap-3 text-sm bg-gray-50 rounded-xl px-3 py-2">
                                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[q.status] || 'bg-gray-100 text-gray-500'}`}>{q.status}</span>
                                  <span className="flex-1 text-gray-600 truncate">{q.question}</span>
                                  <span className="text-gray-400 text-xs">{q.impressions} imp · {q.answers} ans</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Codes */}
                    {activeView[c.id] === 'codes' && (
                      <div className="space-y-3">
                        {campaignCodes[c.id] && (
                          <div className="grid grid-cols-4 gap-3 mb-3">
                            {[
                              { label: 'Total', value: campaignCodes[c.id].stats?.total },
                              { label: 'Available', value: campaignCodes[c.id].stats?.available },
                              { label: 'Assigned', value: campaignCodes[c.id].stats?.assigned },
                              { label: 'Redeemed', value: campaignCodes[c.id].stats?.redeemed },
                            ].map((s, i) => (
                              <div key={i} className="bg-gray-50 rounded-xl p-3 text-center">
                                <div className="text-xl font-bold text-gray-800">{s.value ?? 0}</div>
                                <div className="text-xs text-gray-500">{s.label}</div>
                              </div>
                            ))}
                          </div>
                        )}
                        {showCodesInput === c.id ? (
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Paste codes (one per line or comma-separated)</label>
                            <textarea value={codesInput} onChange={e => setCodesInput(e.target.value)} rows={5} placeholder="SAVE10&#10;DISC20&#10;KOA2025" className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-orange-400 resize-none" />
                            <div className="flex gap-2">
                              <button onClick={() => uploadCodes(c.id)} className="px-4 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition">Upload Codes</button>
                              <button onClick={() => setShowCodesInput(null)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => setShowCodesInput(c.id)} className="flex items-center gap-2 px-4 py-2 bg-orange-50 text-orange-600 border border-orange-200 rounded-xl text-sm font-medium hover:bg-orange-100 transition">
                            <Tag className="w-4 h-4" /> Upload Discount Codes
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
