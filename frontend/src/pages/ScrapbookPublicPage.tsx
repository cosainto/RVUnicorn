import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { format } from 'date-fns';

const MOMENT_TAGS: Record<string, { label: string; icon: string }> = {
  BEST_MOMENT: { label: 'Best Moment', icon: '🔥' },
  FUNNIEST: { label: 'Funniest', icon: '😂' },
  MOST_UNEXPECTED: { label: 'Most Unexpected', icon: '😮' },
  BEST_VIEW: { label: 'Best View', icon: '🌅' },
  CAMPFIRE: { label: 'Around the Campfire', icon: '🔥' },
  BREAKDOWN: { label: 'The Breakdown', icon: '🛠️' },
  WILDLIFE: { label: 'Wildlife', icon: '🦅' },
  FOOD: { label: 'Food', icon: '🍽️' },
  FIRST_DAY: { label: 'First Day', icon: '🌅' },
  LAST_DAY: { label: 'Last Night', icon: '🌙' },
};

export default function ScrapbookPublicPage() {
  const { token } = useParams();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/scrapbook/public/${token}`)
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(d => setData(d))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#0F1C35' }}>
      <div className="text-2xl animate-pulse" style={{ color: '#E8A838' }}>📸</div>
    </div>
  );

  if (error || !data) return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0F1C35' }}>
      <p className="text-lg font-semibold" style={{ color: '#F5F0E8' }}>This scrapbook isn't available</p>
      <Link to="/" className="text-sm font-semibold px-4 py-2 rounded-xl" style={{ background: '#E8A838', color: '#0F1C35' }}>Go to RVUnicorn →</Link>
    </div>
  );

  const firstPhoto = data.pins[0]?.photoUrl;
  const dateRange = data.tripDates?.start && data.tripDates?.end
    ? `${format(new Date(data.tripDates.start), 'MMM d')} – ${format(new Date(data.tripDates.end), 'MMM d, yyyy')}`
    : '';

  return (
    <>
      <Helmet>
        <title>{data.tripTitle} — RVUnicorn Scrapbook</title>
        <meta name="description" content={`${data.ownerName}'s trip to ${data.campgroundName || 'the campground'}${data.campgroundState ? ', ' + data.campgroundState : ''} · ${data.totalPins} memories`} />
        <meta property="og:title" content={`${data.tripTitle} — RVUnicorn Scrapbook`} />
        <meta property="og:description" content={`${data.ownerName}'s trip · ${data.totalPins} memories`} />
        {firstPhoto && <meta property="og:image" content={firstPhoto} />}
        <meta property="og:url" content={`https://www.rvunicorn.com/s/${token}`} />
      </Helmet>

      <div className="min-h-screen" style={{ background: '#0F1C35' }}>
        {/* Hero */}
        <div className="relative overflow-hidden" style={{ minHeight: 320 }}>
          {firstPhoto && (
            <div className="absolute inset-0">
              <img src={firstPhoto} className="w-full h-full object-cover" style={{ filter: 'blur(20px) brightness(0.3)' }} alt="" />
              <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, rgba(15,28,53,0.6), rgba(15,28,53,0.95))' }} />
            </div>
          )}
          <div className="relative z-10 flex flex-col items-center justify-center text-center px-6 py-16">
            <h1 className="text-3xl sm:text-4xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif", color: '#F5F0E8' }}>
              {data.tripTitle}
            </h1>
            {data.campgroundName && (
              <p className="text-sm mb-1" style={{ color: 'rgba(245,240,232,0.7)' }}>
                {data.campgroundName}{data.campgroundState ? `, ${data.campgroundState}` : ''}
              </p>
            )}
            {dateRange && <p className="text-xs mb-4" style={{ color: 'rgba(245,240,232,0.5)' }}>{dateRange}</p>}
            {data.rigMake && (
              <p className="text-xs mb-4" style={{ color: 'rgba(245,240,232,0.4)' }}>
                🚐 {data.rigYear ? `${data.rigYear} ` : ''}{data.rigMake}
              </p>
            )}
            <div className="flex items-center gap-2">
              {data.ownerAvatarUrl ? (
                <img src={data.ownerAvatarUrl} className="w-8 h-8 rounded-full object-cover" style={{ border: '2px solid rgba(232,168,56,0.4)' }} alt="" />
              ) : (
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>
                  {data.ownerName[0]}
                </div>
              )}
              <span className="text-sm" style={{ color: 'rgba(245,240,232,0.7)' }}>A scrapbook by {data.ownerName}</span>
            </div>
          </div>
        </div>

        {/* Pins Grid — masonry */}
        <div className="max-w-4xl mx-auto px-4 py-8">
          <div style={{ columns: window.innerWidth < 640 ? 2 : 3, columnGap: '12px' }}>
            {data.pins.map((pin: any, i: number) => {
              const tag = pin.momentTag ? MOMENT_TAGS[pin.momentTag] : null;
              return (
                <div key={pin.photoId} className="break-inside-avoid mb-3" style={{ animation: `fadeIn 0.4s ease-out ${i * 0.08}s both` }}>
                  <div className="rounded-xl overflow-hidden relative">
                    <img src={pin.photoUrl} alt={pin.caption || ''} className="w-full" loading="lazy" />
                    {tag && (
                      <div className="absolute bottom-2 left-2 rounded-full px-2 py-0.5 text-xs text-white font-semibold backdrop-blur-sm" style={{ background: 'rgba(0,0,0,0.6)' }}>
                        {tag.icon} {tag.label}
                      </div>
                    )}
                  </div>
                  {pin.caption && (
                    <p className="text-xs italic mt-1.5 px-1" style={{ color: 'rgba(245,240,232,0.6)' }}>{pin.caption}</p>
                  )}
                  {pin.pinnedByName && data.totalPins > 1 && (
                    <div className="flex items-center gap-1 mt-1 px-1">
                      {pin.pinnedByAvatar && <img src={pin.pinnedByAvatar} className="w-4 h-4 rounded-full" alt="" />}
                      <span className="text-[10px]" style={{ color: 'rgba(245,240,232,0.3)' }}>{pin.pinnedByName}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer CTA */}
        <div className="text-center py-12 px-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <img src="/images/Logo_RVUnicorn.png" className="w-10 h-10 mx-auto mb-3 opacity-60" alt="RVUnicorn" />
          <p className="text-sm mb-4" style={{ color: 'rgba(245,240,232,0.5)' }}>Create your own RV travel scrapbook</p>
          <Link to="/register" className="inline-block px-6 py-2.5 rounded-xl text-sm font-bold transition hover:brightness-110" style={{ background: '#E8A838', color: '#0F1C35' }}>
            Join RVUnicorn →
          </Link>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </>
  );
}
