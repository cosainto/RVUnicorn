import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import api from '../services/api';

const EVENT_TYPES = [
  { val: 'RALLY', label: 'Rally', emoji: '🏆', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { val: 'MEETUP', label: 'Meetup', emoji: '👋', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { val: 'CAMPOUT', label: 'Campout', emoji: '🏕️', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { val: 'OTHER', label: 'Other', emoji: '📌', color: 'bg-gray-100 text-gray-700 border-gray-300' },
];

export default function EventCreatePage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [eventType, setEventType] = useState('RALLY');
  const [description, setDescription] = useState('');
  const [campgroundSearch, setCampgroundSearch] = useState('');
  const [campgroundResults, setCampgroundResults] = useState<any[]>([]);
  const [selectedCampground, setSelectedCampground] = useState<any>(null);
  const [locationName, setLocationName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [maxAttendees, setMaxAttendees] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const searchCampgrounds = async (q: string) => {
    setCampgroundSearch(q);
    if (q.length < 2) { setCampgroundResults([]); return; }
    try {
      const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=5`);
      setCampgroundResults(data.campgrounds || data || []);
    } catch {}
  };

  const handleSubmit = async () => {
    if (!title.trim() || !startDate || !endDate) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/events-v2', {
        title: title.trim(), eventType, description: description.trim(),
        campgroundId: selectedCampground?.id, locationName: locationName.trim() || null,
        startDate, endDate, isPublic, maxAttendees: maxAttendees ? parseInt(maxAttendees) : null,
      });
      navigate(`/events-v2/${data.event.id}/manage`);
    } catch {}
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Create Event — RVUnicorn</title></Helmet>
      <div className="max-w-lg mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Create an Event</h1>

        <div className="space-y-5">
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spring Rally at Jellystone"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Type</label>
            <div className="flex gap-2 flex-wrap">
              {EVENT_TYPES.map(t => (
                <button key={t.val} onClick={() => setEventType(t.val)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 text-sm font-semibold transition ${eventType === t.val ? t.color : 'border-gray-200 text-gray-500'}`}>
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Tell people what to expect..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none" />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Campground</label>
            {selectedCampground ? (
              <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                <span className="text-lg">🏕️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900">{selectedCampground.name}</p>
                  <p className="text-xs text-gray-500">{selectedCampground.state}</p>
                </div>
                <button onClick={() => setSelectedCampground(null)} className="text-xs text-gray-400">Change</button>
              </div>
            ) : (
              <div>
                <input value={campgroundSearch} onChange={e => searchCampgrounds(e.target.value)} placeholder="Search campgrounds..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
                {campgroundResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                    {campgroundResults.map((cg: any) => (
                      <button key={cg.id} onClick={() => { setSelectedCampground(cg); setCampgroundResults([]); setCampgroundSearch(''); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50">{cg.name} — {cg.state}</button>
                    ))}
                  </div>
                )}
                <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Or type a custom location..."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 mt-2" />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Start Date *</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">End Date *</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded border-gray-300" />
              <span className="text-sm text-gray-700">Public event</span>
            </label>
            <div className="flex-1">
              <input value={maxAttendees} onChange={e => setMaxAttendees(e.target.value)} type="number" placeholder="Max attendees (optional)"
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
          </div>

          <button onClick={handleSubmit} disabled={!title.trim() || !startDate || !endDate || submitting}
            className="w-full bg-[#E86C3A] text-white py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40 transition">
            {submitting ? 'Creating...' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
}
