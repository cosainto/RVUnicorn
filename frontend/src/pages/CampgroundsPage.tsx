const stripHtml = (html: string | null) => html?.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&") || "";
import React, { useEffect, useState, useCallback } from 'react';
import api from '../services/api';
import { Link } from 'react-router-dom';
import { Search, MapPin, Star, Plus, Phone, Globe, Navigation, SlidersHorizontal, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import SuggestCampground from '../components/SuggestCampground';
import HarvestHostsTab from '../components/HarvestHostsTab';
import HitchCampgroundFinder from '../components/HitchCampgroundFinder';
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
  const [pageTab, setPageTab] = useState<'campgrounds' | 'rv-networks' | 'find-similar'>('campgrounds');

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
    <div className="max-w-7xl mx-auto px-4 py-8 text-center">
      <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
      <p className="mt-4 text-gray-600">Loading campgrounds...</p>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Page Tab Switcher */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => setPageTab('campgrounds')}
          className={"flex items-center gap-2 px-5 py-2.5 rounded-full font-semibold text-sm transition " + (pageTab === 'campgrounds' ? 'bg-primary-600 text-white shadow' : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300')}
        >
          🏕️ Campgrounds
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

        <p className="text-xs text-gray-400 mt-3">
          {loading ? 'Searching...' : `${total.toLocaleString()} campground${total !== 1 ? 's' : ''} found`}{totalPages > 1 && ` · Page ${currentPage} of ${totalPages}`}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
      </div>

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
  );
}
