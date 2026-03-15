import { useState } from 'react';
import { Star, Wifi, Zap, Volume2, Navigation, RectangleHorizontal, Send } from 'lucide-react';
import api from '../services/api';

interface SmartReviewFormProps {
  campgroundId: string;
  campgroundName: string;
  onSubmitted?: () => void;
}

const RATING_LABELS = ['Terrible', 'Poor', 'OK', 'Good', 'Excellent'];

const ScaleQuestion = ({
  label, icon, value, onChange, options, note
}: { label: string; icon: React.ReactNode; value: string; onChange: (v: string) => void; options: { value: string; label: string; color: string }[]; note?: string }) => (
  <div className="space-y-2">
    <div className="flex items-center gap-2">
      <span className="text-gray-600">{icon}</span>
      <span className="text-sm font-medium text-gray-800">{label}</span>
    </div>
    <div className="flex gap-2 flex-wrap">
      {options.map(o => (
        <button key={o.value} onClick={() => onChange(o.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${value === o.value ? `${o.color} border-current` : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'}`}>
          {o.label}
        </button>
      ))}
    </div>
    {note && <p className="text-xs text-gray-400">{note}</p>}
  </div>
);

export default function SmartReviewForm({ campgroundId, campgroundName, onSubmitted }: SmartReviewFormProps) {
  const [step, setStep] = useState<'structured' | 'text' | 'done">(\'structured");
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [fields, setFields] = useState({
    accessDifficulty: '',
    levelness: '',
    noise: '',
    cellService: '',
    bigRigFriendly: '',
    petFriendly: '',
    bestSiteNumber: '',
    wouldReturn: '',
  });
  const [reviewText, setReviewText] = useState('');
  const [title, setTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key: string) => (v: string) => setFields(f => ({ ...f, [key]: v }));

  const canProceed = rating > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/campgrounds/${campgroundId}/reviews`, {
        rating,
        title,
        review: reviewText,
        // Structured fields
        accessDifficulty: fields.accessDifficulty || null,
        levelness: fields.levelness || null,
        noise: fields.noise || null,
        cellService: fields.cellService || null,
        bigRigFriendly: fields.bigRigFriendly || null,
        petFriendly: fields.petFriendly || null,
        bestSiteNumber: fields.bestSiteNumber || null,
        wouldReturn: fields.wouldReturn || null,
      });
      setStep('done');
      onSubmitted?.();
    } catch (e: any) {
      setError(e?.response?.data?.error || 'Failed to submit review. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'done') {
    return (
      <div className="text-center py-8">
        <div className="text-4xl mb-3">🏕️</div>
        <h3 className="text-lg font-bold text-gray-900 mb-1">Thanks for your Campground Report!</h3>
        <p className="text-sm text-gray-500">Your structured insights help the whole RV community.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Star rating */}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-700 mb-2">Overall rating</p>
        <div className="flex justify-center gap-1 mb-1">
          {[1,2,3,4,5].map(n => (
            <button key={n}
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              className="transition-transform hover:scale-110">
              <Star className={`w-8 h-8 ${n <= (hoverRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
            </button>
          ))}
        </div>
        {(hoverRating || rating) > 0 && (
          <p className="text-xs text-amber-600 font-medium">{RATING_LABELS[(hoverRating || rating) - 1]}</p>
        )}
      </div>

      {step === 'structured' && (
        <>
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>🎯 Campground Report</strong> — Quick structured questions that power AI insights for the whole community. Takes 60 seconds!
          </div>

          <ScaleQuestion label="Access difficulty" icon={<Navigation className="w-4 h-4" />} value={fields.accessDifficulty} onChange={set('accessDifficulty')}
            options={[
              { value: 'EASY', label: 'Easy', color: 'bg-green-100 text-green-700' },
              { value: 'MODERATE', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'CHALLENGING', label: 'Challenging', color: 'bg-red-100 text-red-700' },
            ]}
            note="How difficult was the entrance road / approach?" />

          <ScaleQuestion label="Site levelness" icon={<RectangleHorizontal className="w-4 h-4" />} value={fields.levelness} onChange={set('levelness')}
            options={[
              { value: 'VERY_LEVEL', label: 'Very level', color: 'bg-green-100 text-green-700' },
              { value: 'MOSTLY_LEVEL', label: 'Mostly level', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'UNEVEN', label: 'Uneven', color: 'bg-red-100 text-red-700' },
            ]} />

          <ScaleQuestion label="Noise level" icon={<Volume2 className="w-4 h-4" />} value={fields.noise} onChange={set('noise')}
            options={[
              { value: 'VERY_QUIET', label: 'Very quiet', color: 'bg-green-100 text-green-700' },
              { value: 'MODERATE', label: 'Moderate', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'LOUD', label: 'Loud', color: 'bg-red-100 text-red-700' },
            ]} />

          <ScaleQuestion label="Cell service" icon={<Wifi className="w-4 h-4" />} value={fields.cellService} onChange={set('cellService')}
            options={[
              { value: 'STRONG', label: 'Strong', color: 'bg-green-100 text-green-700' },
              { value: 'OK', label: 'OK', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'WEAK', label: 'Weak', color: 'bg-orange-100 text-orange-700' },
              { value: 'NONE', label: 'No signal', color: 'bg-red-100 text-red-700' },
            ]} />

          <ScaleQuestion label="Big rig friendly?" icon={<Zap className="w-4 h-4" />} value={fields.bigRigFriendly} onChange={set('bigRigFriendly')}
            options={[
              { value: 'YES', label: 'Yes', color: 'bg-green-100 text-green-700' },
              { value: 'SOME_SITES', label: 'Some sites', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'NO', label: 'No', color: 'bg-red-100 text-red-700' },
            ]} />

          <ScaleQuestion label="Would you return?" icon={<Star className="w-4 h-4" />} value={fields.wouldReturn} onChange={set('wouldReturn')}
            options={[
              { value: 'DEFINITELY', label: 'Definitely', color: 'bg-green-100 text-green-700' },
              { value: 'MAYBE', label: 'Maybe', color: 'bg-yellow-100 text-yellow-700' },
              { value: 'NO', label: 'No', color: 'bg-red-100 text-red-700' },
            ]} />

          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Best site number (optional)</label>
            <input value={fields.bestSiteNumber} onChange={e => setFields(f => ({ ...f, bestSiteNumber: e.target.value }))}
              placeholder="e.g. A12, Loop B, site 7..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
          </div>

          <button onClick={() => canProceed && setStep('text')} disabled={!canProceed}
            className="w-full py-3 rounded-xl text-white font-semibold text-sm transition disabled:opacity-40 bg-primary-600 hover:bg-primary-700">
            Continue → Add your written review
          </button>
        </>
      )}

      {step === 'text' && (
        <>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Review title (optional)</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Great for big rigs, gorgeous views"
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">Tell us about your stay</label>
            <textarea value={reviewText} onChange={e => setReviewText(e.target.value)} rows={5}
              placeholder="What should fellow RVers know? Tips, warnings, highlights, hidden gems..."
              className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none" />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setStep('structured')} className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50">← Back</button>
            <button onClick={handleSubmit} disabled={submitting || !canProceed}
              className="flex-1 py-2.5 rounded-xl bg-primary-600 text-white text-sm font-semibold hover:bg-primary-700 disabled:opacity-40 flex items-center justify-center gap-2">
              {submitting ? 'Submitting...' : <><Send className="w-4 h-4" /> Submit Report</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
