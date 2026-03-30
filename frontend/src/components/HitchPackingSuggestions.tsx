import { useState } from 'react';
import { Loader, Check, X, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
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

const CATEGORY_COLORS: Record<string, { bg: string; border: string; text: string; glow: string }> = {
  default:        { bg: 'bg-slate-800',   border: 'border-slate-600',  text: 'text-slate-100',  glow: 'shadow-slate-900' },
  'Kitchen':      { bg: 'bg-amber-900',   border: 'border-amber-600',  text: 'text-amber-100',  glow: 'shadow-amber-900' },
  'Food':         { bg: 'bg-amber-900',   border: 'border-amber-600',  text: 'text-amber-100',  glow: 'shadow-amber-900' },
  'Bedding':      { bg: 'bg-indigo-900',  border: 'border-indigo-500', text: 'text-indigo-100', glow: 'shadow-indigo-900' },
  'Comfort':      { bg: 'bg-indigo-900',  border: 'border-indigo-500', text: 'text-indigo-100', glow: 'shadow-indigo-900' },
  'Clothing':     { bg: 'bg-teal-900',    border: 'border-teal-500',   text: 'text-teal-100',   glow: 'shadow-teal-900' },
  'Safety':       { bg: 'bg-red-900',     border: 'border-red-500',    text: 'text-red-100',    glow: 'shadow-red-900' },
  'Tools':        { bg: 'bg-red-900',     border: 'border-red-500',    text: 'text-red-100',    glow: 'shadow-red-900' },
  'Activity':     { bg: 'bg-green-900',   border: 'border-green-500',  text: 'text-green-100',  glow: 'shadow-green-900' },
  'Entertainment':{ bg: 'bg-purple-900',  border: 'border-purple-500', text: 'text-purple-100', glow: 'shadow-purple-900' },
  'Hygiene':      { bg: 'bg-cyan-900',    border: 'border-cyan-500',   text: 'text-cyan-100',   glow: 'shadow-cyan-900' },
  'Documents':    { bg: 'bg-yellow-900',  border: 'border-yellow-500', text: 'text-yellow-100', glow: 'shadow-yellow-900' },
  'Tech':         { bg: 'bg-yellow-900',  border: 'border-yellow-500', text: 'text-yellow-100', glow: 'shadow-yellow-900' },
  'Kids':         { bg: 'bg-pink-900',    border: 'border-pink-500',   text: 'text-pink-100',   glow: 'shadow-pink-900' },
  'Pets':         { bg: 'bg-pink-900',    border: 'border-pink-500',   text: 'text-pink-100',   glow: 'shadow-pink-900' },
};

function getCategoryStyle(name: string) {
  const key = Object.keys(CATEGORY_COLORS).find(k => name.includes(k));
  return CATEGORY_COLORS[key || 'default'];
}

export default function HitchPackingSuggestions({ eventId, destination, startDate, endDate, groupSize, rvType, onAddItems }: Props) {
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());
  const [shown, setShown] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const [adding, setAdding] = useState<Set<string>>(new Set());

  const totalItems = categories.reduce((sum, c) => sum + c.items.length, 0);
  const addedCount = addedItems.size;

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/packing-suggestions', {
        eventId, destination, startDate, endDate, groupSize, rvType
      });
      setCategories(data.categories || []);
      setShown(true);
      setActiveCategory(0);
    } catch { alert('Hitch had trouble generating suggestions. Try again!'); }
    finally { setLoading(false); }
  };

  const addItem = async (item: string) => {
    if (addedItems.has(item) || adding.has(item)) return;
    setAdding(prev => new Set([...prev, item]));
    try {
      await api.post('/trip-packing', { eventId, customName: item, customCategory: 'AI Suggested' });
      setAddedItems(prev => new Set([...prev, item]));
      onAddItems?.([item]);
    } catch (err: any) {
      console.error('addItem error:', err?.response?.status, err?.response?.data || err?.message);
    } finally {
      setAdding(prev => { const s = new Set(prev); s.delete(item); return s; });
    }
  };

  const addAll = async () => {
    const cat = categories[activeCategory];
    if (!cat) return;
    for (const item of cat.items) {
      if (!addedItems.has(item)) await addItem(item);
    }
  };

  if (dismissed) return null;

  if (!shown) {
    return (
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border border-slate-700 p-5 shadow-xl">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #f97316 0%, transparent 50%), radial-gradient(circle at 80% 50%, #7c3aed 0%, transparent 50%)' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg shadow-orange-900">
              <img src="/hitch.png" className="w-7 h-7 rounded-lg" onError={(e) => { (e.target as any).style.display='none'; }} />
            </div>
            <div>
              <p className="font-bold text-white text-sm tracking-wide">HITCH AI LOADOUT</p>
              <p className="text-xs text-slate-400">Personalized gear for your trip</p>
            </div>
          </div>
          <button onClick={generate} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-amber-400 text-white text-sm font-bold rounded-xl hover:from-orange-400 hover:to-amber-300 disabled:opacity-50 transition-all shadow-lg shadow-orange-900 active:scale-95">
            {loading
              ? <><Loader className="w-4 h-4 animate-spin" /> Analyzing trip...</>
              : <><Sparkles className="w-4 h-4" /> Generate Loadout</>}
          </button>
        </div>
      </div>
    );
  }

  const activeCat = categories[activeCategory];
  const style = activeCat ? getCategoryStyle(activeCat.name) : CATEGORY_COLORS.default;

  return (
    <div className="rounded-2xl overflow-hidden border border-slate-700 shadow-xl bg-slate-900">
      {/* Header */}
      <div className="relative px-4 py-3 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 border-b border-slate-700">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #f97316 0%, transparent 60%), radial-gradient(circle at 80% 50%, #7c3aed 0%, transparent 60%)' }} />
        <div className="relative flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center flex-shrink-0">
            <img src="/hitch.png" className="w-6 h-6 rounded-md" onError={(e) => { (e.target as any).style.display='none'; }} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-bold text-white text-xs tracking-widest uppercase">Hitch Loadout</p>
              {addedCount > 0 && (
                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/30">
                  {addedCount} packed
                </span>
              )}
            </div>
            {/* Progress bar */}
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-orange-500 to-amber-400 rounded-full transition-all duration-500"
                  style={{ width: totalItems > 0 ? `${(addedCount / totalItems) * 100}%` : '0%' }} />
              </div>
              <span className="text-xs text-slate-500 flex-shrink-0">{addedCount}/{totalItems}</span>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={generate} disabled={loading} title="Regenerate"
              className="p-1.5 text-slate-400 hover:text-orange-400 transition rounded-lg hover:bg-slate-700">
              <Sparkles className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setCollapsed(c => !c)} title={collapsed ? 'Expand' : 'Collapse'}
              className="p-1.5 text-slate-400 hover:text-white transition rounded-lg hover:bg-slate-700">
              {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
            <button onClick={() => setDismissed(true)} title="Dismiss"
              className="p-1.5 text-slate-400 hover:text-red-400 transition rounded-lg hover:bg-slate-700">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Category tabs */}
          <div className="flex overflow-x-auto scrollbar-hide bg-slate-900 border-b border-slate-700/50 px-3 gap-1.5 py-2">
            {categories.map((cat, i) => {
              const s = getCategoryStyle(cat.name);
              const catAdded = cat.items.filter((item: string) => addedItems.has(item)).length;
              return (
                <button key={i} onClick={() => setActiveCategory(i)}
                  className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                    activeCategory === i
                      ? `${s.bg} ${s.border} ${s.text} shadow-lg`
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-200'
                  }`}>
                  <span>{cat.icon}</span>
                  <span className="whitespace-nowrap">{cat.name.split(' & ')[0]}</span>
                  {catAdded > 0 && (
                    <span className="w-4 h-4 rounded-full bg-green-500/30 text-green-400 text-xs flex items-center justify-center font-bold">
                      {catAdded}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Active category items */}
          {activeCat && (
            <div className="p-4 bg-slate-900">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{activeCat.icon}</span>
                  <p className="font-bold text-white text-sm">{activeCat.name}</p>
                  <span className="text-xs text-slate-500">
                    {activeCat.items.filter((i: string) => addedItems.has(i)).length}/{activeCat.items.length}
                  </span>
                </div>
                <button onClick={addAll}
                  className={`text-xs font-bold px-3 py-1 rounded-lg border transition ${style.bg} ${style.border} ${style.text} hover:opacity-80 active:scale-95`}>
                  + Add All
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {activeCat.items.map((item: string, j: number) => {
                  const isAdded = addedItems.has(item);
                  const isAdding = adding.has(item);
                  return (
                    <button key={j} onClick={() => addItem(item)} disabled={isAdded || isAdding}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                        isAdded
                          ? 'bg-green-900/40 text-green-400 border-green-700/50 cursor-default'
                          : isAdding
                          ? 'bg-slate-700 text-slate-400 border-slate-600 cursor-wait'
                          : `bg-slate-800 text-slate-200 border-slate-600 hover:${style.bg} hover:${style.border} hover:${style.text} hover:shadow-md`
                      }`}>
                      {isAdded
                        ? <Check className="w-3 h-3 text-green-400" />
                        : isAdding
                        ? <Loader className="w-3 h-3 animate-spin" />
                        : <span className="text-slate-500">+</span>}
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
