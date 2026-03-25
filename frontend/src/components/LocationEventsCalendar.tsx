import { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, X } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ImageUpload from './ImageUpload';

interface Props {
  locationId: string;
  locationType: 'campground' | 'host';
  canManage?: boolean;
  locationName?: string;
  eventId?: string;
  onActivityAdded?: () => void;
}

const EVENT_TAGS = ['Live Music', 'Wine Tasting', 'Beer Festival', 'Farm Market', 'Food Trucks', 'Harvest Festival', 'Holiday Event', 'Family Fun', 'Workshop', 'Tour', 'Other'];

const TAG_ICONS: Record<string, string> = {
  'Live Music': '🎶', 'Wine Tasting': '🍷', 'Beer Festival': '🍺',
  'Farm Market': '🌽', 'Food Trucks': '🚚', 'Harvest Festival': '🎃',
  'Holiday Event': '🎉', 'Family Fun': '👨‍👩‍👧', 'Workshop': '🛠️',
  'Tour': '🗺️', 'Other': '📅',
};

export default function LocationEventsCalendar({ locationId, locationType, canManage = false, locationName, eventId, onActivityAdded }: Props) {
  const { user } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [addedActivities, setAddedActivities] = useState<Set<string>>(new Set());
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleAddToSchedule = async (event: any) => {
    if (!eventId || addedActivities.has(event.id)) return;
    setAddingId(event.id);
    try {
      await api.post(`/events/${eventId}/schedule-item`, {
        title: event.title,
        description: event.description,
        scheduledDate: event.startDate ? new Date(event.startDate).toISOString().split('T')[0] : null,
        scheduledTime: event.startDate ? new Date(event.startDate).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }) : null,
        notes: event.tags?.length ? `Tags: ${event.tags.join(', ')}` : null,
      });
      setAddedActivities(prev => new Set([...prev, event.id]));
      if (onActivityAdded) onActivityAdded();
    } catch {
      alert('Failed to add to schedule');
    }
    setAddingId(null);
  };
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', startDate: '', endDate: '',
    location: '', tags: [] as string[], imageUrl: '', isRecurring: false,
  });

  const apiBase = locationType === 'host' ? `/harvest-hosts/${locationId}` : `/campground-features/${locationId}`;

  useEffect(() => { fetchEvents(); }, [locationId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`${apiBase}/events`);
      setEvents(data);
    } catch { setEvents([]); }
    finally { setLoading(false); }
  };

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  };

  const handleSubmit = async () => {
    if (!form.title || !form.startDate) return;
    setSubmitting(true);
    try {
      await api.post(`${apiBase}/events`, form);
      await fetchEvents();
      setShowForm(false);
      setForm({ title: '', description: '', startDate: '', endDate: '', location: '', tags: [], imageUrl: '', isRecurring: false });
    } catch { alert('Failed to create event'); }
    finally { setSubmitting(false); }
  };

  const handleDelete = async (eventId: string) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.delete(`${apiBase}/events/${eventId}`);
      setEvents(prev => prev.filter(e => e.id !== eventId));
    } catch { alert('Failed to delete'); }
  };

  const groupByMonth = (events: any[]) => {
    const groups: Record<string, any[]> = {};
    events.forEach(e => {
      const month = new Date(e.startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (!groups[month]) groups[month] = [];
      groups[month].push(e);
    });
    return groups;
  };

  const grouped = groupByMonth(events);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary-600" /> Upcoming Events
          </h3>
          {locationName && <p className="text-xs text-gray-400 mt-0.5">at {locationName}</p>}
        </div>
        {canManage && user && !showForm && (
          <button onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 text-white text-sm font-semibold rounded-lg hover:bg-primary-700 transition">
            <Plus className="w-4 h-4" /> Add Event
          </button>
        )}
      </div>

      {/* Add Event Form */}
      {showForm && (
        <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">New Event</p>
            <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-4 h-4" /></button>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Event Title *</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Summer Wine Tasting" className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Start Date *</label>
              <input type="datetime-local" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">End Date</label>
              <input type="datetime-local" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={2} placeholder="Tell guests what to expect..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Location / Venue</label>
            <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Main barn, tasting room, outdoor stage..." className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Event Tags</label>
            <div className="flex flex-wrap gap-2">
              {EVENT_TAGS.map(tag => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition ${form.tags.includes(tag) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {TAG_ICONS[tag]} {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Event Photo</label>
            <ImageUpload onImageUploaded={url => setForm(f => ({ ...f, imageUrl: url }))} currentImage={form.imageUrl} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.isRecurring} onChange={e => setForm(f => ({ ...f, isRecurring: e.target.checked }))} className="rounded" />
            <span className="text-sm text-gray-700">Recurring event</span>
          </label>
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={submitting || !form.title || !form.startDate}
              className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
              {submitting ? 'Saving...' : 'Save Event'}
            </button>
            <button onClick={() => setShowForm(false)} className="px-4 border border-gray-200 text-gray-600 font-semibold rounded-xl">Cancel</button>
          </div>
        </div>
      )}

      {/* Events List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400 text-sm">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-10">
          <p className="text-3xl mb-2">📅</p>
          <p className="text-sm font-medium text-gray-600 mb-1">No upcoming events</p>
          {canManage ? (
            <p className="text-xs text-gray-400">Add events like wine tastings, live music, or farm markets to attract more visitors.</p>
          ) : (
            <p className="text-xs text-gray-400">Check back soon for upcoming events!</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([month, monthEvents]) => (
            <div key={month}>
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">{month}</p>
              <div className="space-y-3">
                {monthEvents.map(event => (
                  <div key={event.id} className="flex gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 transition group">
                    {/* Date block */}
                    <div className="shrink-0 w-12 text-center">
                      <div className="bg-primary-600 text-white rounded-t-lg py-0.5 text-xs font-bold">
                        {new Date(event.startDate).toLocaleDateString('en-US', { month: 'short' })}
                      </div>
                      <div className="border border-t-0 border-gray-200 rounded-b-lg py-1 text-lg font-bold text-gray-800">
                        {new Date(event.startDate).getDate()}
                      </div>
                    </div>

                    {/* Event info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{event.title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(event.startDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            {event.endDate && ` – ${new Date(event.endDate).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`}
                            {event.location && ` · ${event.location}`}
                          </p>
                          {event.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{event.description}</p>}
                          {event.tags?.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {event.tags.map((tag: string) => (
                                <span key={tag} className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full">
                                  {TAG_ICONS[tag] || '📅'} {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {event.isRecurring && <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">🔄 Recurring</span>}
                          {eventId && (
                            <button
                              onClick={() => handleAddToSchedule(event)}
                              disabled={addingId === event.id || addedActivities.has(event.id)}
                              className={`text-xs px-2.5 py-1 rounded-full font-semibold transition ${
                                addedActivities.has(event.id)
                                  ? 'bg-green-100 text-green-700 cursor-default'
                                  : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                              }`}
                            >
                              {addedActivities.has(event.id) ? '✓ Added' : addingId === event.id ? '...' : '+ Schedule'}
                            </button>
                          )}
                          {canManage && (
                            <button onClick={() => handleDelete(event.id)}
                              className="opacity-0 group-hover:opacity-100 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Event image */}
                    {event.imageUrl && (
                      <img src={event.imageUrl} alt={event.title} className="shrink-0 w-16 h-16 rounded-lg object-cover" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
