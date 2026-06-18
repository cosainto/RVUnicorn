import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Clock, Fuel, Eye, Copy, Check } from 'lucide-react';
import { Helmet } from 'react-helmet-async';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface RouteData {
  id: string;
  name: string;
  description: string | null;
  originAddress: string;
  destinationAddress: string;
  distanceMiles: number;
  driveTime: string;
  estimatedFuelCost: number | null;
  campground: { id: string; name: string; state: string; imageUrl: string | null } | null;
  owner: { username: string; firstName: string; lastName: string; profilePicture: string | null };
  viewCount: number;
  createdAt: string;
}

export default function PublicRoutePage() {
  const { token } = useParams();
  const [route, setRoute] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/saved-trips/public/${token}`)
      .then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then(setRoute)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  const shareUrl = `https://www.rvunicorn.com/route/${token}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }).catch(() => {});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: CN.bg }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: CN.gold, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (error || !route) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4" style={{ background: CN.bg }}>
        <p className="text-lg font-bold mb-2" style={{ color: CN.cream }}>Route not found</p>
        <p className="text-sm mb-4" style={{ color: CN.muted }}>This link may have expired or the trip was made private.</p>
        <Link to="/register" className="px-5 py-2.5 rounded-xl text-sm font-bold" style={{ background: CN.gold, color: CN.bg }}>Join RVUnicorn →</Link>
      </div>
    );
  }

  const desc = `${route.originAddress} → ${route.destinationAddress} · ${route.distanceMiles} mi · ${route.driveTime}${route.estimatedFuelCost ? ` · $${route.estimatedFuelCost.toFixed(0)} fuel` : ''}`;

  return (
    <div className="min-h-screen" style={{ background: CN.bg }}>
      <Helmet>
        <title>{route.name} — {route.owner.firstName}'s Route · RVUnicorn</title>
        <meta name="description" content={desc} />
        <meta property="og:title" content={`${route.name} — ${route.owner.firstName}'s Route`} />
        <meta property="og:description" content={desc} />
        <meta property="og:url" content={shareUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:site_name" content="RVUnicorn" />
      </Helmet>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Route card */}
        <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
          {/* Campground hero image */}
          {route.campground?.imageUrl && (
            <img src={route.campground.imageUrl} alt={route.campground.name} className="w-full h-48 object-cover" />
          )}

          <div className="p-5">
            {/* Owner */}
            <div className="flex items-center gap-3 mb-4">
              {route.owner.profilePicture ? (
                <img src={route.owner.profilePicture} alt="" className="w-10 h-10 rounded-full object-cover" />
              ) : (
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: CN.cardAlt, color: CN.gold }}>{route.owner.firstName[0]}</div>
              )}
              <div>
                <p className="text-sm font-semibold" style={{ color: CN.cream }}>{route.owner.firstName} {route.owner.lastName}</p>
                <p className="text-xs" style={{ color: CN.muted }}>shared a route on RVUnicorn</p>
              </div>
            </div>

            {/* Trip name */}
            <h1 className="text-xl font-bold mb-2" style={{ color: CN.cream }}>{route.name}</h1>
            {route.description && <p className="text-sm mb-3" style={{ color: CN.muted }}>{route.description}</p>}

            {/* FROM → TO */}
            <div className="flex items-center gap-2 mb-4 px-3 py-2.5 rounded-lg" style={{ background: CN.cardAlt }}>
              <MapPin className="w-4 h-4 flex-shrink-0" style={{ color: CN.gold }} />
              <p className="text-sm" style={{ color: CN.cream }}>
                {route.originAddress} <span style={{ color: CN.muted }}>→</span> {route.destinationAddress}
              </p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="text-center px-3 py-2.5 rounded-lg" style={{ background: CN.cardAlt }}>
                <Clock className="w-4 h-4 mx-auto mb-1" style={{ color: CN.gold }} />
                <p className="text-sm font-bold" style={{ color: CN.cream }}>{route.driveTime}</p>
                <p className="text-[10px]" style={{ color: CN.muted }}>Drive time</p>
              </div>
              <div className="text-center px-3 py-2.5 rounded-lg" style={{ background: CN.cardAlt }}>
                <MapPin className="w-4 h-4 mx-auto mb-1" style={{ color: CN.gold }} />
                <p className="text-sm font-bold" style={{ color: CN.cream }}>{route.distanceMiles} mi</p>
                <p className="text-[10px]" style={{ color: CN.muted }}>Distance</p>
              </div>
              {route.estimatedFuelCost && (
                <div className="text-center px-3 py-2.5 rounded-lg" style={{ background: CN.cardAlt }}>
                  <Fuel className="w-4 h-4 mx-auto mb-1" style={{ color: CN.gold }} />
                  <p className="text-sm font-bold" style={{ color: CN.cream }}>${route.estimatedFuelCost.toFixed(0)}</p>
                  <p className="text-[10px]" style={{ color: CN.muted }}>Est. fuel</p>
                </div>
              )}
            </div>

            {/* Campground */}
            {route.campground && (
              <div className="flex items-center gap-3 mb-4 px-3 py-2.5 rounded-lg" style={{ background: CN.cardAlt }}>
                <span className="text-lg">⛺</span>
                <div>
                  <p className="text-sm font-semibold" style={{ color: CN.cream }}>{route.campground.name}</p>
                  <p className="text-xs" style={{ color: CN.muted }}>{route.campground.state}</p>
                </div>
              </div>
            )}

            {/* View count */}
            <div className="flex items-center gap-1 mb-4 text-xs" style={{ color: CN.muted }}>
              <Eye className="w-3 h-3" /> {route.viewCount} views
            </div>

            {/* Copy link */}
            <button onClick={handleCopy} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold mb-3 transition" style={{ background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}` }}>
              {copied ? <><Check className="w-4 h-4" style={{ color: '#22c55e' }} /> Copied!</> : <><Copy className="w-4 h-4" /> Copy link</>}
            </button>

            {/* CTA */}
            <Link to="/register" className="block w-full text-center py-3 rounded-xl text-sm font-bold transition" style={{ background: CN.gold, color: CN.bg }}>
              Plan your own trip on RVUnicorn →
            </Link>
          </div>
        </div>

        {/* Branding */}
        <div className="text-center mt-6">
          <p className="text-xs" style={{ color: CN.muted }}>Shared via <span style={{ color: CN.gold }}>RVUnicorn</span> — the social travel hub for RVers</p>
        </div>
      </div>
    </div>
  );
}
