import { useState, useEffect } from 'react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { DollarSign, Users, X } from 'lucide-react';

/**
 * Single self-contained widget for crowdsourced campground pricing.
 *
 *   - Always shows the headline price (whether OFFICIAL/COMMUNITY/SCRAPED)
 *     with a "from N campers" attribution when community-sourced
 *   - When the viewer recently stayed at this campground and hasn't
 *     reported a price in the last 30 days, shows a friendly banner
 *     prompting them to share what they paid
 *   - Banner opens an inline modal with a single number input + optional
 *     site type / hookups / season chips
 *
 * Drops into the campground detail page above the tabs. Doesn't break
 * any of the 9+ theme variants because it's a standalone block, not
 * baked into the hero.
 */

interface PriceStats {
  count: number;
  median: number | null;
  min: number | null;
  max: number | null;
  latestReportedAt: string | null;
}

interface Props {
  campgroundId: string;
  campgroundName: string;
  pricePerNight: number | null;
  pricePerNightSource?: 'OFFICIAL' | 'COMMUNITY' | 'SCRAPED' | null;
}

const SITE_TYPES = [
  { v: 'TENT', l: 'Tent' },
  { v: 'RV_NO_HOOKUPS', l: 'RV (no hookups)' },
  { v: 'RV_PARTIAL', l: 'RV (partial)' },
  { v: 'RV_FULL', l: 'RV (full hookups)' },
  { v: 'CABIN', l: 'Cabin' },
  { v: 'OTHER', l: 'Other' },
];

const SEASONS = [
  { v: 'PEAK', l: 'Peak' },
  { v: 'OFF_PEAK', l: 'Off-peak' },
  { v: 'WINTER', l: 'Winter' },
  { v: 'SPRING', l: 'Spring' },
  { v: 'SUMMER', l: 'Summer' },
  { v: 'FALL', l: 'Fall' },
];

export default function CampgroundPriceWidget({ campgroundId, campgroundName, pricePerNight, pricePerNightSource }: Props) {
  const { user } = useAuth();
  const [stats, setStats] = useState<PriceStats | null>(null);
  const [eligible, setEligible] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [pricePaid, setPricePaid] = useState('');
  const [siteType, setSiteType] = useState<string | null>(null);
  const [season, setSeason] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    api.get(`/campgrounds/${campgroundId}/price-stats`).then(r => setStats(r.data)).catch(() => {});
    if (user) {
      api.get(`/campgrounds/${campgroundId}/price-prompt-eligible`).then(r => setEligible(!!r.data?.eligible)).catch(() => {});
    }
  }, [campgroundId, user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const num = parseFloat(pricePaid);
    if (!Number.isFinite(num) || num <= 0 || num > 1000) {
      setError('Enter a number between $1 and $1,000');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/campgrounds/${campgroundId}/price-report`, {
        pricePaid: num,
        siteType: siteType || undefined,
        season: season || undefined,
        notes: notes.trim() || undefined,
      });
      setSubmitted(true);
      // Refetch the stats so the badge reflects the new report
      const r = await api.get(`/campgrounds/${campgroundId}/price-stats`).catch(() => null);
      if (r) setStats(r.data);
      // Hide the prompt now that the user has reported
      setEligible(false);
      setTimeout(() => { setShowModal(false); setSubmitted(false); }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit. Try again?');
    } finally {
      setSubmitting(false);
    }
  };

  // Pick what to display in the headline. Source precedence: COMMUNITY (with
  // 3+ reports) > OFFICIAL > SCRAPED > COMMUNITY (1-2 reports) > server price.
  const displayPrice = pricePerNight;
  const sourceLabel: string | null = (() => {
    if (!displayPrice) return null;
    if (pricePerNightSource === 'OFFICIAL') return 'Official rate';
    if (pricePerNightSource === 'COMMUNITY') {
      return stats && stats.count > 0 ? `Community avg from ${stats.count} camper${stats.count === 1 ? '' : 's'}` : 'Community avg';
    }
    if (pricePerNightSource === 'SCRAPED') return 'Listed rate';
    return null;
  })();

  // If we have nothing to show AND no prompt is needed, don't render at all
  if (!displayPrice && !eligible && (!stats || stats.count === 0)) {
    return null;
  }

  return (
    <>
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4 mb-3">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
            <DollarSign className="w-5 h-5 text-amber-700" />
          </div>
          <div className="flex-1 min-w-0">
            {displayPrice ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-amber-900">${Math.round(displayPrice)}</span>
                  <span className="text-sm text-amber-700">/ night</span>
                </div>
                {sourceLabel && (
                  <p className="text-xs text-amber-600/80 mt-0.5 flex items-center gap-1">
                    <Users className="w-3 h-3" /> {sourceLabel}
                  </p>
                )}
                {stats && stats.count >= 3 && stats.min !== null && stats.max !== null && stats.min !== stats.max && (
                  <p className="text-xs text-amber-600/70 mt-0.5">
                    Range: ${Math.round(stats.min)} – ${Math.round(stats.max)}
                  </p>
                )}
              </>
            ) : stats && stats.count > 0 && stats.median !== null ? (
              <>
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-bold text-amber-900">${Math.round(stats.median)}</span>
                  <span className="text-sm text-amber-700">/ night</span>
                </div>
                <p className="text-xs text-amber-600/80 mt-0.5 flex items-center gap-1">
                  <Users className="w-3 h-3" /> Community avg from {stats.count} camper{stats.count === 1 ? '' : 's'}
                </p>
              </>
            ) : (
              <>
                <p className="text-sm font-semibold text-amber-900">Pricing not available yet</p>
                <p className="text-xs text-amber-700/80">Be the first to share what you paid here.</p>
              </>
            )}
          </div>
        </div>

        {eligible && (
          <button
            onClick={() => setShowModal(true)}
            className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition"
          >
            <DollarSign className="w-4 h-4" />
            What did you pay here?
          </button>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">Share what you paid</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{campgroundName}</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            {submitted ? (
              <div className="p-8 text-center">
                <div className="text-3xl mb-2">🎉</div>
                <p className="font-semibold text-gray-900">Thanks!</p>
                <p className="text-sm text-gray-600 mt-1">Your report helps the next camper plan their trip.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Per-night price *</label>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold">$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      max="1000"
                      value={pricePaid}
                      onChange={(e) => setPricePaid(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 border border-gray-300 rounded-lg text-lg font-semibold focus:outline-none focus:border-primary-500"
                      placeholder="45"
                      autoFocus
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Site type (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SITE_TYPES.map((s) => (
                      <button
                        key={s.v}
                        type="button"
                        onClick={() => setSiteType(siteType === s.v ? null : s.v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${siteType === s.v ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        {s.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">Season (optional)</label>
                  <div className="flex flex-wrap gap-1.5">
                    {SEASONS.map((s) => (
                      <button
                        key={s.v}
                        type="button"
                        onClick={() => setSeason(season === s.v ? null : s.v)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition ${season === s.v ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
                      >
                        {s.l}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500"
                    placeholder="Loop B, premium pull-through, etc."
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}

                <p className="text-[11px] text-gray-500 leading-snug">
                  Your report helps other campers plan trips. Only the price and chips above are shown publicly — your name isn't attached to the displayed average.
                </p>

                <button
                  type="submit"
                  disabled={submitting || !pricePaid}
                  className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
                >
                  {submitting ? 'Saving…' : 'Share my price'}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
