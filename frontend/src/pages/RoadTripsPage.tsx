import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Plus, MapPin, Calendar, Trash2, Edit2, X, GripVertical, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const PALETTES = [
  { id: 'sunset',   color: '#f97316', font: 'playfair',   label: 'Desert Sunset',   preview: 'from-orange-400 to-red-500' },
  { id: 'pacific',  color: '#0891b2', font: 'montserrat', label: 'Pacific Coast',    preview: 'from-cyan-500 to-blue-600' },
  { id: 'forest',   color: '#16a34a', font: 'merriweather',label: 'Deep Forest',     preview: 'from-green-500 to-emerald-700' },
  { id: 'mountain', color: '#7c3aed', font: 'raleway',    label: 'Mountain Pass',    preview: 'from-purple-500 to-violet-700' },
  { id: 'prairie',  color: '#ca8a04', font: 'lora',       label: 'Golden Prairie',   preview: 'from-yellow-400 to-amber-600' },
  { id: 'canyon',   color: '#dc2626', font: 'oswald',     label: 'Red Canyon',       preview: 'from-red-500 to-rose-700' },
  { id: 'glacier',  color: '#0284c7', font: 'nunito',     label: 'Glacier Blue',     preview: 'from-sky-400 to-blue-600' },
  { id: 'midnight', color: '#1e293b', font: 'cinzel',     label: 'Midnight Drive',   preview: 'from-slate-700 to-slate-900' },
];

const GOOGLE_FONTS_URL = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Montserrat:wght@700&family=Merriweather:wght@700&family=Raleway:wght@700&family=Lora:wght@700&family=Oswald:wght@700&family=Nunito:wght@700&family=Cinzel:wght@700&display=swap";

const FONT_MAP: Record<string, string> = {
  playfair: "'Playfair Display', serif",
  montserrat: "'Montserrat', sans-serif",
  merriweather: "'Merriweather', serif",
  raleway: "'Raleway', sans-serif",
  lora: "'Lora', serif",
  oswald: "'Oswald', sans-serif",
  nunito: "'Nunito', sans-serif",
  cinzel: "'Cinzel', serif",
};

interface RoadTrip {
  id: string;
  title: string;
  description?: string;
  color: string;
  font: string;
  stops: any[];
  _count?: { stops: number };
}

