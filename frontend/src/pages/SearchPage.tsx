import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, MapPin, Star, User, ChefHat, Calendar, Users, Sparkles, Tent, DollarSign, Wifi, Zap, PawPrint, Waves, Loader2 } from 'lucide-react';
import api from '../services/api';

type TabType = 'all' | 'campgrounds' | 'users' | 'recipes' | 'events';

export default function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') || '';
  const [searchInput, setSearchInput] = useState(query);
  const [results, setResults] = useState<any>({});
  const [parsed, setParsed] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');

  useEffect(() => { if (query) { setSearchInput(query); performSearch(query); } }, [query]);

  const performSearch = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    try { const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`); setResults(data.results || {}); setParsed(data.parsed); }
    catch {} finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); if (searchInput.trim()) setSearchParams({ q: searchInput.trim() }); };
  const totalResults = Object.values(results).reduce((sum: number, cat: any) => sum + (cat?.total || 0), 0);
  const tabs: { key: TabType; label: string; icon: any; count: number }[] = [
    { key: 'all', label: 'All', icon: Search, count: totalResults },
    { key: 'campgrounds', label: 'Campgrounds', icon: Tent, count: results.campgrounds?.total || 0 },
    { key: 'users', label: 'People', icon: User, count: results.users?.total || 0 },
    { key: 'recipes', label: 'Recipes', icon: ChefHat, count: results.recipes?.total || 0 },
    { key: 'events', label: 'Events', icon: Calendar, count: results.events?.total || 0 },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <form onSubmit={handleSearch} className="mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input type="text" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search campgrounds, people, recipes, events..." className="w-full pl-12 pr-4 py-3.5 rounded-xl border border-gray-200 focus:border-orange-400 focus:ring-2 focus:ring-orange-100 text-base outline-none transition" autoFocus />
          <button type="submit" className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-r from-amber-500 to-orange-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:from-amber-400 hover:to-orange-500 transition">Search</button>
        </div>
      </form>

      {parsed?.aiSummary && !loading && (
        <div className="flex items-start gap-2 mb-4 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100 rounded-xl px-4 py-3">
          <Sparkles className="w-4 h-4 text-orange-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-gray-700"><span className="font-medium text-orange-700">AI understood:</span> {parsed.aiSummary}</p>
        </div>
      )}

      {loading && <div className="flex items-center justify-center py-20"><div className="text-center"><Loader2 className="w-8 h-8 text-orange-500 animate-spin mx-auto mb-3" /><p className="text-gray-500 text-sm">Searching with AI...</p></div></div>}

      {!loading && query && (
        <>
          <div className="flex gap-1 mb-6 overflow-x-auto pb-1 border-b border-gray-100">
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)} className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition whitespace-nowrap ${activeTab === tab.key ? 'text-orange-600 border-b-2 border-orange-500 bg-orange-50' : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'}`}>
                {tab.icon && <tab.icon className="w-4 h-4" />}{tab.label}
                {tab.count > 0 && <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {totalResults === 0 && <div className="text-center py-16"><Search className="w-12 h-12 text-gray-300 mx-auto mb-3" /><h3 className="text-lg font-semibold text-gray-700 mb-1">No results found</h3></div>}

          {(activeTab === 'all' || activeTab === 'campgrounds') && results.campgrounds?.items?.length > 0 && (
            <div className="mb-8">
              {activeTab === 'all' && <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><Tent className="w-5 h-5 text-green-600" />Campgrounds <span className="text-sm font-normal text-gray-500">({results.campgrounds.total})</span></h2>}
              <div className="space-y-3">{results.campgrounds.items.map((c: any) => (
                <Link key={c.id} to={`/campgrounds/${c.id}`} className="block bg-white rounded-xl border border-gray-100 hover:border-orange-200 hover:shadow-md transition overflow-hidden">
                  <div className="flex">
                    <div className="w-32 h-28 flex-shrink-0 bg-gradient-to-br from-green-100 to-emerald-100">{c.imageUrl ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Tent className="w-8 h-8 text-green-300" /></div>}</div>
                    <div className="flex-1 p-3 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{c.name}</h3>
                      <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{c.location}{c.state ? `, ${c.state}` : ''}</p>
                      <div className="flex items-center gap-3 mt-1.5">
                        {c.googleRating && <span className="flex items-center gap-0.5 text-xs text-yellow-600"><Star className="w-3.5 h-3.5 fill-current" />{c.googleRating}</span>}
                        {c.pricePerNight && <span className="flex items-center gap-0.5 text-xs text-gray-600"><DollarSign className="w-3.5 h-3.5" />${c.pricePerNight}/night</span>}
                        {c.maxRvLength && <span className="text-xs text-gray-500">Max {c.maxRvLength}ft</span>}
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {c.hasFullHookups && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><Zap className="w-3 h-3" />Full Hookups</span>}
                        {c.hasWifi && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><Wifi className="w-3 h-3" />WiFi</span>}
                        {c.isPetFriendly && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><PawPrint className="w-3 h-3" />Pets</span>}
                        {c.isWaterfront && <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full"><Waves className="w-3 h-3" />Waterfront</span>}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}</div>
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'users') && results.users?.items?.length > 0 && (
            <div className="mb-8">
              {activeTab === 'all' && <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-blue-600" />People <span className="text-sm font-normal text-gray-500">({results.users.total})</span></h2>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{results.users.items.map((u: any) => (
                <Link key={u.id} to={`/profile/${u.username}`} className="flex items-center gap-3 bg-white rounded-xl border border-gray-100 hover:border-blue-200 hover:shadow-md transition p-3">
                  {u.profilePicture ? <img src={u.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" /> : <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center"><User className="w-6 h-6 text-blue-400" /></div>}
                  <div className="min-w-0"><p className="font-semibold text-gray-900 truncate">{u.firstName} {u.lastName}{u.isCreator && <span className="ml-1 text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">Creator</span>}</p><p className="text-sm text-gray-500 truncate">@{u.username}</p></div>
                </Link>
              ))}</div>
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'recipes') && results.recipes?.items?.length > 0 && (
            <div className="mb-8">
              {activeTab === 'all' && <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><ChefHat className="w-5 h-5 text-red-600" />Recipes <span className="text-sm font-normal text-gray-500">({results.recipes.total})</span></h2>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{results.recipes.items.map((r: any) => (
                <Link key={r.id} to={`/recipes/${r.id}`} className="bg-white rounded-xl border border-gray-100 hover:border-red-200 hover:shadow-md transition overflow-hidden">
                  <div className="h-36 bg-gradient-to-br from-red-100 to-orange-100">{r.imageUrl ? <img src={r.imageUrl} alt={r.title} className="w-full h-full object-cover" /> : <img src="/Recipe_default.png" alt={r.title} className="w-full h-full object-contain bg-gradient-to-br from-orange-50 to-red-50" />}</div>
                  <div className="p-3"><h3 className="font-semibold text-gray-900 truncate">{r.title}</h3><div className="flex items-center gap-2 mt-1 text-xs text-gray-500">{r.category && <span className="bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">{r.category}</span>}</div>{r.user && <p className="text-xs text-gray-400 mt-1.5">by {r.user.firstName} {r.user.lastName}</p>}</div>
                </Link>
              ))}</div>
            </div>
          )}

          {(activeTab === 'all' || activeTab === 'events') && results.events?.items?.length > 0 && (
            <div className="mb-8">
              {activeTab === 'all' && <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-3"><Calendar className="w-5 h-5 text-purple-600" />Events <span className="text-sm font-normal text-gray-500">({results.events.total})</span></h2>}
              <div className="space-y-3">{results.events.items.map((e: any) => (
                <Link key={e.id} to={`/events/${e.id}`} className="block bg-white rounded-xl border border-gray-100 hover:border-purple-200 hover:shadow-md transition p-4">
                  <h3 className="font-semibold text-gray-900 truncate">{e.title}</h3>
                  {e.location && <p className="text-sm text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3.5 h-3.5" />{e.location}</p>}
                  <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">{e.startDate && <span>{new Date(e.startDate).toLocaleDateString()}</span>}{e._count?.attendees > 0 && <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{e._count.attendees}</span>}</div>
                </Link>
              ))}</div>
            </div>
          )}
        </>
      )}

      {!query && !loading && (
        <div className="text-center py-20">
          <Search className="w-16 h-16 text-gray-200 mx-auto mb-4" />
          <h2 className="text-xl font-bold text-gray-700 mb-2">Search RVUnicorn</h2>
          <p className="text-gray-500 mb-6">Try natural language searches like:</p>
          <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
            {['Pet-friendly campgrounds in Colorado','Waterfront RV parks with full hookups','Easy camping recipes for groups','Big rig friendly sites near the beach','RV parks under $40 per night in Texas'].map((s, i) => (
              <button key={i} onClick={() => { setSearchInput(s); setSearchParams({ q: s }); }} className="px-4 py-2 bg-gradient-to-r from-orange-50 to-amber-50 hover:from-orange-100 hover:to-amber-100 rounded-full text-sm text-gray-700 border border-orange-100 hover:border-orange-200 transition">{s}</button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
