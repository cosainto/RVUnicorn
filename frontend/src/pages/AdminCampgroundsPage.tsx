import { useState, useEffect } from 'react';
import { Plus, Search, Trash2, Edit3, Check, X, MapPin, Wifi, Zap, Droplets,
  Phone, Mail, Globe, Save, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const WILL_ID = 'cmlpeyk82005s3qause3sws7y';

const HOOKUPS = [
  { key: 'hasElectricHookup', label: 'Electric' },
  { key: 'hasWaterHookup', label: 'Water' },
  { key: 'hasSewerHookup', label: 'Sewer' },
  { key: 'hasFullHookups', label: 'Full Hookups' },
  { key: 'hasPullThrough', label: 'Pull-Through' },
  { key: 'hasBackIn', label: 'Back-In' },
  { key: 'hasRestrooms', label: 'Restrooms' },
  { key: 'hasShowers', label: 'Showers' },
  { key: 'hasLaundry', label: 'Laundry' },
  { key: 'hasPool', label: 'Pool' },
  { key: 'hasDumpStation', label: 'Dump Station' },
  { key: 'hasCableTV', label: 'Cable TV' },
  { key: 'hasPropane', label: 'Propane' },
  { key: 'hasWifi', label: 'WiFi' },
];

const EMPTY_FORM = {
  name: '', description: '', location: '', city: '', state: '', zipCode: '',
  latitude: '', longitude: '', imageUrl: '', websiteUrl: '', bookingUrl: '',
  businessEmail: '', businessPhone: '',
  hasElectricHookup: false, hasWaterHookup: false, hasSewerHookup: false,
  hasFullHookups: false, hasPullThrough: false, hasBackIn: false,
  hasRestrooms: false, hasShowers: false, hasLaundry: false, hasPool: false,
  hasDumpStation: false, hasCableTV: false, hasPropane: false, hasWifi: false,
};

export default function AdminCampgroundsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [campgrounds, setCampgrounds] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_FORM);
  const [editId, setEditId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showAmenities, setShowAmenities] = useState(false);

  useEffect(() => {
    if (!user || user.id !== WILL_ID) { navigate('/basecamp'); return; }
    fetchCampgrounds();
  }, [user]);

  useEffect(() => {
    const t = setTimeout(fetchCampgrounds, 400);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCampgrounds = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/campgrounds', { params: { search } });
      setCampgrounds(res.data.campgrounds);
      setTotal(res.data.total);
    } catch {}
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.location) {
      setMsg({ type: 'error', text: 'Name and location are required' });
      return;
    }
    setSaving(true);
    setMsg(null);
    try {
      if (editId) {
        await api.put(`/admin/campgrounds/${editId}`, form);
        setMsg({ type: 'success', text: 'Campground updated!' });
      } else {
        await api.post('/admin/campgrounds', form);
        setMsg({ type: 'success', text: 'Campground created!' });
      }
      setForm(EMPTY_FORM);
      setEditId(null);
      setShowForm(false);
      fetchCampgrounds();
    } catch (e: any) {
      setMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save' });
    }
    setSaving(false);
  };

  const handleEdit = (cg: any) => {
    setForm({ ...EMPTY_FORM, ...cg });
    setEditId(cg.id);
    setShowForm(true);
    setShowAmenities(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/admin/campgrounds/${id}`);
      fetchCampgrounds();
    } catch {
      alert('Failed to delete');
    }
  };

  const F = (key: string, label: string, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      <input type={type} value={form[key] || ''} placeholder={placeholder}
        onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.value }))}
        className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent"
      />
    </div>
  );

  if (!user || user.id !== WILL_ID) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-gray-900" style={{ letterSpacing: '-0.02em' }}>
              🏕️ Campground Admin
            </h1>
            <div className="flex gap-3 mt-2">
              <Link to="/admin/campgrounds" className="text-xs font-semibold px-3 py-1.5 rounded-full bg-primary-100 text-primary-700 hover:bg-primary-200 transition">🏕️ Campgrounds</Link>
              <Link to="/admin/hosts" className="text-xs font-semibold px-3 py-1.5 rounded-full bg-green-100 text-green-700 hover:bg-green-200 transition">🏡 Host Listings</Link>
              <Link to="/admin/badges" className="text-xs font-semibold px-3 py-1.5 rounded-full bg-amber-100 text-amber-700 hover:bg-amber-200 transition">🏅 Badges</Link>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">{total.toLocaleString()} total campgrounds</p>
          </div>
          <button onClick={() => { setForm(EMPTY_FORM); setEditId(null); setShowForm(!showForm); setMsg(null); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #1a1f2e, #f59e0b)' }}>
            {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showForm ? 'Cancel' : 'Add Campground'}
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">
              {editId ? '✏️ Edit Campground' : '➕ New Campground'}
            </h2>

            <div className="grid grid-cols-2 gap-4">
              {F('name', 'Campground Name *', 'text', 'e.g. Yosemite Valley Campground')}
              {F('location', 'Full Address / Location *', 'text', 'e.g. 9010 Village Dr, Yosemite Valley, CA')}
              {F('city', 'City')}
              {F('state', 'State', 'text', 'e.g. CA')}
              {F('zipCode', 'ZIP Code')}
              {F('latitude', 'Latitude', 'number', 'e.g. 37.7465')}
              {F('longitude', 'Longitude', 'number', 'e.g. -119.5332')}
              {F('imageUrl', 'Image URL')}
              {F('websiteUrl', 'Website URL')}
              {F('bookingUrl', 'Booking URL')}
              {F('businessEmail', 'Business Email')}
              {F('businessPhone', 'Business Phone')}
            </div>

            <div className="mt-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
              <textarea value={form.description || ''} rows={3}
                onChange={e => setForm((f: any) => ({ ...f, description: e.target.value }))}
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                placeholder="Describe the campground..."
              />
            </div>

            {/* Amenities toggle */}
            <button onClick={() => setShowAmenities(!showAmenities)}
              className="flex items-center gap-2 mt-4 text-sm font-semibold text-amber-600">
              {showAmenities ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              Amenities & Hookups
            </button>

            {showAmenities && (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {HOOKUPS.map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50">
                    <input type="checkbox" checked={!!form[key]}
                      onChange={e => setForm((f: any) => ({ ...f, [key]: e.target.checked }))}
                      className="w-4 h-4 text-amber-500 rounded" />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            )}

            {msg && (
              <div className={"flex items-center gap-2 mt-4 p-3 rounded-lg text-sm font-medium " +
                (msg.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700')}>
                {msg.type === 'success' ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                {msg.text}
              </div>
            )}

            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 mt-4 px-6 py-2.5 rounded-xl text-sm font-bold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg, #1a1f2e, #f59e0b)' }}>
              {saving ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : editId ? 'Update Campground' : 'Create Campground'}
            </button>
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, city, or state..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white" />
        </div>

        {/* List */}
        <div className="space-y-2">
          {loading && <div className="text-center py-8 text-gray-400 text-sm">Loading...</div>}
          {!loading && campgrounds.length === 0 && (
            <div className="text-center py-12 text-gray-400 text-sm">No campgrounds found</div>
          )}
          {campgrounds.map(cg => (
            <div key={cg.id} className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-4">
              {cg.imageUrl
                ? <img src={cg.imageUrl} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                : <div className="w-12 h-12 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 text-xl">🏕️</div>
              }
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 text-sm truncate">{cg.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />{[cg.city, cg.state].filter(Boolean).join(', ') || 'No location'}
                </p>
              </div>
              <span className={"text-xs font-semibold px-2 py-1 rounded-full " +
                (cg.verificationStatus === 'VERIFIED' ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500')}>
                {cg.verificationStatus}
              </span>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => handleEdit(cg)}
                  className="p-2 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                  <Edit3 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cg.id, cg.name)}
                  className="p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
