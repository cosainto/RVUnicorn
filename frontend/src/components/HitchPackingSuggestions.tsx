import { useState } from 'react';
import { Package, Loader, Plus, Check } from 'lucide-react';
import api from '../services/api';

interface Props {
  eventId: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  groupSize?: number;
  rvType?: string;
  onAddItems?: (items: string[]) => void;
}

export default function HitchPackingSuggestions({ eventId, destination, startDate, endDate, groupSize, rvType, onAddItems }: Props) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/packing-suggestions', {
        destination, startDate, endDate, groupSize, rvType
      });
      setCategories(data.categories || []);
      setShown(true);
    } catch { alert('Hitch had trouble generating suggestions. Try again!'); }
    finally { setLoading(false); }
  };

  const addItem = async (item: string) => {
    try {
      await api.post(`/events/${eventId}/pack-items`, { name: item, category: 'AI Suggested' });
      setAddedItems(prev => new Set([...prev, item]));
      onAddItems?.([item]);
    } catch {}
  };

  const addAll = async (items: string[]) => {
    for (const item of items) {
      if (!addedItems.has(item)) await addItem(item);
    }
  };

  if (!shown) {
    return (
      <button onClick={generate} disabled={loading}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition shadow-sm">
        {loading ? <Loader className="w-4 h-4 animate-spin" /> : <img src="/hitch.png" className="w-5 h-5 rounded-full" />}
        {loading ? 'Hitch is thinking...' : '🧳 Get AI Packing List'}
      </button>
    );
  }

  return (
    <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900 text-sm">Hitch's Packing Suggestions</p>
          <p className="text-xs text-gray-500">Click + to add items to your pack list</p>
        </div>
        <button onClick={generate} disabled={loading} className="ml-auto text-xs text-primary-600 hover:underline">
          {loading ? '...' : 'Regenerate'}
        </button>
      </div>
      <div className="space-y-4">
        {categories.map((cat, i) => (
          <div key={i}>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                {cat.icon} {cat.name}
              </p>
              <button onClick={() => addAll(cat.items)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium">
                Add all
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {cat.items.map((item: string, j: number) => (
                <button key={j} onClick={() => !addedItems.has(item) && addItem(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    addedItems.has(item)
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-white text-gray-700 border-gray-200 hover:border-primary-300'
                  }`}>
                  {addedItems.has(item) ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                  {item}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
