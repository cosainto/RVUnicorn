import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Lock, Users, MapPin, DollarSign, Upload, Image as ImageIcon, Calendar, Clock, History, Package, ChevronDown, ChevronUp, CheckCircle, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface GearItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  notes?: string;
  visibility: 'PRIVATE' | 'EVENT' | 'CAMPGROUND';
  borrowable: boolean;
  rulesText?: string;
  imageUrl?: string;
  forSale: boolean;
  price?: number;
  saleDescription?: string;
  createdAt: string;
  // New fields
  lastUsedAt?: string;
  lastUsedEventId?: string;
  lastUsedTripId?: string;
  brand?: string;
  model?: string;
  condition?: string;
  weight?: number;
  purchaseDate?: string;
  purchasePrice?: number;
}

interface UpcomingTrip {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  campground?: {
    id: string;
    name: string;
    state: string;
  };
}

interface UsageHistoryItem {
  id: string;
  packedAt: string;
  tripName: string;
  campground?: string;
  state?: string;
  date: string;
}

interface GearStats {
  totalItems: number;
  byCategory: { category: string; count: number }[];
  borrowable: number;
  forSale: number;
  notRecentlyUsed: number;
}

const GEAR_CATEGORIES = [
  'Kitchen',
  'Sleep',
  'Shelter',
  'Tools',
  'Fun',
  'Safety',
  'Clothing',
  'Electronics',
  'First Aid',
  'Other'
];

const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'New', color: 'text-green-600' },
  { value: 'EXCELLENT', label: 'Excellent', color: 'text-green-500' },
  { value: 'GOOD', label: 'Good', color: 'text-blue-600' },
  { value: 'FAIR', label: 'Fair', color: 'text-yellow-600' },
  { value: 'WORN', label: 'Worn', color: 'text-orange-600' },
];

const VISIBILITY_OPTIONS = [
  { value: 'PRIVATE', label: 'Private', icon: Lock, description: 'Only you can see' },
  { value: 'EVENT', label: 'Event Only', icon: Users, description: 'Event attendees can see' },
  { value: 'CAMPGROUND', label: 'Campground', icon: MapPin, description: 'Campground neighbors can see' },
];

