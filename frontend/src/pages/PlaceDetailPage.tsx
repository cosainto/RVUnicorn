import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, Globe, ChevronLeft, Camera } from 'lucide-react';
import GenieWishlistButton from '../components/ui/GenieWishlistButton';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Helmet } from 'react-helmet-async';

// Campfire Night dark theme
const theme = {
  bg: '#0F1C35',
  card: '#1B2B4B',
  cardLight: '#243352',
  border: '#2A3F5F',
  gold: '#C9A84C',
  orange: '#E8622A',
  cream: '#F5F0E8',
  muted: '#94A3B8',
};

const CATEGORY_EMOJI: Record<string, string> = {
  CAMPGROUND: '🏕️',
  RESTAURANT: '🍽️',
  GAS_STATION: '⛽',
  ATTRACTION: '🎡',
  STORE: '🛒',
  PARK: '🌲',
  HOTEL: '🏨',
  REPAIR: '🔧',
  OTHER: '📍',
};

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'sm' ? 'text-sm' : size === 'lg' ? 'text-2xl' : 'text-lg';
  return (
    <span className={sizeClass} style={{ color: theme.gold }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i}>{i <= Math.round(rating) ? '★' : '☆'}</span>
      ))}
    </span>
  );
}

function StarSelector({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <button
          key={i}
          type="button"
          onClick={() => onChange(i)}
          className="text-3xl transition-transform hover:scale-110 focus:outline-none"
          style={{ color: i <= value ? theme.gold : theme.muted }}
        >
          {i <= value ? '★' : '☆'}
        </button>
      ))}
    </div>
  );
}

