import { useState, useEffect } from 'react';
import { DollarSign, MapPin, User, Search, Package } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Link } from 'react-router-dom';

interface MarketplaceItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  notes?: string;
  visibility: string;
  imageUrl?: string;
  price: number;
  saleDescription?: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
  createdAt: string;
}

const GEAR_CATEGORIES = [
  'Kitchen',
  'Sleep',
  'Shelter',
  'Tools',
  'Fun',
  'Safety',
  'Other'
];

export default function GearMarketplace() {
  const { user } = useAuth();
  const [items, setItems] = useState<MarketplaceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItem, setSelectedItem] = useState<MarketplaceItem | null>(null);
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactMessage, setContactMessage] = useState('');

  useEffect(() => {
    loadMarketplace();
  }, [filterCategory]);

  const loadMarketplace = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filterCategory) params.append('category', filterCategory);

      const { data } = await api.get(`/gear/marketplace?${params.toString()}`);
      setItems(data);
    } catch (error) {
      console.error('Load marketplace error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleContact = async () => {
    if (!selectedItem || !contactMessage.trim()) {
      alert('Please enter a message');
      return;
    }

    try {
      await api.post('/messages', {
        receiverId: selectedItem.user.id,
        content: `Hi! I'm interested in your ${selectedItem.name} listed for $${selectedItem.price}.\n\n${contactMessage}`,
      });

      setShowContactModal(false);
      setSelectedItem(null);
      setContactMessage('');
      alert('Message sent! Check your messages for their response. ✅');
    } catch (error) {
      console.error('Send message error:', error);
      alert('Failed to send message');
    }
  };

  const filteredItems = items.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.saleDescription?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading marketplace...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Gear Marketplace</h2>
        <p className="text-gray-600">Browse camping gear for sale from the community</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search gear..."
              className="input pl-10"
            />
          </div>
          
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="input"
          >
            <option value="">All Categories</option>
            {GEAR_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Marketplace Grid */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => (
            <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-xl transition">
              {/* Image */}
              {item.imageUrl ? (
                <img
                  src={`http://127.0.0.1:3001${item.imageUrl}`}
                  alt={item.name}
                  className="w-full h-48 object-cover"
                />
              ) : (
                <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                  <Package className="w-16 h-16 text-gray-400" />
                </div>
              )}

              <div className="p-4">
                {/* Price Badge */}
                <div className="bg-green-600 text-white px-3 py-1 rounded-full inline-flex items-center gap-1 font-bold mb-3">
                  <DollarSign className="w-4 h-4" />
                  {item.price.toFixed(2)}
                </div>

                {/* Item Details */}
                <h3 className="font-bold text-gray-900 text-lg mb-1">{item.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{item.category}</p>

                {item.saleDescription && (
                  <p className="text-sm text-gray-700 mb-3 line-clamp-2">{item.saleDescription}</p>
                )}

                {item.notes && (
                  <p className="text-xs text-gray-600 mb-3 italic">{item.notes}</p>
                )}

                <div className="flex items-center justify-between text-sm text-gray-600 mb-3">
                  <span>Qty: {item.quantity}</span>
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.visibility === 'CAMPGROUND' ? 'Community' : 'Friends'}
                  </span>
                </div>

                {/* Seller Info */}
                <div className="border-t border-gray-200 pt-3 mb-3">
                  <Link
                    to={`/profile/${item.user.username}`}
                    className="flex items-center gap-2 hover:text-primary-600 transition"
                  >
                    {item.user.profilePicture ? (
                      <img
                        src={`http://127.0.0.1:3001${item.user.profilePicture}`}
                        alt={item.user.firstName}
                        className="w-8 h-8 rounded-full"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <User className="w-4 h-4 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {item.user.firstName} {item.user.lastName}
                      </p>
                      <p className="text-xs text-gray-600">@{item.user.username}</p>
                    </div>
                  </Link>
                </div>

                {/* Contact Button */}
                <button
                  onClick={() => {
                    setSelectedItem(item);
                    setContactMessage('');
                    setShowContactModal(true);
                  }}
                  className="btn btn-primary w-full"
                >
                  Contact Seller
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">
            {searchTerm || filterCategory
              ? 'No items match your search'
              : 'No items for sale yet'}
          </p>
        </div>
      )}

      {/* Contact Modal */}
      {showContactModal && selectedItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-lg w-full">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <h2 className="text-2xl font-bold">Contact Seller</h2>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                {selectedItem.imageUrl && (
                  <img
                    src={`http://127.0.0.1:3001${selectedItem.imageUrl}`}
                    alt={selectedItem.name}
                    className="w-16 h-16 rounded object-cover"
                  />
                )}
                <div className="flex-1">
                  <p className="font-bold text-gray-900">{selectedItem.name}</p>
                  <p className="text-sm text-gray-600">{selectedItem.category}</p>
                  <p className="font-bold text-green-600">${selectedItem.price.toFixed(2)}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-600 mb-2">
                  Send a message to {selectedItem.user.firstName}:
                </p>
                <textarea
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  rows={4}
                  className="input"
                  placeholder="Ask questions about condition, availability, pickup location, etc..."
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleContact}
                  className="btn btn-primary flex-1"
                >
                  Send Message
                </button>
                <button
                  onClick={() => {
                    setShowContactModal(false);
                    setSelectedItem(null);
                  }}
                  className="btn btn-secondary"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