export default function MyGear() {
  const { user } = useAuth();
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingItem, setEditingItem] = useState<GearItem | null>(null);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBorrowable, setFilterBorrowable] = useState(false);
  const [filterForSale, setFilterForSale] = useState(false);
  const [filterNotUsed, setFilterNotUsed] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [stats, setStats] = useState<GearStats | null>(null);
  const [showStats, setShowStats] = useState(true);
  
  // Add to trip modal
  const [showAddToTripModal, setShowAddToTripModal] = useState(false);
  const [addToTripGear, setAddToTripGear] = useState<GearItem | null>(null);
  const [upcomingTrips, setUpcomingTrips] = useState<{ events: UpcomingTrip[]; trips: UpcomingTrip[] }>({ events: [], trips: [] });
  const [loadingTrips, setLoadingTrips] = useState(false);
  
  // History modal
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyGear, setHistoryGear] = useState<GearItem | null>(null);
  const [usageHistory, setUsageHistory] = useState<UsageHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    category: 'Other',
    quantity: 1,
    notes: '',
    visibility: 'PRIVATE' as 'PRIVATE' | 'EVENT' | 'CAMPGROUND',
    borrowable: false,
    rulesText: '',
    forSale: false,
    price: '',
    saleDescription: '',
    brand: '',
    model: '',
    condition: 'GOOD',
    weight: '',
    purchaseDate: '',
    purchasePrice: '',
  });

  useEffect(() => {
    loadGear();
    loadStats();
  }, []);

  const loadGear = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);
      if (filterBorrowable) params.append('borrowable', 'true');
      if (filterForSale) params.append('forSale', 'true');

      const { data } = await api.get(`/gear?${params.toString()}`);
      setGearItems(data);
    } catch (error) {
      console.error('Load gear error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/gear/stats/summary');
      setStats(data);
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  useEffect(() => {
    loadGear();
  }, [filterCategory, filterBorrowable, filterForSale]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Image must be smaller than 10MB');
        return;
      }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      alert('Please enter an item name');
      return;
    }

    try {
      const submitData = new FormData();
      submitData.append('name', formData.name);
      submitData.append('category', formData.category);
      submitData.append('quantity', formData.quantity.toString());
      submitData.append('notes', formData.notes);
      submitData.append('visibility', formData.visibility);
      submitData.append('borrowable', formData.borrowable.toString());
      submitData.append('rulesText', formData.rulesText);
      submitData.append('forSale', formData.forSale.toString());
      submitData.append('brand', formData.brand);
      submitData.append('model', formData.model);
      submitData.append('condition', formData.condition);
      if (formData.weight) submitData.append('weight', formData.weight);
      if (formData.purchaseDate) submitData.append('purchaseDate', formData.purchaseDate);
      if (formData.purchasePrice) submitData.append('purchasePrice', formData.purchasePrice);
      if (formData.price) submitData.append('price', formData.price);
      if (formData.saleDescription) submitData.append('saleDescription', formData.saleDescription);
      if (selectedImage) submitData.append('image', selectedImage);

      if (editingItem) {
        await api.put(`/gear/${editingItem.id}`, submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Item updated! ✅');
      } else {
        await api.post('/gear', submitData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        alert('Item added! 🎒');
      }

      closeModal();
      await loadGear();
      await loadStats();
    } catch (error) {
      console.error('Save gear error:', error);
      alert('Failed to save item');
    }
  };

  const closeModal = () => {
    setShowAddModal(false);
    setEditingItem(null);
    setSelectedImage(null);
    setImagePreview('');
    setFormData({
      name: '',
      category: 'Other',
      quantity: 1,
      notes: '',
      visibility: 'PRIVATE',
      borrowable: false,
      rulesText: '',
      forSale: false,
      price: '',
      saleDescription: '',
      brand: '',
      model: '',
      condition: 'GOOD',
      weight: '',
      purchaseDate: '',
      purchasePrice: '',
    });
  };

  const handleEdit = (item: GearItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      notes: item.notes || '',
      visibility: item.visibility,
      borrowable: item.borrowable,
      rulesText: item.rulesText || '',
      forSale: item.forSale,
      price: item.price?.toString() || '',
      saleDescription: item.saleDescription || '',
      brand: item.brand || '',
      model: item.model || '',
      condition: item.condition || 'GOOD',
      weight: item.weight?.toString() || '',
      purchaseDate: item.purchaseDate?.split('T')[0] || '',
      purchasePrice: item.purchasePrice?.toString() || '',
    });
    setImagePreview(item.imageUrl || '');
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gear item?')) return;

    try {
      await api.delete(`/gear/${id}`);
      alert('Item deleted');
      await loadGear();
      await loadStats();
    } catch (error) {
      console.error('Delete gear error:', error);
      alert('Failed to delete item');
    }
  };

  // Add to Trip functionality
  const openAddToTrip = async (item: GearItem) => {
    setAddToTripGear(item);
    setShowAddToTripModal(true);
    setLoadingTrips(true);
    
    try {
      const { data } = await api.get('/gear/trips/upcoming');
      setUpcomingTrips(data);
    } catch (error) {
      console.error('Load trips error:', error);
    } finally {
      setLoadingTrips(false);
    }
  };

  const handleAddToTrip = async (tripId?: string, eventId?: string) => {
    if (!addToTripGear) return;
    
    try {
      await api.post(`/gear/${addToTripGear.id}/add-to-trip`, {
        tripId,
        eventId,
        quantity: 1
      });
      alert('Added to pack list! 📦');
      setShowAddToTripModal(false);
      setAddToTripGear(null);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to add to trip');
    }
  };

  // History functionality
  const openHistory = async (item: GearItem) => {
    setHistoryGear(item);
    setShowHistoryModal(true);
    setLoadingHistory(true);
    
    try {
      const { data } = await api.get(`/gear/${item.id}/history`);
      setUsageHistory(data.usageHistory);
    } catch (error) {
      console.error('Load history error:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const getLastUsedText = (item: GearItem) => {
    if (!item.lastUsedAt) return 'Never used';
    
    const lastUsed = new Date(item.lastUsedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Used today';
    if (diffDays === 1) return 'Used yesterday';
    if (diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays < 30) return `Used ${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `Used ${Math.floor(diffDays / 30)} months ago`;
    return `Used ${Math.floor(diffDays / 365)} years ago`;
  };

  const getLastUsedColor = (item: GearItem) => {
    if (!item.lastUsedAt) return 'text-gray-400';
    
    const lastUsed = new Date(item.lastUsedAt);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return 'text-green-600';
    if (diffDays < 90) return 'text-blue-600';
    if (diffDays < 180) return 'text-yellow-600';
    return 'text-orange-600';
  };

  const getVisibilityIcon = (visibility: string) => {
    const option = VISIBILITY_OPTIONS.find(o => o.value === visibility);
    if (!option) return null;
    const Icon = option.icon;
    return <Icon className="w-4 h-4" />;
  };

  const filteredItems = gearItems.filter(item => {
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (filterNotUsed) {
      if (item.lastUsedAt) {
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (new Date(item.lastUsedAt) > sixMonthsAgo) return false;
      }
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Gear</h2>
          <p className="text-sm text-gray-600">Track your camping equipment and add items to trips</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-5 h-5" />
          Add Gear
        </button>
      </div>

      {/* Stats Summary */}
      {stats && (
        <div className="bg-white rounded-lg shadow-sm p-4">
          <button
            onClick={() => setShowStats(!showStats)}
            className="flex items-center justify-between w-full"
          >
            <span className="font-medium text-gray-900">Gear Summary</span>
            {showStats ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
          </button>
          
          {showStats && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-2xl font-bold text-gray-900">{stats.totalItems}</div>
                <div className="text-xs text-gray-600">Total Items</div>
              </div>
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">{stats.borrowable}</div>
                <div className="text-xs text-gray-600">Borrowable</div>
              </div>
              <div className="text-center p-3 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{stats.forSale}</div>
                <div className="text-xs text-gray-600">For Sale</div>
              </div>
              <div className="text-center p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100"
                   onClick={() => setFilterNotUsed(!filterNotUsed)}>
                <div className="text-2xl font-bold text-orange-600">{stats.notRecentlyUsed}</div>
                <div className="text-xs text-gray-600">Not Used (6mo+)</div>
              </div>
              <div className="text-center p-3 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{stats.byCategory.length}</div>
                <div className="text-xs text-gray-600">Categories</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap gap-4">
          <input
            type="text"
            placeholder="Search gear..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          />
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
          >
            <option value="">All Categories</option>
            {GEAR_CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterNotUsed}
              onChange={(e) => setFilterNotUsed(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Not used in 6mo</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterBorrowable}
              onChange={(e) => setFilterBorrowable(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">Borrowable</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterForSale}
              onChange={(e) => setFilterForSale(e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded"
            />
            <span className="text-sm text-gray-700">For Sale</span>
          </label>
        </div>
      </div>

      {/* Gear Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading gear...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No gear items</h3>
          <p className="text-gray-600 mb-4">Start building your gear inventory!</p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add Your First Item
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
              {/* Image */}
              <div className="h-40 bg-gray-100 relative">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-12 h-12 text-gray-300" />
                  </div>
                )}
                
                {/* Category badge */}
                <span className="absolute top-2 left-2 px-2 py-1 bg-white/90 rounded-full text-xs font-medium">
                  {item.category}
                </span>
                
                {/* For sale badge */}
                {item.forSale && (
                  <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white rounded-full text-xs font-medium">
                    ${item.price}
                  </span>
                )}
              </div>

              {/* Content */}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{item.name}</h3>
                    {item.brand && (
                      <p className="text-sm text-gray-600">{item.brand} {item.model}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-gray-400">
                    {getVisibilityIcon(item.visibility)}
                    {item.borrowable && <Users className="w-4 h-4 text-blue-500" />}
                  </div>
                </div>

                {/* Last used indicator */}
                <div className={`flex items-center gap-1 text-sm mb-3 ${getLastUsedColor(item)}`}>
                  <Clock className="w-4 h-4" />
                  <span>{getLastUsedText(item)}</span>
                </div>

                {/* Quantity & Condition */}
                <div className="flex items-center gap-3 text-sm text-gray-600 mb-3">
                  {item.quantity > 1 && (
                    <span>Qty: {item.quantity}</span>
                  )}
                  {item.condition && (
                    <span className={CONDITION_OPTIONS.find(c => c.value === item.condition)?.color}>
                      {item.condition}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 pt-3 border-t">
                  <button
                    onClick={() => openAddToTrip(item)}
                    className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 text-sm font-medium"
                  >
                    <Calendar className="w-4 h-4" />
                    Add to Trip
                  </button>
                  <button
                    onClick={() => openHistory(item)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="View history"
                  >
                    <History className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleEdit(item)}
                    className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                    title="Edit"
                  >
                    <Edit2 className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg"
                    title="Delete"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-gray-900">
                  {editingItem ? 'Edit Gear Item' : 'Add Gear Item'}
                </h3>
                <button onClick={closeModal} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Coleman 4-Person Tent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Coleman"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Sundome"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {GEAR_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
                  <select
                    value={formData.condition}
                    onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  >
                    {CONDITION_OPTIONS.map(opt => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={formData.weight}
                    onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., 5.5"
                  />
                </div>
              </div>

              {/* Purchase Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Date</label>
                  <input
                    type="date"
                    value={formData.purchaseDate}
                    onChange={(e) => setFormData({ ...formData, purchaseDate: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Purchase Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.purchasePrice}
                    onChange={(e) => setFormData({ ...formData, purchasePrice: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., 149.99"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Any notes about this item..."
                />
              </div>

              {/* Image */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
                <div className="flex items-center gap-4">
                  {imagePreview && (
                    <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                    <Upload className="w-5 h-5 text-gray-500" />
                    <span className="text-sm text-gray-600">Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageSelect}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {/* Visibility */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visibility</label>
                <div className="flex gap-3">
                  {VISIBILITY_OPTIONS.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, visibility: opt.value as any })}
                        className={`flex-1 p-3 rounded-lg border-2 text-center transition-all ${
                          formData.visibility === opt.value
                            ? 'border-primary-500 bg-primary-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <Icon className="w-5 h-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-gray-500">{opt.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Borrowable */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.borrowable}
                  onChange={(e) => setFormData({ ...formData, borrowable: e.target.checked })}
                  className="w-5 h-5 text-primary-600 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900">Allow borrowing</div>
                  <div className="text-sm text-gray-500">Other campers at your campground can request to borrow this item</div>
                </div>
              </label>

              {formData.borrowable && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Borrowing Rules</label>
                  <textarea
                    value={formData.rulesText}
                    onChange={(e) => setFormData({ ...formData, rulesText: e.target.value })}
                    rows={2}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    placeholder="e.g., Please return within 24 hours, handle with care"
                  />
                </div>
              )}

              {/* For Sale */}
              <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={formData.forSale}
                  onChange={(e) => setFormData({ ...formData, forSale: e.target.checked })}
                  className="w-5 h-5 text-green-600 rounded"
                />
                <div>
                  <div className="font-medium text-gray-900">List for sale</div>
                  <div className="text-sm text-gray-500">This item will appear in the marketplace</div>
                </div>
              </label>

              {formData.forSale && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="0.00"
                      required={formData.forSale}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Sale Description</label>
                    <input
                      type="text"
                      value={formData.saleDescription}
                      onChange={(e) => setFormData({ ...formData, saleDescription: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                      placeholder="e.g., Lightly used, great condition"
                    />
                  </div>
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  {editingItem ? 'Update Item' : 'Add Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add to Trip Modal */}
      {showAddToTripModal && addToTripGear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Add to Trip</h3>
                <button onClick={() => setShowAddToTripModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                Add <strong>{addToTripGear.name}</strong> to a trip's pack list
              </p>
            </div>

            <div className="p-6">
              {loadingTrips ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : upcomingTrips.events.length === 0 && upcomingTrips.trips.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming trips</p>
                  <Link to="/events" className="text-primary-600 hover:underline text-sm">
                    Plan a trip →
                  </Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.events.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Events</h4>
                      <div className="space-y-2">
                        {upcomingTrips.events.map(event => (
                          <button
                            key={event.id}
                            onClick={() => handleAddToTrip(undefined, event.id)}
                            className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{event.title}</div>
                            <div className="text-sm text-gray-600">
                              {formatDate(event.startDate)}
                              {event.campground && ` • ${event.campground.name}, ${event.campground.state}`}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {upcomingTrips.trips.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Trip Plans</h4>
                      <div className="space-y-2">
                        {upcomingTrips.trips.map(trip => (
                          <button
                            key={trip.id}
                            onClick={() => handleAddToTrip(trip.id)}
                            className="w-full p-3 text-left border rounded-lg hover:bg-gray-50 transition-colors"
                          >
                            <div className="font-medium text-gray-900">{trip.title}</div>
                            <div className="text-sm text-gray-600">{formatDate(trip.startDate)}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Usage History Modal */}
      {showHistoryModal && historyGear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Usage History</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{historyGear.name}</p>
            </div>

            <div className="p-6">
              {loadingHistory ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                </div>
              ) : usageHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No usage history yet</p>
                  <p className="text-sm text-gray-500">This item hasn't been packed for any trips</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usageHistory.map((history, index) => (
                    <div key={history.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{history.tripName}</div>
                        <div className="text-sm text-gray-600">
                          {formatDate(history.date)}
                          {history.campground && ` • ${history.campground}, ${history.state}`}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
