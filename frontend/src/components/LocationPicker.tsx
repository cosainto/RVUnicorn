/**
 * LocationPicker — bottom-sheet location search + "Add new place" inline form.
 * Mobile-first: slides up from bottom. Desktop: centered modal.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Search, Plus, ChevronDown } from 'lucide-react';
import api from '../services/api';

/* ── Theme ─────────────────────────────────────────────────────── */
const TH = {
  bg: '#0F1C35',
  card: '#1B2B4B',
  cardLight: '#243352',
  border: '#2A3F5F',
  gold: '#C9A84C',
  orange: '#E8622A',
  cream: '#F5F0E8',
  muted: '#94A3B8',
};

/* ── Category emoji map ────────────────────────────────────────── */
const CATEGORY_EMOJI: Record<string, string> = {
  CAMPGROUND: '🏕',
  OVERNIGHT_STOP: '🛏',
  RESTAURANT: '🍽',
  HIKING_TRAIL: '🥾',
  ATTRACTION: '🎡',
  SCENIC_OVERLOOK: '🌄',
  MUSEUM: '🏛',
  VISITOR_CENTER: 'ℹ️',
  OUTFITTER: '🎒',
  CAMP_STORE: '🏪',
  RV_SERVICE: '🔧',
  LANDMARK: '📍',
  OTHER: '📌',
};

const CATEGORIES = Object.entries(CATEGORY_EMOJI).map(([value, emoji]) => ({
  value,
  emoji,
  label: value
    .split('_')
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(' '),
}));

/* ── Types ─────────────────────────────────────────────────────── */
interface Place {
  id: string;
  name: string;
  category: string;
  city?: string;
  state?: string;
  type: 'place' | 'campground';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (place: Place) => void;
  campgroundId?: string;
}

