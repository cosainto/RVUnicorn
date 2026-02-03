import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Lock, Users, MapPin, Upload, Calendar, Clock, History, Package, ChevronDown, ChevronUp, CheckCircle, ShoppingCart, ExternalLink, MessageCircle, Store, Sparkles } from 'lucide-react';
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
  lastUsedAt?: string;
  lastUsedEventId?: string;
  lastUsedTripId?: string;
  brand?: string;
  model?: string;
  condition?: string;
  weight?: number;
  purchaseDate?: string;
  purchasePrice?: number;
  // For marketplace items
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
    homeState?: string;
  };
  siteNumber?: string;
  type?: 'user-sale' | 'campground-sale' | 'sponsored';
}

interface SponsoredAd {
  id: string;
  type: 'sponsored';
  name: string;
  brand: string;
  description?: string;
  imageUrl: string;
  linkUrl: string;
  category: string;
  advertiser?: string;
  advertiserLogo?: string;
}

interface UpcomingTrip {
  id: string;
  title: string;
  startDate: string;
  endDate?: string;
  campground?: { id: string; name: string; state: string };
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

interface MarketplaceData {
  items: GearItem[];
  campground?: { id: string; name: string; state: string };
  totalSellers?: number;
  message?: string;
}

const GEAR_CATEGORIES = ['Kitchen', 'Sleep', 'Shelter', 'Tools', 'Fun', 'Safety', 'Clothing', 'Electronics', 'First Aid', 'Other'];
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
  const [activeTab, setActiveTab] = useState<'my-gear' | 'marketplace' | 'nearby'>('my-gear');
  const [gearItems, setGearItems] = useState<GearItem[]>([]);
  const [sponsoredAds, setSponsoredAds] = useState<SponsoredAd[]>([]);
  const [marketplaceItems, setMarketplaceItems] = useState<GearItem[]>([]);
  const [nearbyMarketplace, setNearbyMarketplace] = useState<MarketplaceData | null>(null);
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
  
  // Buy new / affiliate
  const [showBuyModal, setShowBuyModal] = useState(false);
  const [buySearchQuery, setBuySearchQuery] = useState('');
  const [affiliateLinks, setAffiliateLinks] = useState<any[]>([]);
  
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
  
