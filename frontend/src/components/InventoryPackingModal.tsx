import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Package, Plus, Check, ChevronDown, ChevronRight,
  Trash2, Search, Save, CheckCircle, Circle, User
} from 'lucide-react';
import api from '../services/api';

interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  notes?: string;
  assignedTrips: any[];
}

interface TripPackItem {
  id: string;
  inventoryItemId?: string;
  customName?: string;
  name: string;
  category: string;
  quantity: number;
  isPacked: boolean;
  assignedToId?: string;
  assignedTo?: { id: string; firstName: string; lastName: string; };
  assignmentStatus: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  tripId?: string;
  eventId?: string;
  mode?: 'inventory' | 'trip' | 'event';
}

const CATEGORIES = ['Kitchen', 'Sleeping', 'Clothing', 'Safety', 'Recreation', 'Hygiene', 'Electronics', 'General'];
const CATEGORY_ICONS: Record<string, string> = {
  Kitchen: '🍳', Sleeping: '🛏️', Clothing: '👕', Safety: '🩹',
  Recreation: '🎣', Hygiene: '🧼', Electronics: '🔌', General: '📦'
};

export default function InventoryPackingModal({ isOpen, onClose, tripId, eventId, mode = 'inventory' }: Props) {
  const [activeTab, setActiveTab] = useState<'inventory' | 'packing' | 'templates'>(mode === 'inventory' ? 'inventory' : 'packing');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [packItems, setPackItems] = useState<TripPackItem[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [starterTemplates, setStarterTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES));
  const [newItemName, setNewItemName] = useState('');
  const [newItemCategory, setNewItemCategory] = useState('General');
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showAddCustom, setShowAddCustom] = useState(false);
  const [showCreateTemplate, setShowCreateTemplate] = useState(false);
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [eventInfo, setEventInfo] = useState<any>(null);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [isOrganizer, setIsOrganizer] = useState(false);
  const [stats, setStats] = useState({ total: 0, packed: 0, unpacked: 0, progress: 0 });

  const loadInventory = useCallback(async () => {
    try {
      const { data } = await api.get('/inventory');
      setInventory(data.items || []);
    } catch (error) {
      console.error('Failed to load inventory:', error);
    }
  }, []);

  const loadPackingList = useCallback(async () => {
    if (!tripId && !eventId) return;
    try {
      const endpoint = tripId ? `/trip-packing/trip/${tripId}` : `/trip-packing/event/${eventId}`;
      const { data } = await api.get(endpoint);
      setPackItems(data.items || []);
      setStats(data.stats || { total: 0, packed: 0, unpacked: 0, progress: 0 });
      if (data.event) { setEventInfo(data.event); setIsOrganizer(data.isOrganizer); }
      if (data.attendees) setAttendees(data.attendees);
    } catch (error) {
      console.error('Failed to load packing list:', error);
    }
  }, [tripId, eventId]);

  const loadTemplates = useCallback(async () => {
    try {
      const { data } = await api.get('/pack-templates');
      setTemplates(data.myTemplates || []);
      setStarterTemplates(data.starterTemplates || []);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const loadData = async () => {
      setLoading(true);
      await Promise.all([loadInventory(), loadPackingList(), loadTemplates()]);
      setLoading(false);
    };
    loadData();
  }, [isOpen, loadInventory, loadPackingList, loadTemplates]);

  const addInventoryItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await api.post('/inventory', { name: newItemName.trim(), category: newItemCategory, quantity: newItemQuantity });
      setNewItemName('');
      setNewItemQuantity(1);
      await loadInventory();
    } catch (error) {
      console.error('Failed to add item:', error);
    }
  };

  const deleteInventoryItem = async (id: string) => {
    if (!confirm('Delete this item?')) return;
    try {
      await api.delete(`/inventory/${id}`);
      await loadInventory();
    } catch (error) {
      console.error('Failed to delete:', error);
    }
  };

  const addFromInventory = async (inventoryItemId: string) => {
    try {
      await api.post('/trip-packing', { tripId, eventId, inventoryItemId });
      await loadPackingList();
      await loadInventory();
    } catch (error) {
      console.error('Failed to add:', error);
    }
  };

  const addCustomItem = async () => {
    if (!newItemName.trim()) return;
    try {
      await api.post('/trip-packing', { tripId, eventId, customName: newItemName.trim(), customCategory: newItemCategory });
      setNewItemName('');
      setShowAddCustom(false);
      await loadPackingList();
    } catch (error) {
      console.error('Failed to add:', error);
    }
  };

  const togglePacked = async (itemId: string) => {
    try {
      await api.put(`/trip-packing/${itemId}/toggle`);
      await loadPackingList();
    } catch (error) {
      console.error('Failed to toggle:', error);
    }
  };

  const removeFromPackingList = async (itemId: string) => {
    try {
      await api.delete(`/trip-packing/${itemId}`);
      await loadPackingList();
    } catch (error) {
      console.error('Failed to remove:', error);
    }
  };

  const assignItem = async (itemId: string, userId: string | null) => {
    try {
      await api.put(`/trip-packing/${itemId}/assign`, { assignedToId: userId });
      await loadPackingList();
    } catch (error) {
      console.error('Failed to assign:', error);
    }
  };

  const applyTemplate = async (templateId: string, isStarter: boolean = false, starterIndex?: number) => {
    try {
      const endpoint = isStarter ? `/pack-templates/starter/${starterIndex}/apply` : `/pack-templates/${templateId}/apply`;
      await api.post(endpoint, { tripId, eventId, useInventory: true });
      await loadPackingList();
      setActiveTab('packing');
    } catch (error) {
      console.error('Failed to apply:', error);
    }
  };

  const copyTemplateToInventory = async (items: any[], templateName: string) => {
    try {
      for (const item of items) {
        await api.post('/inventory', {
          name: item.name,
          category: item.category || 'General',
          quantity: item.quantity || 1
        });
      }
      await loadInventory();
      alert(`Added ${items.length} items from "${templateName}" to your inventory!`);
    } catch (error) {
      console.error('Failed to copy template:', error);
      alert('Failed to copy some items');
    }
  };

  const createTemplateFromInventory = async () => {
    if (!newTemplateName.trim()) {
      alert('Please enter a template name');
      return;
    }
    if (inventory.length === 0) {
      alert('Add items to your inventory first');
      return;
    }
    try {
      await api.post('/pack-templates', {
        name: newTemplateName.trim(),
        description: newTemplateDescription.trim() || null,
        privacy: 'PRIVATE',
        items: inventory.map(item => ({
          name: item.name,
          category: item.category,
          quantity: item.quantity
        }))
      });
      setNewTemplateName('');
      setNewTemplateDescription('');
      setShowCreateTemplate(false);
      await loadTemplates();
      alert('Template created!');
    } catch (error) {
      console.error('Failed to create template:', error);
      alert('Failed to create template');
    }
  };

  const saveAsTemplate = async () => {
    const name = prompt('Template name:');
    if (!name) return;
    try {
      await api.post('/pack-templates/from-trip', { tripId, eventId, name, privacy: 'PRIVATE' });
      await loadTemplates();
      alert('Template saved!');
    } catch (error) {
      console.error('Failed to save:', error);
    }
  };

  const deleteTemplate = async (templateId: string) => {
    if (!confirm('Delete this template?')) return;
    try {
      await api.delete('/pack-templates/' + templateId);
      await loadTemplates();
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const unpackAll = async () => {
    if (!confirm('Unpack all items?')) return;
    try {
      await api.post('/trip-packing/unpack-all', { tripId, eventId });
      await loadPackingList();
    } catch (error) {
      console.error('Failed to unpack:', error);
    }
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const filteredPackItems = packItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = filterCategory === 'all' || item.category === filterCategory;
    return matchesSearch && matchesCategory;
  });

  const groupedInventory = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredInventory.filter(i => i.category === cat);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const groupedPackItems = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = filteredPackItems.filter(i => i.category === cat);
    return acc;
  }, {} as Record<string, TripPackItem[]>);

  const isInPackingList = (inventoryItemId: string) => packItems.some(p => p.inventoryItemId === inventoryItemId);

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(category)) newExpanded.delete(category);
    else newExpanded.add(category);
    setExpandedCategories(newExpanded);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75" onClick={onClose} />
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 w-full max-w-4xl max-h-[90vh] flex flex-col">
          
          {/* Header */}
          <div className="bg-gradient-to-r from-green-600 to-green-700 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Package className="w-6 h-6 text-white" />
                <h2 className="text-xl font-bold text-white">
                  {mode === 'inventory' ? 'My Inventory' : 'Packing List'}
                </h2>
              </div>
              <button onClick={onClose} className="text-white hover:text-green-100">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'inventory' ? 'bg-white text-green-700' : 'bg-green-500 text-white hover:bg-green-400'}`}>
                📦 Inventory ({inventory.length})
              </button>
              {(tripId || eventId) && (
                <button onClick={() => setActiveTab('packing')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'packing' ? 'bg-white text-green-700' : 'bg-green-500 text-white hover:bg-green-400'}`}>
                  ✓ Packing ({stats.packed}/{stats.total})
                </button>
              )}
              <button onClick={() => setActiveTab('templates')} className={`px-4 py-2 rounded-lg text-sm font-medium ${activeTab === 'templates' ? 'bg-white text-green-700' : 'bg-green-500 text-white hover:bg-green-400'}`}>
                📋 Templates
              </button>
            </div>
          </div>

          {/* Progress Bar */}
          {activeTab === 'packing' && stats.total > 0 && (
            <div className="px-6 py-3 bg-gray-50 border-b">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Progress</span>
                <span className="text-sm text-gray-600">{stats.packed}/{stats.total} ({stats.progress}%)</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div className={`h-2.5 rounded-full ${stats.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${stats.progress}%` }} />
              </div>
              {stats.progress === 100 && <p className="text-green-600 text-sm mt-2 font-medium">🎉 All packed!</p>}
            </div>
          )}

          {/* Search & Filter */}
          <div className="px-6 py-3 border-b bg-gray-50 flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px] relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm" />
            </div>
            <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
              <option value="all">All Categories</option>
              {CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>)}
            </select>
            {activeTab === 'packing' && stats.total > 0 && (
              <button onClick={unpackAll} className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">↩️ Unpack All</button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600" />
              </div>
            ) : (
              <>
                {/* INVENTORY TAB */}
                {activeTab === 'inventory' && (
                  <div>
                    <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
                      <h3 className="font-medium text-gray-900 mb-3">Add to Inventory</h3>
                      {(tripId || eventId) && (
                        <p className="text-sm text-blue-600 mb-3 bg-blue-50 p-2 rounded">
                          💡 Click the green "+ Add" button next to any item to add it to this event's pack list
                        </p>
                      )}
                      <div className="flex flex-wrap gap-3">
                        <input type="text" placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addInventoryItem()} className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm" />
                        <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                          {CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>)}
                        </select>
                        <input type="number" min="1" value={newItemQuantity} onChange={(e) => setNewItemQuantity(parseInt(e.target.value) || 1)} className="w-16 px-3 py-2 border rounded-lg text-sm text-center" />
                        <button onClick={addInventoryItem} disabled={!newItemName.trim()} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
                          <Plus className="w-4 h-4" /> Add
                        </button>
                      </div>
                    </div>

                    {inventory.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <Package className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>Your inventory is empty</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {CATEGORIES.map(category => {
                          const items = groupedInventory[category];
                          if (items.length === 0) return null;
                          return (
                            <div key={category} className="border rounded-lg overflow-hidden">
                              <button onClick={() => toggleCategory(category)} className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100">
                                <span className="font-medium">{CATEGORY_ICONS[category]} {category} ({items.length})</span>
                                {expandedCategories.has(category) ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                              </button>
                              {expandedCategories.has(category) && (
                                <div className="divide-y">
                                  {items.map(item => (
                                    <div key={item.id} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50">
                                      <div>
                                        <span className="font-medium">{item.name}</span>
                                        {item.quantity > 1 && <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">×{item.quantity}</span>}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {(tripId || eventId) ? (
                                          <button onClick={() => addFromInventory(item.id)} disabled={isInPackingList(item.id)} className={`px-3 py-2 text-sm rounded-lg font-medium ${isInPackingList(item.id) ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-green-500 text-white hover:bg-green-600"}`}>
                                            {isInPackingList(item.id) ? '✓ Added' : '+ Add to Pack List'}
                                          </button>
                                        ) : null}
                                        <button onClick={() => deleteInventoryItem(item.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* PACKING TAB */}
                {activeTab === 'packing' && (
                  <div>
                    <div className="mb-6 flex gap-3">
                      <button onClick={() => setActiveTab('inventory')} className="px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 flex items-center gap-2">
                        <Package className="w-4 h-4" /> Add from Inventory
                      </button>
                      <button onClick={() => setShowAddCustom(!showAddCustom)} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 flex items-center gap-2">
                        <Plus className="w-4 h-4" /> Add Custom
                      </button>
                      {packItems.length > 0 && (
                        <button onClick={saveAsTemplate} className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 flex items-center gap-2 ml-auto">
                          <Save className="w-4 h-4" /> Save Template
                        </button>
                      )}
                    </div>

                    {showAddCustom && (
                      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                        <div className="flex flex-wrap gap-3">
                          <input type="text" placeholder="Item name..." value={newItemName} onChange={(e) => setNewItemName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addCustomItem()} className="flex-1 min-w-[200px] px-3 py-2 border rounded-lg text-sm" />
                          <select value={newItemCategory} onChange={(e) => setNewItemCategory(e.target.value)} className="px-3 py-2 border rounded-lg text-sm">
                            {CATEGORIES.map(cat => <option key={cat} value={cat}>{CATEGORY_ICONS[cat]} {cat}</option>)}
                          </select>
                          <button onClick={addCustomItem} disabled={!newItemName.trim()} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">Add</button>
                          <button onClick={() => setShowAddCustom(false)} className="px-4 py-2 text-gray-600">Cancel</button>
                        </div>
                      </div>
                    )}

                    {packItems.length === 0 ? (
                      <div className="text-center py-12 text-gray-500">
                        <CheckCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                        <p>No items yet. Add from inventory or use a template.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {CATEGORIES.map(category => {
                          const items = groupedPackItems[category];
                          if (items.length === 0) return null;
                          const categoryPacked = items.filter(i => i.isPacked).length;
                          return (
                            <div key={category} className="border rounded-lg overflow-hidden">
                              <button onClick={() => toggleCategory(category)} className="w-full px-4 py-3 bg-gray-50 flex items-center justify-between hover:bg-gray-100">
                                <span className="font-medium">{CATEGORY_ICONS[category]} {category}</span>
                                <span className={`text-sm ${categoryPacked === items.length ? 'text-green-600' : 'text-gray-500'}`}>{categoryPacked}/{items.length}</span>
                              </button>
                              {expandedCategories.has(category) && (
                                <div className="divide-y">
                                  {items.map(item => (
                                    <div key={item.id} className={`px-4 py-3 flex items-center gap-3 ${item.isPacked ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                      <button onClick={() => togglePacked(item.id)}>
                                        {item.isPacked ? <CheckCircle className="w-6 h-6 text-green-600" /> : <Circle className="w-6 h-6 text-gray-300 hover:text-green-500" />}
                                      </button>
                                      <div className="flex-1">
                                        <span className={`font-medium ${item.isPacked ? 'text-gray-500 line-through' : ''}`}>{item.name}</span>
                                        {item.quantity > 1 && <span className="ml-2 text-xs bg-gray-200 px-2 py-0.5 rounded-full">×{item.quantity}</span>}
                                        {item.assignedTo && (
                                          <div className="mt-1 flex items-center gap-1 text-sm">
                                            <User className="w-3 h-3" />
                                            <span className={item.assignmentStatus === 'ACCEPTED' ? 'text-green-600' : item.assignmentStatus === 'DECLINED' ? 'text-red-600' : 'text-yellow-600'}>
                                              {item.assignedTo.firstName} {item.assignedTo.lastName}
                                              {item.assignmentStatus === 'PENDING' && ' (pending)'}
                                            </span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {eventId && isOrganizer && attendees.length > 0 && (
                                          <select value={item.assignedToId || ''} onChange={(e) => assignItem(item.id, e.target.value || null)} className="text-sm border rounded-lg px-2 py-1">
                                            <option value="">Unassigned</option>
                                            {attendees.map(a => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                                          </select>
                                        )}
                                        <button onClick={() => removeFromPackingList(item.id)} className="p-1.5 text-gray-400 hover:text-red-500">
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* TEMPLATES TAB */}
                {activeTab === 'templates' && (
                  <div>
                    {/* Create New Template */}
                    <div className="mb-6">
                      {!showCreateTemplate ? (
                        <button
                          onClick={() => setShowCreateTemplate(true)}
                          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" /> Create New Template
                        </button>
                      ) : (
                        <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <h4 className="font-medium mb-3">Create Template from Inventory</h4>
                          <p className="text-sm text-gray-600 mb-3">This will save all {inventory.length} items in your inventory as a reusable template.</p>
                          <input
                            type="text"
                            placeholder="Template name..."
                            value={newTemplateName}
                            onChange={(e) => setNewTemplateName(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm mb-2"
                          />
                          <input
                            type="text"
                            placeholder="Description (optional)..."
                            value={newTemplateDescription}
                            onChange={(e) => setNewTemplateDescription(e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg text-sm mb-3"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={createTemplateFromInventory}
                              disabled={!newTemplateName.trim() || inventory.length === 0}
                              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
                            >
                              Save Template
                            </button>
                            <button
                              onClick={() => setShowCreateTemplate(false)}
                              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mb-8">
                      <h3 className="font-bold text-gray-900 mb-4">🚀 Starter Templates</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {starterTemplates.map((template, index) => (
                          <div key={index} className="border rounded-lg p-4 hover:border-green-500">
                            <h4 className="font-medium">{template.name}</h4>
                            <p className="text-sm text-gray-500 mt-1">{template.description}</p>
                            <p className="text-xs text-gray-400 mt-2">{template.items.length} items</p>
                            {(tripId || eventId) ? (
                              <button onClick={() => applyTemplate('', true, index)} className="mt-3 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm w-full">
                                Use Template
                              </button>
                            ) : (
                              <button onClick={() => copyTemplateToInventory(template.items, template.name)} className="mt-3 px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 text-sm w-full">
                                Copy to Inventory
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 mb-4">📁 My Templates</h3>
                      {templates.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg">
                          <p>No saved templates yet</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {templates.map(template => (
                            <div key={template.id} className="border rounded-lg p-4 hover:border-green-500">
                              <h4 className="font-medium">{template.name}</h4>
                              <p className="text-xs text-gray-400 mt-2">{(template.items as any[]).length} items</p>
                              {(tripId || eventId) && (
                                <button onClick={() => applyTemplate(template.id)} className="mt-3 px-4 py-2 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 text-sm w-full">
                                  Use Template
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
