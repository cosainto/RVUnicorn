import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, ChevronDown } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface Review {
  id: string;
  rating: number;
  title?: string;
  review?: string;
  visitDate?: string;
  createdAt: string;
  campground: { id: string; name: string; city?: string; state?: string; imageUrl?: string; slug?: string };
  user: { id: string; firstName: string; lastName?: string; username: string; profilePicture?: string };
  wouldReturn?: string;
  bigRigFriendly?: string;
}

export default function RigReviewsTab({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ total: 0, avgRating: 0, uniqueCampgrounds: 0 });
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const loadReviews = (p: number) => {
    api.get(`/rigs/${slug}/reviews`, { params: { page: p } })
      .then(r => {
        const data = r.data;
        if (p === 1) {
          setReviews(data.reviews || []);
          setStats({ total: data.total, avgRating: data.avgRating, uniqueCampgrounds: data.uniqueCampgrounds });
        } else {
          setReviews(prev => [...prev, ...(data.reviews || [])]);
        }
        setHasMore(data.hasMore);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadReviews(1); }, [slug]);

  if (loading) return <div className="text-center py-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto" style={{ borderColor: CN.gold }} /></div>;

  if (reviews.length === 0) {
    return (
      <div className="text-center py-12 rounded-2xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <span className="text-3xl block mb-2">⭐</span>
        <p className="text-sm" style={{ color: CN.muted }}>No campground reviews yet</p>
        {isOwner && <p className="text-xs mt-1" style={{ color: CN.gold }}>Review campgrounds you've stayed at to help other RVers.</p>}
      </div>
    );
  }

  const renderStars = (rating: number) => (
    <span className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className="w-3 h-3" style={{ color: i <= rating ? CN.gold : CN.border, fill: i <= rating ? CN.gold : 'none' }} />
      ))}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Stats header */}
      <div className="flex items-center gap-4 px-4 py-3 rounded-2xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color: CN.gold }}>{stats.total}</p>
          <p className="text-[9px] uppercase" style={{ color: CN.muted }}>Reviews</p>
        </div>
        <div className="w-px h-8" style={{ background: CN.border }} />
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color: CN.gold }}>{stats.avgRating}</p>
          <p className="text-[9px] uppercase" style={{ color: CN.muted }}>Avg Rating</p>
        </div>
        <div className="w-px h-8" style={{ background: CN.border }} />
        <div className="text-center">
          <p className="text-xl font-bold" style={{ color: CN.gold }}>{stats.uniqueCampgrounds}</p>
          <p className="text-[9px] uppercase" style={{ color: CN.muted }}>Campgrounds</p>
        </div>
      </div>

      {/* Review cards */}
      {reviews.map(r => {
        const isExpanded = expanded.has(r.id);
        const reviewText = r.review || '';
        const isLong = reviewText.length > 200;
        const linkTo = r.campground?.slug ? `/campgrounds/${r.campground.slug}` : `/campgrounds/${r.campground?.id}`;

        return (
          <div key={r.id} className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            <div className="p-4">
              {/* Campground header */}
              <div className="flex items-start gap-3 mb-3">
                <Link to={linkTo} className="flex-shrink-0">
                  {r.campground?.imageUrl ? (
                    <img src={r.campground.imageUrl} alt="" className="w-14 h-14 rounded-xl object-cover" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: CN.cardAlt }}>
                      <MapPin className="w-5 h-5" style={{ color: CN.muted }} />
                    </div>
                  )}
                </Link>
                <div className="flex-1 min-w-0">
                  <Link to={linkTo} className="text-sm font-bold hover:underline" style={{ color: CN.cream, textDecoration: 'none' }}>
                    {r.campground?.name}
                  </Link>
                  {(r.campground?.city || r.campground?.state) && (
                    <p className="text-xs" style={{ color: CN.muted }}>{[r.campground?.city, r.campground?.state].filter(Boolean).join(', ')}</p>
                  )}
                </div>
              </div>

              {/* Reviewer + rating */}
              <div className="flex items-center gap-2 mb-2">
                {r.user?.profilePicture ? (
                  <img src={r.user.profilePicture} alt="" className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold" style={{ background: CN.cardAlt, color: CN.gold }}>{r.user?.firstName?.[0]}</div>
                )}
                <span className="text-xs font-semibold" style={{ color: CN.cream }}>{r.user?.firstName}</span>
                <span className="text-xs" style={{ color: CN.muted }}>·</span>
                {renderStars(r.rating)}
                <span className="text-xs" style={{ color: CN.muted }}>·</span>
                <span className="text-[10px]" style={{ color: CN.muted }}>
                  {new Date(r.visitDate || r.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                </span>
              </div>

              {/* Review text */}
              {reviewText && (
                <div>
                  <p className={`text-sm leading-relaxed ${isLong && !isExpanded ? 'line-clamp-3' : ''}`} style={{ color: 'rgba(255,255,255,0.7)' }}>
                    {reviewText}
                  </p>
                  {isLong && (
                    <button
                      onClick={() => setExpanded(prev => { const next = new Set(prev); isExpanded ? next.delete(r.id) : next.add(r.id); return next; })}
                      className="text-xs font-semibold mt-1 flex items-center gap-0.5"
                      style={{ color: CN.gold, background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      {isExpanded ? 'Show less' : 'Read more'} <ChevronDown className="w-3 h-3" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }} />
                    </button>
                  )}
                </div>
              )}

              {/* Extra details */}
              <div className="flex items-center gap-3 mt-2 text-[10px]" style={{ color: CN.muted }}>
                {r.wouldReturn === 'YES' && <span>Would return ✓</span>}
                {r.bigRigFriendly === 'YES' && <span>Big rig friendly 🚐</span>}
                <Link to={linkTo} className="ml-auto font-semibold" style={{ color: CN.gold, textDecoration: 'none' }}>View Campground →</Link>
              </div>
            </div>
          </div>
        );
      })}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => { const next = page + 1; setPage(next); loadReviews(next); }}
          className="w-full py-3 rounded-2xl text-sm font-semibold transition hover:brightness-110"
          style={{ background: CN.cardAlt, color: CN.gold, border: `1px solid ${CN.border}` }}
        >
          Load More Reviews
        </button>
      )}
    </div>
  );
}
