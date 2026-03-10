import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../services/api';
import {
  Plus, Trash2, ChevronDown, ChevronUp, MapPin, Calendar,
  Fuel, Utensils, Star, Tent, ShoppingCart, ArrowLeft,
  Edit2, Check, X, Navigation, Clock, DollarSign, StickyNote,
  ChevronRight, Loader
} from 'lucide-react';

const STOP_TYPES = [
  { value: 'OVERNIGHT', label: 'Overnight Stay', icon: '🏕️', color: 'bg-green-100 text-green-700 border-green-200' },
  { value: 'FUEL', label: 'Fuel Stop', icon: '⛽', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  { value: 'FOOD', label: 'Food / Restaurant', icon: '🍔', color: 'bg-orange-100 text-orange-700 border-orange-200' },
  { value: 'ATTRACTION', label: 'Attraction', icon: '⭐', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  { value: 'WAYPOINT', label: 'Waypoint', icon: '📍', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  { value: 'BOONDOCK', label: 'Boondocking', icon: '🌲', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  { value: 'WALMART', label: 'Walmart Overnight', icon: '🛒', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  { value: 'DUMP', label: 'Dump Station', icon: '🚰', color: 'bg-gray-100 text-gray-700 border-gray-200' },
  { value: 'REST', label: 'Rest Area', icon: '😴', color: 'bg-indigo-100 text-indigo-700 border-indigo-200' },
];

const DAY_TYPES = [
  { value: 'TRAVEL', label: 'Travel Day', icon: '🚗' },
  { value: 'STAY', label: 'Stay Day', icon: '🏕️' },
  { value: 'REST', label: 'Rest Day', icon: '😴' },
  { value: 'ARRIVAL', label: 'Arrival Day', icon: '🎉' },
  { value: 'DEPARTURE', label: 'Departure Day', icon: '👋' },
];

const TRIP_STATUSES = ['PLANNING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED'];

function getStopType(type: string) {
  return STOP_TYPES.find(t => t.value === type) || STOP_TYPES[0];
}

function getDayType(type: string) {
  return DAY_TYPES.find(t => t.value === type) || DAY_TYPES[0];
}

interface TripStop {
  id: string;
  order: number;
  type: string;
  campgroundId?: string;
  customName?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  siteNumber?: string;
  durationMins?: number;
  cost?: number;
  confirmed: boolean;
  campground?: { id: string; name: string; location: string; state: string; imageUrl?: string; latitude?: number; longitude?: number };
}

interface TripDay {
  id: string;
  dayNumber: number;
  date?: string;
  type: string;
  notes?: string;
  stops: TripStop[];
}

interface Trip {
  id: string;
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  status: string;
  visibility: string;
  coverImage?: string;
  days: TripDay[];
}

// ── Stop Card ──────────────────────────────────────────────────────────────
function StopCard({ stop, tripId, dayId, onUpdate, onDelete }: {
  stop: TripStop; tripId: string; dayId: string;
  onUpdate: (s: TripStop) => void; onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...stop });
  const [saving, setSaving] = useState(false);
  const [campSearch, setCampSearch] = useState('');
  const [campResults, setCampResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const st = getStopType(stop.type);

  const searchCampgrounds = async (q: string) => {
    if (q.length < 2) { setCampResults([]); return; }
    setSearching(true);
    try {
      const { data } = await api.get(`/campgrounds/search?q=${encodeURIComponent(q)}&limit=5`);
      setCampResults(Array.isArray(data) ? data : data.campgrounds || []);
    } catch { setCampResults([]); }
    setSearching(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/itinerary/${tripId}/days/${dayId}/stops/${stop.id}`, form);
      onUpdate(data);
      setEditing(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const toggleConfirmed = async () => {
    try {
      const { data } = await api.put(`/itinerary/${tripId}/days/${dayId}/stops/${stop.id}`, { ...stop, confirmed: !stop.confirmed });
      onUpdate(data);
    } catch (e) { console.error(e); }
  };

  if (editing) return (
    <div className="bg-white border-2 border-primary-300 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        {STOP_TYPES.map(t => (
          <button key={t.value} onClick={() => setForm(f => ({ ...f, type: t.value }))}
            className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${form.type === t.value ? 'ring-2 ring-primary-400 ' + t.color : 'bg-gray-50 text-gray-500 border-gray-200'}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>
      {(form.type === 'OVERNIGHT' || form.type === 'BOONDOCK') && (
        <div className="relative">
          <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Search campgrounds..."
            value={campSearch} onChange={e => { setCampSearch(e.target.value); searchCampgrounds(e.target.value); }} />
          {campResults.length > 0 && (
            <div className="absolute z-10 w-full bg-white border border-gray-200 rounded-lg shadow-lg mt-1 max-h-40 overflow-y-auto">
              {campResults.map(c => (
                <button key={c.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  onClick={() => { setForm(f => ({ ...f, campgroundId: c.id, customName: c.name })); setCampResults([]); setCampSearch(c.name); }}>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-gray-500 text-xs">{c.location}, {c.state}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Name / Location"
        value={form.customName || ''} onChange={e => setForm(f => ({ ...f, customName: e.target.value }))} />
      <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Address"
        value={form.address || ''} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} />
      <div className="grid grid-cols-2 gap-2">
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Site #"
          value={form.siteNumber || ''} onChange={e => setForm(f => ({ ...f, siteNumber: e.target.value }))} />
        <input className="border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Cost $"
          type="number" value={form.cost || ''} onChange={e => setForm(f => ({ ...f, cost: parseFloat(e.target.value) }))} />
      </div>
      <textarea className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Notes" rows={2}
        value={form.notes || ''} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      <div className="flex gap-2">
        <button onClick={save} disabled={saving}
          className="flex-1 bg-primary-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-600 flex items-center justify-center gap-1">
          {saving ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save
        </button>
        <button onClick={() => setEditing(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );

  return (
    <div className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${stop.confirmed ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'}`}>
      <button onClick={toggleConfirmed}
        className={`w-6 h-6 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center transition-all ${stop.confirmed ? 'bg-green-500 border-green-500' : 'border-gray-300 hover:border-green-400'}`}>
        {stop.confirmed && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${st.color}`}>{st.icon} {st.label}</span>
          {stop.siteNumber && <span className="text-xs text-gray-500">Site {stop.siteNumber}</span>}
          {stop.cost && <span className="text-xs text-gray-500">${stop.cost}</span>}
        </div>
        <div className="font-medium text-gray-800 text-sm mt-0.5 truncate">
          {stop.campground?.name || stop.customName || 'Unnamed stop'}
        </div>
        {(stop.campground?.location || stop.address) && (
          <div className="text-xs text-gray-500 truncate">{stop.campground?.location || stop.address}</div>
        )}
        {stop.notes && <div className="text-xs text-gray-400 mt-1 italic truncate">{stop.notes}</div>}
      </div>
      <div className="flex gap-1">
        <button onClick={() => setEditing(true)} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all">
          <Edit2 className="w-3.5 h-3.5" />
        </button>
        <button onClick={() => onDelete(stop.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ── Day Card ───────────────────────────────────────────────────────────────
function DayCard({ day, tripId, onUpdate, onDelete }: {
  day: TripDay; tripId: string;
  onUpdate: (d: TripDay) => void; onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingHeader, setEditingHeader] = useState(false);
  const [form, setForm] = useState({ date: day.date || '', type: day.type, notes: day.notes || '' });
  const [addingStop, setAddingStop] = useState(false);
  const [newStopType, setNewStopType] = useState('OVERNIGHT');
  const [saving, setSaving] = useState(false);
  const dt = getDayType(day.type);

  const saveHeader = async () => {
    setSaving(true);
    try {
      const { data } = await api.put(`/itinerary/${tripId}/days/${day.id}`, { ...form, dayNumber: day.dayNumber });
      onUpdate(data);
      setEditingHeader(false);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  const addStop = async () => {
    try {
      const { data } = await api.post(`/itinerary/${tripId}/days/${day.id}/stops`, {
        type: newStopType, order: day.stops.length, confirmed: false
      });
      onUpdate({ ...day, stops: [...day.stops, data] });
      setAddingStop(false);
    } catch (e) { console.error(e); }
  };

  const updateStop = (updated: TripStop) => {
    onUpdate({ ...day, stops: day.stops.map(s => s.id === updated.id ? updated : s) });
  };

  const deleteStop = async (stopId: string) => {
    try {
      await api.delete(`/itinerary/${tripId}/days/${day.id}/stops/${stopId}`);
      onUpdate({ ...day, stops: day.stops.filter(s => s.id !== stopId) });
    } catch (e) { console.error(e); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Day Header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold flex-shrink-0">
          {day.dayNumber}
        </div>
        {editingHeader ? (
          <div className="flex-1 flex items-center gap-2 flex-wrap">
            <select className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
              value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
              {DAY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            <input type="date" className="border border-gray-200 rounded-lg px-2 py-1 text-sm"
              value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} />
            <input className="border border-gray-200 rounded-lg px-2 py-1 text-sm flex-1 min-w-32" placeholder="Notes..."
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
            <button onClick={saveHeader} disabled={saving} className="p-1.5 bg-primary-500 text-white rounded-lg hover:bg-primary-600">
              {saving ? <Loader className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setEditingHeader(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-gray-700">{dt.icon} {dt.label}</span>
            {day.date && <span className="text-xs text-gray-400">{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>}
            {day.notes && <span className="text-xs text-gray-400 italic truncate">— {day.notes}</span>}
            <div className="ml-auto flex items-center gap-1">
              <button onClick={() => setEditingHeader(true)} className="p-1.5 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-all">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => onDelete(day.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setExpanded(!expanded)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition-all">
                {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
          {day.stops.length === 0 && !addingStop && (
            <div className="text-center py-4 text-gray-400 text-sm">No stops yet</div>
          )}
          {day.stops.map(stop => (
            <StopCard key={stop.id} stop={stop} tripId={tripId} dayId={day.id} onUpdate={updateStop} onDelete={deleteStop} />
          ))}

          {addingStop ? (
            <div className="border-2 border-dashed border-primary-200 rounded-xl p-3 bg-primary-50">
              <p className="text-sm font-medium text-gray-600 mb-2">What type of stop?</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {STOP_TYPES.map(t => (
                  <button key={t.value} onClick={() => setNewStopType(t.value)}
                    className={`px-2 py-1 rounded-lg text-xs font-medium border transition-all ${newStopType === t.value ? 'ring-2 ring-primary-400 ' + t.color : 'bg-white text-gray-500 border-gray-200'}`}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button onClick={addStop} className="flex-1 bg-primary-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-primary-600 flex items-center justify-center gap-1">
                  <Plus className="w-4 h-4" /> Add Stop
                </button>
                <button onClick={() => setAddingStop(false)} className="px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setAddingStop(true)}
              className="w-full py-2 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-1">
              <Plus className="w-4 h-4" /> Add Stop
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Trip Detail View ───────────────────────────────────────────────────────
function TripDetail({ tripId, onBack }: { tripId: string; onBack: () => void }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleForm, setTitleForm] = useState({ title: '', description: '', startDate: '', endDate: '', status: 'PLANNING' });

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/itinerary/${tripId}`);
      setTrip(data);
      setTitleForm({ title: data.title, description: data.description || '', startDate: data.startDate?.split('T')[0] || '', endDate: data.endDate?.split('T')[0] || '', status: data.status });
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [tripId]);

  useEffect(() => { load(); }, [load]);

  const saveTitle = async () => {
    try {
      await api.put(`/itinerary/${tripId}`, titleForm);
      setTrip(t => t ? { ...t, ...titleForm } : t);
      setEditingTitle(false);
    } catch (e) { console.error(e); }
  };

  const addDay = async () => {
    if (!trip) return;
    try {
      const { data } = await api.post(`/itinerary/${tripId}/days`, { dayNumber: trip.days.length + 1, type: 'TRAVEL' });
      setTrip(t => t ? { ...t, days: [...t.days, data] } : t);
    } catch (e) { console.error(e); }
  };

  const updateDay = (updated: TripDay) => {
    setTrip(t => t ? { ...t, days: t.days.map(d => d.id === updated.id ? updated : d) } : t);
  };

  const deleteDay = async (dayId: string) => {
    try {
      await api.delete(`/itinerary/${tripId}/days/${dayId}`);
      setTrip(t => t ? { ...t, days: t.days.filter(d => d.id !== dayId).map((d, i) => ({ ...d, dayNumber: i + 1 })) } : t);
    } catch (e) { console.error(e); }
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader className="w-8 h-8 animate-spin text-primary-400" /></div>;
  if (!trip) return <div className="text-center py-20 text-gray-500">Trip not found</div>;

  const statusColors: Record<string, string> = {
    PLANNING: 'bg-blue-100 text-blue-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-orange-100 text-orange-700',
    COMPLETED: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-500">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          {editingTitle ? (
            <div className="space-y-2">
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-semibold" placeholder="Trip title"
                value={titleForm.title} onChange={e => setTitleForm(f => ({ ...f, title: e.target.value }))} />
              <input className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" placeholder="Description (optional)"
                value={titleForm.description} onChange={e => setTitleForm(f => ({ ...f, description: e.target.value }))} />
              <div className="flex gap-2">
                <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={titleForm.startDate} onChange={e => setTitleForm(f => ({ ...f, startDate: e.target.value }))} />
                <input type="date" className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={titleForm.endDate} onChange={e => setTitleForm(f => ({ ...f, endDate: e.target.value }))} />
                <select className="border border-gray-200 rounded-lg px-3 py-2 text-sm"
                  value={titleForm.status} onChange={e => setTitleForm(f => ({ ...f, status: e.target.value }))}>
                  {TRIP_STATUSES.map(s => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div className="flex gap-2">
                <button onClick={saveTitle} className="bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-600 flex items-center gap-1">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditingTitle(false)} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl font-bold text-gray-900 truncate">{trip.title}</h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[trip.status] || 'bg-gray-100 text-gray-600'}`}>{trip.status}</span>
                  {trip.startDate && <span className="text-xs text-gray-500">📅 {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  {trip.endDate && <span className="text-xs text-gray-500">→ {new Date(trip.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  <span className="text-xs text-gray-400">{trip.days.length} days · {trip.days.reduce((a, d) => a + d.stops.length, 0)} stops</span>
                </div>
                {trip.description && <p className="text-sm text-gray-500 mt-1">{trip.description}</p>}
              </div>
              <button onClick={() => setEditingTitle(true)} className="p-2 text-gray-400 hover:text-primary-500 hover:bg-primary-50 rounded-xl transition-all">
                <Edit2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Days */}
      <div className="space-y-3">
        {trip.days.map(day => (
          <DayCard key={day.id} day={day} tripId={tripId} onUpdate={updateDay} onDelete={deleteDay} />
        ))}
      </div>

      <button onClick={addDay}
        className="w-full py-3 border-2 border-dashed border-gray-200 rounded-2xl text-sm text-gray-400 hover:border-primary-300 hover:text-primary-500 transition-all flex items-center justify-center gap-2 font-medium">
        <Plus className="w-5 h-5" /> Add Day
      </button>
    </div>
  );
}

// ── AI Trip Wizard ────────────────────────────────────────────────────────
function AITripWizard({ onCreated, onCancel }: { onCreated: (id: string) => void; onCancel: () => void }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    title: '', startLocation: '', destination: '', nights: 3,
    startDate: '', rvType: 'Class A Motorhome', avoidHighways: false
  });
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<any>(null);
  const [error, setError] = useState('');

  const suggest = async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/itinerary-ai/suggest', {
        startLocation: form.startLocation,
        destination: form.destination,
        nights: form.nights,
        rvType: form.rvType,
        avoidHighways: form.avoidHighways
      });
      setSuggestion(data);
      setStep(3);
    } catch (e) {
      setError('Failed to generate suggestions. Try again.');
    }
    setLoading(false);
  };

  const createTrip = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/itinerary-ai/create-from-suggestion', {
        title: form.title || suggestion.title,
        startDate: form.startDate || null,
        suggestion
      });
      onCreated(data.id);
    } catch (e) {
      setError('Failed to create trip. Try again.');
    }
    setLoading(false);
  };

  const createManual = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/itinerary', {
        title: form.title || 'My Trip',
        status: 'PLANNING',
        visibility: 'PRIVATE',
        startDate: form.startDate || null
      });
      onCreated(data.id);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const RV_TYPES = ['Class A Motorhome', 'Class B Van', 'Class C Motorhome', 'Fifth Wheel', 'Travel Trailer', 'Pop-Up Camper', 'Truck Camper'];

  return (
    <div className="bg-white border-2 border-primary-300 rounded-2xl p-5 shadow-sm space-y-4">
      {/* Step 1: Basic info */}
      {step === 1 && (
        <>
          <div>
            <h3 className="font-bold text-gray-800 text-lg mb-1">✨ Plan a New Trip</h3>
            <p className="text-sm text-gray-500">Start with the basics, then let AI suggest your route</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Trip Name (optional)</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                placeholder='e.g. "Summer 2025 Pacific Coast"'
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Start Date (optional)</label>
              <input type="date" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">RV Type</label>
              <select className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400"
                value={form.rvType} onChange={e => setForm(f => ({ ...f, rvType: e.target.value }))}>
                {RV_TYPES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setStep(2)}
              className="flex-1 bg-primary-500 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-primary-600 flex items-center justify-center gap-1">
              Next: Route Details →
            </button>
            <button onClick={createManual} disabled={loading}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
              Skip AI
            </button>
            <button onClick={onCancel} className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </>
      )}

      {/* Step 2: Route info */}
      {step === 2 && (
        <>
          <div>
            <button onClick={() => setStep(1)} className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">
              ← Back
            </button>
            <h3 className="font-bold text-gray-800 text-lg mb-1">🗺️ Where are you headed?</h3>
            <p className="text-sm text-gray-500">AI will plan your stops, overnight stays, and fuel breaks</p>
          </div>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Starting From *</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                placeholder="e.g. Springfield, IL"
                value={form.startLocation} onChange={e => setForm(f => ({ ...f, startLocation: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Destination (or leave blank for scenic loop)</label>
              <input className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
                placeholder="e.g. Yellowstone National Park, WY"
                value={form.destination} onChange={e => setForm(f => ({ ...f, destination: e.target.value }))} />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1 block">Number of Nights 🌙</label>
              <div className="flex items-center gap-3">
                <input type="range" min={1} max={21} value={form.nights}
                  onChange={e => setForm(f => ({ ...f, nights: parseInt(e.target.value) }))}
                  className="flex-1 accent-primary-500" />
                <span className="w-16 text-center font-bold text-primary-600 text-lg">{form.nights} {form.nights === 1 ? 'night' : 'nights'}</span>
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.avoidHighways}
                onChange={e => setForm(f => ({ ...f, avoidHighways: e.target.checked }))}
                className="w-4 h-4 accent-primary-500" />
              <span className="text-sm text-gray-600">Prefer scenic routes over highways</span>
            </label>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={suggest} disabled={loading || !form.startLocation}
              className="flex-1 bg-gradient-to-r from-primary-500 to-blue-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:from-primary-600 hover:to-blue-600 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm">
              {loading ? <><Loader className="w-4 h-4 animate-spin" /> Generating your route...</> : <>✨ Generate AI Itinerary</>}
            </button>
          </div>
        </>
      )}

      {/* Step 3: Review AI suggestion */}
      {step === 3 && suggestion && (
        <>
          <div>
            <button onClick={() => setStep(2)} className="text-sm text-gray-400 hover:text-gray-600 mb-2 flex items-center gap-1">← Regenerate</button>
            <h3 className="font-bold text-gray-800 text-lg mb-1">🎉 Your AI-Planned Trip</h3>
            <p className="text-sm text-gray-500 mb-3">{suggestion.description}</p>
          </div>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {suggestion.days?.map((day: any) => (
              <div key={day.dayNumber} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center">{day.dayNumber}</span>
                  <span className="text-sm font-semibold text-gray-700">{getDayType(day.type).icon} {getDayType(day.type).label}</span>
                  {day.notes && <span className="text-xs text-gray-400 truncate">— {day.notes}</span>}
                </div>
                <div className="space-y-1 ml-8">
                  {day.stops?.map((stop: any, i: number) => {
                    const st = getStopType(stop.type);
                    return (
                      <div key={i} className="flex items-center gap-2 text-xs text-gray-600">
                        <span className={`px-1.5 py-0.5 rounded text-xs border ${st.color}`}>{st.icon}</span>
                        <span className="truncate">{stop.customName}</span>
                        {stop.campgroundId && <span className="text-green-500 text-xs">✓ in database</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={createTrip} disabled={loading}
              className="flex-1 bg-primary-500 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2">
              {loading ? <Loader className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save This Itinerary
            </button>
            <button onClick={() => { setStep(2); suggest(); }} disabled={loading}
              className="px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-500 hover:bg-gray-50">
              Regenerate
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Trip List View ─────────────────────────────────────────────────────────
function TripList({ onSelect }: { onSelect: (id: string) => void }) {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    api.get('/itinerary').then(({ data }) => { setTrips(data); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const deleteTrip = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm('Delete this trip?')) return;
    try {
      await api.delete(`/itinerary/${id}`);
      setTrips(t => t.filter(x => x.id !== id));
    } catch (e) { console.error(e); }
  };

  const statusColors: Record<string, string> = {
    PLANNING: 'bg-blue-100 text-blue-700',
    CONFIRMED: 'bg-green-100 text-green-700',
    IN_PROGRESS: 'bg-orange-100 text-orange-700',
    COMPLETED: 'bg-gray-100 text-gray-600',
  };

  if (loading) return <div className="flex items-center justify-center py-20"><Loader className="w-8 h-8 animate-spin text-primary-400" /></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🗺️ My Trips</h1>
          <p className="text-sm text-gray-500 mt-0.5">Plan your RV adventures, day by day</p>
        </div>
        <button onClick={() => setCreating(true)}
          className="bg-primary-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all flex items-center gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> New Trip
        </button>
      </div>

      {creating && <AITripWizard onCreated={onCreated} onCancel={() => setCreating(false)} />}

      {trips.length === 0 && !creating && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-200">
          <div className="text-5xl mb-3">🚐</div>
          <h3 className="font-semibold text-gray-700 mb-1">No trips yet</h3>
          <p className="text-sm text-gray-400 mb-4">Plan your first RV adventure — stops, stays, and all</p>
          <button onClick={() => setCreating(true)} className="bg-primary-500 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-primary-600 transition-all">
            Plan a Trip
          </button>
        </div>
      )}

      <div className="space-y-3">
        {trips.map(trip => (
          <button key={trip.id} onClick={() => onSelect(trip.id)}
            className="w-full text-left bg-white border border-gray-200 rounded-2xl p-4 hover:border-primary-300 hover:shadow-md transition-all group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold text-gray-900 group-hover:text-primary-600 transition-colors">{trip.title}</h3>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[trip.status] || 'bg-gray-100 text-gray-600'}`}>{trip.status}</span>
                </div>
                {trip.description && <p className="text-sm text-gray-500 mt-0.5 truncate">{trip.description}</p>}
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {trip.startDate && <span className="text-xs text-gray-400 flex items-center gap-1"><Calendar className="w-3 h-3" />{new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>}
                  <span className="text-xs text-gray-400">{trip.days.length} days</span>
                  <span className="text-xs text-gray-400">{trip.days.reduce((a, d) => a + d.stops.length, 0)} stops</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={e => deleteTrip(e, trip.id)} className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100">
                  <Trash2 className="w-4 h-4" />
                </button>
                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-primary-400 transition-colors" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function ItineraryPage() {
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      {selectedTripId
        ? <TripDetail tripId={selectedTripId} onBack={() => setSelectedTripId(null)} />
        : <TripList onSelect={setSelectedTripId} />
      }
    </div>
  );
}