export default function PlaceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [place, setPlace] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Review form state
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api
      .get(`/places/${id}`)
      .then((r) => {
        setPlace(r.data);
        setNotFound(false);
      })
      .catch((err) => {
        if (err.response?.status === 404) setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const submitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewRating === 0 || !reviewText.trim()) return;
    setSubmittingReview(true);
    try {
      await api.post(`/places/${id}/reviews`, {
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        text: reviewText.trim(),
      });
      // Refresh place data
      const r = await api.get(`/places/${id}`);
      setPlace(r.data);
      setReviewRating(0);
      setReviewTitle('');
      setReviewText('');
    } catch {
      alert('Failed to submit review');
    }
    setSubmittingReview(false);
  };

  // Loading
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: theme.bg }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2" style={{ borderColor: theme.gold }} />
      </div>
    );
  }

  // Not found
  if (notFound || !place) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: theme.bg }}>
        <p className="text-xl font-semibold" style={{ color: theme.cream }}>Place not found</p>
        <Link to="/explore" className="underline text-sm" style={{ color: theme.gold }}>
          Back to Explore
        </Link>
      </div>
    );
  }

  const categoryEmoji = CATEGORY_EMOJI[place.category] || CATEGORY_EMOJI.OTHER;
  const heroImage = place.websiteImageUrl || place.photos?.[0]?.url || null;
  const reviews: any[] = place.reviews || [];
  const photos: any[] = place.photos || [];
  const avgRating = place.averageRating || 0;
  const fullAddress = [place.street, place.city, place.state, place.zip].filter(Boolean).join(', ');

  // Check if current user already reviewed
  const userAlreadyReviewed = user && reviews.some((r: any) => r.userId === (user as any).id);

  return (
    <>
      <Helmet>
        <title>{place.name} | RVUnicorn</title>
        <meta name="description" content={`${place.name} — ${fullAddress}. Read reviews and see photos on RVUnicorn.`} />
      </Helmet>

      <div className="min-h-screen" style={{ background: theme.bg }}>
        {/* Hero Section */}
        <div className="relative w-full" style={{ height: 280 }}>
          {heroImage ? (
            <img
              src={heroImage}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${theme.card} 0%, ${theme.bg} 100%)`,
              }}
            >
              <span className="text-7xl">{categoryEmoji}</span>
            </div>
          )}
          {/* Gradient overlay */}
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(to top, rgba(15,28,53,0.95) 0%, rgba(15,28,53,0.3) 50%, transparent 100%)',
            }}
          />
          {/* Back button */}
          <button
            onClick={() => window.history.back()}
            className="absolute top-4 left-4 w-10 h-10 rounded-full flex items-center justify-center backdrop-blur-sm"
            style={{ background: 'rgba(15,28,53,0.6)' }}
          >
            <ChevronLeft className="w-5 h-5" style={{ color: theme.cream }} />
          </button>
          {/* Wishlist button */}
          <div className="absolute top-4 right-4 z-10">
            <GenieWishlistButton itemId={place.id} itemType="place" itemName={place.name} size="md" scrim />
          </div>
          {/* Name + category badge */}
          <div className="absolute bottom-4 left-4 right-4">
            <span
              className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full mb-2"
              style={{ background: theme.orange, color: '#fff' }}
            >
              {categoryEmoji} {place.category?.replace(/_/g, ' ') || 'Place'}
            </span>
            <h1 className="text-2xl font-bold leading-tight" style={{ color: theme.cream }}>
              {place.name}
            </h1>
          </div>
        </div>

        {/* Info Card */}
        <div className="mx-4 -mt-2 relative z-10 rounded-xl p-5" style={{ background: theme.card, border: `1px solid ${theme.border}` }}>
          {fullAddress && (
            <div className="flex items-start gap-2 mb-3">
              <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: theme.gold }} />
              <p className="text-sm" style={{ color: theme.cream }}>{fullAddress}</p>
            </div>
          )}
          {place.website && (
            <div className="flex items-center gap-2 mb-3">
              <Globe className="w-4 h-4 flex-shrink-0" style={{ color: theme.gold }} />
              <a
                href={place.website.startsWith('http') ? place.website : `https://${place.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline truncate"
                style={{ color: theme.gold }}
              >
                {place.website.replace(/^https?:\/\//, '')}
              </a>
            </div>
          )}
          {avgRating > 0 && (
            <div className="flex items-center gap-2">
              <StarRating rating={avgRating} />
              <span className="text-sm" style={{ color: theme.muted }}>
                ({avgRating.toFixed(1)})
              </span>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        <div className="px-4 mt-6">
          <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.cream }}>
            <Star className="w-5 h-5" style={{ color: theme.gold }} />
            Reviews
            <span className="text-sm font-normal" style={{ color: theme.muted }}>({reviews.length})</span>
          </h2>

          {reviews.length === 0 && (
            <p className="text-sm mt-3" style={{ color: theme.muted }}>No reviews yet. Be the first!</p>
          )}

          <div className="mt-3 space-y-3">
            {reviews.map((review: any) => (
              <div
                key={review.id || review._id}
                className="rounded-lg p-4"
                style={{ background: theme.cardLight, border: `1px solid ${theme.border}` }}
              >
                <div className="flex items-center gap-3 mb-2">
                  {review.user?.profilePicture ? (
                    <img
                      src={review.user.profilePicture}
                      alt=""
                      className="w-8 h-8 rounded-full object-cover"
                    />
                  ) : (
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                      style={{ background: theme.border, color: theme.cream }}
                    >
                      {(review.user?.firstName || review.user?.username || '?')[0]?.toUpperCase()}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: theme.cream }}>
                      {review.user?.firstName
                        ? `${review.user.firstName} ${review.user.lastName || ''}`.trim()
                        : review.user?.username || 'Anonymous'}
                    </p>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-xs" style={{ color: theme.muted }}>
                        {review.createdAt ? timeAgo(review.createdAt) : ''}
                      </span>
                    </div>
                  </div>
                </div>
                {review.title && (
                  <p className="text-sm font-semibold mb-1" style={{ color: theme.cream }}>{review.title}</p>
                )}
                <p className="text-sm leading-relaxed" style={{ color: theme.muted }}>{review.text}</p>
              </div>
            ))}
          </div>

          {/* Write a Review form (if logged in and hasn't reviewed) */}
          {user && !userAlreadyReviewed && (
            <form onSubmit={submitReview} className="mt-4 rounded-lg p-4" style={{ background: theme.card, border: `1px solid ${theme.border}` }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: theme.cream }}>Write a Review</h3>
              <div className="mb-3">
                <StarSelector value={reviewRating} onChange={setReviewRating} />
              </div>
              <input
                type="text"
                placeholder="Title (optional)"
                value={reviewTitle}
                onChange={(e) => setReviewTitle(e.target.value)}
                className="w-full rounded-lg px-3 py-2 text-sm mb-2 focus:outline-none focus:ring-2"
                style={{
                  background: theme.cardLight,
                  border: `1px solid ${theme.border}`,
                  color: theme.cream,
                  outline: 'none',
                }}
              />
              <textarea
                placeholder="Share your experience..."
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 resize-none"
                style={{
                  background: theme.cardLight,
                  border: `1px solid ${theme.border}`,
                  color: theme.cream,
                }}
              />
              <button
                type="submit"
                disabled={reviewRating === 0 || !reviewText.trim() || submittingReview}
                className="w-full py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-40"
                style={{ background: theme.gold, color: theme.bg }}
              >
                {submittingReview ? 'Submitting...' : 'Submit Review'}
              </button>
            </form>
          )}
        </div>

        {/* Photos Section */}
        {photos.length > 0 && (
          <div className="px-4 mt-6 pb-8">
            <h2 className="text-lg font-bold flex items-center gap-2" style={{ color: theme.cream }}>
              <Camera className="w-5 h-5" style={{ color: theme.gold }} />
              Photos
              <span className="text-sm font-normal" style={{ color: theme.muted }}>({photos.length})</span>
            </h2>
            <div className="grid grid-cols-3 gap-2 mt-3">
              {photos.map((photo: any, idx: number) => (
                <a
                  key={photo.id || idx}
                  href={photo.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square rounded-lg overflow-hidden"
                  style={{ border: `1px solid ${theme.border}` }}
                >
                  <img
                    src={photo.url || photo.thumbnailUrl}
                    alt={photo.caption || `Photo ${idx + 1}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform"
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* OSM attribution */}
        {place.googlePlaceId?.startsWith('osm-') && (
          <p className="text-[10px] text-center mt-6" style={{ color: 'rgba(139,155,180,0.4)' }}>
            Place data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline">OpenStreetMap</a> contributors
          </p>
        )}

        {/* Bottom spacer for mobile nav */}
        <div className="h-24" />
      </div>
    </>
  );
}