  // Contact seller modal
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactItem, setContactItem] = useState<GearItem | null>(null);
  const [contactMessage, setContactMessage] = useState('');

  const [formData, setFormData] = useState({
    name: '', category: 'Other', quantity: 1, notes: '',
    visibility: 'PRIVATE' as 'PRIVATE' | 'EVENT' | 'CAMPGROUND',
    borrowable: false, rulesText: '', forSale: false, price: '', saleDescription: '',
    brand: '', model: '', condition: 'GOOD', weight: '', purchaseDate: '', purchasePrice: '',
  });

  useEffect(() => {
    loadGear();
    loadStats();
    loadSponsoredAds();
    loadNearbyMarketplace();
  }, []);

  useEffect(() => {
    if (activeTab === 'marketplace') {
      loadMarketplace();
    }
  }, [activeTab]);

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

  const loadSponsoredAds = async () => {
    try {
      const { data } = await api.get('/gear-ads/sponsored?limit=2');
      setSponsoredAds(data);
    } catch (error) {
      console.error('Load sponsored ads error:', error);
    }
  };

  const loadMarketplace = async () => {
    try {
      const { data } = await api.get('/gear-ads/marketplace/all?limit=50');
      setMarketplaceItems(data.items);
    } catch (error) {
      console.error('Load marketplace error:', error);
    }
  };

  const loadNearbyMarketplace = async () => {
    try {
      const { data } = await api.get('/gear-ads/marketplace/nearby');
      setNearbyMarketplace(data);
    } catch (error) {
      console.error('Load nearby marketplace error:', error);
    }
  };

  useEffect(() => { loadGear(); }, [filterCategory, filterBorrowable, filterForSale]);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) { alert('Image must be smaller than 10MB'); return; }
      setSelectedImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { alert('Please enter an item name'); return; }

    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([key, value]) => {
        if (value !== '' && value !== null) submitData.append(key, String(value));
      });
      if (selectedImage) submitData.append('image', selectedImage);

      if (editingItem) {
        await api.put(`/gear/${editingItem.id}`, submitData, { headers: { 'Content-Type': 'multipart/form-data' } });
        alert('Item updated! ✅');
      } else {
        await api.post('/gear', submitData, { headers: { 'Content-Type': 'multipart/form-data' } });
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
    setFormData({ name: '', category: 'Other', quantity: 1, notes: '', visibility: 'PRIVATE', borrowable: false, rulesText: '', forSale: false, price: '', saleDescription: '', brand: '', model: '', condition: 'GOOD', weight: '', purchaseDate: '', purchasePrice: '' });
  };

  const handleEdit = (item: GearItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name, category: item.category, quantity: item.quantity, notes: item.notes || '',
      visibility: item.visibility, borrowable: item.borrowable, rulesText: item.rulesText || '',
      forSale: item.forSale, price: item.price?.toString() || '', saleDescription: item.saleDescription || '',
      brand: item.brand || '', model: item.model || '', condition: item.condition || 'GOOD',
      weight: item.weight?.toString() || '', purchaseDate: item.purchaseDate?.split('T')[0] || '',
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

  // Sponsored ad click tracking
  const handleAdClick = async (ad: SponsoredAd) => {
    try {
      const { data } = await api.post(`/gear-ads/${ad.id}/click`);
      window.open(data.redirectUrl, '_blank');
    } catch (error) {
      window.open(ad.linkUrl, '_blank');
    }
  };

  // Buy new - affiliate links
  const openBuyNew = async (itemName: string) => {
    setBuySearchQuery(itemName);
    setShowBuyModal(true);
    try {
      const { data } = await api.get(`/gear-ads/affiliate/search/${encodeURIComponent(itemName)}`);
      setAffiliateLinks(data);
    } catch (error) {
      console.error('Load affiliate links error:', error);
    }
  };

  const handleAffiliateClick = async (link: any) => {
    try {
      await api.post('/gear-ads/affiliate/click', {
        retailer: link.retailer,
        productUrl: link.searchUrl,
        productName: buySearchQuery
      });
    } catch (error) {
      console.error('Track affiliate click error:', error);
    }
    window.open(link.searchUrl, '_blank');
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
      await api.post(`/gear/${addToTripGear.id}/add-to-trip`, { tripId, eventId, quantity: 1 });
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

  // Contact seller
  const openContactSeller = (item: GearItem) => {
    setContactItem(item);
    setContactMessage('');
    setShowContactModal(true);
  };

  const handleContactSeller = async () => {
    if (!contactItem) return;
    try {
      await api.post('/gear-ads/marketplace/contact', {
        gearItemId: contactItem.id,
        message: contactMessage
      });
      alert('Message sent to seller! 📨');
      setShowContactModal(false);
    } catch (error: any) {
      alert(error.response?.data?.error || 'Failed to contact seller');
    }
  };

  const getLastUsedText = (item: GearItem) => {
    if (!item.lastUsedAt) return 'Never used';
    const diffDays = Math.floor((new Date().getTime() - new Date(item.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return 'Used today';
    if (diffDays === 1) return 'Used yesterday';
    if (diffDays < 7) return `Used ${diffDays} days ago`;
    if (diffDays < 30) return `Used ${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `Used ${Math.floor(diffDays / 30)} months ago`;
    return `Used ${Math.floor(diffDays / 365)} years ago`;
  };

  const getLastUsedColor = (item: GearItem) => {
    if (!item.lastUsedAt) return 'text-gray-400';
    const diffDays = Math.floor((new Date().getTime() - new Date(item.lastUsedAt).getTime()) / (1000 * 60 * 60 * 24));
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
    if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterNotUsed) {
      if (item.lastUsedAt) {
        const sixMonthsAgo = new Date(); sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (new Date(item.lastUsedAt) > sixMonthsAgo) return false;
      }
    }
    return true;
  });

  const formatDate = (dateStr: string) => new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Combine gear with sponsored ads for display
  const getDisplayItems = () => {
    if (activeTab !== 'my-gear' || filteredItems.length === 0) return filteredItems;
    
    // Insert sponsored ads every 6 items
    const result: (GearItem | SponsoredAd)[] = [];
    let adIndex = 0;
    
    filteredItems.forEach((item, index) => {
      result.push(item);
      if ((index + 1) % 6 === 0 && adIndex < sponsoredAds.length) {
        result.push(sponsoredAds[adIndex]);
        adIndex++;
      }
    });
    
    return result;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">My Gear</h2>
          <p className="text-sm text-gray-600">Track equipment, shop deals & find gear at your campground</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => openBuyNew('')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            <ShoppingCart className="w-5 h-5" />
            Buy New Gear
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5" />
            Add Gear
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
        <button
          onClick={() => setActiveTab('my-gear')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'my-gear' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
        >
          🎒 My Gear
        </button>
        <button
          onClick={() => setActiveTab('nearby')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'nearby' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
        >
          📍 At My Campground
          {nearbyMarketplace && nearbyMarketplace.items.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
              {nearbyMarketplace.items.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('marketplace')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'marketplace' ? 'bg-white shadow text-gray-900' : 'text-gray-600 hover:text-gray-900'}`}
        >
          🛒 Marketplace
        </button>
      </div>

      {/* Nearby Campground Marketplace */}
      {activeTab === 'nearby' && (
        <div className="space-y-4">
          {nearbyMarketplace?.campground ? (
            <>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2 text-green-800">
                  <MapPin className="w-5 h-5" />
                  <span className="font-medium">Gear for sale at {nearbyMarketplace.campground.name}</span>
                </div>
                <p className="text-sm text-green-600 mt-1">
                  {nearbyMarketplace.totalSellers} camper{nearbyMarketplace.totalSellers !== 1 ? 's' : ''} selling gear
                </p>
              </div>
              
              {nearbyMarketplace.items.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow-sm">
                  <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900">No gear for sale here</h3>
                  <p className="text-gray-600">Check back later or browse the global marketplace</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {nearbyMarketplace.items.map(item => (
                    <MarketplaceItemCard 
                      key={item.id} 
                      item={item} 
                      onContact={() => openContactSeller(item)}
                      showSite={true}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <MapPin className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">Not checked into a campground</h3>
              <p className="text-gray-600 mb-4">Check into a campground to see gear from nearby campers</p>
              <Link to="/campgrounds" className="text-primary-600 hover:underline">
                Find a campground →
              </Link>
            </div>
          )}
        </div>
      )}

      {/* Global Marketplace */}
      {activeTab === 'marketplace' && (
        <div className="space-y-4">
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="flex flex-wrap gap-4">
              <input
                type="text"
                placeholder="Search marketplace..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Categories</option>
                {GEAR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          {marketplaceItems.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-lg shadow-sm">
              <Store className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No items for sale</h3>
              <p className="text-gray-600">Be the first to list something!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {marketplaceItems
                .filter(item => !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase()))
                .filter(item => !filterCategory || item.category === filterCategory)
                .map(item => (
                  <MarketplaceItemCard 
                    key={item.id} 
                    item={item} 
                    onContact={() => openContactSeller(item)}
                    showSite={false}
                  />
                ))}
            </div>
          )}
        </div>
      )}

      {/* My Gear Tab */}
      {activeTab === 'my-gear' && (
        <>
          {/* Stats Summary */}
          {stats && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <button onClick={() => setShowStats(!showStats)} className="flex items-center justify-between w-full">
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
                  <div className="text-center p-3 bg-orange-50 rounded-lg cursor-pointer hover:bg-orange-100" onClick={() => setFilterNotUsed(!filterNotUsed)}>
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
              <input type="text" placeholder="Search gear..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 min-w-[200px] px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500">
                <option value="">All Categories</option>
                {GEAR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterNotUsed} onChange={(e) => setFilterNotUsed(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-gray-700">Not used in 6mo</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterBorrowable} onChange={(e) => setFilterBorrowable(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-gray-700">Borrowable</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={filterForSale} onChange={(e) => setFilterForSale(e.target.checked)} className="w-4 h-4 text-primary-600 rounded" />
                <span className="text-sm text-gray-700">For Sale</span>
              </label>
            </div>
          </div>

          {/* Gear Grid with Sponsored Ads */}
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
              <button onClick={() => setShowAddModal(true)} className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                Add Your First Item
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getDisplayItems().map((item, index) => (
                'type' in item && item.type === 'sponsored' ? (
                  <SponsoredAdCard key={`ad-${item.id}`} ad={item as SponsoredAd} onClick={() => handleAdClick(item as SponsoredAd)} />
                ) : (
                  <GearItemCard
                    key={item.id}
                    item={item as GearItem}
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                    onAddToTrip={openAddToTrip}
                    onHistory={openHistory}
                    onBuyNew={openBuyNew}
                    getLastUsedText={getLastUsedText}
                    getLastUsedColor={getLastUsedColor}
                    getVisibilityIcon={getVisibilityIcon}
                  />
                )
              ))}
            </div>
          )}
        </>
      )}

      {/* Buy New Gear Modal */}
      {showBuyModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">🛒 Buy New Gear</h3>
                <button onClick={() => setShowBuyModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <input
                type="text"
                value={buySearchQuery}
                onChange={(e) => setBuySearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && openBuyNew(buySearchQuery)}
                placeholder="Search for gear..."
                className="w-full mt-3 px-4 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="p-6 space-y-3">
              <p className="text-sm text-gray-600 mb-4">Shop from our partner retailers:</p>
              {affiliateLinks.map(link => (
                <button
                  key={link.retailer}
                  onClick={() => handleAffiliateClick(link)}
                  className="w-full flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{link.logo}</span>
                    <span className="font-medium">{link.name}</span>
                  </div>
                  <ExternalLink className="w-5 h-5 text-gray-400" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Contact Seller Modal */}
      {showContactModal && contactItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Contact Seller</h3>
                <button onClick={() => setShowContactModal(false)} className="text-gray-500 hover:text-gray-700">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                {contactItem.imageUrl ? (
                  <img src={contactItem.imageUrl} alt={contactItem.name} className="w-16 h-16 object-cover rounded" />
                ) : (
                  <div className="w-16 h-16 bg-gray-200 rounded flex items-center justify-center"><Package className="w-8 h-8 text-gray-400" /></div>
                )}
                <div>
                  <div className="font-medium">{contactItem.name}</div>
                  <div className="text-green-600 font-bold">${contactItem.price}</div>
                  {contactItem.user && (
                    <div className="text-sm text-gray-600">Sold by {contactItem.user.firstName}</div>
                  )}
                </div>
              </div>
              <textarea
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                placeholder="Hi! Is this still available?"
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg"
              />
              <button onClick={handleContactSeller} className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
                <MessageCircle className="w-5 h-5 inline mr-2" />
                Send Message
              </button>
            </div>
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
                <button onClick={() => setShowAddToTripModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
              </div>
              <p className="text-sm text-gray-600 mt-1">Add <strong>{addToTripGear.name}</strong> to a trip's pack list</p>
            </div>
            <div className="p-6">
              {loadingTrips ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
              ) : upcomingTrips.events.length === 0 && upcomingTrips.trips.length === 0 ? (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No upcoming trips</p>
                  <Link to="/events" className="text-primary-600 hover:underline text-sm">Plan a trip →</Link>
                </div>
              ) : (
                <div className="space-y-4">
                  {upcomingTrips.events.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium text-gray-500 mb-2">Events</h4>
                      <div className="space-y-2">
                        {upcomingTrips.events.map(event => (
                          <button key={event.id} onClick={() => handleAddToTrip(undefined, event.id)}
                            className="w-full p-3 text-left border rounded-lg hover:bg-gray-50">
                            <div className="font-medium text-gray-900">{event.title}</div>
                            <div className="text-sm text-gray-600">{formatDate(event.startDate)}{event.campground && ` • ${event.campground.name}`}</div>
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
                          <button key={trip.id} onClick={() => handleAddToTrip(trip.id)}
                            className="w-full p-3 text-left border rounded-lg hover:bg-gray-50">
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

      {/* History Modal */}
      {showHistoryModal && historyGear && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900">Usage History</h3>
                <button onClick={() => setShowHistoryModal(false)} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
              </div>
              <p className="text-sm text-gray-600 mt-1">{historyGear.name}</p>
            </div>
            <div className="p-6">
              {loadingHistory ? (
                <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div></div>
              ) : usageHistory.length === 0 ? (
                <div className="text-center py-8">
                  <History className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600">No usage history yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {usageHistory.map(history => (
                    <div key={history.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <CheckCircle className="w-4 h-4 text-primary-600" />
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{history.tripName}</div>
                        <div className="text-sm text-gray-600">{formatDate(history.date)}{history.campground && ` • ${history.campground}`}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal - Keep existing but simplified here */}
      {showAddModal && (
        <AddEditGearModal
          editingItem={editingItem}
          formData={formData}
          setFormData={setFormData}
          imagePreview={imagePreview}
          handleImageSelect={handleImageSelect}
          handleSubmit={handleSubmit}
          closeModal={closeModal}
        />
      )}
    </div>
  );
}

// Sponsored Ad Card Component
function SponsoredAdCard({ ad, onClick }: { ad: SponsoredAd; onClick: () => void }) {
  return (
    <div className="bg-gradient-to-br from-amber-50 to-orange-50 border-2 border-amber-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <div className="h-40 bg-white relative">
        <img src={ad.imageUrl} alt={ad.name} className="w-full h-full object-cover" />
        <span className="absolute top-2 left-2 px-2 py-1 bg-amber-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
          <Sparkles className="w-3 h-3" /> Sponsored
        </span>
      </div>
      <div className="p-4">
        <div className="text-xs text-amber-700 font-medium mb-1">{ad.advertiser}</div>
        <h3 className="font-semibold text-gray-900">{ad.name}</h3>
        <p className="text-sm text-gray-600">{ad.brand}</p>
        {ad.description && <p className="text-sm text-gray-500 mt-1 line-clamp-2">{ad.description}</p>}
        <button className="mt-3 w-full py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 flex items-center justify-center gap-2">
          <ShoppingCart className="w-4 h-4" /> Shop Now
        </button>
      </div>
    </div>
  );
}

// Gear Item Card Component
function GearItemCard({ item, onEdit, onDelete, onAddToTrip, onHistory, onBuyNew, getLastUsedText, getLastUsedColor, getVisibilityIcon }: any) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-gray-100 relative">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : 
          <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-300" /></div>}
        <span className="absolute top-2 left-2 px-2 py-1 bg-white/90 rounded-full text-xs font-medium">{item.category}</span>
        {item.forSale && <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white rounded-full text-xs font-medium">${item.price}</span>}
      </div>
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h3 className="font-semibold text-gray-900">{item.name}</h3>
            {item.brand && <p className="text-sm text-gray-600">{item.brand} {item.model}</p>}
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            {getVisibilityIcon(item.visibility)}
            {item.borrowable && <Users className="w-4 h-4 text-blue-500" />}
          </div>
        </div>
        <div className={`flex items-center gap-1 text-sm mb-3 ${getLastUsedColor(item)}`}>
          <Clock className="w-4 h-4" />
          <span>{getLastUsedText(item)}</span>
        </div>
        <div className="flex items-center gap-2 pt-3 border-t">
          <button onClick={() => onAddToTrip(item)} className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary-50 text-primary-600 rounded-lg hover:bg-primary-100 text-sm font-medium">
            <Calendar className="w-4 h-4" /> Add to Trip
          </button>
          <button onClick={() => onBuyNew(item.name)} className="p-2 text-green-600 hover:text-green-700 hover:bg-green-50 rounded-lg" title="Buy new">
            <ShoppingCart className="w-5 h-5" />
          </button>
          <button onClick={() => onHistory(item)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="History">
            <History className="w-5 h-5" />
          </button>
          <button onClick={() => onEdit(item)} className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg" title="Edit">
            <Edit2 className="w-5 h-5" />
          </button>
          <button onClick={() => onDelete(item.id)} className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg" title="Delete">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}

// Marketplace Item Card Component
function MarketplaceItemCard({ item, onContact, showSite }: { item: GearItem; onContact: () => void; showSite: boolean }) {
  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      <div className="h-40 bg-gray-100 relative">
        {item.imageUrl ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" /> : 
          <div className="w-full h-full flex items-center justify-center"><Package className="w-12 h-12 text-gray-300" /></div>}
        <span className="absolute top-2 left-2 px-2 py-1 bg-white/90 rounded-full text-xs font-medium">{item.category}</span>
        <span className="absolute top-2 right-2 px-2 py-1 bg-green-500 text-white rounded-full text-xs font-bold">${item.price}</span>
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900">{item.name}</h3>
        {item.brand && <p className="text-sm text-gray-600">{item.brand}</p>}
        {item.user && (
          <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
            {item.user.profilePicture ? (
              <img src={item.user.profilePicture} alt="" className="w-6 h-6 rounded-full" />
            ) : (
              <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                {item.user.firstName?.[0]}
              </div>
            )}
            <span>{item.user.firstName}</span>
            {showSite && item.siteNumber && (
              <span className="text-primary-600">• Site {item.siteNumber}</span>
            )}
            {!showSite && item.user.homeState && (
              <span className="text-gray-400">• {item.user.homeState}</span>
            )}
          </div>
        )}
        <button onClick={onContact} className="mt-3 w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 flex items-center justify-center gap-2">
          <MessageCircle className="w-4 h-4" /> Contact Seller
        </button>
      </div>
    </div>
  );
}

// Add/Edit Gear Modal Component
function AddEditGearModal({ editingItem, formData, setFormData, imagePreview, handleImageSelect, handleSubmit, closeModal }: any) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b sticky top-0 bg-white">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">{editingItem ? 'Edit Gear Item' : 'Add Gear Item'}</h3>
            <button onClick={closeModal} className="text-gray-500 hover:text-gray-700"><X className="w-6 h-6" /></button>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
              <input type="text" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Coleman 4-Person Tent" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <input type="text" value={formData.brand} onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Coleman" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Model</label>
              <input type="text" value={formData.model} onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="e.g., Sundome" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                {GEAR_CATEGORIES.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Condition</label>
              <select value={formData.condition} onChange={(e) => setFormData({ ...formData, condition: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg">
                {CONDITION_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input type="number" min="1" value={formData.quantity} onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Weight (lbs)</label>
              <input type="number" step="0.1" value={formData.weight} onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={2}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Image</label>
            <div className="flex items-center gap-4">
              {imagePreview && <img src={imagePreview} alt="Preview" className="w-20 h-20 object-cover rounded-lg" />}
              <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <Upload className="w-5 h-5 text-gray-500" /><span className="text-sm text-gray-600">Upload Image</span>
                <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
              </label>
            </div>
          </div>
          <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="checkbox" checked={formData.forSale} onChange={(e) => setFormData({ ...formData, forSale: e.target.checked })}
              className="w-5 h-5 text-green-600 rounded" />
            <div>
              <div className="font-medium text-gray-900">List for sale</div>
              <div className="text-sm text-gray-500">This item will appear in the marketplace</div>
            </div>
          </label>
          {formData.forSale && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Price ($) *</label>
                <input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" required={formData.forSale} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <input type="text" value={formData.saleDescription} onChange={(e) => setFormData({ ...formData, saleDescription: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg" placeholder="Lightly used" />
              </div>
            </div>
          )}
          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={closeModal} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50">Cancel</button>
            <button type="submit" className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700">
              {editingItem ? 'Update Item' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
