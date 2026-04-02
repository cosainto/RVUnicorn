import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Plus, Trash2, Pin, X } from 'lucide-react';
import api from '../services/api';

export default function EventManagePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [event, setEvent] = useState<any>(null);
  const [tab, setTab] = useState<'overview' | 'schedule' | 'announcements' | 'meals' | 'attendees'>('overview');
  const [loading, setLoading] = useState(true);

  // Form states
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [scheduleTitle, setScheduleTitle] = useState('');
  const [scheduleDesc, setScheduleDesc] = useState('');
  const [scheduleStart, setScheduleStart] = useState('');
  const [scheduleEnd, setScheduleEnd] = useState('');
  const [scheduleLocation, setScheduleLocation] = useState('');
  const [scheduleOptional, setScheduleOptional] = useState(false);
  const [annTitle, setAnnTitle] = useState('');
  const [annBody, setAnnBody] = useState('');
  const [mealTitle, setMealTitle] = useState('');
  const [mealDesc, setMealDesc] = useState('');
  const [mealTime, setMealTime] = useState('');
  const [mealLocation, setMealLocation] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get(`/events-v2/${id}`);
      setEvent(data.event);
      setEditTitle(data.event.title);
      setEditDesc(data.event.description || '');
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { if (id) load(); }, [id]);

  const saveOverview = async () => {
    await api.put(`/events-v2/${id}`, { title: editTitle, description: editDesc });
    load();
  };

  const addScheduleItem = async () => {
    if (!scheduleTitle || !scheduleStart) return;
    await api.post(`/events-v2/${id}/schedule`, {
      title: scheduleTitle, description: scheduleDesc, startTime: scheduleStart,
      endTime: scheduleEnd || null, location: scheduleLocation, isOptional: scheduleOptional,
    });
    setScheduleTitle(''); setScheduleDesc(''); setScheduleStart(''); setScheduleEnd(''); setScheduleLocation(''); setScheduleOptional(false);
    load();
  };

  const deleteScheduleItem = async (itemId: string) => {
    await api.delete(`/events-v2/${id}/schedule/${itemId}`);
    load();
  };

  const postAnnouncement = async () => {
    if (!annTitle || !annBody) return;
    await api.post(`/events-v2/${id}/announcements`, { title: annTitle, body: annBody });
    setAnnTitle(''); setAnnBody('');
    load();
  };

  const togglePin = async (annId: string, isPinned: boolean) => {
    await api.put(`/events-v2/${id}/announcements/${annId}`, { isPinned: !isPinned });
    load();
  };

  const deleteAnnouncement = async (annId: string) => {
    await api.delete(`/events-v2/${id}/announcements/${annId}`);
    load();
  };

  const createMeal = async () => {
    if (!mealTitle) return;
    await api.post(`/events-v2/${id}/meals`, {
      mealType: 'OFFICIAL', title: mealTitle, description: mealDesc,
      scheduledAt: mealTime || new Date().toISOString(), location: mealLocation,
    });
    setMealTitle(''); setMealDesc(''); setMealTime(''); setMealLocation('');
    load();
  };

  if (loading) return <div className="min-h-screen bg-gray-50 flex items-center justify-center"><div className="animate-pulse text-2xl">⚙️</div></div>;
  if (!event) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Manage: {event.title} — RVUnicorn</title></Helmet>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-gray-900">Manage Event</h1>
          <button onClick={() => navigate(`/events-v2/${id}`)} className="text-sm text-gray-500 hover:text-gray-700">← Back to event</button>
        </div>

        <div className="flex gap-1 mb-6 overflow-x-auto">
          {(['overview', 'schedule', 'announcements', 'meals', 'attendees'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition capitalize ${tab === t ? 'bg-[#1B2B4B] text-white' : 'bg-white text-gray-500 border border-gray-200'}`}>{t}</button>
          ))}
        </div>

        {tab === 'overview' && (
          <div className="bg-white rounded-xl border border-gray-100 p-5 space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Title</label>
              <input value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase mb-1 block">Description</label>
              <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} rows={4} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
            </div>
            <button onClick={saveOverview} className="bg-[#E86C3A] text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">Save Changes</button>
          </div>
        )}

        {tab === 'schedule' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-bold text-sm text-gray-900">Add Schedule Item</h3>
              <input value={scheduleTitle} onChange={e => setScheduleTitle(e.target.value)} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
              <textarea value={scheduleDesc} onChange={e => setScheduleDesc(e.target.value)} placeholder="Description" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
              <div className="grid grid-cols-2 gap-2">
                <input type="datetime-local" value={scheduleStart} onChange={e => setScheduleStart(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <input type="datetime-local" value={scheduleEnd} onChange={e => setScheduleEnd(e.target.value)} placeholder="End (optional)" className="border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <input value={scheduleLocation} onChange={e => setScheduleLocation(e.target.value)} placeholder="Location (e.g. Main Pavilion)" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={scheduleOptional} onChange={e => setScheduleOptional(e.target.checked)} /> Optional</label>
              <button onClick={addScheduleItem} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus className="w-3 h-3 inline mr-1" />Add</button>
            </div>
            {event.scheduleItems?.map((item: any) => (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-400">{new Date(item.startTime).toLocaleString()}{item.location ? ` · ${item.location}` : ''}</p>
                </div>
                <button onClick={() => deleteScheduleItem(item.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {tab === 'announcements' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-bold text-sm text-gray-900">Post Announcement</h3>
              <input value={annTitle} onChange={e => setAnnTitle(e.target.value)} placeholder="Title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <textarea value={annBody} onChange={e => setAnnBody(e.target.value)} placeholder="Message *" rows={3} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              <button onClick={postAnnouncement} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold">Post</button>
            </div>
            {event.announcements?.map((a: any) => (
              <div key={a.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-start gap-3">
                <div className="flex-1"><p className="text-sm font-semibold">{a.title}</p><p className="text-xs text-gray-500 mt-0.5">{a.body}</p></div>
                <button onClick={() => togglePin(a.id, a.isPinned)} className={a.isPinned ? 'text-amber-500' : 'text-gray-300'}><Pin className="w-4 h-4" /></button>
                <button onClick={() => deleteAnnouncement(a.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        {tab === 'meals' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
              <h3 className="font-bold text-sm text-gray-900">Create Official Meal</h3>
              <input value={mealTitle} onChange={e => setMealTitle(e.target.value)} placeholder="Meal title *" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <textarea value={mealDesc} onChange={e => setMealDesc(e.target.value)} placeholder="Description" rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none" />
              <input type="datetime-local" value={mealTime} onChange={e => setMealTime(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <input value={mealLocation} onChange={e => setMealLocation(e.target.value)} placeholder="Location" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <button onClick={createMeal} className="bg-[#1B2B4B] text-white px-4 py-2 rounded-lg text-sm font-semibold">Create Meal</button>
            </div>
          </div>
        )}

        {tab === 'attendees' && (
          <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead><tr className="bg-gray-50 text-xs text-gray-500"><th className="px-4 py-2 text-left">Name</th><th className="px-4 py-2">Site</th><th className="px-4 py-2">Mode</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Joined</th></tr></thead>
              <tbody>
                {event.attendees?.map((a: any) => (
                  <tr key={a.id} className="border-t border-gray-50">
                    <td className="px-4 py-2 font-medium">{a.user?.firstName} {a.user?.lastName}</td>
                    <td className="px-4 py-2 text-center text-gray-500">{a.siteNumber || '—'}</td>
                    <td className="px-4 py-2 text-center"><span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded-full">{a.participationMode}</span></td>
                    <td className="px-4 py-2 text-center text-gray-500">{a.status}</td>
                    <td className="px-4 py-2 text-center text-gray-400 text-xs">{new Date(a.createdAt).toLocaleDateString()}</td>
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
