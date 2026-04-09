import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import api from '../services/api';
import { useCampgroundTier } from '../hooks/useCampgroundTier';

// Pricing model:
//   Base Camp $19.99/mo  — pause anytime up to 6 months
//   Summit    $39.99/mo  — pause anytime up to 6 months
//   Founding  $100/yr    — locked-in lifetime price, capped at 50 spots
const TIERS = [
  {
    id: 'TRAILHEAD',
    name: 'Trailhead',
    price: 'Free',
    cycle: '',
    badge: '\u{1F3D4}',
    features: ['Campground profile', 'Follow system + check-ins', 'Respond to reviews', '10 photos', '3 announcements/month', '1 job posting', 'Community threads'],
  },
  {
    id: 'BASECAMP',
    name: 'Base Camp',
    price: '$19.99',
    cycle: '/mo',
    badge: '\u{1F3D5}',
    popular: true,
    features: ['Everything in Trailhead', 'Hitch FAQ — custom AI rules', 'Digital Welcome Kit', 'Unlimited announcements', 'Events + RSVP system', 'Unlimited job postings', 'Custom check-in sticker', 'Analytics dashboard', 'Campfire Pulse tools', 'Custom branding', 'Priority search placement'],
  },
  {
    id: 'SUMMIT',
    name: 'Summit',
    price: '$39.99',
    cycle: '/mo',
    badge: '\u{1F451}',
    features: ['Everything in Base Camp', 'Mission Mode — live control room', 'Co-Host Autopilot (3 modes)', 'Hitch Skins — 3 personalities', 'Serendipity Triggers', 'Geo-fence auto check-in', 'Trip Memory galleries', 'Sponsor campaign tools', 'Advanced analytics', 'Unlimited trivia questions', '"Summit Partner" badge', 'Priority support'],
  },
];

export default function CampgroundUpgradePage() {
  const { campgroundId } = useParams<{ campgroundId: string }>();
  const { tier: currentTier } = useCampgroundTier(campgroundId);
  const [foundingRemaining, setFoundingRemaining] = useState(50);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(() => {
    api.get('/stripe/founding-count').then(r => setFoundingRemaining(r.data.remaining)).catch(() => {});
  }, []);

  const handleUpgrade = async (tier: { id: string }) => {
    setLoading(tier.id);
    try {
      // Backend resolves the actual Stripe price ID from `tier` via env vars —
      // never trust price IDs from the client.
      const { data } = await api.post('/stripe/create-checkout', {
        campgroundId,
        tier: tier.id,
      });
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
          <p className="text-[12px] mt-3" style={{ color: '#10B981' }}>Monthly billing · Pause for free, up to 6 months — perfect for seasonal campgrounds</p>
        </div>

        {/* Summit trial banner — every signup gets full Summit access for the first 30 days */}
        <div
          className="rounded-2xl p-5 mb-6 text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(16,185,129,0.12), rgba(14,165,233,0.12))',
            border: '1.5px solid rgba(16,185,129,0.35)',
          }}
        >
          <p className="text-base font-bold mb-1" style={{ color: '#0F766E' }}>
            🎁 Every plan starts with a 30-day FREE Summit trial
          </p>
          <p className="text-[13px]" style={{ color: '#475569' }}>
            No matter which plan you pick below, your first 30 days unlock <span className="font-bold">every Summit feature</span> — Mission Mode, Co-Host Autopilot, advanced analytics, and more. After 30 days you'll switch to your selected plan at its normal rate. <span className="font-semibold">No charge during the trial.</span> Cancel anytime.
          </p>
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
                <p className="text-2xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif", color: '#0EA5E9' }}>
                  {tier.price === 'Free' ? 'Free' : `${tier.price}${tier.cycle}`}
                </p>
                {tier.id !== 'TRAILHEAD' && (
                  <p className="text-[11px] font-semibold mb-3" style={{ color: '#10B981' }}>
                    🎁 First 30 days FREE — full Summit access
                  </p>
                )}
                {tier.id === 'TRAILHEAD' && <div className="mb-3" />}

                <ul className="space-y-2 mb-6">
                  {tier.features.map(f => (
                    <li key={f} className="flex items-start gap-2 text-[12px]">
                      <Check className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                      <span style={{ color: '#475569' }}>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <button disabled className="w-full py-3 rounded-xl text-[13px] font-semibold" style={{ background: '#F1F5F9', color: '#94A3B8' }}>Current Plan</button>
                ) : tier.id === 'TRAILHEAD' ? null : (
                  <button onClick={() => handleUpgrade(tier)} disabled={loading === tier.id}
                    className="w-full py-3 rounded-xl text-[13px] font-bold transition hover:brightness-110 disabled:opacity-50"
                    style={{ background: tier.popular ? '#E8622A' : '#0EA5E9', color: tier.popular ? 'white' : '#0F1C35' }}>
                    {loading === tier.id ? 'Loading...' : 'Start 30-Day Summit Trial'}
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
            <p className="text-[13px] mb-4" style={{ color: '#64748B' }}>Lock in Summit-level access for <span className="font-bold">$100/year, forever</span>. Never pay more, no matter how we grow.</p>
            <button onClick={() => handleUpgrade({ id: 'FOUNDING' })}
              className="px-8 py-3 rounded-xl text-[14px] font-bold" style={{ background: '#E8622A', color: 'white' }}>
              Claim Founding Spot — $100/yr
            </button>
          </div>
        )}

        {/* Seasonal Pause */}
        <div className="rounded-xl p-5 mt-6" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
          <p className="text-[14px] font-bold mb-1" style={{ color: '#1E293B' }}>{'\u2744'} Closing for the season?</p>
          <p className="text-[12px]" style={{ color: '#64748B' }}>Pause your subscription for free, up to 6 months. Your data, photos, Hitch FAQ, and analytics stay safe until you resume in spring. Manage from your business dashboard.</p>
        </div>
      </div>
    </div>
  );
}
