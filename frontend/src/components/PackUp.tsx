import { useState, useEffect } from 'react';
import { Check, MapPin, Package, AlertTriangle, RotateCcw, ChevronDown, ChevronUp, Save, X, CheckCircle2, Clock, Info } from 'lucide-react';
import api from '../services/api';

interface PackUpItem {
  id: string;
  customName: string;
  customCategory: string;
  quantity: number;
  isPacked: boolean;
  packUpStatus: 'NOT_STARTED' | 'PACKED' | null;
  packedToLocation: string | null;
  packUpNote: string | null;
  leftBehind: boolean;
  gearItemId: string | null;
  gearItem?: {
    id: string;
    name: string;
    storageLocation: string | null;
    storageNotes: string | null;
  };
  defaultLocation: string | null;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
    profilePicture: string | null;
  };
}

interface PackUpStats {
  total: number;
  packed: number;
  leftBehind: number;
  notStarted: number;
}

interface PackUpProps {
  eventId?: string;
  tripId?: string;
  eventTitle: string;
  endDate: string;
}

export default function PackUp({ eventId, tripId, eventTitle, endDate }: PackUpProps) {
  const [items, setItems] = useState<PackUpItem[]>([]);
  const [stats, setStats] = useState<PackUpStats>({ total: 0, packed: 0, leftBehind: 0, notStarted: 0 });
  const [storageLocations, setStorageLocations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [customLocation, setCustomLocation] = useState('');
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [groupByCategory, setGroupByCategory] = useState(true);

  useEffect(() => {
    loadPackUpList();
  }, [eventId, tripId]);

  const loadPackUpList = async () => {
    try {
      setLoading(true);
      const endpoint = eventId ? `/packup/event/${eventId}` : `/packup/trip/${tripId}`;
      const { data } = await api.get(endpoint);
      setItems(data.items);
      setStats(data.stats);
      setStorageLocations(data.storageLocations || []);
    } catch (error) {
      console.error('Load pack-up list error:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateItem = async (itemId: string, updates: Partial<PackUpItem> & { saveAsDefault?: boolean }) => {
    try {
      await api.put(`/packup/item/${itemId}`, updates);
      
      // Update local state
      setItems(prev => prev.map(item => 
        item.id === itemId 
          ? { ...item, ...updates }
          : item
      ));
      
      // Recalculate stats
      setStats(prev => {
        const updatedItems = items.map(item => 
          item.id === itemId ? { ...item, ...updates } : item
        );
        return {
          total: updatedItems.length,
          packed: updatedItems.filter(i => i.packUpStatus === 'PACKED').length,
          leftBehind: updatedItems.filter(i => i.leftBehind).length,
          notStarted: updatedItems.filter(i => i.packUpStatus === 'NOT_STARTED' || !i.packUpStatus).length
        };
      });
    } catch (error) {
      console.error('Update item error:', error);
      alert('Failed to update item');
    }
  };

  const markAsPacked = async (item: PackUpItem) => {
    const location = item.packedToLocation || item.defaultLocation || '';
    await updateItem(item.id, {
      packUpStatus: 'PACKED',
      packedToLocation: location,
      leftBehind: false
    });
  };

  const markAsLeftBehind = async (item: PackUpItem) => {
    await updateItem(item.id, {
      packUpStatus: 'NOT_STARTED',
      leftBehind: true
    });
  };

  const undoPackUp = async (item: PackUpItem) => {
    await updateItem(item.id, {
      packUpStatus: 'NOT_STARTED',
      leftBehind: false
    });
  };

  const setLocation = async (itemId: string, location: string, saveAsDefault: boolean = false) => {
    await updateItem(itemId, {
      packedToLocation: location,
      saveAsDefault
    });
    setExpandedItem(null);
    setCustomLocation('');
  };

  const completePackUp = async () => {
    try {
      const endpoint = eventId ? `/packup/event/${eventId}/complete` : `/packup/trip/${tripId}/complete`;
      const { data } = await api.post(endpoint);
      
      alert(`🎉 Pack-up complete!\n${data.packedCount} items packed.${data.leftBehindCount > 0 ? `\n⚠️ ${data.leftBehindCount} items left behind.` : ''}`);
      
      setShowCompleteModal(false);
      loadPackUpList();
    } catch (error) {
      console.error('Complete pack-up error:', error);
      alert('Failed to complete pack-up');
    }
  };

  const resetPackUp = async () => {
    if (!confirm('Reset pack-up progress? This will clear all packed status.')) return;
    
    try {
      const endpoint = eventId ? `/packup/event/${eventId}/reset` : `/packup/trip/${tripId}/reset`;
      await api.post(endpoint);
      loadPackUpList();
    } catch (error) {
      console.error('Reset pack-up error:', error);
      alert('Failed to reset');
    }
  };

  const groupedItems = groupByCategory
    ? items.reduce((acc, item) => {
        const category = item.customCategory || 'Other';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
      }, {} as Record<string, PackUpItem[]>)
    : { 'All Items': items };

  const progress = stats.total > 0 ? Math.round((stats.packed / stats.total) * 100) : 0;
  const isComplete = stats.packed === stats.total && stats.total > 0;
  const tripEnding = new Date(endDate) <= new Date(Date.now() + 24 * 60 * 60 * 1000); // Within 24 hours

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900">No items to pack up</h3>
        <p className="text-gray-600">Add items to your pack list first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Progress */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Pack Up Checklist</h2>
            <p className="text-sm text-gray-600">
              {tripEnding ? '🚐 Time to pack up!' : 'Track items as you pack to leave'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetPackUp}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
              title="Reset progress"
            >
              <RotateCcw className="w-5 h-5" />
            </button>
            {progress > 0 && !isComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Complete Pack-Up
              </button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm mb-1">
            <span className="text-gray-600">{stats.packed} of {stats.total} items packed</span>
            <span className="font-medium text-gray-900">{progress}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary-600'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            <span>{stats.packed} packed</span>
          </div>
          <div className="flex items-center gap-1 text-gray-500">
            <Clock className="w-4 h-4" />
            <span>{stats.notStarted} remaining</span>
          </div>
          {stats.leftBehind > 0 && (
            <div className="flex items-center gap-1 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
              <span>{stats.leftBehind} left behind</span>
            </div>
          )}
        </div>

        {/* Completion celebration */}
        {isComplete && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle2 className="w-6 h-6" />
              <span className="font-medium">All packed up! Safe travels! 🚐</span>
            </div>
          </div>
        )}
      </div>

      {/* Group toggle */}
      <div className="flex justify-end">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={groupByCategory}
            onChange={(e) => setGroupByCategory(e.target.checked)}
            className="w-4 h-4 text-primary-600 rounded"
          />
          <span className="text-gray-700">Group by category</span>
        </label>
      </div>

      {/* Items List */}
      {Object.entries(groupedItems).map(([category, categoryItems]) => (
        <div key={category} className="bg-white rounded-lg shadow-sm overflow-hidden">
          {groupByCategory && (
            <div className="px-4 py-2 bg-gray-50 border-b">
              <h3 className="font-medium text-gray-700">{category}</h3>
            </div>
          )}
          
          <div className="divide-y">
            {categoryItems.map(item => (
              <div key={item.id} className="p-4">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <button
                    onClick={() => item.packUpStatus === 'PACKED' ? undoPackUp(item) : markAsPacked(item)}
                    className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-colors ${
                      item.packUpStatus === 'PACKED'
                        ? 'bg-green-500 border-green-500 text-white'
                        : item.leftBehind
                        ? 'bg-orange-100 border-orange-300'
                        : 'border-gray-300 hover:border-primary-500'
                    }`}
                  >
                    {item.packUpStatus === 'PACKED' && <Check className="w-5 h-5" />}
                    {item.leftBehind && <AlertTriangle className="w-4 h-4 text-orange-600" />}
                  </button>

                  {/* Item info */}
                  <div className="flex-1 min-w-0">
                    <div className={`font-medium ${item.packUpStatus === 'PACKED' ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {item.customName}
                      {item.quantity > 1 && <span className="text-gray-500 ml-1">×{item.quantity}</span>}
                    </div>
                    
                    {/* Location info */}
                    {(item.packedToLocation || item.defaultLocation) && (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <MapPin className="w-3 h-3" />
                        <span>{item.packedToLocation || item.defaultLocation}</span>
                        {item.packedToLocation && item.packedToLocation !== item.defaultLocation && (
                          <span className="text-xs text-primary-600">(custom)</span>
                        )}
                      </div>
                    )}

                    {/* Left behind note */}
                    {item.leftBehind && (
                      <div className="text-sm text-orange-600">⚠️ Marked as left behind</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {/* Location button */}
                    <button
                      onClick={() => setExpandedItem(expandedItem === item.id ? null : item.id)}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
                      title="Set storage location"
                    >
                      <MapPin className="w-5 h-5" />
                    </button>

                    {/* Left behind toggle */}
                    {item.packUpStatus !== 'PACKED' && (
                      <button
                        onClick={() => item.leftBehind ? undoPackUp(item) : markAsLeftBehind(item)}
                        className={`p-2 rounded-lg ${
                          item.leftBehind 
                            ? 'text-orange-600 bg-orange-50' 
                            : 'text-gray-400 hover:text-orange-600 hover:bg-orange-50'
                        }`}
                        title={item.leftBehind ? 'Undo left behind' : 'Mark as left behind'}
                      >
                        <AlertTriangle className="w-5 h-5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded location picker */}
                {expandedItem === item.id && (
                  <div className="mt-4 ml-11 p-4 bg-gray-50 rounded-lg">
                    <div className="text-sm font-medium text-gray-700 mb-2">Where is this stored?</div>
                    
                    {/* Quick location buttons */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {storageLocations.slice(0, 10).map(loc => (
                        <button
                          key={loc}
                          onClick={() => setLocation(item.id, loc, false)}
                          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
                            item.packedToLocation === loc
                              ? 'bg-primary-100 border-primary-300 text-primary-700'
                              : 'bg-white border-gray-200 hover:border-primary-300'
                          }`}
                        >
                          {loc}
                        </button>
                      ))}
                    </div>

                    {/* Custom location input */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={customLocation}
                        onChange={(e) => setCustomLocation(e.target.value)}
                        placeholder="Custom location..."
                        className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg"
                      />
                      <button
                        onClick={() => setLocation(item.id, customLocation, false)}
                        disabled={!customLocation.trim()}
                        className="px-3 py-2 bg-primary-600 text-white text-sm rounded-lg hover:bg-primary-700 disabled:opacity-50"
                      >
                        Set
                      </button>
                    </div>

                    {/* Save as default option */}
                    {item.gearItemId && (
                      <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          id={`save-default-${item.id}`}
                          className="w-4 h-4 text-primary-600 rounded"
                        />
                        <span className="text-gray-600">Save as default location for this gear item</span>
                      </label>
                    )}

                    {/* Close button */}
                    <button
                      onClick={() => setExpandedItem(null)}
                      className="mt-3 text-sm text-gray-500 hover:text-gray-700"
                    >
                      Close
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Complete Pack-Up Modal */}
      {showCompleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Complete Pack-Up?</h3>
              <button onClick={() => setShowCompleteModal(false)} className="text-gray-500 hover:text-gray-700">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-4">
              <p className="text-gray-600">
                This will mark all remaining items as packed and update your gear tracking.
              </p>

              {stats.notStarted > 0 && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-center gap-2 text-yellow-800">
                    <Info className="w-5 h-5" />
                    <span className="font-medium">{stats.notStarted} items haven't been checked off yet</span>
                  </div>
                </div>
              )}

              {stats.leftBehind > 0 && (
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <div className="flex items-center gap-2 text-orange-800">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="font-medium">{stats.leftBehind} items marked as left behind</span>
                  </div>
                  <p className="text-sm text-orange-600 mt-1">
                    Don't forget to retrieve these items!
                  </p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowCompleteModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={completePackUp}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  Complete Pack-Up
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