export default function RoadTripsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [roadTrips, setRoadTrips] = useState<RoadTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', color: '#f97316', font: 'playfair' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
    loadRoadTrips();
  }, []);

  const loadRoadTrips = async () => {
    try {
      const { data } = await api.get('/road-trips');
      setRoadTrips(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post('/road-trips', form);
      setRoadTrips(prev => [data, ...prev]);
      setShowCreate(false);
      setForm({ title: '', description: '', color: '#f97316', font: 'playfair' });
      navigate(`/road-trips/${data.id}`);
    } catch (e) { alert('Failed to create road trip'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this road trip? Your individual events will not be deleted.')) return;
    try {
      await api.delete(`/road-trips/${id}`);
      setRoadTrips(prev => prev.filter(rt => rt.id !== id));
    } catch (e) { alert('Failed to delete'); }
  };

  const selectedPalette = PALETTES.find(p => p.color === form.color) || PALETTES[0];

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-6">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">🗺️ Road Trips</h1>
          <p className="text-gray-500 mt-1">Multi-stop adventures across campgrounds</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition shadow-md">
          <Plus className="w-5 h-5" /> New Road Trip
        </button>
      </div>

      {/* Road Trip Cards */}
      {roadTrips.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <div className="text-6xl mb-4">🚐</div>
          <h3 className="text-xl font-bold text-gray-600 mb-2">No road trips yet</h3>
          <p className="text-gray-500 mb-6">Link multiple campground stops into one epic journey</p>
          <button onClick={() => setShowCreate(true)}
            className="px-6 py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 transition">
            Plan Your First Road Trip
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {roadTrips.map(rt => {
            const palette = PALETTES.find(p => p.color === rt.color) || PALETTES[0];
            const totalNights = rt.stops.reduce((sum: number, s: any) => {
              if (!s.startDate || !s.endDate) return sum;
              return sum + Math.ceil((new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 86400000);
            }, 0);
            const states = [...new Set(rt.stops.map((s: any) => s.campground?.state).filter(Boolean))];
            return (
              <div key={rt.id} className="bg-white rounded-2xl overflow-hidden shadow-md hover:shadow-xl transition border border-gray-100"
                style={{ borderLeft: `5px solid ${rt.color}` }}>
                {/* Color header */}
                <div className={`h-3 bg-gradient-to-r ${palette.preview}`} />
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1">
                    <h2 className="text-xl font-bold text-gray-900 leading-tight"
                      style={{ fontFamily: FONT_MAP[rt.font] }}>{rt.title}</h2>
                    <button onClick={() => handleDelete(rt.id)}
                      className="text-gray-300 hover:text-red-400 transition ml-2 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {rt.description && <p className="text-sm text-gray-500 mb-3">{rt.description}</p>}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-4">
                    <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{rt.stops.length} stops</span>
                    {totalNights > 0 && <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{totalNights} nights</span>}
                    {states.length > 0 && <span>📍 {states.join(', ')}</span>}
                  </div>
                  {/* Stop previews */}
                  <div className="space-y-1.5 mb-4">
                    {rt.stops.slice(0, 3).map((stop: any, i: number) => (
                      <div key={stop.id} className="flex items-center gap-2 text-sm">
                        <div className="w-5 h-5 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                          style={{ backgroundColor: rt.color }}>
                          {(stop.stopNumber || i + 1)}
                        </div>
                        <span className="text-gray-700 truncate">{stop.campground?.name || stop.title}</span>
                        {stop.startDate && <span className="text-gray-400 text-xs ml-auto flex-shrink-0">
                          {new Date(stop.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>}
                      </div>
                    ))}
                    {rt.stops.length > 3 && <p className="text-xs text-gray-400 pl-7">+{rt.stops.length - 3} more stops</p>}
                  </div>
                  <Link to={`/road-trips/${rt.id}`}
                    className="block w-full text-center py-2 rounded-xl text-sm font-semibold text-white transition hover:opacity-90"
                    style={{ backgroundColor: rt.color }}>
                    View Road Trip →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className={`h-2 bg-gradient-to-r ${selectedPalette.preview}`} />
            <div className="p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-xl font-bold text-gray-900">New Road Trip</h2>
                <button onClick={() => setShowCreate(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trip Name *</label>
                  <input value={form.title} onChange={e => setForm({...form, title: e.target.value})}
                    placeholder="e.g. Summer Southwest Loop"
                    className="input w-full"
                    style={{ fontFamily: FONT_MAP[form.font] }} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                    placeholder="What's this trip about?" rows={2} className="input w-full" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Identity / Color Theme</label>
                  <div className="grid grid-cols-4 gap-2">
                    {PALETTES.map(p => (
                      <button key={p.id} onClick={() => setForm({...form, color: p.color, font: p.font})}
                        className={`relative rounded-xl overflow-hidden h-14 transition ${form.color === p.color ? 'ring-2 ring-offset-2 ring-gray-900 scale-105' : 'hover:scale-105'}`}>
                        <div className={`absolute inset-0 bg-gradient-to-br ${p.preview}`} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-white text-xs font-bold drop-shadow" style={{ fontFamily: FONT_MAP[p.font] }}>Aa</span>
                          <span className="text-white text-xs opacity-80 drop-shadow">{p.label.split(' ')[0]}</span>
                        </div>
                        {form.color === p.color && <div className="absolute top-1 right-1 w-3 h-3 bg-white rounded-full flex items-center justify-center"><div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} /></div>}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowCreate(false)} className="btn btn-secondary flex-1">Cancel</button>
                <button onClick={handleCreate} disabled={saving || !form.title.trim()}
                  className="btn btn-primary flex-1 disabled:opacity-50"
                  style={{ backgroundColor: form.color, borderColor: form.color }}>
                  {saving ? 'Creating...' : 'Create Road Trip'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
