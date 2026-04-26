const stripHtml = (html: string | null) => html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") || "";
import React, { useEffect, useState, useCallback } from 'react';
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Plus, Phone, Globe, Navigation, SlidersHorizontal, X, Grid3X3, Map as MapIcon } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SuggestCampground from '../components/SuggestCampground';
import HarvestHostsTab from '../components/HarvestHostsTab';
import HitchCampgroundFinder from '../components/HitchCampgroundFinder';
import HiddenGemFinder from '../components/HiddenGemFinder';
import YourKindOfPlace from '../components/YourKindOfPlace';
import { Leaf } from 'lucide-react';

interface Campground {
  id: string; name: string; slug: string; location: string; state: string | null;
  description: string; latitude: number | null; longitude: number | null;
  amenities: string[]; imageUrl: string | null; phone: string | null; website: string | null;
  _count?: { reviews: number };
}

const AMENITY_ICONS: Record<string, string> = {
  WIFI: '📶', SHOWERS: '🚿', RESTROOMS: '🚻', ELECTRIC_HOOKUPS: '⚡',
  WATER_HOOKUPS: '💧', SEWER_HOOKUPS: '🚰', DUMP_STATION: '♻️', LAUNDRY: '👕',
  CAMP_STORE: '🏪', RESTAURANT: '🍽️', PLAYGROUND: '🎪', POOL: '🏊',
  BEACH: '🏖️', BOAT_LAUNCH: '⛵', FISHING: '🎣', TRAILS: '🥾', CAMPING: '⛺',
};

const getAmenityIcon = (a: string) => AMENITY_ICONS[a] || AMENITY_ICONS[a.toUpperCase()] || null;
const formatAmenityName = (a: string) => a.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

const AMENITY_FILTERS: [string, string][] = [
  ['hasFullHookups','🔌 Full Hookups'],['hasElectricHookup','⚡ Electric'],
  ['hasWaterHookup','💧 Water Hookup'],['hasSewerHookup','🚰 Sewer Hookup'],
  ['hasDumpStation','♻️ Dump Station'],['hasWifi','📶 WiFi'],
  ['hasShowers','🚿 Showers'],['hasRestrooms','🚻 Restrooms'],
  ['hasPool','🏊 Pool'],['hasLaundry','👕 Laundry'],['hasStore','🏪 Camp Store'],
  ['hasPullThrough','🚛 Pull-Through'],['hasBackIn','↩️ Back-In'],
  ['isBigRigFriendly','🚌 Big Rig Friendly'],['isPetFriendly','🐾 Pet Friendly'],['isWaterfront','🌊 Waterfront'],
];

