import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { MapPin, Calendar, Users, Camera, Truck } from 'lucide-react';
import PublicHeader from '../../components/public/PublicHeader';
import GateBlur from '../../components/public/GateBlur';
import GateModal from '../../components/public/GateModal';
import { useGate } from '../../hooks/useGate';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };

export default function PublicTripPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const [trip, setTrip] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const { requireAuth, gateModalProps } = useGate();

  useEffect(() => {
    if (!tripId) return;
    api.get(`/public/trips/${tripId}`)
      .then(r => setTrip(r.data))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [tripId]);

  if (loading) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-12">
          <div className="h-48 rounded-2xl animate-pulse" style={{ background: CN.card }} />
          <div className="h-8 w-64 rounded mt-6 animate-pulse" style={{ background: CN.card }} />
          <div className="h-4 w-96 rounded mt-3 animate-pulse" style={{ background: CN.card }} />
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <p className="text-lg font-semibold" style={{ color: CN.cream }}>Trip not found</p>
          <p className="text-sm mt-2" style={{ color: CN.muted }}>This trip may be private or no longer exists.</p>
          <Link to="/" className="inline-block mt-6 px-6 py-3 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>
            Explore RVUnicorn
          </Link>
        </div>
      </div>
    );
  }

  const author = trip.organizer || {};
  const campground = trip.campground;
  const coverImg = trip.coverImage || campground?.imageUrl;
  const duration = trip.startDate && trip.endDate
    ? Math.ceil((new Date(trip.endDate).getTime() - new Date(trip.startDate).getTime()) / 86400000)
    : null;

  return (
    <>
      <Helmet>
        <title>{author.firstName}'s Trip to {campground?.name || trip.title} · RVUnicorn</title>
        <meta name="description" content={`${author.firstName} took their ${author.rvYear || ''} ${author.rvMake || 'RV'} to ${campground?.name || trip.title}${duration ? ` for ${duration} days` : ''}. See the campgrounds, route, and photos on RVUnicorn.`} />
        <meta property="og:title" content={`${author.firstName}'s RV Trip to ${campground?.name || trip.title}`} />
        <meta property="og:description" content={`${duration ? `${duration}-day trip` : 'RV trip'}${campground ? ` · ${campground.name}` : ''}${author.rvMake ? ` · ${author.rvMake} ${author.rvModel || ''}` : ''}`} />
        {coverImg && <meta property="og:image" content={coverImg} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/t/${tripId}`} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="RVUnicorn" />
        <meta name="twitter:card" content="summary_large_image" />
        <link rel="canonical" href={`https://www.rvunicorn.com/t/${tripId}`} />
      </Helmet>

      <div style={{ background: CN.bg, minHeight: '100vh' }}>
        <PublicHeader />

        {/* Cover image */}
        {coverImg && (
          <div className="w-full h-64 sm:h-80 relative">
            <img src={coverImg} alt="" className="w-full h-full object-cover" />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, #0F1C35, transparent 60%)' }} />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
          {/* Title */}
          <h1 className="text-3xl sm:text-4xl font-bold mb-3" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
            {trip.title}
          </h1>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 mb-6">
            {campground && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: CN.muted }}>
                <MapPin className="w-4 h-4" style={{ color: CN.gold }} />
                {campground.name}{campground.state ? `, ${campground.state}` : ''}
              </span>
            )}
            {trip.startDate && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: CN.muted }}>
                <Calendar className="w-4 h-4" style={{ color: CN.gold }} />
                {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                {duration ? ` · ${duration} days` : ''}
              </span>
            )}
            {trip.attendeeCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: CN.muted }}>
                <Users className="w-4 h-4" style={{ color: CN.gold }} />
                {trip.attendeeCount} RVer{trip.attendeeCount !== 1 ? 's' : ''}
              </span>
            )}
            {trip.photoCount > 0 && (
              <span className="flex items-center gap-1.5 text-sm" style={{ color: CN.muted }}>
                <Camera className="w-4 h-4" style={{ color: CN.gold }} />
                {trip.photoCount} photo{trip.photoCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Author card */}
          <div className="flex items-center gap-3 p-4 rounded-xl mb-8" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
            {author.profilePicture ? (
              <img src={author.profilePicture} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold" style={{ background: CN.gold, color: CN.bg }}>
                {author.firstName?.[0]}{author.lastName?.[0]}
              </div>
            )}
            <div className="flex-1">
              <Link to={`/u/${author.username}`} className="text-sm font-bold hover:underline" style={{ color: CN.cream }}>
                {author.firstName} {author.lastName}
              </Link>
              {(author.rvType || author.rvMake) && (
                <p className="text-xs flex items-center gap-1" style={{ color: CN.muted }}>
                  <Truck className="w-3 h-3" />
                  {author.rvYear ? `${author.rvYear} ` : ''}{author.rvMake || ''} {author.rvModel || ''} · {author.rvType?.replace('_', ' ')}
                </p>
              )}
            </div>
            <button
              onClick={() => requireAuth('follow_user', { targetName: `${author.firstName}` }, () => {})}
              className="px-3 py-1.5 rounded-lg text-xs font-bold transition hover:brightness-110"
              style={{ background: CN.gold, color: CN.bg }}
            >
              Follow
            </button>
          </div>

          {/* Description */}
          {trip.description && (
            <p className="text-sm leading-relaxed mb-8" style={{ color: CN.muted }}>
              {trip.description}
            </p>
          )}

          {/* Campground card (public) */}
          {campground && (
            <div className="rounded-xl overflow-hidden mb-8" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
              {campground.imageUrl && (
                <img src={campground.imageUrl} alt={campground.name} className="w-full h-40 object-cover" />
              )}
              <div className="p-4">
                <h3 className="text-sm font-bold mb-1" style={{ color: CN.cream }}>{campground.name}</h3>
                <p className="text-xs" style={{ color: CN.muted }}>{campground.location || campground.state}</p>
              </div>
            </div>
          )}

          {/* Gated: Full itinerary */}
          <GateBlur trigger="view_full_trip" context={{ destination: campground?.name || trip.title }} label="Sign up to see the full itinerary">
            <div className="space-y-4 mb-8">
              {['Day 1: Departure & first stop', 'Day 2: Scenic route through mountains', 'Day 3: Arrival at campground'].map((d, i) => (
                <div key={i} className="p-4 rounded-xl" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
                  <p className="text-sm font-semibold" style={{ color: CN.cream }}>{d}</p>
                  <p className="text-xs mt-1" style={{ color: CN.muted }}>Route details, stops, and timing information...</p>
                </div>
              ))}
            </div>
          </GateBlur>

          {/* Gated: Save trip action */}
          <div className="flex gap-3 mb-8">
            <button
              onClick={() => requireAuth('save_trip', { destination: campground?.name || trip.title }, () => {})}
              className="flex-1 py-3 rounded-xl text-sm font-bold transition hover:brightness-110"
              style={{ background: CN.gold, color: CN.bg }}
            >
              Save This Trip
            </button>
            <button
              onClick={() => requireAuth('view_full_trip', { destination: campground?.name || trip.title }, () => {})}
              className="flex-1 py-3 rounded-xl text-sm font-semibold transition hover:brightness-110"
              style={{ border: `1px solid ${CN.gold}`, color: CN.gold }}
            >
              Plan a Similar Trip
            </button>
          </div>

          {/* Footer CTA */}
          <div className="text-center p-6 rounded-2xl" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
            <p className="text-lg font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: CN.cream }}>
              Plan your own RV adventure
            </p>
            <p className="text-sm mb-4" style={{ color: CN.muted }}>
              Hitch can help you find campgrounds, plan routes, and pack smart.
            </p>
            <Link to="/register" className="inline-block px-6 py-3 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: CN.gold, color: CN.bg }}>
              Join RVUnicorn — It's Free
            </Link>
          </div>
        </div>
      </div>

      <GateModal {...gateModalProps} />
    </>
  );
}
