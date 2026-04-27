import React, { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Wrench, ExternalLink, ChevronDown, Loader2 } from 'lucide-react';
import api from '../services/api';
import { trackAndOpen } from '../utils/affiliateLink';

const CATEGORIES = ['All', 'Solar', 'Towing', 'Kitchen', 'Comfort', 'Tech', 'Exterior', 'Safety', 'Storage'];
const RIG_CLASSES = ['All', 'Class A', 'Class B', 'Class C', 'Travel Trailer', '5th Wheel'];
const SORT_OPTIONS = [
  { value: 'popular', label: 'Most Popular' },
  { value: 'recent', label: 'Recently Added' },
  { value: 'cost', label: 'Lowest Cost' },
];

interface ModItem {
  title: string;
  category: string;
  description: string | null;
  photos: string[];
  beforePhoto: string | null;
  afterPhoto: string | null;
  productLink: string | null;
  adoptionCount: number;
  avgCost: number | null;
  rigs: { id: string; slug: string; rigName: string | null; heroPhoto: string | null }[];
  modLogIds: string[];
}

export default function ModMarketplacePage() {
  const [mods, setMods] = useState<ModItem[]>([]);
  const [stats, setStats] = useState({ totalMods: 0, totalRigs: 0, totalCategories: 0 });
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState('All');
  const [rigClass, setRigClass] = useState('All');
  const [sort, setSort] = useState('popular');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);

  const loadMods = useCallback(async (reset = false) => {
    try {
      setLoading(true);
      const p = reset ? 1 : page;
      const { data } = await api.get('/mods/marketplace', {
        params: { category: category === 'All' ? undefined : category, rigClass: rigClass === 'All' ? undefined : rigClass, sort, page: p, limit: 24 },
      });
      setMods(reset ? data.mods : [...mods, ...data.mods]);
      setHasMore(data.hasMore);
      if (reset) setPage(1);
    } catch (err) {
      console.error('Failed to load mods:', err);
    } finally {
      setLoading(false);
    }
  }, [category, rigClass, sort, page]);

  useEffect(() => {
    api.get('/mods/stats').then(r => setStats(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadMods(true);
  }, [category, rigClass, sort]);

  const popularMods = mods.filter(m => m.adoptionCount > 1).slice(0, 5);

  return (
    <div className="min-h-screen bg-stone-50">
      {/* Header */}
      <div className="bg-gradient-to-b from-amber-50 to-stone-50 border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-4 py-12 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Wrench className="w-6 h-6 text-amber-600" />
            <h1 className="text-3xl font-serif font-bold text-stone-900">What RVers Are Adding to Their Rigs</h1>
          </div>
          <div className="flex items-center justify-center gap-4 text-sm text-stone-500 mt-2">
            <span className="font-semibold">{stats.totalMods} mods</span>
            <span>·</span>
            <span className="font-semibold">{stats.totalRigs} rigs</span>
            <span>·</span>
            <span className="font-semibold">{stats.totalCategories} categories</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Popular Mods Horizontal Scroll */}
        {popularMods.length > 0 && (
          <div className="mb-8">
            <h2 className="text-sm font-bold uppercase tracking-wider text-stone-500 mb-3">Most Popular</h2>
            <div className="flex gap-4 overflow-x-auto pb-2 -mx-4 px-4 scrollbar-hide">
              {popularMods.map((mod, i) => (
                <div key={mod.title + i} className="flex-shrink-0 w-56 bg-white rounded-xl border border-stone-200 overflow-hidden">
                  {(mod.beforePhoto || mod.photos[0]) && (
                    <img src={mod.beforePhoto || mod.photos[0]} alt="" className="w-full h-28 object-cover" />
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold text-amber-600">#{i + 1}</span>
                      <span className="text-sm font-semibold text-stone-900 truncate">{mod.title}</span>
                    </div>
                    <p className="text-xs text-stone-500">Added by {mod.adoptionCount} rig{mod.adoptionCount !== 1 ? 's' : ''}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="sticky top-0 z-10 bg-stone-50/95 backdrop-blur-sm py-3 -mx-4 px-4 border-b border-stone-200 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            {/* Category Pills */}
            <div className="flex gap-2 overflow-x-auto flex-1 scrollbar-hide">
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                    category === cat
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-stone-600 border border-stone-200 hover:border-amber-300'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Rig Class Dropdown */}
            <div className="relative">
              <select
                value={rigClass}
                onChange={e => setRigClass(e.target.value)}
                className="appearance-none bg-white border border-stone-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-stone-600 cursor-pointer"
              >
                {RIG_CLASSES.map(rc => (
                  <option key={rc} value={rc}>{rc === 'All' ? 'All Rig Types' : rc}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            </div>

            {/* Sort */}
            <div className="relative">
              <select
                value={sort}
                onChange={e => setSort(e.target.value)}
                className="appearance-none bg-white border border-stone-200 rounded-lg px-3 py-1.5 pr-8 text-xs font-medium text-stone-600 cursor-pointer"
              >
                {SORT_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Mod Cards Grid */}
        {loading && mods.length === 0 ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-amber-600" />
          </div>
        ) : mods.length === 0 ? (
          <div className="text-center py-20 text-stone-500">
            <Wrench className="w-12 h-12 mx-auto mb-3 text-stone-300" />
            <p className="text-lg font-semibold">No mods found</p>
            <p className="text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {mods.map((mod, i) => (
              <ModCard key={mod.title + '-' + i} mod={mod} />
            ))}
          </div>
        )}

        {/* Load More */}
        {hasMore && (
          <div className="text-center py-8">
            <button
              onClick={() => { setPage(p => p + 1); loadMods(); }}
              disabled={loading}
              className="px-6 py-2 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
            >
              {loading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ModCard({ mod }: { mod: ModItem }) {
  const hasBeforeAfter = mod.beforePhoto && mod.afterPhoto;

  return (
    <div className="bg-white rounded-xl border border-stone-200 overflow-hidden hover:shadow-md transition-shadow">
      {/* Photo Strip */}
      {hasBeforeAfter ? (
        <div className="flex h-40">
          <div className="relative w-1/2">
            <img src={mod.beforePhoto!} alt="Before" className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">Before</span>
          </div>
          <div className="relative w-1/2">
            <img src={mod.afterPhoto!} alt="After" className="w-full h-full object-cover" />
            <span className="absolute bottom-1 left-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded">After</span>
          </div>
        </div>
      ) : mod.photos.length > 0 ? (
        <img src={mod.photos[0]} alt="" className="w-full h-40 object-cover" />
      ) : (
        <div className="w-full h-40 bg-stone-100 flex items-center justify-center">
          <Wrench className="w-10 h-10 text-stone-300" />
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h3 className="font-semibold text-stone-900 text-sm leading-tight">{mod.title}</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium whitespace-nowrap">
            {mod.category}
          </span>
        </div>

        {mod.description && (
          <p className="text-xs text-stone-500 line-clamp-2 mb-3">{mod.description}</p>
        )}

        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-stone-500">
            Added by <span className="font-semibold text-stone-700">{mod.adoptionCount}</span> rig{mod.adoptionCount !== 1 ? 's' : ''}
          </span>
          {mod.avgCost != null && (
            <span className="text-sm font-semibold text-stone-900">~${mod.avgCost}</span>
          )}
        </div>

        {/* Product Link */}
        {mod.productLink && (
          <button
            onClick={() => trackAndOpen(mod.productLink!, mod.modLogIds[0], mod.rigs[0]?.id || '')}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-600 text-white rounded-lg text-xs font-semibold hover:bg-amber-700 transition-colors mb-3"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View Product
          </button>
        )}

        {/* Rig Chips */}
        {mod.rigs.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
            {mod.rigs.slice(0, 5).map(rig => (
              <Link
                key={rig.id}
                to={`/rig/${rig.slug}`}
                className="flex-shrink-0"
                title={rig.rigName || 'Rig'}
              >
                {rig.heroPhoto ? (
                  <img src={rig.heroPhoto} alt={rig.rigName || ''} className="w-7 h-7 rounded-full object-cover border border-stone-200" />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center text-[10px]">
                    🚐
                  </div>
                )}
              </Link>
            ))}
            {mod.rigs.length > 5 && (
              <span className="text-[10px] text-stone-400 self-center">+{mod.rigs.length - 5}</span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
