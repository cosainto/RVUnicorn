import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { Sparkles } from 'lucide-react';
import api from '../services/api';
import { format } from 'date-fns';

const REGIONS = ['All', 'Southwest', 'Pacific Coast', 'Northeast', 'Mountain West', 'Southeast', 'Midwest'];
const TAGS = ['boondocking', 'family', 'solo', 'full-hookup', 'national-park', 'international', 'weekend', 'dog-friendly'];

interface ScrapbookCard {
  id: string;
  tripId: string;
  coverPhotoUrl?: string;
  pinCount: number;
  region?: string;
  tags: string[];
  tripTitle?: string;
  tripDates?: { start: string; end: string };
  shareToken?: string;
  campgroundName?: string;
  campgroundState?: string;
  reactionCount: number;
  user: { firstName: string; profilePicture?: string; username: string };
}

export default function ScrapbookDiscoverPage() {
  const [featured, setFeatured] = useState<ScrapbookCard[]>([]);
  const [scrapbooks, setScrapbooks] = useState<ScrapbookCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [region, setRegion] = useState('All');
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set());
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  useEffect(() => {
    api.get('/scrapbook/discover/featured').then(({ data }) => setFeatured(data.featured || [])).catch(() => {});
    loadScrapbooks(true);
  }, []);

  useEffect(() => { loadScrapbooks(true); }, [region, selectedTags]);

  async function loadScrapbooks(reset = false) {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (region !== 'All') params.set('region', region);
      if (selectedTags.size > 0) params.set('tags', Array.from(selectedTags).join(','));
      if (!reset && cursor) params.set('cursor', cursor);

      const { data } = await api.get(`/scrapbook/discover?${params}`);
      const items = data.scrapbooks || [];
      setScrapbooks(prev => reset ? items : [...prev, ...items]);
      setCursor(data.nextCursor);
      setHasMore(!!data.nextCursor);
    } catch {}
    setLoading(false);
  }

  function toggleTag(tag: string) {
    const next = new Set(selectedTags);
    if (next.has(tag)) next.delete(tag); else next.add(tag);
    setSelectedTags(next);
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Helmet><title>Discover Scrapbooks — RVUnicorn</title></Helmet>

      {/* Hero */}
      <div className="bg-gradient-to-b from-[#0F1C35] to-[#1a2d4a] py-12 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2" style={{ color: '#F5F0E8' }}>Discover Scrapbooks</h1>
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.6)' }}>Real trip memories from the RVUnicorn community</p>
        </div>

        {/* Featured */}
        {featured.length > 0 && (
          <div className="max-w-5xl mx-auto mt-8">
            <h2 className="text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-1.5" style={{ color: '#E8A838' }}>
              <Sparkles className="w-3.5 h-3.5" /> Featured Memories
            </h2>
            <div className="flex gap-4 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
              {featured.map((s) => (
                <Link key={s.id} to={`/s/${s.shareToken}`} className="flex-shrink-0 w-64 rounded-xl overflow-hidden group hover:shadow-lg transition" style={{ background: '#1a2d4a' }}>
                  {s.coverPhotoUrl && <img src={s.coverPhotoUrl} className="w-full h-36 object-cover group-hover:brightness-110 transition" alt="" />}
                  <div className="p-3">
                    <p className="text-sm font-bold truncate" style={{ color: '#F5F0E8' }}>{s.tripTitle || 'Trip'}</p>
                    <p className="text-[10px] truncate" style={{ color: 'rgba(245,240,232,0.5)' }}>{s.campgroundName}{s.campgroundState ? `, ${s.campgroundState}` : ''}</p>
                    <div className="flex items-center gap-2 mt-2">
                      {s.user?.profilePicture && <img src={s.user.profilePicture} className="w-4 h-4 rounded-full" alt="" />}
                      <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.4)' }}>{s.user?.firstName}</span>
                      <span className="text-[10px] ml-auto" style={{ color: 'rgba(245,240,232,0.4)' }}>❤️ {s.reactionCount}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="flex gap-2 overflow-x-auto mb-2" style={{ scrollbarWidth: 'none' }}>
          {REGIONS.map(r => (
            <button key={r} onClick={() => setRegion(r)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${region === r ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {r}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {TAGS.map(t => (
            <button key={t} onClick={() => toggleTag(t)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold transition ${selectedTags.has(t) ? 'bg-amber-100 text-amber-800 border border-amber-300' : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="max-w-5xl mx-auto px-4 pb-12">
        {scrapbooks.length === 0 && !loading ? (
          <div className="text-center py-16">
            <p className="text-gray-400">No scrapbooks found for this region yet.</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to share yours!</p>
          </div>
        ) : (
          <div className="columns-1 sm:columns-2 lg:columns-3 gap-4">
            {scrapbooks.map((s) => (
              <Link key={s.id} to={`/s/${s.shareToken}`} className="block break-inside-avoid mb-4 bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-md transition group">
                {s.coverPhotoUrl && <img src={s.coverPhotoUrl} className="w-full object-cover group-hover:brightness-105 transition" style={{ maxHeight: 240 }} alt="" loading="lazy" />}
                <div className="p-3">
                  <div className="flex items-center gap-1 text-xs text-gray-400 mb-1">
                    {s.reactionCount > 0 && <span>❤️ {s.reactionCount}</span>}
                    {s.pinCount > 0 && <span className="ml-auto">{s.pinCount} photos</span>}
                  </div>
                  <p className="font-bold text-gray-900 text-sm line-clamp-1">{s.tripTitle || 'Trip'}</p>
                  <p className="text-xs text-gray-500 line-clamp-1">{s.campgroundName}{s.campgroundState ? ` · ${s.campgroundState}` : ''}</p>
                  <div className="flex items-center gap-2 mt-2">
                    {s.user?.profilePicture && <img src={s.user.profilePicture} className="w-5 h-5 rounded-full" alt="" />}
                    <span className="text-xs text-gray-500">{s.user?.firstName}</span>
                    {s.tripDates?.start && <span className="text-[10px] text-gray-400 ml-auto">{format(new Date(s.tripDates.start), 'MMM yyyy')}</span>}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {hasMore && !loading && (
          <div className="text-center mt-6">
            <button onClick={() => loadScrapbooks()} className="px-6 py-2.5 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold hover:bg-gray-200 transition">
              Load More
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
