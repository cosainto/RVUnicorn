import { useState } from 'react';
import { Star, X } from 'lucide-react';
import api from '../services/api';

/**
 * Post-trip stay survey modal.
 *
 *   - Opened from the Echo state of the NowBar ("How was it?" button)
 *   - Also opened automatically when TripDetailPage sees ?survey=open
 *     in the URL — that's how Hitch's 24h follow-up notification deep-
 *     links straight into the survey instead of dumping the user on a
 *     page with no context.
 *
 * Posts to POST /api/campgrounds/:campgroundId/reviews. The route was
 * extended in this same change set to accept the rich category fields
 * (noise, levelness, cellService, bigRigFriendly, petFriendly,
 * wouldReturn) so we can hand structured insight back to operators.
 */

interface Props {
  open: boolean;
  onClose: () => void;
  campgroundId: string;
  campgroundName: string;
  visitDate?: string; // ISO; defaults to "now"
}

const NOISE_OPTIONS = [
  { v: 'QUIET', l: 'Quiet' },
  { v: 'MODERATE', l: 'Moderate' },
  { v: 'NOISY', l: 'Noisy' },
];
const LEVELNESS_OPTIONS = [
  { v: 'LEVEL', l: 'Level' },
  { v: 'SLIGHTLY_UNEVEN', l: 'Slightly uneven' },
  { v: 'UNEVEN', l: 'Uneven' },
];
const CELL_OPTIONS = [
  { v: 'GREAT', l: 'Great' },
  { v: 'OK', l: 'OK' },
  { v: 'POOR', l: 'Poor' },
  { v: 'NONE', l: 'None' },
];
const YN_OPTIONS = [
  { v: 'YES', l: 'Yes' },
  { v: 'NO', l: 'No' },
];
const ACCESS_OPTIONS = [
  { v: 'EASY', l: 'Easy' },
  { v: 'MODERATE', l: 'Moderate' },
  { v: 'TIGHT', l: 'Tight' },
];

export default function TripStaySurveyModal({ open, onClose, campgroundId, campgroundName, visitDate }: Props) {
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [noise, setNoise] = useState<string | null>(null);
  const [levelness, setLevelness] = useState<string | null>(null);
  const [cellService, setCellService] = useState<string | null>(null);
  const [bigRigFriendly, setBigRigFriendly] = useState<string | null>(null);
  const [petFriendly, setPetFriendly] = useState<string | null>(null);
  const [wouldReturn, setWouldReturn] = useState<string | null>(null);
  const [accessDifficulty, setAccessDifficulty] = useState<string | null>(null);
  const [bestSiteNumber, setBestSiteNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (rating < 1 || rating > 5) {
      setError('Pick a star rating before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/campgrounds/${campgroundId}/reviews`, {
        rating,
        review: reviewText.trim() || undefined,
        visitDate: visitDate || new Date().toISOString(),
        noise: noise || undefined,
        levelness: levelness || undefined,
        cellService: cellService || undefined,
        bigRigFriendly: bigRigFriendly || undefined,
        petFriendly: petFriendly || undefined,
        wouldReturn: wouldReturn || undefined,
        accessDifficulty: accessDifficulty || undefined,
        bestSiteNumber: bestSiteNumber.trim() || undefined,
      });
      setSubmitted(true);
      setTimeout(() => {
        onClose();
        // Reset for next open
        setSubmitted(false);
        setRating(0);
        setReviewText('');
        setNoise(null);
        setLevelness(null);
        setCellService(null);
        setBigRigFriendly(null);
        setPetFriendly(null);
        setWouldReturn(null);
        setAccessDifficulty(null);
        setBestSiteNumber('');
      }, 1500);
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit. Try again?');
    } finally {
      setSubmitting(false);
    }
  };

  const ChipRow = ({ value, onChange, options, label }: { value: string | null; onChange: (v: string | null) => void; options: { v: string; l: string }[]; label: string }) => (
    <div>
      <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1.5">{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onChange(value === o.v ? null : o.v)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition ${value === o.v ? 'bg-primary-50 border-primary-300 text-primary-700' : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-md w-full overflow-hidden shadow-xl my-8">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-900">How was your stay?</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate">{campgroundName}</p>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg flex-shrink-0">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        {submitted ? (
          <div className="p-8 text-center">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-semibold text-gray-900">Thanks!</p>
            <p className="text-sm text-gray-600 mt-1">Your insight helps other RVers — and we'll share it with the campground.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Star rating */}
            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-2">Overall rating *</label>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    className="p-1"
                    aria-label={`${n} star${n === 1 ? '' : 's'}`}
                  >
                    <Star
                      className="w-8 h-8"
                      fill={(hoverRating || rating) >= n ? '#f59e0b' : 'none'}
                      stroke={(hoverRating || rating) >= n ? '#f59e0b' : '#d1d5db'}
                    />
                  </button>
                ))}
              </div>
            </div>

            <ChipRow value={noise} onChange={setNoise} options={NOISE_OPTIONS} label="Noise level" />
            <ChipRow value={levelness} onChange={setLevelness} options={LEVELNESS_OPTIONS} label="Site levelness" />
            <ChipRow value={cellService} onChange={setCellService} options={CELL_OPTIONS} label="Cell service" />
            <ChipRow value={accessDifficulty} onChange={setAccessDifficulty} options={ACCESS_OPTIONS} label="Access / road in" />
            <ChipRow value={bigRigFriendly} onChange={setBigRigFriendly} options={YN_OPTIONS} label="Big rig friendly?" />
            <ChipRow value={petFriendly} onChange={setPetFriendly} options={YN_OPTIONS} label="Pet friendly?" />
            <ChipRow value={wouldReturn} onChange={setWouldReturn} options={YN_OPTIONS} label="Would you return?" />

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Best site number (optional)</label>
              <input
                type="text"
                value={bestSiteNumber}
                onChange={(e) => setBestSiteNumber(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500"
                placeholder="e.g. B14, Loop B premium"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide block mb-1">Anything else? (optional)</label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-primary-500 resize-none"
                placeholder="What stood out, good or bad?"
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={submitting || rating < 1}
              className="w-full py-2.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold disabled:opacity-50"
            >
              {submitting ? 'Saving…' : 'Share my review'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
