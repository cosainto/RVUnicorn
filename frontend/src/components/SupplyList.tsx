import { useState, useEffect } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface SupplyItem {
  id: string;
  title: string;
  quantity?: string;
  priority: string;
  claimedById?: string;
  claimedBy?: { id: string; firstName: string; lastName: string; profilePicture?: string };
  createdById: string;
  createdBy: { id: string; firstName: string; lastName: string };
}

interface Props {
  eventId: string;
  compact?: boolean; // for Planning Mode panel preview
}

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'bg-red-100 text-red-700 border-red-200',
  NORMAL: 'bg-gray-100 text-gray-600 border-gray-200',
  LOW: 'bg-green-50 text-green-600 border-green-200',
};

export default function SupplyList({ eventId, compact = false }: Props) {
  const { user } = useAuth();
  const [items, setItems] = useState<SupplyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newQty, setNewQty] = useState('');
  const [newPriority, setNewPriority] = useState('NORMAL');
  const [saving, setSaving] = useState(false);

  useEffect(() => { load(); }, [eventId]);

  const load = async () => {
    try {
      const { data } = await api.get(`/supply/${eventId}`);
      setItems(data);
    } catch {}
    finally { setLoading(false); }
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/supply/${eventId}`, {
        title: newTitle.trim(),
        quantity: newQty.trim() || undefined,
        priority: newPriority,
      });
      setItems(prev => [...prev, data]);
      setNewTitle(''); setNewQty(''); setNewPriority('NORMAL');
      setShowAdd(false);
    } catch {}
    finally { setSaving(false); }
  };

  const handleClaim = async (itemId: string) => {
    try {
      const { data } = await api.patch(`/supply/${eventId}/${itemId}/claim`, {});
      setItems(prev => prev.map(i => i.id === itemId ? data : i));
    } catch {}
  };

  const handleDelete = async (itemId: string) => {
    try {
      await api.delete(`/supply/${eventId}/${itemId}`);
      setItems(prev => prev.filter(i => i.id !== itemId));
    } catch {}
  };

  const claimed = items.filter(i => i.claimedById);
  const unclaimed = items.filter(i => !i.claimedById);

  if (loading) return <div className="h-10 bg-gray-100 rounded-xl animate-pulse" />;

  if (compact) {
    // Compact view for Planning Mode panel
    return (
      <div className="bg-white rounded-xl p-3 border border-primary-100 mb-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-700">🛒 Supply List</p>
          <span className="text-xs text-gray-500">{claimed.length}/{items.length} claimed</span>
        </div>
        {items.length === 0 ? (
          <p className="text-xs text-gray-400">No items yet — add what the group needs to bring</p>
        ) : (
          <div className="space-y-1">
            {items.slice(0, 4).map(item => (
              <div key={item.id} className="flex items-center gap-2">
                <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 ${item.claimedById ? 'bg-green-500' : 'bg-gray-200'}`}>
                  {item.claimedById && <Check className="w-2.5 h-2.5 text-white" />}
                </div>
                <span className={`text-xs flex-1 ${item.claimedById ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {item.title}{item.quantity ? ` (${item.quantity})` : ''}
                </span>
                {item.claimedBy && (
                  <span className="text-xs text-green-600">{item.claimedBy.firstName}</span>
                )}
              </div>
            ))}
            {items.length > 4 && (
              <p className="text-xs text-gray-400">+{items.length - 4} more items</p>
            )}
          </div>
        )}
        {/* Progress bar */}
        {items.length > 0 && (
          <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((claimed.length / items.length) * 100)}%` }}
            />
          </div>
        )}
      </div>
    );
  }

  // Full view for Trip detail page
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-900">🛒 Supply List</h3>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-1.5 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold px-3 py-2 rounded-xl transition"
        >
          <Plus className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 space-y-3">
          <input
            type="text"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Item name (e.g. Firewood, Propane, S'mores kit)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm"
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newQty}
              onChange={e => setNewQty(e.target.value)}
              placeholder="Quantity (optional)"
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm"
            />
            <select
              value={newPriority}
              onChange={e => setNewPriority(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
            >
              <option value="HIGH">🔴 High</option>
              <option value="NORMAL">🟡 Normal</option>
              <option value="LOW">🟢 Low</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={handleAdd} disabled={saving || !newTitle.trim()}
              className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-medium disabled:opacity-50">
              {saving ? 'Adding...' : 'Add Item'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm">
              Cancel
            </button>
          </div>
        </div>
      )}

      {items.length === 0 && !showAdd && (
        <div className="text-center py-8 text-gray-400">
          <p className="text-4xl mb-2">🛒</p>
          <p className="font-medium">No items yet</p>
          <p className="text-sm">Add what the group needs to bring</p>
        </div>
      )}

      {/* Unclaimed items */}
      {unclaimed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Needs Someone</p>
          {unclaimed.map(item => (
            <div key={item.id} className="bg-white rounded-xl p-3 border border-gray-200 flex items-center gap-3">
              <button onClick={() => handleClaim(item.id)}
                className="w-8 h-8 rounded-full border-2 border-gray-300 hover:border-primary-500 hover:bg-primary-50 flex items-center justify-center transition flex-shrink-0">
                <Plus className="w-4 h-4 text-gray-400" />
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 text-sm">{item.title}</span>
                  {item.quantity && <span className="text-xs text-gray-500">× {item.quantity}</span>}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full border ${PRIORITY_COLORS[item.priority]}`}>
                    {item.priority}
                  </span>
                </div>
              </div>
              <button onClick={() => handleClaim(item.id)}
                className="text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 px-3 py-1.5 rounded-full font-semibold transition">
                I'll bring it
              </button>
              {item.createdById === user?.id && (
                <button onClick={() => handleDelete(item.id)}
                  className="p-1.5 text-gray-300 hover:text-red-500 transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Claimed items */}
      {claimed.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Covered ✓</p>
          {claimed.map(item => (
            <div key={item.id} className="bg-green-50 rounded-xl p-3 border border-green-200 flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="font-medium text-gray-700 text-sm line-through">{item.title}</span>
                {item.claimedBy && (
                  <p className="text-xs text-green-600 mt-0.5">
                    {item.claimedBy.firstName} {item.claimedBy.lastName} is bringing this
                  </p>
                )}
              </div>
              {item.claimedById === user?.id && (
                <button onClick={() => handleClaim(item.id)}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded-full border border-gray-200 transition">
                  Unclaim
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
