import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../services/api';
import { useCampgroundTier } from '../hooks/useCampgroundTier';

const TIERS = [
  {
    id: 'TRAILHEAD', name: 'Trailhead', price: 'Free', annual: 'Free', badge: '\u{1F3D4}',
    features: ['Campground profile', 'Follow system + check-ins', 'Respond to reviews', '10 photos', '3 announcements/month', '1 job posting', 'Community threads'],
  },
  {
    id: 'BASECAMP', name: 'Base Camp', price: '$39', annual: '$390', badge: '\u{1F3D5}', popular: true,
    monthlyPriceId: 'STRIPE_BASECAMP_MONTHLY_PRICE_ID', annualPriceId: 'STRIPE_BASECAMP_ANNUAL_PRICE_ID',
    features: ['Everything in Trailhead', 'Hitch FAQ — custom AI rules', 'Digital Welcome Kit', 'Unlimited announcements', 'Events + RSVP system', 'Unlimited job postings', 'Custom check-in sticker', 'Analytics dashboard', 'Campfire Pulse tools', 'Custom branding', 'Priority search placement'],
  },
  {
    id: 'SUMMIT', name: 'Summit', price: '$99', annual: '$990', badge: '\u{1F451}',
    monthlyPriceId: 'STRIPE_SUMMIT_MONTHLY_PRICE_ID', annualPriceId: 'STRIPE_SUMMIT_ANNUAL_PRICE_ID',
    features: ['Everything in Base Camp', 'Mission Mode — live control room', 'Co-Host Autopilot (3 modes)', 'Hitch Skins — 3 personalities', 'Serendipity Triggers', 'Geo-fence auto check-in', 'Trip Memory galleries', 'Sponsor campaign tools', 'Advanced analytics', 'Unlimited trivia questions', '"Summit Partner" badge', 'Priority support'],
  },
];

export default function CampgroundUpgradePage() {
  const { campgroundId } = useParams<{ campgroundId: string }>();
  const { tier: currentTier } = useCampgroundTier(campgroundId);
  const [annual, setAnnual] = useState(false);
  const [foundingRemaining, setFoundingRemaining] = useState(50);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    api.get('/stripe/founding-count').then(r => setFoundingRemaining(r.data.remaining)).catch(() => {});
  }, []);

  const handleUpgrade = async (tier: any) => {
    const priceId = annual ? tier.annualPriceId : tier.monthlyPriceId;
    if (!priceId) return;
    setLoading(tier.id);
    try {
      const { data } = await api.post('/stripe/create-checkout', { campgroundId, priceId: process.env[priceId] || priceId, tier: tier.id });
      if (data.url) window.location.href = data.url;
    } catch (e: any) { alert(e.response?.data?.error || 'Failed'); }
    finally { setLoading(null); }
  };

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: '#F7F9FC', color: '#1E293B', fontFamily: "'DM Sans',sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <Link to={`/business/${campgroundId}`} className="text-[12px] mb-4 inline-block" style={{ color: '#94A3B8' }}>← Back to Dashboard</Link>
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>Grow Your Campground on RVUnicorn</h1>
          <p className="text-[14px]" style={{ color: '#64748B' }}>Choose the plan that fits your season</p>

          {/* Billing toggle */}
          <div className="flex items-center justify-center gap-3 mt-6">
            <span className="text-[13px]" style={{ color: annual ? 'rgba(245,240,232,0.4)' : '#F5F0E8' }}>Monthly</span>
            <button onClick={() => setAnnual(!annual)} className="relative w-12 h-6 rounded-full transition" style={{ background: annual ? '#0EA5E9' : '#1B2E50' }}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${annual ? 'translate-x-6' : ''}`} />
            </button>
            <span className="text-[13px]" style={{ color: annual ? '#F5F0E8' : 'rgba(245,240,232,0.4)' }}>Annual <span style={{ color: '#10B981' }}>Save 2 months</span></span>
          </div>
        </div>

        {/* Tier Cards */}
        <div className="grid md:grid-cols-3 gap-5 mb-8">
          {TIERS.map(tier => {
            const isCurrent = tier.id === currentTier || (tier.id === 'TRAILHEAD' && (currentTier === 'FREE' || currentTier === 'TRAILHEAD'));
            return (
              <div key={tier.id} className="rounded-2xl p-6 relative" style={{
                background: '#FFFFFF',
                border: tier.popular ? '2px solid #0EA5E9' : '1px solid #E2E8F0',
              }}>
                {tier.popular && <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-[11px] font-bold" style={{ background: '#0EA5E9', color: '#0F1C35' }}>Most Popular</span>}

                <div className="text-2xl mb-2">{tier.badge}</div>
                <h3 className="text-lg font-bold mb-1">{tier.name}</h3>
                <p className="text-2xl font-bold mb-4" style={{ fontFamily: "'Playfair Display',serif", color: '#0EA5E9' }}>
                  {tier.price === 'Free' ? 'Free' : `${annual ? tier.annual : tier.price}${tier.price !== 'Free' ? (annual ? '/yr' : '/mo') : ''}`}
                </p>

                <ul className="space-y-2 mb-6">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[12px]">
                      <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                      <span style={{ color: 'rgba(245,240,232,0.7)' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-xl text-[13px] font-semibold" style={{ background: 'rgba(255,255,255,0.06)', color: '#94A3B8' }}>Current Plan</button>
                ) : tier.id === 'TRAILHEAD' ? null : (
                  <button onClick={() => handleUpgrade(tier)} disabled={loading === tier.id}
                    className="w-full py-3 rounded-xl text-[13px] font-bold transition hover:brightness-110 disabled:opacity-50"
                    style={{ background: tier.popular ? '#E8622A' : '#0EA5E9', color: tier.popular ? 'white' : '#0F1C35' }}>
                    {loading === tier.id ? 'Loading...' : tier.id === 'BASECAMP' ? 'Start 30-Day Free Trial' : 'Upgrade to Summit'}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Founding 50 */}
        {foundingRemaining > 0 && (
          <div className="rounded-2xl p-6 text-center" style={{ background: 'rgba(232,98,42,0.08)', border: '1px solid rgba(232,98,42,0.2)' }}>
            <p className="text-lg font-bold mb-1" style={{ color: '#0EA5E9' }}>{'\u{1F984}'} Founding Partner — {foundingRemaining} of 50 spots remaining</p>
            <p className="text-[13px] mb-4" style={{ color: '#64748B' }}>Lock in Summit access at $49/month forever. Never pay more, no matter how we grow.</p>
            <button onClick={() => handleUpgrade({ id: 'FOUNDING', monthlyPriceId: 'STRIPE_FOUNDING_PRICE_ID', annualPriceId: 'STRIPE_FOUNDING_PRICE_ID' })}
              className="px-8 py-3 rounded-xl text-[14px] font-bold" style={{ background: '#E8622A', color: 'white' }}>
              Claim Founding Spot
            </button>
          </div>
        )}

        {/* Seasonal Pause */}
        <div className="rounded-xl p-5 mt-6" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <p className="text-[14px] font-bold mb-1">{'\u2744'} Closing for winter?</p>
          <p className="text-[12px]" style={{ color: 'rgba(245,240,232,0.4)' }}>Pause your plan for $5/month and keep all your data, photos, and Hitch configuration safe until spring.</p>
        </div>
      </div>
    </div>
  );
}