export default function CampgroundsPage() {
  const { user } = useAuth();
  const [campgrounds, setCampgrounds] = useState<Campground[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingSearch, setPendingSearch] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [stateFilter, setStateFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [rvLength, setRvLength] = useState('');
  const [rvAmps, setRvAmps] = useState('');
  const [rvYear, setRvYear] = useState('');
  const [amenityFilters, setAmenityFilters] = useState<Record<string, boolean>>({});
  const [showSuggestModal, setShowSuggestModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [pageTab, setPageTab] = useState<'campgrounds' | 'rv-networks' | 'find-similar' | 'hidden-gems' | 'for-you'>('campgrounds');
  const [viewMode, setViewMode] = useState<'grid' | 'map'>('grid');

  useEffect(() => {
    if (!user) return;
    if (user.rvLength) setRvLength(String(user.rvLength));
    if ((user as any).rvShorepower) {
      const sp = (user as any).rvShorepower as string;
      const amp = sp.includes('50') ? '50' : sp.includes('30') ? '30' : '';
      if (amp) setRvAmps(amp);
    }
    if (user.rvYear) setRvYear(String(user.rvYear));
    if (user.rvType && ['Class A','Fifth Wheel','Class C'].includes(user.rvType))
      setAmenityFilters(f => ({ ...f, isBigRigFriendly: true }));
  }, [user?.id]);

  const activeFilterCount = Object.values(amenityFilters).filter(Boolean).length + (rvLength ? 1 : 0) + (rvAmps ? 1 : 0) + (rvYear ? 1 : 0) + (stateFilter ? 1 : 0);

  const fetchCampgrounds = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm) params.append('search', searchTerm);
      if (stateFilter) params.append('state', stateFilter);
      Object.entries(amenityFilters).forEach(([k, v]) => { if (v) params.append(k, 'true'); });
      if (rvLength) params.append('minRvLength', rvLength);
      if (rvAmps) params.append('minAmp', rvAmps);
      if (rvYear) params.append('minRvYear', rvYear);
      params.append('page', currentPage.toString());
      params.append('limit', '50');
      const res = await api.get(`/campgrounds?${params.toString()}`);
      const data = res.data;
      setCampgrounds(data.campgrounds ?? []);
      setTotalPages(data.totalPages ?? 1);
      setTotal(data.total ?? 0);
    } catch (err) { console.error(err); setCampgrounds([]); }
    finally { setLoading(false); }
  }, [searchTerm, stateFilter, currentPage, amenityFilters, rvLength, rvAmps, rvYear]);

  useEffect(() => { fetchCampgrounds(); }, [fetchCampgrounds]);

  const clearAll = () => { setAmenityFilters({}); setRvLength(''); setRvAmps(''); setRvYear(''); setStateFilter(''); setPendingSearch(''); setSearchTerm(''); setCurrentPage(1); };
  const handleSearch = () => { setSearchTerm(pendingSearch); setCurrentPage(1); };
  const toggleAmenity = (k: string) => { setAmenityFilters(f => ({ ...f, [k]: !f[k] })); setCurrentPage(1); };

  if (loading && campgrounds.length === 0) return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl overflow-hidden" style={{ background: 'rgba(15,28,53,0.95)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="h-40 bg-gray-700 animate-pulse" />
            <div className="p-4 space-y-3">
              <div className="h-4 bg-gray-700 rounded animate-pulse w-3/4" />
              <div className="h-3 bg-gray-700 rounded animate-pulse w-1/2" />
              <div className="h-3 bg-gray-700 rounded animate-pulse w-2/3" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <>
    <style>{`
      .cg-list-dark{background:#0F1C35!important;color:#F5F0E8!important;min-height:100vh}
      .cg-list-dark .bg-white{background:rgba(15,28,53,0.95)!important;color:#F5F0E8!important}
      .cg-list-dark .bg-gray-50,.cg-list-dark .bg-gray-100{background:#1B2E50!important}
      .cg-list-dark .text-gray-900,.cg-list-dark .text-gray-800{color:#F5F0E8!important}
      .cg-list-dark .text-gray-700,.cg-list-dark .text-gray-600{color:rgba(245,240,232,0.65)!important}
      .cg-list-dark .text-gray-500,.cg-list-dark .text-gray-400{color:rgba(245,240,232,0.4)!important}
      .cg-list-dark .border-gray-200,.cg-list-dark .border-gray-100{border-color:rgba(232,168,56,0.08)!important}
      .cg-list-dark .shadow-sm,.cg-list-dark .shadow{box-shadow:0 2px 10px rgba(0,0,0,0.3)!important}
      .cg-list-dark input,.cg-list-dark select{background:#1B2E50!important;border-color:rgba(232,168,56,0.12)!important;color:#F5F0E8!important}
      .cg-list-dark .btn-primary,.cg-list-dark .bg-primary-600{background:#E8622A!important;color:white!important}
      .cg-list-dark .btn-secondary{background:transparent!important;border-color:rgba(255,255,255,0.1)!important;color:rgba(245,240,232,0.5)!important}
      .cg-list-dark .hover\\:shadow-md:hover{box-shadow:0 4px 16px rgba(0,0,0,0.5)!important}
      .cg-list-dark .text-primary-600{color:#E8A838!important}
      .cg-list-dark .hover\\:text-primary-600:hover{color:#E8A838!important}
      .cg-list-dark .bg-primary-100{background:rgba(232,168,56,0.1)!important}
      .cg-list-dark .text-primary-700{color:#E8A838!important}
      .cg-list-dark .bg-green-100{background:rgba(16,185,129,0.1)!important}.cg-list-dark .text-green-700{color:#10B981!important}
      .cg-list-dark .bg-blue-100{background:rgba(59,130,246,0.1)!important}.cg-list-dark .text-blue-700{color:#60A5FA!important}
      .cg-list-dark .bg-red-500{background:#E8622A!important}
      .cg-list-dark .hover\\:border-gray-300:hover{border-color:rgba(232,168,56,0.15)!important}
    `}</style>
    <div className="cg-list-dark max-w-7xl mx-auto px-4 py-8">
      {/* Page Tab Switcher */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setPageTab('campgrounds')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'campgrounds' ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          🏕️ Campgrounds
        </button>
        <button
          onClick={() => setPageTab('for-you')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'for-you' ? 'bg-primary-500 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          <span>✨</span> For You
        </button>
        <button
          onClick={() => setPageTab('hidden-gems')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'hidden-gems' ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          💎 Hidden Gems
        </button>
        <button
          onClick={() => setPageTab('find-similar')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'find-similar' ? 'bg-purple-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          🦄 Find Similar
        </button>
        <button
          onClick={() => setPageTab('rv-networks')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'rv-networks' ? 'bg-green-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1773413639/rv-host-networks-icon.png" alt="RV Host Networks" className="w-5 h-5 rounded-full object-cover" /> RV Host Networks
        </button>
      </div>

      {pageTab === 'for-you' && (
        <div className="max-w-2xl mx-auto px-4 py-4"><YourKindOfPlace /></div>
      )}
      {pageTab === 'hidden-gems' && (
        <div className="max-w-xl mx-auto py-4">
          <HiddenGemFinder />
        </div>
      )}
      {pageTab === 'find-similar' && (
        <div className="max-w-xl mx-auto py-4">
          <HitchCampgroundFinder />
        </div>
      )}

      {pageTab === 'rv-networks' && (
        <HarvestHostsTab />
      )}

      {pageTab === 'campgrounds' && <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 mb-1">Discover Campgrounds</h1>
        <p className="text-gray-500">Find campgrounds that fit your rig and style</p>
      </div>

      {/* Character Quick Filters */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4" style={{ scrollbarWidth: 'none' }}>
        {[
          { img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261021/rvunicorn/characters/diesel.png', name: "Diesel's Pick", desc: 'Big Rig Ready', filters: { isBigRigFriendly: true, hasPullThrough: true, hasFullHookups: true } },
          { img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261086/rvunicorn/characters/luna.webp', name: "Luna's Pick", desc: 'Family & Pets', filters: { isPetFriendly: true, hasPool: true } },
          { img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261023/rvunicorn/characters/scout.png', name: "Scout's Pick", desc: 'Adventure Ready', filters: { isWaterfront: true } },
          { img: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261022/rvunicorn/characters/rose.png', name: "Rosé's Pick", desc: 'Full Amenities', filters: { hasFullHookups: true, hasShowers: true, hasPool: true, hasStore: true } },
        ].map(preset => (
          <button key={preset.name} onClick={() => { setAmenityFilters(preset.filters); setCurrentPage(1); }}
            className="flex items-center gap-2.5 px-4 py-2.5 rounded-xl flex-shrink-0 border transition hover:shadow-md"
            style={{ background: '#0F1C35', border: '1px solid rgba(232,168,56,0.15)' }}>
            <img src={preset.img} alt={preset.name} className="w-8 h-8 rounded-full object-cover" />
            <div className="text-left">
              <p className="text-[11px] font-bold" style={{ color: '#E8A838' }}>{preset.name}</p>
              <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.5)' }}>{preset.desc}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-4">
        <div className="flex gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9 w-full" placeholder="Search campgrounds... (press Enter)" value={pendingSearch}
              onChange={e => setPendingSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleSearch()} />
          </div>
          <button className="btn btn-primary px-4" onClick={handleSearch}><Search className="w-4 h-4" /></button>
          <button className={`btn px-4 flex items-center gap-2 ${showFilters ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setShowFilters(f => !f)}>
            <SlidersHorizontal className="w-4 h-4" /> Filters
            {activeFilterCount > 0 && <span className="bg-white text-primary-600 rounded-full w-5 h-5 text-xs flex items-center justify-center font-bold">{activeFilterCount}</span>}
          </button>
          <button className="btn btn-secondary flex items-center gap-2" onClick={() => setShowSuggestModal(true)}><Plus className="w-4 h-4" /> Suggest</button>
        </div>

        {activeFilterCount > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {searchTerm && <span className="flex items-center gap-1 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">"{searchTerm}" <button onClick={() => { setSearchTerm(''); setPendingSearch(''); setCurrentPage(1); }}><X className="w-3 h-3" /></button></span>}
            {stateFilter && <span className="flex items-center gap-1 text-xs bg-primary-100 text-primary-700 px-2 py-1 rounded-full">📍 {stateFilter} <button onClick={() => { setStateFilter(''); setCurrentPage(1); }}><X className="w-3 h-3" /></button></span>}
            {rvLength && <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">🚐 {rvLength}ft+ <button onClick={() => { setRvLength(''); setCurrentPage(1); }}><X className="w-3 h-3" /></button></span>}
            {rvAmps && <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">⚡ {rvAmps}A+ <button onClick={() => { setRvAmps(''); setCurrentPage(1); }}><X className="w-3 h-3" /></button></span>}
            {rvYear && <span className="flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">📅 {rvYear}+ <button onClick={() => { setRvYear(''); setCurrentPage(1); }}><X className="w-3 h-3" /></button></span>}
            {AMENITY_FILTERS.filter(([k]) => amenityFilters[k]).map(([k, label]) => (
              <span key={k} className="flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">{label} <button onClick={() => toggleAmenity(k)}><X className="w-3 h-3" /></button></span>
            ))}
            <button onClick={clearAll} className="text-xs text-red-500 hover:text-red-700 px-2 py-1">Clear all</button>
          </div>
        )}

        {showFilters && (
          <div className="mt-4 pt-4 border-t grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-1"><MapPin className="w-4 h-4" /> Location</h4>
              <select className="input w-full" value={stateFilter} onChange={e => { setStateFilter(e.target.value); setCurrentPage(1); }}>
                <option value="">All States</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-3">🚐 My RV Specs</h4>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min RV Length (ft)</label>
                  <input type="number" className="input w-full" placeholder="e.g. 35" value={rvLength} onChange={e => { setRvLength(e.target.value); setCurrentPage(1); }} />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Min Amp Service</label>
                  <select className="input w-full" value={rvAmps} onChange={e => { setRvAmps(e.target.value); setCurrentPage(1); }}>
                    <option value="">Any</option>
                    <option value="15">15 Amp</option>
                    <option value="20">20 Amp</option>
                    <option value="30">30 Amp</option>
                    <option value="50">50 Amp</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">My RV Year (min allowed)</label>
                  <input type="number" className="input w-full" placeholder="e.g. 2005" value={rvYear} onChange={e => { setRvYear(e.target.value); setCurrentPage(1); }} />
                </div>
              </div>
            </div>
            <div>
              <h4 className="font-semibold text-sm text-gray-700 mb-3">⛺ Amenities</h4>
              <div className="grid grid-cols-2 gap-y-2 gap-x-3">
                {AMENITY_FILTERS.map(([k, label]) => (
                  <label key={k} className="flex items-center gap-2 cursor-pointer text-sm">
                    <input type="checkbox" className="w-4 h-4 rounded" checked={!!amenityFilters[k]} onChange={() => toggleAmenity(k)} />
                    <span className="text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-gray-400">
            {loading ? 'Searching...' : `${total.toLocaleString()} campground${total !== 1 ? 's' : ''} found`}{totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
          </p>
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5" style={{ background: 'rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setViewMode('grid')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: viewMode === 'grid' ? 'rgba(232,168,56,0.15)' : 'transparent', color: viewMode === 'grid' ? '#E8A838' : 'rgba(245,240,232,0.5)' }}
            >
              <Grid3X3 className="w-3.5 h-3.5 inline mr-1" />Grid
            </button>
            <button
              onClick={() => setViewMode('map')}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
              style={{ background: viewMode === 'map' ? 'rgba(232,168,56,0.15)' : 'transparent', color: viewMode === 'map' ? '#E8A838' : 'rgba(245,240,232,0.5)' }}
            >
              <MapIcon className="w-3.5 h-3.5 inline mr-1" />Map
            </button>
          </div>
        </div>
      </div>

      {/* Map View */}
      {viewMode === 'map' && (
        <div className="rounded-xl overflow-hidden mb-6" style={{ background: '#1B2E50', border: '1px solid rgba(232,168,56,0.12)' }}>
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 900 }}
            width={800}
            height={500}
            style={{ width: '100%', height: 'auto' }}
          >
            <Geographies geography="https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json">
              {({ geographies }) =>
                geographies.map((geo) => (
                  <Geography
                    key={geo.rsmKey}
                    geography={geo}
                    style={{
                      default: { fill: 'rgba(245,240,232,0.08)', stroke: 'rgba(245,240,232,0.15)', strokeWidth: 0.5, outline: 'none' },
                      hover: { fill: 'rgba(245,240,232,0.12)', stroke: 'rgba(245,240,232,0.2)', strokeWidth: 0.5, outline: 'none' },
                      pressed: { fill: 'rgba(245,240,232,0.08)', stroke: 'rgba(245,240,232,0.15)', strokeWidth: 0.5, outline: 'none' },
                    }}
                  />
                ))
              }
            </Geographies>
            {campgrounds.filter(c => c.latitude && c.longitude).map(c => (
              <Marker key={c.id} coordinates={[c.longitude!, c.latitude!]}>
                <circle r={4} fill="#E8A838" stroke="#0F1C35" strokeWidth={1.5} />
                <title>{c.name}</title>
              </Marker>
            ))}
          </ComposableMap>
          {/* Mini cards below map for campgrounds with coordinates */}
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto">
            {campgrounds.filter(c => c.latitude && c.longitude).map(c => (
              <Link key={c.id} to={`/campgrounds/${c.id}`} className="flex items-center gap-3 p-2 rounded-lg transition hover:brightness-110" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                {c.imageUrl && <img src={c.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold truncate" style={{ color: '#F5F0E8' }}>{c.name}</p>
                  <p className="text-[10px] truncate" style={{ color: 'rgba(245,240,232,0.5)' }}>{c.location}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Grid View */}
      {viewMode === 'grid' && <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {campgrounds.map(c => (
          <Link key={c.id} to={`/campgrounds/${c.id}`} className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow overflow-hidden block">
            <div className="relative h-48 bg-gradient-to-br from-primary-100 to-secondary-100">
              {c.imageUrl ? <img src={c.imageUrl.startsWith("http") ? c.imageUrl : c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                : <div className="flex items-center justify-center h-full"><MapPin className="w-16 h-16 text-primary-300" /></div>}
              {c.state && <span className="absolute top-2 right-2 bg-white/90 px-2 py-0.5 rounded-full text-xs font-medium text-gray-700">{c.state}</span>}
            </div>
            <div className="p-4">
              <h3 className="font-bold text-gray-900 mb-1 line-clamp-1">{c.name}</h3>
              <p className="text-xs text-gray-500 mb-2 flex items-center gap-1"><MapPin className="w-3 h-3 shrink-0" />{c.location}</p>
              <p className="text-xs text-gray-500 mb-3 line-clamp-2">{stripHtml(c.description)}</p>
              {c.amenities && c.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {c.amenities.slice(0, 6).map(a => { const icon = getAmenityIcon(a); return icon ? <span key={a} title={formatAmenityName(a)} className="text-base">{icon}</span> : null; })}
                  {c.amenities.length > 6 && <span className="text-xs text-gray-400">+{c.amenities.length - 6}</span>}
                </div>
              )}
              <div className="flex items-center justify-between pt-3 border-t text-xs text-gray-500">
                <div className="flex items-center gap-1"><Star className="w-3 h-3 text-yellow-400 fill-current" />{c._count?.reviews ?? 0} reviews</div>
                <div className="flex gap-3">{c.phone && <Phone className="w-3 h-3" />}{c.website && <Globe className="w-3 h-3" />}{c.latitude && c.longitude && <Navigation className="w-3 h-3" />}</div>
              </div>
            </div>
          </Link>
        ))}
      </div>}

      {campgrounds.length === 0 && !loading && (
        <div className="text-center py-16 text-gray-500">
          <MapPin className="w-12 h-12 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">No campgrounds match your filters</p>
          <p className="text-sm mt-1">Try adjusting your search or clearing some filters</p>
          <button onClick={clearAll} className="btn btn-secondary mt-4">Clear all filters</button>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-4 mt-8">
          <button className="btn btn-secondary disabled:opacity-50" disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))}>Previous</button>
          <span className="font-medium text-sm">Page {currentPage} of {totalPages}</span>
          <button className="btn btn-secondary disabled:opacity-50" disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}>Next</button>
        </div>
      )}

      {showSuggestModal && <SuggestCampground onClose={() => setShowSuggestModal(false)} onSubmit={() => { setShowSuggestModal(false); fetchCampgrounds(); }} />}
    </div> }
    </div>
    </>
  );
}
