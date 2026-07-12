import { useState } from 'react';
import { Star, X, Camera, Loader2 } from 'lucide-react';
import api from '../services/api';
import { uploadAndGetUrl } from '../utils/uploadMedia';

interface Props {
  experienceId: string;
  experienceName: string;
  onClose: () => void;
  onSubmit: () => void;
}

const RECS = [
  { value: 'LOVED_IT', label: 'Loved It', emoji: '🤩' },
  { value: 'WORTH_VISITING', label: 'Worth Visiting', emoji: '👍' },
  { value: 'JUST_OKAY', label: 'Just Okay', emoji: '😐' },
  { value: 'WOULD_SKIP', label: 'Would Skip', emoji: '👎' },
];

export default function ReviewModal({ experienceId, experienceName, onClose, onSubmit }: Props) {
  const [starRating, setStarRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [recommendation, setRecommendation] = useState('');
  const [body, setBody] = useState('');
  const [bestTimeToVisit, setBestTimeToVisit] = useState('');
  const [familyFriendlyRating, setFamilyFriendlyRating] = useState(0);
  const [petFriendlyRating, setPetFriendlyRating] = useState(0);
  const [accessibilityNotes, setAccessibilityNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showOptional, setShowOptional] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || photoUrls.length >= 4) return;
    setUploading(true);
    for (let i = 0; i < Math.min(files.length, 4 - photoUrls.length); i++) {
      try {
        const url = await uploadAndGetUrl(files[i], 'rvunicorn/reviews');
        setPhotoUrls(prev => [...prev, url]);
      } catch {}
    }
    setUploading(false);
  };

  const handleSubmit = async () => {
    if (!starRating || !recommendation) return;
    setSubmitting(true);
    try {
      await api.post(`/experiences/${experienceId}/reviews`, {
        starRating, recommendation, body: body || null, photoUrls,
        bestTimeToVisit: bestTimeToVisit || null,
        familyFriendlyRating: familyFriendlyRating || null,
        petFriendlyRating: petFriendlyRating || null,
        accessibilityNotes: accessibilityNotes || null,
      });
      onSubmit();
    } catch (err: any) {
      alert(err?.response?.data?.error || 'Failed to submit review');
    }
    setSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-3 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="font-bold text-gray-900">Review {experienceName}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5 text-gray-400" /></button>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* Star rating */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Your Rating</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(i => (
                <button key={i} onMouseEnter={() => setHoverRating(i)} onMouseLeave={() => setHoverRating(0)} onClick={() => setStarRating(i)}>
                  <Star className={`w-8 h-8 transition ${i <= (hoverRating || starRating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
                </button>
              ))}
            </div>
          </div>

          {/* Recommendation */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-2">Quick Take</label>
            <div className="grid grid-cols-2 gap-2">
              {RECS.map(r => (
                <button key={r.value} onClick={() => setRecommendation(r.value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition border ${
                    recommendation === r.value ? 'border-primary-500 bg-primary-50 text-primary-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'
                  }`}>
                  <span>{r.emoji}</span>{r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tips text */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Any tips for fellow campers? (optional)</label>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={3} placeholder="Great views from the top, bring water..."
              className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none" />
          </div>

          {/* Photos */}
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Photos (optional, max 4)</label>
            <div className="flex gap-2 flex-wrap">
              {photoUrls.map((url, i) => (
                <div key={i} className="relative w-16 h-16">
                  <img src={url} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button onClick={() => setPhotoUrls(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">x</button>
                </div>
              ))}
              {photoUrls.length < 4 && (
                <label className="w-16 h-16 border-2 border-dashed border-gray-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-gray-300 transition">
                  {uploading ? <Loader2 className="w-5 h-5 text-gray-400 animate-spin" /> : <Camera className="w-5 h-5 text-gray-400" />}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>

          {/* Optional fields toggle */}
          <button onClick={() => setShowOptional(!showOptional)} className="text-xs text-primary-600 font-medium">
            {showOptional ? 'Hide' : 'Show'} optional details
          </button>

          {showOptional && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Best Time to Visit</label>
                <input value={bestTimeToVisit} onChange={e => setBestTimeToVisit(e.target.value)} placeholder="e.g. Morning, Sunset, Spring..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Family Friendly (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} onClick={() => setFamilyFriendlyRating(i)} className={`w-8 h-8 rounded-lg text-sm font-bold ${i <= familyFriendlyRating ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{i}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Pet Friendly (1-5)</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} onClick={() => setPetFriendlyRating(i)} className={`w-8 h-8 rounded-lg text-sm font-bold ${i <= petFriendlyRating ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{i}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-500 block mb-1">Accessibility Notes</label>
                <input value={accessibilityNotes} onChange={e => setAccessibilityNotes(e.target.value)} placeholder="Wheelchair accessible, paved paths..."
                  className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2" />
              </div>
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="sticky bottom-0 bg-white border-t border-gray-100 px-5 py-3">
          <button onClick={handleSubmit} disabled={!starRating || !recommendation || submitting}
            className="w-full py-3 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
            {submitting ? 'Submitting...' : 'Submit Review'}
          </button>
        </div>
      </div>
    </div>
  );
}