/* ── Component ─────────────────────────────────────────────────── */
export default function LocationPicker({ isOpen, onClose, onSelect, campgroundId }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Place[]>([]);
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  // Add-place form state
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState('OTHER');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newState, setNewState] = useState('');
  const [newZip, setNewZip] = useState('');
  const [newLat, setNewLat] = useState('');
  const [newLng, setNewLng] = useState('');
  const [newWebsite, setNewWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ── Fetch nearby suggestions on mount ─────────────────────── */
  useEffect(() => {
    if (!isOpen || !campgroundId) return;
    api
      .get(`/places/suggestions?campgroundId=${campgroundId}`)
      .then((res) => setSuggestions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, [isOpen, campgroundId]);

  /* ── Debounced search ──────────────────────────────────────── */
  const search = useCallback((q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    api
      .get(`/places/search?q=${encodeURIComponent(q)}`)
      .then((res) => setResults(Array.isArray(res.data) ? res.data : []))
      .catch(() => setResults([]))
      .finally(() => setLoading(false));
  }, []);

  const handleQueryChange = (val: string) => {
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  /* ── Add new place ─────────────────────────────────────────── */
  const handleAddPlace = async () => {
    if (!newName.trim()) return;
    setSubmitting(true);
    try {
      const res = await api.post('/places', {
        name: newName.trim(),
        category: newCategory,
        address: newAddress.trim() || undefined,
        city: newCity.trim() || undefined,
        state: newState.trim() || undefined,
        zip: newZip.trim() || undefined,
        latitude: newLat ? parseFloat(newLat) : undefined,
        longitude: newLng ? parseFloat(newLng) : undefined,
        website: newWebsite.trim() || undefined,
      });
      const created: Place = {
        id: res.data.id,
        name: res.data.name,
        category: res.data.category,
        city: res.data.city,
        state: res.data.state,
        type: 'place',
      };
      onSelect(created);
      resetForm();
      onClose();
    } catch {
      // silent
    }
    setSubmitting(false);
  };

  const resetForm = () => {
    setQuery('');
    setResults([]);
    setShowAddForm(false);
    setNewName('');
    setNewCategory('OTHER');
    setNewAddress('');
    setNewCity('');
    setNewState('');
    setNewZip('');
    setNewLat('');
    setNewLng('');
    setNewWebsite('');
  };

  if (!isOpen) return null;

  const emoji = (cat: string) => CATEGORY_EMOJI[cat] || '📌';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col"
        style={{ background: TH.bg, border: `1px solid ${TH.border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ─────────────────────────────────────────── */}
        <div className="flex items-center justify-between p-4 pb-2">
          <h3 className="text-sm font-bold" style={{ color: TH.cream }}>
            Pick a Location
          </h3>
          <button onClick={() => { resetForm(); onClose(); }} style={{ color: TH.muted }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Search input ───────────────────────────────────── */}
        <div className="px-4 pb-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: TH.muted }} />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Search places..."
              autoFocus
              className="w-full pl-9 pr-3 py-2 rounded-lg text-sm focus:outline-none"
              style={{ background: TH.card, border: `1px solid ${TH.border}`, color: TH.cream }}
            />
          </div>
        </div>

        {/* ── Scrollable body ────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 pb-4" style={{ maxHeight: '55vh' }}>
          {/* Nearby suggestions chips */}
          {suggestions.length > 0 && !query.trim() && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold mb-2" style={{ color: TH.muted }}>
                Nearby
              </p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => { onSelect(s); resetForm(); onClose(); }}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs transition hover:brightness-110"
                    style={{ background: TH.card, border: `1px solid ${TH.border}`, color: TH.cream }}
                  >
                    <span>{emoji(s.category)}</span>
                    <span className="truncate max-w-[120px]">{s.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <p className="text-xs text-center py-4" style={{ color: TH.muted }}>
              Searching...
            </p>
          )}

          {/* Search results */}
          {results.map((r) => (
            <button
              key={r.id}
              onClick={() => { onSelect(r); resetForm(); onClose(); }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 text-left transition hover:brightness-110"
              style={{ background: TH.card, border: `1px solid ${TH.border}` }}
            >
              <span className="text-lg">{emoji(r.category)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate" style={{ color: TH.cream }}>
                  {r.name}
                </p>
                {(r.city || r.state) && (
                  <p className="text-[10px]" style={{ color: TH.muted }}>
                    {[r.city, r.state].filter(Boolean).join(', ')}
                  </p>
                )}
              </div>
            </button>
          ))}

          {/* No results hint */}
          {query.trim() && !loading && results.length === 0 && (
            <p className="text-xs text-center py-3" style={{ color: TH.muted }}>
              No results found
            </p>
          )}

          {/* ── Add new place ────────────────────────────────── */}
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg mt-2 transition hover:brightness-110"
            style={{ background: TH.cardLight, border: `1px dashed ${TH.border}` }}
          >
            {showAddForm ? (
              <ChevronDown className="w-4 h-4" style={{ color: TH.gold }} />
            ) : (
              <Plus className="w-4 h-4" style={{ color: TH.gold }} />
            )}
            <span className="text-xs font-semibold" style={{ color: TH.gold }}>
              Add a new place
            </span>
          </button>

          {showAddForm && (
            <div className="mt-2 p-3 rounded-lg space-y-2" style={{ background: TH.card, border: `1px solid ${TH.border}` }}>
              {/* Name */}
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Place name *"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
              />

              {/* Category chips */}
              <div>
                <p className="text-[10px] mb-1.5" style={{ color: TH.muted }}>Category</p>
                <div className="flex flex-wrap gap-1">
                  {CATEGORIES.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setNewCategory(c.value)}
                      className="px-2 py-1 rounded-full text-[10px] transition"
                      style={{
                        background: newCategory === c.value ? TH.gold : TH.cardLight,
                        color: newCategory === c.value ? TH.bg : TH.cream,
                        border: `1px solid ${newCategory === c.value ? TH.gold : TH.border}`,
                      }}
                    >
                      {c.emoji} {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Street address */}
              <input
                type="text"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
                placeholder="Street address (opt)"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
              />

              {/* City + State + Zip row */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCity}
                  onChange={(e) => setNewCity(e.target.value)}
                  placeholder="City"
                  className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
                />
                <input
                  type="text"
                  value={newState}
                  onChange={(e) => setNewState(e.target.value)}
                  placeholder="State"
                  className="w-16 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
                />
                <input
                  type="text"
                  value={newZip}
                  onChange={(e) => setNewZip(e.target.value)}
                  placeholder="Zip"
                  className="w-20 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
                />
              </div>

              {/* Lat / Lng (optional) */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newLat}
                  onChange={(e) => setNewLat(e.target.value)}
                  placeholder="Latitude (opt)"
                  className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
                />
                <input
                  type="text"
                  value={newLng}
                  onChange={(e) => setNewLng(e.target.value)}
                  placeholder="Longitude (opt)"
                  className="flex-1 px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
                />
              </div>

              {/* Website (optional) */}
              <input
                type="text"
                value={newWebsite}
                onChange={(e) => setNewWebsite(e.target.value)}
                placeholder="Website (opt)"
                className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none"
                style={{ background: TH.bg, border: `1px solid ${TH.border}`, color: TH.cream }}
              />

              {/* Submit */}
              <button
                onClick={handleAddPlace}
                disabled={!newName.trim() || submitting}
                className="w-full py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50"
                style={{ background: TH.gold, color: TH.bg }}
              >
                {submitting ? 'Creating...' : 'Create Place'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
