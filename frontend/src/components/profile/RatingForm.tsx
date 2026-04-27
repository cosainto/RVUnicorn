import { useState } from 'react';
import { Star, ChevronDown } from 'lucide-react';
import api from '../../services/api';
import { useToast } from '../ToastProvider';

const CN = { bg: '#0F1C35', card: '#162236', gold: '#E8A838', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', orange: '#D4621A' };

interface Props {
  campgroundId: string;
  campgroundName: string;
  existingRating?: {
    rating: number;
    review?: string | null;
    visitDate?: string | null;
    noise?: string | null;
    levelness?: string | null;
    cellService?: string | null;
    bigRigFriendly?: string | null;
    wouldReturn?: string | null;
  } | null;
  onSaved: () => void;
  onCancel: () => void;
}

function StarPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map(i => (
        <button
          key={i}
          type="button"
          onMouseEnter={() => setHover(i)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(i === value ? i - 0.5 : i)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className="w-8 h-8"
            style={{
              color: i <= display ? CN.gold : CN.border,
              fill: i <= display ? CN.gold : 'none',
            }}
          />
        </button>
      ))}
      {value > 0 && (
        <span className="text-2xl font-bold ml-2" style={{ fontFamily: "'Playfair Display', serif", color: CN.gold }}>
          {value.toFixed(1)}
        </span>
      )}
    </div>
  );
}

function DotPicker({ value, onChange, label, icon }: { value: string | null; onChange: (v: string) => void; label: string; icon: string }) {
  const options = ['1', '2', '3', '4', '5'];
  const current = value ? parseInt(value) : 0;

  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs" style={{ color: CN.muted }}>{icon} {label}</span>
      <div className="flex gap-1">
        {options.map((o, i) => (
          <button
            key={o}
            type="button"
            onClick={() => onChange(o)}
            className="w-3 h-3 rounded-full transition"
            style={{ background: i < current ? CN.gold : CN.border }}
          />
        ))}
      </div>
    </div>
  );
}

export default function RatingForm({ campgroundId, campgroundName, existingRating, onSaved, onCancel }: Props) {
  const { addLocalToast } = useToast();
  const [rating, setRating] = useState(existingRating?.rating || 0);
  const [review, setReview] = useState(existingRating?.review || '');
  const [showDetails, setShowDetails] = useState(false);
  const [noise, setNoise] = useState(existingRating?.noise || null);
  const [levelness, setLevelness] = useState(existingRating?.levelness || null);
  const [cellService, setCellService] = useState(existingRating?.cellService || null);
  const [bigRigFriendly, setBigRigFriendly] = useState(existingRating?.bigRigFriendly || null);
  const [wouldReturn, setWouldReturn] = useState(existingRating?.wouldReturn || null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) {
      setError('Please select a star rating');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.post(`/campground-features/${campgroundId}/reviews`, {
        rating,
        review: review.trim() || undefined,
        noise, levelness, cellService, bigRigFriendly, wouldReturn,
      });
      addLocalToast('Rating saved — thanks for helping the community!', 'success');
      onSaved();
    } catch {
      addLocalToast('Failed to save rating', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-xl p-4 mt-2"
      style={{ background: CN.card, border: `1px solid ${CN.border}`, animation: 'slideDown 300ms ease' }}
    >
      <style>{`@keyframes slideDown { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 600px; } }`}</style>

      <p className="text-xs font-bold mb-3" style={{ color: CN.cream }}>
        Rate {campgroundName}
      </p>

      {/* Overall rating */}
      <StarPicker value={rating} onChange={setRating} />
      {error && <p className="text-xs mt-1" style={{ color: CN.orange }}>{error}</p>}

      {/* Detailed ratings toggle */}
      <button
        type="button"
        onClick={() => setShowDetails(!showDetails)}
        className="flex items-center gap-1 text-xs mt-3 transition"
        style={{ color: CN.gold }}
      >
        <ChevronDown className="w-3 h-3" style={{ transform: showDetails ? 'rotate(180deg)' : '', transition: '200ms' }} />
        {showDetails ? 'Hide' : 'Add'} detailed ratings
      </button>

      {showDetails && (
        <div className="mt-2 space-y-0.5">
          <DotPicker value={noise} onChange={setNoise} label="Noise Level" icon="🔇" />
          <DotPicker value={levelness} onChange={setLevelness} label="Site Levelness" icon="📐" />
          <DotPicker value={cellService} onChange={setCellService} label="Cell Service" icon="📶" />
          <DotPicker value={bigRigFriendly} onChange={setBigRigFriendly} label="Big Rig Friendly" icon="🚛" />
          <DotPicker value={wouldReturn} onChange={setWouldReturn} label="Would Return" icon="🔄" />
        </div>
      )}

      {/* Review text */}
      <div className="mt-3 relative">
        <textarea
          value={review}
          onChange={e => setReview(e.target.value.slice(0, 500))}
          placeholder="How was your stay? (optional)"
          rows={3}
          className="w-full text-sm rounded-lg p-3 resize-none focus:outline-none"
          style={{ background: CN.bg, border: `1px solid ${CN.border}`, color: CN.cream }}
        />
        <span className="absolute bottom-2 right-3 text-[10px]" style={{ color: CN.muted }}>
          {review.length}/500
        </span>
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 mt-3">
        <button onClick={onCancel} className="px-4 py-2 rounded-lg text-xs font-medium transition" style={{ color: CN.muted }}>
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="px-4 py-2 rounded-lg text-xs font-bold transition hover:brightness-110 disabled:opacity-50"
          style={{ background: CN.gold, color: CN.bg }}
        >
          {saving ? 'Saving...' : 'Save Rating'}
        </button>
      </div>
    </div>
  );
}
