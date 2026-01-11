import { useState, useEffect } from 'react';
import { Plus, X, Package, Users, Edit2, Trash2, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface EventPackListProps {
  eventId: string;
  isOrganizer: boolean;
}

interface PackItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  isChecked: boolean;
  notes?: string;
  assignedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    username: string;
    profilePicture?: string;
  };
}

const CATEGORIES = [
  { name: 'Food & Cooking', icon: '🍳', color: 'bg-orange-50 border-orange-200' },
  { name: 'Shelter & Sleep', icon: '⛺', color: 'bg-blue-50 border-blue-200' },
  { name: 'Clothing', icon: '👕', color: 'bg-purple-50 border-purple-200' },
  { name: 'First Aid', icon: '🏥', color: 'bg-red-50 border-red-200' },
  { name: 'Tools & Gear', icon: '🔧', color: 'bg-gray-50 border-gray-200' },
  { name: 'Entertainment', icon: '🎮', color: 'bg-green-50 border-green-200' },
  { name: 'Personal Items', icon: '🎒', color: 'bg-yellow-50 border-yellow-200' },
  { name: 'Other', icon: '📦', color: 'bg-pink-50 border-pink-200' },
];

export default function EventPackList({ eventId, isOrganizer }: EventPackListProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<PackItem[]>([]);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState<PackItem | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    category: 'Other',
    quantity: 1,
    assignedTo: '',
    notes: '',
  });

  useEffect(() => {
    loadItems();
    loadAttendees();
  }, [eventId]);

  const loadItems = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/trip-packing/event/${eventId}`);
      setItems(data.items || []);
      if (data.attendees) setAttendees(data.attendees);
    } catch (error) {
      console.error('Load pack items error:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAttendees = async () => {
    try {
      const { data } = await api.get(`/events/${eventId}/attendees`);
      setAttendees(data);
    } catch (error) {
      console.error('Load attendees error:', error);
    }
  };

  const openAddModal = () => {
    setEditingItem(null);
    setFormData({ name: '', category: 'Other', quantity: 1, assignedTo: '', notes: '' });
    setShowModal(true);
  };

  const openEditModal = (item: PackItem) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
      quantity: item.quantity,
      assignedTo: item.assignedUser?.id || '',
      notes: item.notes || '',
    });
    setShowModal(true);
  };

  const handleSaveItem = async () => {
    if (!formData.name || !formData.category) {
      alert('Please enter item name and select a category');
      return;
    }

    try {
      const payload = {
        eventId,
        customName: formData.name,
        customCategory: formData.category,
        quantity: formData.quantity,
        assignedToId: formData.assignedTo || null,
      };

      if (editingItem) {
        await api.put(`/trip-packing/${editingItem.id}`, payload);
        
        // Notify if assigned to someone
        if (formData.assignedTo) {
          const assignedPerson = attendees.find(a => a.id === formData.assignedTo);
          alert(`✅ ${assignedPerson?.firstName} will be notified about this item!`);
        }
      } else {
        await api.post('/trip-packing', payload);
        
        // Notify if assigned to someone
        if (formData.assignedTo) {
          const assignedPerson = attendees.find(a => a.id === formData.assignedTo);
          alert(`✅ ${assignedPerson?.firstName} will be notified to bring: ${formData.name}!`);
        }
      }
      
      setShowModal(false);
      setEditingItem(null);
      setFormData({ name: '', category: 'Other', quantity: 1, assignedTo: '', notes: '' });
      await loadItems();
    } catch (error) {
      console.error('Save pack item error:', error);
      alert('Failed to save item');
    }
  };

  const handleToggleCheck = async (item: PackItem) => {
    try {
      const newCheckedState = !item.isChecked;
      
      await api.put(`/trip-packing/${item.id}/toggle`, {
        isChecked: newCheckedState
      });
      
      // Notify if someone else assigned this item and it's being checked
      if (newCheckedState && item.assignedUser && item.assignedUser.id !== user?.id) {
        console.log(`📧 Notification: ${user?.firstName} marked "${item.name}" as packed (assigned to ${item.assignedUser.firstName})`);
      }
      
      await loadItems();
    } catch (error) {
      console.error('Toggle check error:', error);
      alert('Failed to update item');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm('Remove this item from the pack list?')) return;

    try {
      await api.delete(`/trip-packing/${itemId}`);
      await loadItems();
    } catch (error) {
      console.error('Delete item error:', error);
      alert('Failed to delete item');
    }
  };

  const getItemsByCategory = (category: string) => {
    return items.filter(item => item.category === category);
  };

  const getTotalItems = () => items.length;
  const getCheckedItems = () => items.filter(item => item.isChecked).length;
  const getProgress = () => {
    const total = getTotalItems();
    return total === 0 ? 0 : Math.round((getCheckedItems() / total) * 100);
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading pack list...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-r from-blue-500 to-purple-500 p-3 rounded-xl shadow-lg">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Pack List</h2>
            <p className="text-sm text-gray-600">
              📦 Collaborative packing for THIS event • Each event has its own list!
            </p>
          </div>
        </div>
        <button
          onClick={openAddModal}
          className="btn btn-primary flex items-center shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
        >
          <Plus className="w-5 h-5 mr-2" />
          Add Item
        </button>
      </div>

      {/* Progress Bar */}
      {getTotalItems() > 0 && (
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-700">
              Packing Progress: {getCheckedItems()} of {getTotalItems()} items
            </span>
            <span className="text-sm font-bold text-primary-600">{getProgress()}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="bg-gradient-to-r from-green-500 to-blue-500 h-4 rounded-full transition-all duration-500"
              style={{ width: `${getProgress()}%` }}
            />
          </div>
        </div>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {CATEGORIES.map((category) => {
          const categoryItems = getItemsByCategory(category.name);
          
          if (categoryItems.length === 0) return null;

          return (
            <div key={category.name} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className={`${category.color} border-b-2 p-4 flex items-center justify-between`}>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{category.icon}</span>
                  <div>
                    <h3 className="font-bold text-gray-900">{category.name}</h3>
                    <p className="text-xs text-gray-600">
                      {categoryItems.filter(i => i.isChecked).length} of {categoryItems.length} packed
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 space-y-2">
                {categoryItems.map((item) => (
                  <div
                    key={item.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border-2 transition group ${
                      item.isChecked
                        ? 'bg-green-50 border-green-200'
                        : 'bg-gray-50 border-gray-200 hover:border-primary-300'
                    }`}
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggleCheck(item)}
                      className={`w-6 h-6 rounded flex items-center justify-center border-2 transition flex-shrink-0 ${
                        item.isChecked
                          ? 'bg-green-500 border-green-500'
                          : 'bg-white border-gray-300 hover:border-green-500'
                      }`}
                    >
                      {item.isChecked && <Check className="w-4 h-4 text-white" />}
                    </button>

                    {/* Item Details */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`font-semibold ${item.isChecked ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                          {item.name}
                        </span>
                        {item.quantity > 1 && (
                          <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full">
                            x{item.quantity}
                          </span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-3 mt-1">
                        {item.assignedUser && (
                          <div className="flex items-center gap-1 text-xs text-gray-600">
                            <Users className="w-3 h-3" />
                            <span>{item.assignedUser.firstName} {item.assignedUser.lastName}</span>
                          </div>
                        )}
                        {item.notes && (
                          <span className="text-xs text-gray-500 italic truncate">
                            "{item.notes}"
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                      <button
                        onClick={() => openEditModal(item)}
                        className="bg-blue-500 text-white p-1.5 rounded hover:bg-blue-600 transition shadow"
                        title="Edit item"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        className="bg-red-500 text-white p-1.5 rounded hover:bg-red-600 transition shadow"
                        title="Delete item"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        {getTotalItems() === 0 && (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">No items yet</h3>
            <p className="text-gray-600 mb-4">Start building your pack list for this trip!</p>
            <button onClick={openAddModal} className="btn btn-primary">
              <Plus className="w-5 h-5 mr-2" />
              Add First Item
            </button>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-2xl">
            <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white p-6 rounded-t-xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Package className="w-8 h-8" />
                  <h2 className="text-2xl font-bold">
                    {editingItem ? 'Edit Item' : 'Add Item'}
                  </h2>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-white hover:bg-white hover:bg-opacity-20 p-2 rounded-lg transition"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Item Name */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Item Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Tent, Sleeping bag, Flashlight"
                  required
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="input w-full"
                  required
                >
                  {CATEGORIES.map((cat) => (
                    <option key={cat.name} value={cat.name}>
                      {cat.icon} {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: parseInt(e.target.value) || 1 })}
                  className="input w-full"
                />
              </div>

              {/* Assigned To */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Who's Bringing It? (Optional)
                </label>
                <select
                  value={formData.assignedTo}
                  onChange={(e) => setFormData({ ...formData, assignedTo: e.target.value })}
                  className="input w-full"
                >
                  <option value="">Not assigned</option>
                  {attendees.map((attendee) => (
                    <option key={attendee.id} value={attendee.id}>
                      {attendee.firstName} {attendee.lastName}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 They'll be notified when you assign them!
                </p>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  rows={2}
                  className="input w-full"
                  placeholder="Any special notes or details..."
                />
              </div>

              {/* Submit */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleSaveItem}
                  className="btn btn-primary flex-1 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 transition"
                  disabled={!formData.name || !formData.category}
                >
                  {editingItem ? '💾 Save Changes' : '✨ Add Item'}
                </button>
                <button
                  onClick={() => setShowModal(false)}
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
