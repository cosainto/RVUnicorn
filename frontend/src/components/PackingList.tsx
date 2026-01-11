import { useState, useEffect, useCallback } from 'react';
import { Package, Plus, Check, X, RotateCcw, Calendar, Filter, ChevronDown } from 'lucide-react';
import api from '../services/api';

interface PackItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isPacked: boolean;
  tripId?: string;
  eventId?: string;
  trip?: { id: string; name: string; startDate: string };
  event?: { id: string; title: string; startDate: string };
}

interface PackStats {
  total: number;
  packed: number;
  unpacked: number;
  progress: number;
}

interface Trip {
  id: string;
  name?: string;
  title?: string;
  startDate: string;
}

const PACK_CATEGORIES = [
  'General',
  'Clothing',
  'Kitchen',
  'Safety',
  'Electronics',
  'Toiletries',
  'Outdoor Gear',
  'Bedding',
  'Tools',
  'Food',
  'Documents',
  'Entertainment',
  'Pet Supplies',
  'Kids',
  'Other',
];

export default function PackingList() {
  const [packItems, setPackItems] = useState<PackItem[]>([]);
  const [packStats, setPackStats] = useState<PackStats>({ total: 0, packed: 0, unpacked: 0, progress: 0 });
  const [loading, setLoading] = useState(true);
  const [showAddItem, setShowAddItem] = useState(false);
  
  // Form state
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemTripId, setNewItemTripId] = useState('');
  
  // Filter state
  const [filterTripId, setFilterTripId] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  
  // Trips state
  const [userTrips, setUserTrips] = useState<Trip[]>([]);

  const loadPackingList = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterTripId) params.append('eventId', filterTripId);
      
      const { data } = await api.get(`/personal-pack?${params.toString()}`);
      setPackItems(data.items || []);
      setPackStats(data.stats || { total: 0, packed: 0, unpacked: 0, progress: 0 });
    } catch (error) {
      console.error('Failed to load packing list:', error);
    } finally {
      setLoading(false);
    }
  }, [filterTripId]);

  const loadUserTrips = useCallback(async () => {
    try {
      // Load upcoming trips/events
      const { data } = await api.get('/trips');
      const trips = Array.isArray(data) ? data : data?.events || data?.trips || [];
      // Filter to upcoming trips only
      const now = new Date();
      const upcomingTrips = trips.filter((t: Trip) => new Date(t.startDate) >= now);
      setUserTrips(upcomingTrips.slice(0, 20)); // Limit to 20
    } catch (error) {
      console.error('Failed to load trips:', error);
      // Try alternate endpoint
      try {
        const { data } = await api.get('/trips/upcoming');
        setUserTrips(Array.isArray(data) ? data : data ? [data] : []);
      } catch (e) {
        console.error('Failed to load upcoming trips:', e);
      }
    }
  }, []);

  useEffect(() => {
    loadPackingList();
    loadUserTrips();
  }, [loadPackingList, loadUserTrips]);

  const addPackItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await api.post('/personal-pack', {
        name: newItemName.trim(),
        category: newItemCategory,
        eventId: newItemTripId || null,
      });
      setNewItemName('');
      setNewItemTripId('');
      setShowAddItem(false);
      loadPackingList();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const togglePackItem = async (id: string) => {
    try {
      await api.post(`/personal-pack/${id}/toggle`);
      loadPackingList();
    } catch (error) {
      console.error('Failed to toggle item:', error);
    }
  };

  const deletePackItem = async (id: string) => {
    try {
      await api.delete(`/personal-pack/${id}`);
      loadPackingList();
    } catch (error) {
      console.error('Failed to delete item:', error);
    }
  };

  const unpackAll = async () => {
    try {
      await api.post('/personal-pack/unpack-all', {
        eventId: filterTripId || undefined,
      });
      loadPackingList();
    } catch (error) {
      console.error('Failed to unpack all:', error);
    }
  };

  const packAll = async () => {
    try {
      await api.post('/personal-pack/pack-all', {
        eventId: filterTripId || undefined,
      });
      loadPackingList();
    } catch (error) {
      console.error('Failed to pack all:', error);
    }
  };

  const getTripName = (item: PackItem) => {
    if (item.event) return item.event.title;
    if (item.trip) return item.trip.name;
    return null;
  };

  const selectedTrip = userTrips.find(t => t.id === filterTripId);

  return (
    <div className="bg-white rounded-lg shadow-md p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Package className="w-5 h-5 text-emerald-600" />
          <h3 className="font-bold text-gray-800">Packing List</h3>
          <span className="text-sm text-gray-500">
            {packStats.packed}/{packStats.total}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter Button */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`p-2 rounded-lg text-sm flex items-center gap-1 transition-colors ${
              filterTripId ? 'bg-emerald-100 text-emerald-700' : 'text-gray-500 hover:bg-gray-100'
            }`}
          >
            <Filter className="w-4 h-4" />
            {filterTripId && <span className="text-xs">Filtered</span>}
          </button>
          
          {packStats.unpacked > 0 && (
            <button
              onClick={packAll}
              className="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
              title="Pack all items"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {packStats.packed > 0 && (
            <button
              onClick={unpackAll}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
              title="Unpack all items"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => setShowAddItem(!showAddItem)}
            className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-sm flex items-center gap-1"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg">
          <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Trip</label>
          <select
            value={filterTripId}
            onChange={(e) => setFilterTripId(e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="">All Items</option>
            {userTrips.map((trip) => (
              <option key={trip.id} value={trip.id}>
                {trip.title || trip.name} - {new Date(trip.startDate).toLocaleDateString()}
              </option>
            ))}
          </select>
          {filterTripId && (
            <button
              onClick={() => setFilterTripId('')}
              className="mt-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* Selected Trip Banner */}
      {filterTripId && selectedTrip && (
        <div className="mb-4 p-2 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-emerald-600" />
            <span className="text-sm font-medium text-emerald-800">
              {selectedTrip.title || selectedTrip.name}
            </span>
            <span className="text-xs text-emerald-600">
              {new Date(selectedTrip.startDate).toLocaleDateString()}
            </span>
          </div>
          <button
            onClick={() => setFilterTripId('')}
            className="text-emerald-600 hover:text-emerald-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 transition-all duration-300"
            style={{ width: `${packStats.progress}%` }}
          />
        </div>
        <p className="text-xs text-gray-500 mt-1 text-right">{packStats.progress}% packed</p>
      </div>

      {/* Add Item Form */}
      {showAddItem && (
        <div className="mb-4 p-4 bg-emerald-50 rounded-lg space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Item name..."
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              onKeyDown={(e) => e.key === 'Enter' && addPackItem()}
              autoFocus
            />
          </div>
          <div className="flex gap-2">
            <select
              value={newItemCategory}
              onChange={(e) => setNewItemCategory(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {PACK_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              value={newItemTripId}
              onChange={(e) => setNewItemTripId(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">No Trip (General)</option>
              {userTrips.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  🗓️ {trip.title || trip.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setShowAddItem(false)}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
            >
              Cancel
            </button>
            <button
              onClick={addPackItem}
              disabled={!newItemName.trim()}
              className="bg-emerald-500 hover:bg-emerald-600 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm flex items-center gap-1"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          </div>
        </div>
      )}

      {/* Items List */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : packItems.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Package className="w-12 h-12 mx-auto mb-2 text-gray-300" />
          <p>{filterTripId ? 'No items for this trip yet.' : 'No items yet.'}</p>
          <p className="text-sm">Add your first item!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {packItems.map((item) => {
            const tripName = getTripName(item);
            return (
              <div
                key={item.id}
                className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                  item.isPacked
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-gray-100 hover:border-emerald-200'
                }`}
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => togglePackItem(item.id)}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all flex-shrink-0 ${
                      item.isPacked
                        ? 'bg-emerald-500 border-emerald-500 text-white'
                        : 'border-gray-300 hover:border-emerald-400'
                    }`}
                  >
                    {item.isPacked && <Check className="w-4 h-4" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`font-medium truncate ${item.isPacked ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {item.name}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span>{item.category}</span>
                      {item.quantity > 1 && <span>× {item.quantity}</span>}
                      {tripName && (
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                          🗓️ {tripName}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => deletePackItem(item.id)}
                  className="text-gray-400 hover:text-red-500 p-1 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Quick Add for Selected Trip */}
      {userTrips.length > 0 && !showAddItem && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-gray-500 mb-2">Quick add to trip:</p>
          <div className="flex flex-wrap gap-2">
            {userTrips.slice(0, 3).map((trip) => (
              <button
                key={trip.id}
                onClick={() => {
                  setNewItemTripId(trip.id);
                  setShowAddItem(true);
                }}
                className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors flex items-center gap-1"
              >
                <Calendar className="w-3 h-3" />
                {trip.title || trip.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
