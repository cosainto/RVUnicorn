import { useState, useEffect } from 'react';
import { Plus, X, Edit2, Trash2, Eye, EyeOff, Lock, Users, MapPin, DollarSign, Upload, Image as ImageIcon } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');

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
  });

  useEffect(() => {
    loadGear();
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

    if (formData.forSale && !formData.price) {
      alert('Please enter a price for items for sale');
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
      if (formData.price) {
        submitData.append('price', formData.price);
      }
      if (formData.saleDescription) {
        submitData.append('saleDescription', formData.saleDescription);
      }
      if (selectedImage) {
        submitData.append('image', selectedImage);
      }

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
      });
      await loadGear();
    } catch (error) {
      console.error('Save gear error:', error);
      alert('Failed to save item');
    }
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
    });
    setImagePreview(item.imageUrl ? `${item.imageUrl}` : '');
    setShowAddModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this gear item?')) return;

    try {
      await api.delete(`/gear/${id}`);
      alert('Item deleted');
      await loadGear();
    } catch (error) {
      console.error('Delete gear error:', error);
      alert('Failed to delete item');
    }
  };

  const getVisibilityIcon = (visibility: string) => {
    const option = VISIBILITY_OPTIONS.find(o => o.value === visibility);
    return option ? option.icon : Lock;
  };

  const filteredItems = gearItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading gear...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Gear</h2>
        <button
          onClick={() => {
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
            });
            setShowAddModal(true);
          }}
          className="btn btn-primary flex items-center"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search gear..."
            className="input"
          />
          
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

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterBorrowable}
              onChange={(e) => setFilterBorrowable(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>Borrowable only</span>
          </label>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={filterForSale}
              onChange={(e) => setFilterForSale(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span>For sale only</span>
          </label>
        </div>
      </div>

      {/* Gear List */}
      {filteredItems.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => {
            const VisibilityIcon = getVisibilityIcon(item.visibility);
            return (
              <div key={item.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition">
                {/* Image */}
                {item.imageUrl ? (
                  <img
                    src={`${item.imageUrl}`}
                    alt={item.name}
                    className="w-full h-48 object-cover"
                  />
                ) : (
                  <div className="w-full h-48 bg-gray-200 flex items-center justify-center">
                    <ImageIcon className="w-16 h-16 text-gray-400" />
                  </div>
                )}

                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-900">{item.name}</h3>
                      <p className="text-sm text-gray-600">{item.category}</p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(item)}
                        className="p-1 text-gray-600 hover:text-primary-600 transition"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        className="p-1 text-gray-600 hover:text-red-600 transition"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Quantity:</span>
                      <span className="font-medium">{item.quantity}</span>
                    </div>

                    {item.notes && (
                      <p className="text-gray-600 text-xs italic">{item.notes}</p>
                    )}

                    {item.forSale && item.price && (
                      <div className="bg-green-50 border border-green-200 rounded p-2">
                        <div className="flex items-center gap-1 text-green-700 font-bold">
                          <DollarSign className="w-4 h-4" />
                          ${item.price.toFixed(2)}
                        </div>
                        {item.saleDescription && (
                          <p className="text-xs text-green-600 mt-1">{item.saleDescription}</p>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-2 border-t border-gray-200">
                      <VisibilityIcon className="w-4 h-4 text-gray-500" />
                      <span className="text-xs text-gray-600">
                        {VISIBILITY_OPTIONS.find(o => o.value === item.visibility)?.label}
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      {item.borrowable && (
                        <div className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                          ✓ Borrowable
                        </div>
                      )}
                      {item.forSale && (
                        <div className="bg-green-50 text-green-700 px-2 py-1 rounded text-xs">
                          💰 For Sale
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-md">
          <p className="text-gray-600 mb-4">
            {searchTerm || filterCategory || filterBorrowable || filterForSale
              ? 'No gear items match your filters'
              : 'No gear items yet'}
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
          >
            Add Your First Item
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="bg-gradient-to-r from-primary-500 to-primary-600 text-white p-6 rounded-t-lg">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">
                  {editingItem ? 'Edit Gear Item' : 'Add Gear Item'}
                </h2>
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                    setSelectedImage(null);
                    setImagePreview('');
                  }}
                  className="text-white hover:text-gray-200"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              {/* Image Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Item Photo (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-primary-500 transition">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                    id="gear-image-upload"
                  />
                  <label htmlFor="gear-image-upload" className="cursor-pointer">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Preview"
                        className="max-h-48 mx-auto rounded-lg mb-2"
                      />
                    ) : (
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                    )}
                    <p className="text-gray-600">Click to upload image</p>
                    <p className="text-sm text-gray-500 mt-1">PNG, JPG, GIF (max 10MB)</p>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  required
                  placeholder="Camp stove, sleeping bag, etc."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="input"
                    required
                  >
                    {GEAR_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                    className="input"
                    min="1"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="input"
                  placeholder="Brand, size, special features..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visibility *
                </label>
                <div className="space-y-2">
                  {VISIBILITY_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    return (
                      <label key={option.value} className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition">
                        <input
                          type="radio"
                          value={option.value}
                          checked={formData.visibility === option.value}
                          onChange={(e) => setFormData({ ...formData, visibility: e.target.value as any })}
                          className="mt-1"
                        />
                        <Icon className="w-5 h-5 text-gray-600 mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium text-gray-900">{option.label}</p>
                          <p className="text-sm text-gray-600">{option.description}</p>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* For Sale Section */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer mb-3">
                  <input
                    type="checkbox"
                    checked={formData.forSale}
                    onChange={(e) => setFormData({ ...formData, forSale: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="font-medium text-gray-900 flex items-center gap-1">
                    <DollarSign className="w-4 h-4" />
                    List this item for sale
                  </span>
                </label>

                {formData.forSale && (
                  <div className="space-y-3 ml-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Price *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2.5 text-gray-600">$</span>
                        <input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                          className="input pl-7"
                          placeholder="0.00"
                          required={formData.forSale}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sale Description
                      </label>
                      <textarea
                        value={formData.saleDescription}
                        onChange={(e) => setFormData({ ...formData, saleDescription: e.target.value })}
                        rows={2}
                        className="input"
                        placeholder="Condition, reason for selling, etc..."
                      />
                    </div>
                  </div>
                )}
              </div>

              {(formData.visibility === 'EVENT' || formData.visibility === 'CAMPGROUND') && (
                <div className="border-t pt-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.borrowable}
                      onChange={(e) => setFormData({ ...formData, borrowable: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <span className="font-medium text-gray-900">Allow others to borrow this item</span>
                  </label>

                  {formData.borrowable && (
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Borrowing Rules (Optional)
                      </label>
                      <textarea
                        value={formData.rulesText}
                        onChange={(e) => setFormData({ ...formData, rulesText: e.target.value })}
                        rows={2}
                        className="input"
                        placeholder="e.g., Please return same day, Ask first, etc."
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t">
                <button type="submit" className="btn btn-primary flex-1">
                  {editingItem ? 'Save Changes' : 'Add Item'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setEditingItem(null);
                    setSelectedImage(null);
                    setImagePreview('');
                  }}
                  className="btn btn-secondary"
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
