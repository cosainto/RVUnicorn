import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, Pin, AlertTriangle, Upload, Send, BarChart3, Users, MessageSquare } from 'lucide-react';
import QRCode from 'react-qr-code';
import api from '../services/api';

export default function EventManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<string>('overview');
  const [loading, setLoading] = useState(true);

  // Forms
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [schedTitle, setSchedTitle] = useState('');
  const [schedStart, setSchedStart] = useState('');
  const [schedEnd, setSchedEnd] = useState('');
  const [schedLoc, setSchedLoc] = useState('');
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [blastMsg, setBlastMsg] = useState('');
  const [blastEmergency, setBlastEmergency] = useState(false);
  const [blasts, setBlasts] = useState<any[]>([]);
  const [checkins, setCheckins] = useState<any[]>([]);
  const [polls, setPolls] = useState<any[]>([]);
  const [pollQ, setPollQ] = useState('');
  const [pollOpts, setPollOpts] = useState(['', '']);
  const [faqStatus, setFaqStatus] = useState<any>(null);
  const [faqTestQ, setFaqTestQ] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);

  const load = async () => {
    try {
      const [{ data: evData }, { data: stData }] = await Promise.all([
        api.get(`/events-v2/${id}`),
        api.get(`/events-v2/${id}/organizer-stats`).catch(() => ({ data: null })),
      ]);
      setEvent(evData.event);
      setStats(stData);
      setEditTitle(evData.event.title);
      setEditDesc(evData.event.description || '');

      // Check onboarding
      const key = `rvu_org_onboarding_${id}`;
      if (!localStorage.getItem(key)) { setShowOnboarding(true); localStorage.setItem(key, 'true'); }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) load(); }, [id]);

  useEffect(() => {
    if (!id) return;
    if (tab === 'blast') api.get(`/events-v2/${id}/blasts`).then(r => setBlasts(r.data.blasts || [])).catch(() => {});
    if (tab === 'checkin') api.get(`/events-v2/${id}/checkins`).then(r => setCheckins(r.data.checkins || [])).catch(() => {});
    if (tab === 'polls') api.get(`/events-v2/${id}/polls`).then(r => setPolls(r.data.polls || [])).catch(() => {});
    if (tab === 'faq') api.get(`/events-v2/${id}`).then(r => setFaqStatus(r.data.event?.hitchFAQ || null)).catch(() => {});
  }, [tab, id]);

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse text-2xl">⚙️</div></div>;
  if (!event) return null;

  const TABS = ['overview', 'schedule', 'announcements', 'blast', 'checkin', 'polls', 'meals', 'faq', 'attendees'];

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Manage: {event.title}</title></Helmet>

      {/* Onboarding Modal */}
      {showOnboarding && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6">
            <div className="flex gap-1 justify-center mb-4">{[0,1,2,3,4].map(i => <div key={i} className={`w-2 h-2 rounded-full ${i <= onboardingStep ? 'bg-[#D4A843]' : 'bg-gray-200'}`} />)}</div>
            {onboardingStep === 0 && <div className="text-center"><div className="text-4xl mb-2">🎉</div><h2 className="text-xl font-bold mb-2">Your event is live!</h2><p className="text-sm text-gray-500 mb-4">{event.title}</p><p className="text-xs text-gray-400">Here's your quick-start checklist:</p><div className="text-left mt-3 space-y-1.5 text-sm">{[['Schedule', event.scheduleItems?.length > 0], ['Announcement', event.announcements?.length > 0], ['QR Code', !!event.qrToken], ['Hitch FAQ', !!stats?.hasHitchFAQ]].map(([label, done]) => <div key={String(label)} className="flex gap-2"><span>{done ? '✅' : '⬜'}</span><span>{String(label)}</span></div>)}</div></div>}
            {onboardingStep === 1 && <div className="text-center"><h2 className="text-lg font-bold mb-2">Share your event</h2><div className="bg-gray-50 rounded-xl p-3 text-xs font-mono text-gray-600 break-all mb-2">rvunicorn.com/events-v2/{id}</div><p className="text-xs text-gray-400">Anyone with this link can view and join</p></div>}
            {onboardingStep === 2 && <div className="text-center"><h2 className="text-lg font-bold mb-2">The Blast Button 📢</h2><p className="text-sm text-gray-500">Need to reach everyone fast? Use the Blast tab for weather, schedule changes, or urgent updates.</p></div>}
            {onboardingStep === 3 && <div className="text-center"><h2 className="text-lg font-bold mb-2">Upload your rally guide</h2><p className="text-sm text-gray-500 mb-3">Upload a PDF and Hitch will answer camper questions from it.</p><button onClick={() => { setShowOnboarding(false); setTab('faq'); }} className="text-sm text-orange-600 font-semibold">Go to FAQ tab →</button></div>}
            {onboardingStep === 4 && <div className="text-center"><h2 className="text-lg font-bold mb-2">You're ready! 🏕️</h2><p className="text-sm text-gray-500">Your dashboard is all set. Everything is in the tabs.</p></div>}
            <div className="flex justify-between mt-6">
              {onboardingStep < 4 ? <button onClick={() => setOnboardingStep(s => s + 1)} className="bg-[#D4A843] text-white px-5 py-2 rounded-xl font-semibold text-sm w-full">Next</button> : <button onClick={() => setShowOnboarding(false)} className="bg-[#1B2B4B] text-white px-5 py-2 rounded-xl font-semibold text-sm w-full">Go to Dashboard</button>}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{event.title}</h1>
            {stats && <p className="text-xs text-gray-400">{stats.totalRSVPs} RSVPs · {stats.checkedIn} checked in · {stats.activePolls} active polls</p>}
          </div>
          <button onClick={() => navigate(`/events-v2/${id}`)} className="text-sm text-gray-500 hover:text-gray-700">View as attendee →</button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${tab === t ? 'bg-[#D4A843] text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-[#D4A843]'}`}>{t === 'faq' ? 'Hitch FAQ' : t}</button>
          ))}
        </div>

        {/* Overview */}
        {tab === 'overview' && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm font-bold" />
            <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none" />
            <button onClick={async () => { await api.put(`/events-v2/${id}`, { title: editTitle, description: editDesc }); load(); }} className="bg-[#E86C3A] text-white px-4 py-2 rounded-xl text-sm font-semibold">Save</button>
          </div>
        )}

        {/* Schedule */}
        {tab === 'schedule' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <input value={schedTitle} onChange={e => setSchedTitle(e.target.value)} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input type="datetime-local" value={schedStart} onChange={e => setSchedStart(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="datetime-local" value={schedEnd} onChange={e => setSchedEnd(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <input value={schedLoc} onChange={e => setSchedLoc(e.target.value)} placeholder="Location" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={async () => { await api.post(`/events-v2/${id}/schedule`, { title: schedTitle, startTime: schedStart, endTime: schedEnd || null, location: schedLoc }); setSchedTitle(''); setSchedStart(''); setSchedEnd(''); setSchedLoc(''); load(); }} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus className="w-3 h-3 inline mr-1" />Add</button>
            </div>
            {event.scheduleItems?.map((s: any) => (
              <div key={s.id} className="bg-white rounded-xl border p-3 flex justify-between items-center">
                <div><p className="text-sm font-semibold">{s.title}</p><p className="text-xs text-gray-400">{new Date(s.startTime).toLocaleString()}{s.location ? ` · ${s.location}` : ''}</p></div>
                <button onClick={async () => { await api.delete(`/events-v2/${id}/schedule/${s.id}`); load(); }} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {/* Announcements */}
        {tab === 'announcements' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <textarea value={annBody} onChange={e => setAnnBody(e.target.value.slice(0, 500))} placeholder="Message *" rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              <p className="text-[10px] text-gray-400 text-right">{annBody.length}/500</p>
              <button onClick={async () => { await api.post(`/events-v2/${id}/announcements`, { title: annTitle, body: annBody }); setAnnTitle(''); setAnnBody(''); load(); }} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold">Post</button>
            </div>
            {event.announcements?.map((a: any) => (
              <div key={a.id} className={`bg-white rounded-xl border p-3 ${a.isPinned ? 'border-amber-300 bg-amber-50' : ''}`}>
                <div className="flex justify-between"><p className="text-sm font-semibold">{a.isPinned && '📌 '}{a.title}</p>
                <div className="flex gap-1">
                  <button onClick={async () => { await api.put(`/events-v2/${id}/announcements/${a.id}`, { isPinned: !a.isPinned }); load(); }} className={a.isPinned ? 'text-amber-500' : 'text-gray-300'}><Pin className="w-4 h-4" /></button>
                  <button onClick={async () => { await api.delete(`/events-v2/${id}/announcements/${a.id}`); load(); }} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                </div></div>
                <p className="text-xs text-gray-600 mt-1">{a.body}</p>
              </div>
            ))}
          </div>
        )}

        {/* Blast */}
        {tab === 'blast' && (
          <div className="space-y-4">
            <div className={`bg-white rounded-xl border-2 p-5 ${blastEmergency ? 'border-red-400 bg-red-50' : 'border-gray-200'}`}>
              <div className="flex gap-3 mb-3">
                <button onClick={() => setBlastEmergency(false)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${!blastEmergency ? 'bg-[#1B2B4B] text-white' : 'bg-gray-100 text-gray-500'}`}>📢 Announcement</button>
                <button onClick={() => setBlastEmergency(true)} className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${blastEmergency ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-500'}`}>⚠️ Emergency</button>
              </div>
              <textarea value={blastMsg} onChange={e => setBlastMsg(e.target.value.slice(0, 200))} placeholder="Your message..." rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none mb-1" />
              <p className="text-[10px] text-gray-400 text-right mb-3">{blastMsg.length}/200</p>
              {blastEmergency && <p className="text-xs text-red-600 mb-3">⚠️ This will alert ALL attendees including Nearby mode.</p>}
              <button onClick={async () => {
                if (blastEmergency && !confirm('Send emergency alert to ALL attendees?')) return;
                await api.post(`/events-v2/${id}/blast`, { message: blastMsg, isEmergency: blastEmergency });
                setBlastMsg(''); load();
                api.get(`/events-v2/${id}/blasts`).then(r => setBlasts(r.data.blasts || []));
              }} disabled={!blastMsg.trim()} className={`w-full py-2.5 rounded-xl font-bold text-sm transition ${blastEmergency ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-[#1B2B4B] text-white hover:bg-[#2d4a7a]'} disabled:opacity-40`}>
                <Send className="w-4 h-4 inline mr-1" />{blastEmergency ? 'Send Emergency Alert' : 'Send Blast'}
              </button>
            </div>
            {blasts.map((b: any) => (
              <div key={b.id} className={`bg-white rounded-xl border p-3 ${b.isEmergency ? 'border-red-200 bg-red-50' : ''}`}>
                <p className="text-sm">{b.isEmergency && '⚠️ '}{b.message}</p>
                <p className="text-xs text-gray-400 mt-1">{new Date(b.sentAt).toLocaleString()} · {b.recipientCount} recipients</p>
              </div>
            ))}
          </div>
        )}

        {/* Check-In */}
        {tab === 'checkin' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5 text-center">
              {event.qrToken ? (
                <div>
                  <QRCode value={`https://rvunicorn.com/checkin/${event.qrToken}`} size={200} style={{ margin: '0 auto' }} />
                  <p className="text-xs text-gray-500 mt-3">Scan to check in</p>
                  <p className="text-xs font-mono text-gray-400 mt-1 break-all">rvunicorn.com/checkin/{event.qrToken}</p>
                </div>
              ) : (
                <button onClick={async () => { await api.post(`/events-v2/${id}/generate-qr`); load(); }}
                  className="bg-[#D4A843] text-white px-6 py-3 rounded-xl font-bold">Generate Check-In QR Code</button>
              )}
            </div>
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 text-xs font-bold text-gray-500">{checkins.length} checked in</div>
              {checkins.map((c: any) => (
                <div key={c.id} className="px-4 py-2 border-t border-gray-50 flex items-center gap-3">
                  {c.user?.profilePicture ? <img src={c.user.profilePicture} className="w-7 h-7 rounded-full object-cover" alt="" /> : <div className="w-7 h-7 rounded-full bg-green-200 flex items-center justify-center text-xs font-bold text-green-700">{c.user?.firstName?.[0]}</div>}
                  <div className="flex-1"><p className="text-sm font-medium">{c.user?.firstName} {c.user?.lastName}</p></div>
                  <div className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" /><span className="text-xs text-gray-400">{new Date(c.checkedInAt).toLocaleTimeString()}</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Polls */}
        {tab === 'polls' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-4 space-y-3">
              <input value={pollQ} onChange={e => setPollQ(e.target.value)} placeholder="Question *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              {pollOpts.map((o, i) => (
                <div key={i} className="flex gap-2">
                  <input value={o} onChange={e => { const n = [...pollOpts]; n[i] = e.target.value; setPollOpts(n); }} placeholder={`Option ${i + 1}`} className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  {pollOpts.length > 2 && <button onClick={() => setPollOpts(pollOpts.filter((_, j) => j !== i))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>}
                </div>
              ))}
              {pollOpts.length < 4 && <button onClick={() => setPollOpts([...pollOpts, ''])} className="text-xs text-blue-600 font-semibold">+ Add option</button>}
              <button onClick={async () => { await api.post(`/events-v2/${id}/polls`, { question: pollQ, options: pollOpts.filter(Boolean) }); setPollQ(''); setPollOpts(['', '']); api.get(`/events-v2/${id}/polls`).then(r => setPolls(r.data.polls || [])); }} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold"><BarChart3 className="w-3 h-3 inline mr-1" />Launch Poll</button>
            </div>
            {polls.map((p: any) => (
              <div key={p.id} className={`bg-white rounded-xl border p-4 ${p.isActive ? 'border-[#D4A843]' : 'border-gray-100'}`}>
                <div className="flex justify-between mb-2"><p className="font-semibold text-sm">{p.question}</p>{p.isActive && <button onClick={async () => { await api.put(`/events-v2/${id}/polls/${p.id}/close`); api.get(`/events-v2/${id}/polls`).then(r => setPolls(r.data.polls || [])); }} className="text-xs text-red-500">Close</button>}</div>
                {p.options.map((opt: string, i: number) => {
                  const votes = p.responses?.filter((r: any) => r.optionIndex === i).length || 0;
                  const total = p.responses?.length || 1;
                  const pct = Math.round((votes / total) * 100);
                  return <div key={i} className="mb-1.5"><div className="flex justify-between text-xs mb-0.5"><span>{opt}</span><span className="font-semibold">{votes} ({pct}%)</span></div><div className="h-2 bg-[#1B2B4B]/10 rounded-full overflow-hidden"><div className="h-full bg-[#D4A843] rounded-full transition-all" style={{ width: `${pct}%` }} /></div></div>;
                })}
                <p className="text-xs text-gray-400 mt-2">{p._count?.responses || p.responses?.length || 0} responses{p.isActive ? '' : ' · Closed'}</p>
              </div>
            ))}
          </div>
        )}

        {/* Hitch FAQ */}
        {tab === 'faq' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border p-5">
              {faqStatus ? (
                <div>
                  <div className="flex items-center gap-2 mb-3"><span className="text-lg">✅</span><p className="font-semibold text-sm text-gray-900">FAQ Active: {faqStatus.fileName}</p></div>
                  <p className="text-xs text-gray-400 mb-4">Uploaded {new Date(faqStatus.uploadedAt).toLocaleDateString()}</p>
                  <button onClick={async () => { if (confirm('Delete FAQ?')) { await api.delete(`/events-v2/${id}/hitch-faq`); setFaqStatus(null); } }} className="text-xs text-red-500">Delete FAQ</button>
                </div>
              ) : (
                <div className="text-center">
                  <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 mb-3">Upload your rally welcome packet or FAQ as a PDF</p>
                  <input type="file" accept=".pdf" onChange={async (e) => {
                    const file = e.target.files?.[0]; if (!file) return;
                    const fd = new FormData(); fd.append('file', file);
                    const { data } = await api.post(`/events-v2/${id}/hitch-faq`, fd, { headers: { 'Content-Type': 'multipart/form-data' } });
                    if (data.success) setFaqStatus({ fileName: data.fileName, uploadedAt: new Date() });
                  }} className="text-sm" />
                </div>
              )}
            </div>
            {faqStatus && (
              <div className="bg-white rounded-xl border p-4">
                <p className="text-xs font-semibold text-gray-500 mb-2">Test Hitch</p>
                <div className="flex gap-2">
                  <input value={faqTestQ} onChange={e => setFaqTestQ(e.target.value)} placeholder="Ask a question..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                  <button onClick={async () => { const { data } = await api.get(`/events-v2/${id}/hitch-faq/ask?q=${encodeURIComponent(faqTestQ)}`); setFaqAnswer(data.answer || 'No answer'); }} className="bg-purple-600 text-white px-3 py-2 rounded-lg text-sm">Ask</button>
                </div>
                {faqAnswer && <div className="mt-3 bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm text-purple-800">{faqAnswer}</div>}
              </div>
            )}
          </div>
        )}

        {/* Meals */}
        {tab === 'meals' && <div className="text-center py-8 text-gray-400 text-sm">Meals are managed from the Event View meals tab.</div>}

        {/* Attendees */}
        {tab === 'attendees' && (
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="px-3 py-2 text-left">Name</th><th className="px-3 py-2">Site</th><th className="px-3 py-2">Mode</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Checked In</th></tr></thead>
              <tbody>
                {event.attendees?.map((a: any) => (
                  <tr key={a.id} className="border-t border-gray-50">
                    <td className="px-3 py-2 font-medium">{a.user?.firstName} {a.user?.lastName}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{a.siteNumber || '—'}</td>
                    <td className="px-3 py-2 text-center"><span className={`text-[10px] px-1.5 py-0.5 rounded-full ${a.participationMode === 'FULL' ? 'bg-amber-100 text-amber-800' : a.participationMode === 'CASUAL' ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-700'}`}>{a.participationMode}</span></td>
                    <td className="px-3 py-2 text-center text-gray-500 text-xs">{a.status}</td>
                    <td className="px-3 py-2 text-center">{event.eventCheckIns?.some((c: any) => c.userId === a.userId) ? <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
