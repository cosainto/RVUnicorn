import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Heart, Star, MapPin } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface FavoriteCampground {
  campgroundId: string;
  campgroundName: string;
  campground?: { id: string; name: string; city?: string; state?: string; imageUrl?: string; slug?: string; googleRating?: number };
  totalVisits: number;
  isFavorite: boolean;
  highestRating: number;
  reviewSnippet: string | null;
  reviewerName: string | null;
  reviewerAvatar: string | null;
  siteNumbers: string[];
}

export default function RigCampgroundsTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [campgrounds, setCampgrounds] = useState<FavoriteCampground[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'favorites' | 'most-visited' | 'best-rated'>('all');

  useEffect(() => {
    api.get(`/rigs/${slug}/favorite-campgrounds`)
      .then(r => setCampgrounds(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: CN.gold }} /></div>;

  const filtered = campgrounds.filter(c => {
    if (filter === 'favorites') return c.isFavorite;
    if (filter === 'most-visited') return c.totalVisits >= 2;
    if (filter === 'best-rated') return c.highestRating >= 4;
    return true;
  });

  if (campgrounds.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <span className="text-3xl block mb-2">🏕</span>
        <p className="text-sm" style={{ color: CN.muted }}>No campgrounds logged yet</p>
        {isOwner && <p className="text-xs mt-1" style={{ color: CN.gold }}>Log your campsite visits to build your favorites list.</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {([
          { id: 'all', label: 'All' },
          { id: 'favorites', label: '♥ Favorites' },
          { id: 'most-visited', label: 'Most Visited' },
          { id: 'best-rated', label: 'Best Rated' },
        ] as const).map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className="px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition"
            style={{
              background: filter === f.id ? CN.gold : CN.cardAlt,
              color: filter === f.id ? CN.bg : CN.muted,
              border: `1px solid ${filter === f.id ? CN.gold : CN.border}`,
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Campground cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {filtered.map(c => {
          const cg = c.campground;
          const linkTo = cg?.slug ? `/campgrounds/${cg.slug}` : cg?.id ? `/campgrounds/${cg.id}` : '#';

          return (
            <Link
              key={c.campgroundId}
              to={linkTo}
              className="rounded-2xl overflow-hidden transition hover:brightness-110"
              style={{ background: CN.card, border: `1px solid ${CN.border}`, textDecoration: 'none' }}
            >
              {/* Photo */}
              <div className="relative" style={{ height: 140 }}>
                {cg?.imageUrl ? (
                  <img src={cg.imageUrl} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center" style={{ background: CN.cardAlt }}>
                    <MapPin className="w-8 h-8" style={{ color: CN.border }} />
                  </div>
                )}
                {c.isFavorite && (
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-bold flex items-center gap-1" style={{ background: 'rgba(239,68,68,0.9)', color: '#fff' }}>
                    <Heart className="w-3 h-3 fill-current" /> Favorite
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="p-3">
                <p className="text-sm font-bold mb-0.5" style={{ color: CN.cream }}>{cg?.name || c.campgroundName}</p>
                {(cg?.city || cg?.state) && (
                  <p className="text-xs mb-1.5" style={{ color: CN.muted }}>{[cg?.city, cg?.state].filter(Boolean).join(', ')}</p>
                )}
                <div className="flex items-center gap-3 text-xs" style={{ color: CN.muted }}>
                  {c.highestRating > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Star className="w-3 h-3 fill-current" style={{ color: CN.gold }} /> {c.highestRating}
                    </span>
                  )}
                  {c.totalVisits > 0 && <span>Visited {c.totalVisits}x</span>}
                  {c.siteNumbers.length > 0 && <span>Site {c.siteNumbers[0]}</span>}
                </div>
                {c.reviewSnippet && (
                  <p className="text-xs mt-2 italic line-clamp-2" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    "{c.reviewSnippet}"{c.reviewerName && ` — ${c.reviewerName}`}
                  </p>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
