import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Check } from 'lucide-react';
import api from '../services/api';

const EVENT_TYPES = [
  { val: 'RALLY', label: 'Rally', emoji: '🏆', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { val: 'MEETUP', label: 'Meetup', emoji: '👋', color: 'bg-teal-100 text-teal-800 border-teal-300' },
  { val: 'CAMPOUT', label: 'Campout', emoji: '🏕️', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  { val: 'OTHER', label: 'Other', emoji: '📌', color: 'bg-gray-100 text-gray-700 border-gray-300' },
];

const TEMPLATE_CARDS = [
  { type: 'BRAND_RALLY', icon: '🏆', name: 'Brand Rally', desc: 'Workshops, tours, sponsor spotlights. Built for manufacturers and clubs.', tags: ['Schedule-Heavy', 'Announcements', 'Hitch FAQ'] },
  { type: 'SOCIAL_HANGOUT', icon: '🔥', name: 'Social Hangout', desc: 'Community-led gatherings. Meals, campfires, good neighbors.', tags: ['Meal-Focused', 'Map View', 'Campfire'] },
  { type: 'CARAVAN', icon: '🚐', name: 'Caravan', desc: 'Multi-stop road adventure. Daily destinations with milestones.', tags: ['Route Stops', 'Check-in', 'Drive Together'] },
];

export default function EventCreatePage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [templates, setTemplates] = useState<any[]>([]);

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
  const [addSchedule, setAddSchedule] = useState(true);
  const [addAnnouncement, setAddAnnouncement] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.get('/events-v2/templates').then(({ data }) => setTemplates(data.templates || [])).catch(() => {});
  }, []);

  const selectTemplate = (t: any) => {
    setSelectedTemplate(t);
    const fields = t.defaultFields || {};
    if (fields.type === 'RALLY') setEventType('RALLY');
    else if (fields.type === 'MEETUP') setEventType('MEETUP');
    else if (fields.type === 'CAMPOUT') setEventType('CAMPOUT');
    setStep(2);
  };

  const searchCampgrounds = async (q: string) => {
    setCampgroundSearch(q);
    if (q.length < 2) { setCampgroundResults([]); return; }
    try { const { data } = await api.get(`/campgrounds?search=${encodeURIComponent(q)}&limit=5`); setCampgroundResults(data.campgrounds || data || []); } catch {}
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
      const eventId = data.event.id;

      // Add schedule items from template
      if (addSchedule && selectedTemplate?.defaultFields?.suggestedScheduleItems) {
        const start = new Date(startDate);
        for (const item of selectedTemplate.defaultFields.suggestedScheduleItems) {
          const d = new Date(start);
          d.setDate(d.getDate() + (item.offsetDays || 0));
          d.setHours(item.hour || 12, 0, 0, 0);
          await api.post(`/events-v2/${eventId}/schedule`, { title: item.title, startTime: d.toISOString() }).catch(() => {});
        }
      }

      // Add announcement
      if (addAnnouncement && selectedTemplate?.defaultFields?.suggestedAnnouncement) {
        await api.post(`/events-v2/${eventId}/announcements`, {
          title: 'Welcome!', body: selectedTemplate.defaultFields.suggestedAnnouncement, isPinned: true,
        }).catch(() => {});
      }

      navigate(`/events-v2/${eventId}/manage`);
    } catch {}
    finally { setSubmitting(false); }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Create Event — RVUnicorn</title></Helmet>
      <div className="max-w-2xl mx-auto px-4 py-8">

        {/* Step 1: Template Selection */}
        {step === 1 && (
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Create an Event</h1>
            <p className="text-sm text-gray-500 mb-6">Choose a template to get started fast</p>

            <div className="space-y-4">
              {TEMPLATE_CARDS.map(t => {
                const tpl = templates.find(tp => tp.type === t.type);
                return (
                  <button key={t.type} onClick={() => selectTemplate(tpl || { type: t.type, defaultFields: {} })}
                    className="w-full text-left bg-white rounded-2xl border-2 border-gray-200 p-5 hover:border-[#D4A843] hover:shadow-md transition group">
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{t.icon}</span>
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-900 group-hover:text-[#D4A843] transition">{t.name}</h3>
                        <p className="text-sm text-gray-500 mt-0.5">{t.desc}</p>
                        <div className="flex gap-1.5 mt-2 flex-wrap">
                          {t.tags.map(tag => <span key={tag} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>)}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <button onClick={() => { setSelectedTemplate(null); setStep(2); }} className="mt-4 text-sm text-gray-400 hover:text-gray-600 text-center w-full">Start from scratch</button>
          </div>
        )}

        {/* Step 2: Event Details */}
        {step === 2 && (
          <div>
            <button onClick={() => setStep(1)} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back to templates</button>
            <h1 className="text-xl font-bold text-gray-900 mb-6">Event Details</h1>

            <div className="space-y-5">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Event Name *</label>
                <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Spring Rally at Jellystone" className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Type</label>
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
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} placeholder="Tell people what to expect..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#D4A843]" />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Campground</label>
                {selectedCampground ? (
                  <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                    <span>🏕️</span><div className="flex-1"><p className="text-sm font-medium">{selectedCampground.name}</p></div>
                    <button onClick={() => setSelectedCampground(null)} className="text-xs text-gray-400">Change</button>
                  </div>
                ) : (
                  <div>
                    <input value={campgroundSearch} onChange={e => searchCampgrounds(e.target.value)} placeholder="Search campgrounds..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A843]" />
                    {campgroundResults.length > 0 && (
                      <div className="mt-1 bg-white border rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {campgroundResults.map((cg: any) => (
                          <button key={cg.id} onClick={() => { setSelectedCampground(cg); setCampgroundResults([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-50">{cg.name} — {cg.state}</button>
                        ))}
                      </div>
                    )}
                    <input value={locationName} onChange={e => setLocationName(e.target.value)} placeholder="Or type a custom location..." className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm mt-2 focus:outline-none focus:ring-2 focus:ring-[#D4A843]" />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">Start *</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></div>
                <div><label className="text-xs font-semibold text-gray-500 uppercase mb-1.5 block">End *</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm" /></div>
              </div>

              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={isPublic} onChange={e => setIsPublic(e.target.checked)} className="rounded" /><span className="text-sm">Public</span></label>
                <input value={maxAttendees} onChange={e => setMaxAttendees(e.target.value)} type="number" placeholder="Max attendees" className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm" />
              </div>

              {/* Quick Setup from template */}
              {selectedTemplate?.defaultFields?.suggestedScheduleItems && (
                <div className="bg-[#D4A843]/10 border border-[#D4A843]/30 rounded-xl p-4 space-y-2">
                  <p className="text-xs font-bold text-[#D4A843] uppercase">Quick Setup</p>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={addSchedule} onChange={e => setAddSchedule(e.target.checked)} className="rounded" />
                    Add suggested schedule items ({selectedTemplate.defaultFields.suggestedScheduleItems.length})
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" checked={addAnnouncement} onChange={e => setAddAnnouncement(e.target.checked)} className="rounded" />
                    Post welcome announcement
                  </label>
                </div>
              )}

              <button onClick={handleSubmit} disabled={!title.trim() || !startDate || !endDate || submitting}
                className="w-full bg-[#E86C3A] text-white py-3 rounded-xl font-bold hover:bg-orange-600 disabled:opacity-40 transition">
                {submitting ? 'Creating...' : 'Create Event & Open Dashboard'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
