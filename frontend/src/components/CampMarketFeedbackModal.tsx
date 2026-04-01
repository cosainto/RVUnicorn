import { useState } from 'react';
import { X, Star } from 'lucide-react';
import api from '../services/api';

interface Props {
  listingId: string;
  listingTitle: string;
  otherPartyName: string;
  otherPartyPicture?: string;
  onClose: () => void;
  onSubmitted: () => void;
}

export default function CampMarketFeedbackModal({ listingId, listingTitle, otherPartyName, otherPartyPicture, onClose, onSubmitted }: Props) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (rating === 0) { setError('Please select a rating'); return; }
    setSubmitting(true);
    setError('');
    try {
      await api.post(`/camp-market/listing/${listingId}/feedback`, {
        rating,
        comment: comment.trim() || null,
      });
      setSubmitted(true);
      onSubmitted();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to submit feedback');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-5 py-4 flex items-center justify-between">
          <h2 className="text-white font-bold">Leave Feedback</h2>
          <button onClick={onClose} className="text-white/70 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5">
          {submitted ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-2">⭐</div>
              <p className="font-semibold text-gray-800">Thanks for your feedback!</p>
              <p className="text-sm text-gray-500 mt-1">This helps build trust in the Camp Market community.</p>
              <button onClick={onClose} className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-xl text-sm font-semibold hover:bg-orange-600 transition">Done</button>
            </div>
          ) : (
            <>
              {/* Who you're reviewing */}
              <div className="flex items-center gap-3 mb-4 pb-4 border-b border-gray-100">
                {otherPartyPicture ? (
                  <img src={otherPartyPicture} className="w-10 h-10 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-orange-200 flex items-center justify-center text-sm font-bold text-orange-700">{otherPartyName[0]}</div>
                )}
                <div>
                  <p className="font-semibold text-gray-800 text-sm">{otherPartyName}</p>
                  <p className="text-xs text-gray-400">for "{listingTitle}"</p>
                </div>
              </div>

              {/* Star rating */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rating</p>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button
                      key={n}
                      onClick={() => setRating(n)}
                      onMouseEnter={() => setHoveredRating(n)}
                      onMouseLeave={() => setHoveredRating(0)}
                      className="p-0.5 transition"
                    >
                      <Star
                        className={`w-8 h-8 transition ${n <= (hoveredRating || rating) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Comment */}
              <div className="mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">How did it go? (optional)</p>
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  placeholder="Quick, friendly, exactly as described..."
                  rows={2}
                  maxLength={200}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-1">{comment.length}/200</p>
              </div>

              {error && <p className="text-xs text-red-500 mb-3">{error}</p>}

              <button
                onClick={handleSubmit}
                disabled={rating === 0 || submitting}
                className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {submitting ? 'Submitting...' : 'Submit Feedback'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
