import { useState, useEffect } from 'react';
import { Plus, X, MapPin, Check, Trash2, Edit2, Star, Landmark, Eye, Globe, Home } from 'lucide-react';
import api from '../services/api';

interface Attraction {
  id: string;
  name: string;
  type: string;
  state: string;
  city?: string;
  address?: string;
  imageUrl?: string;
  description?: string;
  website?: string;
  isVisited: boolean;
  rating?: number;
  createdAt: string;
}

const ATTRACTION_TYPES = [
  { value: 'roadside', label: '🛣️ Roadside Attraction', color: 'bg-orange-100 text-orange-700' },
  { value: 'landmark', label: '🏛️ Landmark', color: 'bg-blue-100 text-blue-700' },
  { value: 'nature', label: '🌲 Natural Wonder', color: 'bg-green-100 text-green-700' },
  { value: 'museum', label: '🏛️ Museum', color: 'bg-purple-100 text-purple-700' },
  { value: 'food', label: '🍔 Food Stop', color: 'bg-red-100 text-red-700' },
  { value: 'quirky', label: '🎪 Quirky/Weird', color: 'bg-pink-100 text-pink-700' },
  { value: 'historic', label: '📜 Historic Site', color: 'bg-amber-100 text-amber-700' },
  { value: 'viewpoint', label: '👀 Scenic Viewpoint', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'photo', label: '📸 Photo Op', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'other', label: '📍 Other', color: 'bg-gray-100 text-gray-700' },
];

const STATE_NAMES: { [key: string]: string } = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

const US_STATES = Object.keys(STATE_NAMES).sort();

export default function Attractions() {
  const [attractions, setAttractions] = useState<Attraction[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingAttraction, setEditingAttraction] = useState<Attraction | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterVisited, setFilterVisited] = useState<string>('all');
  const [error, setError] = useState('');
  
  const [form, setForm] = useState({
    name: '',
    type: 'roadside',
    state: '',
    city: '',
    address: '',
    imageUrl: '',
    description: '',
    website: '',
  });

  useEffect(() => {
    loadAttractions();
  }, []);

  const loadAttractions = async () => {
    try {
      setLoading(true);
      const { data } = await api.get('/attractions');
      setAttractions(data);
    } catch (error) {
      console.error('Load attractions error:', error);
      setAttractions([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!form.name.trim()) {
      setError('Please enter a name');
      return;
    }
    if (!form.state) {
      setError('Please select a state');
      return;
    }
    
    try {
      setSaving(true);
      if (editingAttraction) {
        await api.put(`/attractions/${editingAttraction.id}`, form);
      } else {
        await api.post('/attractions', form);
      }
      setShowModal(false);
      resetForm();
      loadAttractions();
    } catch (error: any) {
      console.error('Save attraction error:', error);
      setError(error.response?.data?.error || 'Failed to save attraction');
    } finally {
      setSaving(false);
    }
  };

  const resetForm = () => {
    setForm({ name: '', type: 'roadside', state: '', city: '', address: '', imageUrl: '', description: '', website: '' });
    setEditingAttraction(null);
    setError('');
  };

  const handleEdit = (attraction: Attraction) => {
    setEditingAttraction(attraction);
    setForm({
      name: attraction.name,
      type: attraction.type,
      state: attraction.state,
      city: attraction.city || '',
      address: attraction.address || '',
      imageUrl: attraction.imageUrl || '',
      description: attraction.description || '',
      website: attraction.website || '',
    });
    setShowModal(true);
  };

  const handleToggleVisited = async (id: string, isVisited: boolean) => {
    try {
      await api.put(`/attractions/${id}`, { isVisited: !isVisited });
      loadAttractions();
    } catch (error) {
      console.error('Toggle visited error:', error);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this attraction from your list?')) return;
    try {
      await api.delete(`/attractions/${id}`);
      loadAttractions();
    } catch (error) {
      console.error('Delete attraction error:', error);
    }
  };

  const handleRate = async (id: string, rating: number) => {
    try {
      await api.put(`/attractions/${id}`, { rating });
      loadAttractions();
    } catch (error) {
      console.error('Rate attraction error:', error);
    }
  };

  const getTypeConfig = (type: string) => {
    return ATTRACTION_TYPES.find(t => t.value === type) || ATTRACTION_TYPES[ATTRACTION_TYPES.length - 1];
  };

  const filteredAttractions = attractions.filter(a => {
    if (filterType !== 'all' && a.type !== filterType) return false;
    if (filterVisited === 'visited' && !a.isVisited) return false;
    if (filterVisited === 'unvisited' && a.isVisited) return false;
    return true;
  });

  const groupedByState = filteredAttractions.reduce((acc, item) => {
    if (!acc[item.state]) acc[item.state] = [];
    acc[item.state].push(item);
    return acc;
  }, {} as { [key: string]: Attraction[] });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading attractions...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-orange-500 to-amber-500 p-3 rounded-xl shadow-lg">
            <Landmark className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Attractions</h2>
            <p className="text-sm text-gray-600">Things to see along the way! 🛣️</p>
          </div>
        </div>
        <button 
          onClick={() => { resetForm(); setShowModal(true); }} 
          className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium flex items-center shadow-lg transition-colors"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Attraction
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select 
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All Types</option>
              {ATTRACTION_TYPES.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
            </select>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select 
              value={filterVisited} 
              onChange={(e) => setFilterVisited(e.target.value)} 
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value="all">All</option>
              <option value="unvisited">🎯 Want to Visit</option>
              <option value="visited">✅ Visited</option>
            </select>
          </div>
        </div>
      </div>

      {Object.keys(groupedByState).length > 0 ? (
        <div className="space-y-6">
          {Object.entries(groupedByState).sort(([a], [b]) => a.localeCompare(b)).map(([state, items]) => (
            <div key={state} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                  <MapPin className="w-5 h-5" />
                  {STATE_NAMES[state] || state}
                </h3>
              </div>
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((attraction) => {
                  const typeConfig = getTypeConfig(attraction.type);
                  return (
                    <div key={attraction.id} className={`relative group rounded-lg overflow-hidden border-2 transition ${attraction.isVisited ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200 hover:border-orange-300'}`}>
                      {attraction.imageUrl ? (
                        <div className="relative h-40 overflow-hidden">
                          <img src={attraction.imageUrl} alt={attraction.name} className="w-full h-full object-cover" />
                          <div className="absolute top-2 left-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="h-32 bg-gradient-to-br from-orange-100 to-amber-100 flex items-center justify-center relative">
                          <Landmark className="w-12 h-12 text-orange-300" />
                          <div className="absolute top-2 left-2">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${typeConfig.color}`}>{typeConfig.label}</span>
                          </div>
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="font-bold text-lg mb-1">{attraction.name}</h4>
                        {attraction.city && <p className="text-sm text-gray-500">{attraction.city}</p>}
                        {attraction.address && <p className="text-xs text-gray-400 mb-2">{attraction.address}</p>}
                        {attraction.description && <p className="text-sm text-gray-600 mb-3 line-clamp-2">{attraction.description}</p>}
                        {attraction.website && (
                          <a 
                            href={attraction.website.startsWith('http') ? attraction.website : `https://${attraction.website}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 mb-2"
                          >
                            <Globe className="w-3 h-3" />
                            Visit Website
                          </a>
                        )}
                        <div className="flex items-center gap-1 mb-3">
                          {[1,2,3,4,5].map((star) => (
                            <button key={star} onClick={() => handleRate(attraction.id, star)} className={attraction.rating && attraction.rating >= star ? 'text-yellow-400' : 'text-gray-300'}>
                              <Star className="w-4 h-4 fill-current" />
                            </button>
                          ))}
                        </div>
                        <div className="flex items-center gap-2">
                          <button onClick={() => handleToggleVisited(attraction.id, attraction.isVisited)} className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-1 ${attraction.isVisited ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'}`}>
                            {attraction.isVisited ? <><Check className="w-4 h-4" />Visited</> : <><Eye className="w-4 h-4" />Want to Visit</>}
                          </button>
                          <button onClick={() => handleEdit(attraction)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(attraction.id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
          <Landmark className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No attractions yet</h3>
          <p className="text-gray-600 mb-4">Add roadside attractions and things to see!</p>
          <button 
            onClick={() => setShowModal(true)} 
            className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded-lg font-medium inline-flex items-center"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add First Attraction
          </button>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-xl w-full shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-orange-500 to-amber-500 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">{editingAttraction ? 'Edit Attraction' : 'Add Attraction'}</h2>
                <button onClick={() => { setShowModal(false); resetForm(); }} className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}
              
              {/* Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input 
                  type="text" 
                  value={form.name} 
                  onChange={(e) => setForm({...form, name: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  placeholder="World's Largest Ball of Twine" 
                />
              </div>
              
              {/* Type */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                <select 
                  value={form.type} 
                  onChange={(e) => setForm({...form, type: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  {ATTRACTION_TYPES.map(type => (<option key={type.value} value={type.value}>{type.label}</option>))}
                </select>
              </div>
              
              {/* Street Address */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Home className="w-4 h-4 inline mr-1" />
                  Street Address
                </label>
                <input 
                  type="text" 
                  value={form.address} 
                  onChange={(e) => setForm({...form, address: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  placeholder="123 Main Street"
                />
              </div>
              
              {/* State and City */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">State *</label>
                  <select 
                    value={form.state} 
                    onChange={(e) => setForm({...form, state: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  >
                    <option value="">Select...</option>
                    {US_STATES.map(state => (<option key={state} value={state}>{STATE_NAMES[state]}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">City</label>
                  <input 
                    type="text" 
                    value={form.city} 
                    onChange={(e) => setForm({...form, city: e.target.value})} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                    placeholder="Kansas City"
                  />
                </div>
              </div>
              
              {/* Website URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  <Globe className="w-4 h-4 inline mr-1" />
                  Website URL (optional)
                </label>
                <input 
                  type="url" 
                  value={form.website} 
                  onChange={(e) => setForm({...form, website: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  placeholder="https://www.example.com"
                />
              </div>
              
              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                <textarea 
                  value={form.description} 
                  onChange={(e) => setForm({...form, description: e.target.value})} 
                  rows={3} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  placeholder="What makes this attraction special?"
                />
              </div>
              
              {/* Image URL */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL (optional)</label>
                <input 
                  type="url" 
                  value={form.imageUrl} 
                  onChange={(e) => setForm({...form, imageUrl: e.target.value})} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500" 
                  placeholder="https://example.com/image.jpg"
                />
                {form.imageUrl && (
                  <div className="mt-2">
                    <img 
                      src={form.imageUrl} 
                      alt="Preview" 
                      className="h-24 w-auto rounded-lg object-cover"
                      onError={(e) => (e.currentTarget.style.display = 'none')}
                    />
                  </div>
                )}
              </div>
              
              {/* Submit Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button 
                  type="submit" 
                  disabled={saving}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-300 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {saving ? 'Saving...' : (editingAttraction ? 'Save Changes' : 'Add Attraction')}
                </button>
                <button 
                  type="button" 
                  onClick={() => { setShowModal(false); resetForm(); }} 
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
