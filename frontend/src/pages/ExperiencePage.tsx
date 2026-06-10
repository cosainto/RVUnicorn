import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Star, MapPin, ThumbsUp, ThumbsDown, MessageSquare, ChevronLeft, ExternalLink, Check, Camera, Clock, Users, PawPrint, Accessibility } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import ReviewModal from '../components/ExperienceReviewModal';

const REC_LABELS: Record<string, { label: string; color: string }> = {
  LOVED_IT: { label: 'Loved It', color: 'bg-green-100 text-green-700' },
  WORTH_VISITING: { label: 'Worth Visiting', color: 'bg-blue-100 text-blue-700' },
  JUST_OKAY: { label: 'Just Okay', color: 'bg-yellow-100 text-yellow-700' },
  WOULD_SKIP: { label: 'Would Skip', color: 'bg-red-100 text-red-700' },
};

const CATEGORY_LABELS: Record<string, string> = {
  TRAIL: 'Trail', RESTAURANT: 'Restaurant', ATTRACTION: 'Attraction', MUSEUM: 'Museum',
  MARKET: 'Market', SCENIC_VIEW: 'Scenic View', FISHING_SPOT: 'Fishing Spot', PLAYGROUND: 'Playground', OTHER: 'Other',
};

function Stars({ rating, size = 'w-4 h-4' }: { rating: number; size?: string }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`${size} ${i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} />
      ))}
    </div>
  );
}

export default function ExperiencePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [experience, setExperience] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [hasVisited, setHasVisited] = useState(false);
  const [visitLoading, setVisitLoading] = useState(false);
  const [showUnvisitConfirm, setShowUnvisitConfirm] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [question, setQuestion] = useState('');
  const [answerInputs, setAnswerInputs] = useState<Record<string, string>>({});
  const [photoIdx, setPhotoIdx] = useState(0);

  useEffect(() => { load(); }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/experiences/${id}`);
      setExperience(data);
      if (user && Array.isArray(data.visits)) {
        setHasVisited(data.visits.some((v: any) => v.userId === user.id));
      }
    } catch {}
    setLoading(false);
  };

  const toggleVisit = async () => {
    if (visitLoading) return;
    if (hasVisited) {
      setShowUnvisitConfirm(true);
      return;
    }
    setVisitLoading(true);
    try {
      const { data } = await api.post(`/experiences/${id}/visit`);
      setHasVisited(data.visited !== false);
      load();
    } catch {}
    setVisitLoading(false);
  };

  const confirmUnvisit = async () => {
    setShowUnvisitConfirm(false);
    setVisitLoading(true);
    try {
      await api.post(`/experiences/${id}/visit`);
      setHasVisited(false);
      load();
    } catch {}
    setVisitLoading(false);
  };

  const voteReview = async (reviewId: string, vote: string) => {
    try {
      await api.post(`/experiences/${id}/reviews/${reviewId}/vote`, { vote });
      load();
    } catch {}
  };

  const submitQuestion = async () => {
    if (!question.trim()) return;
    try {
      await api.post(`/experiences/${id}/questions`, { question });
      setQuestion('');
      load();
    } catch {}
  };

  const submitAnswer = async (questionId: string) => {
    const answer = answerInputs[questionId];
    if (!answer?.trim()) return;
    try {
      await api.post(`/experiences/${id}/questions/${questionId}/answers`, { answer });
      setAnswerInputs(prev => ({ ...prev, [questionId]: '' }));
      load();
    } catch {}
  };

  const upvoteAnswer = async (questionId: string, answerId: string) => {
    try {
      await api.post(`/experiences/${id}/questions/${questionId}/answers/${answerId}/helpful`);
      load();
    } catch {}
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-3 border-primary-500 border-t-transparent rounded-full animate-spin" /></div>;
  if (!experience) return <div className="p-6 text-center text-gray-500">Experience not found</div>;

  const photos = experience.photoUrls?.length > 0 ? experience.photoUrls : [];
  const totalReviews = experience._count?.reviews || experience.reviews?.length || 0;
  const recs = experience.recommendations || {};
  const totalRecs = Object.values(recs).reduce((s: number, v: any) => s + v, 0) as number;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Back nav */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3">
        <Link to={-1 as any} className="p-1 hover:bg-gray-100 rounded-lg"><ChevronLeft className="w-5 h-5" /></Link>
        <h1 className="font-bold text-gray-900 truncate">{experience.name}</h1>
      </div>

      {/* Hero photos */}
      {photos.length > 0 && (
        <div className="relative aspect-[16/9] bg-gray-200 overflow-hidden">
          <img src={photos[photoIdx]} alt="" className="w-full h-full object-cover" />
          {photos.length > 1 && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {photos.map((_: any, i: number) => (
                <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full transition ${i === photoIdx ? 'bg-white' : 'bg-white/50'}`} />
              ))}
            </div>
          )}
        </div>
      )}

      <div className="max-w-2xl mx-auto px-4">
        {/* Header info */}
        <div className="py-4 border-b border-gray-100">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{CATEGORY_LABELS[experience.category] || experience.category}</span>
            {experience.isVerified && <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">Verified</span>}
          </div>
          <h2 className="text-xl font-bold text-gray-900 mt-1">{experience.name}</h2>
          {experience.address && <p className="text-sm text-gray-500 flex items-center gap-1 mt-1"><MapPin className="w-3.5 h-3.5" />{experience.address}</p>}

          {/* Rating display */}
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5">
              <span className="text-2xl font-bold text-gray-900">{experience.avgRating || '—'}</span>
              <Stars rating={experience.avgRating || 0} />
            </div>
            <span className="text-sm text-gray-500">{totalReviews} review{totalReviews !== 1 ? 's' : ''}</span>
            <span className="text-sm text-gray-400">|</span>
            <span className="text-sm text-gray-500">{experience._count?.visits || 0} visited</span>
          </div>

          {/* Recommendation breakdown */}
          {totalRecs > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {Object.entries(REC_LABELS).map(([key, { label, color }]) => {
                const count = recs[key] || 0;
                const pct = Math.round(count / totalRecs * 100);
                if (pct === 0) return null;
                return <span key={key} className={`text-xs font-medium px-2 py-1 rounded-full ${color}`}>{pct}% {label}</span>;
              })}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2 mt-4 flex-wrap items-start">
            <div className="relative">
              <button onClick={toggleVisit} disabled={visitLoading}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition disabled:opacity-50 ${
                  hasVisited
                    ? 'bg-green-600 text-white hover:bg-green-700'
                    : 'bg-primary-600 text-white hover:bg-primary-700'
                }`}>
                <Check className="w-4 h-4" />{visitLoading ? '...' : hasVisited ? 'Visited' : 'Mark as Visited'}
              </button>
              {showUnvisitConfirm && (
                <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg p-3 z-10 w-56">
                  <p className="text-xs text-gray-600 mb-2">Remove visited status?</p>
                  <div className="flex gap-2">
                    <button onClick={confirmUnvisit} className="flex-1 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg">Remove</button>
                    <button onClick={() => setShowUnvisitConfirm(false)} className="flex-1 py-1.5 border border-gray-200 text-gray-600 text-xs font-semibold rounded-lg">Cancel</button>
                  </div>
                </div>
              )}
            </div>
            {hasVisited && (
              <button onClick={() => setShowReviewModal(true)} className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition">
                <Star className="w-4 h-4" />Write a Review
              </button>
            )}
            {experience.website && (
              <a href={experience.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-600 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
                <ExternalLink className="w-4 h-4" />Website
              </a>
            )}
          </div>
        </div>

        {/* Description */}
        {experience.description && (
          <div className="py-4 border-b border-gray-100">
            <p className="text-sm text-gray-700 leading-relaxed">{experience.description}</p>
          </div>
        )}

        {/* Community Tips */}
        {experience.tips?.length > 0 && (
          <div className="py-4 border-b border-gray-100">
            <h3 className="font-bold text-gray-900 mb-3">Community Tips</h3>
            <div className="space-y-2">
              {experience.tips.map((t: any, i: number) => (
                <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                  <p className="text-sm text-gray-700 italic">"{t.tip}"</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                    <span>{t.user.firstName}</span>
                    {t.bestTimeToVisit && <span>| Best time: {t.bestTimeToVisit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Reviews ({totalReviews})</h3>
          {experience.reviews?.length === 0 ? (
            <p className="text-sm text-gray-400">No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {experience.reviews?.map((r: any) => (
                <div key={r.id} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    {r.user.profilePicture ? (
                      <img src={r.user.profilePicture} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500">{r.user.firstName?.[0]}</div>
                    )}
                    <div>
                      <Link to={`/profile/${r.user.username || r.user.id}`} className="text-sm font-semibold text-gray-900 hover:underline">{r.user.firstName} {r.user.lastName}</Link>
                      <div className="flex items-center gap-2">
                        <Stars rating={r.starRating} size="w-3 h-3" />
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${REC_LABELS[r.recommendation]?.color || ''}`}>
                          {REC_LABELS[r.recommendation]?.label}
                        </span>
                      </div>
                    </div>
                  </div>
                  {r.body && <p className="text-sm text-gray-700 mb-2">{r.body}</p>}
                  {r.photoUrls?.length > 0 && (
                    <div className="flex gap-2 mb-2 overflow-x-auto">
                      {r.photoUrls.map((url: string, i: number) => (
                        <img key={i} src={url} alt="" className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500 mb-2">
                    {r.bestTimeToVisit && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{r.bestTimeToVisit}</span>}
                    {r.familyFriendlyRating && <span className="flex items-center gap-1"><Users className="w-3 h-3" />Family: {r.familyFriendlyRating}/5</span>}
                    {r.petFriendlyRating && <span className="flex items-center gap-1"><PawPrint className="w-3 h-3" />Pets: {r.petFriendlyRating}/5</span>}
                    {r.accessibilityNotes && <span className="flex items-center gap-1"><Accessibility className="w-3 h-3" />{r.accessibilityNotes}</span>}
                  </div>
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-50">
                    <button onClick={() => voteReview(r.id, 'HELPFUL')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition">
                      <ThumbsUp className="w-3.5 h-3.5" />Helpful ({r.helpfulCount})
                    </button>
                    <button onClick={() => voteReview(r.id, 'NOT_HELPFUL')} className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-500 transition">
                      <ThumbsDown className="w-3.5 h-3.5" />({r.notHelpfulCount})
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Questions & Answers */}
        <div className="py-4 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 mb-3">Questions & Answers</h3>
          {user && (
            <div className="flex gap-2 mb-4">
              <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="Ask a question about this place..."
                className="flex-1 text-sm border border-gray-200 rounded-xl px-4 py-2" />
              <button onClick={submitQuestion} disabled={!question.trim()} className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl disabled:opacity-50">Ask</button>
            </div>
          )}
          {experience.questions?.length === 0 ? (
            <p className="text-sm text-gray-400">No questions yet.</p>
          ) : (
            <div className="space-y-4">
              {experience.questions?.map((q: any) => (
                <div key={q.id} className="bg-white border border-gray-100 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-primary-500" />
                    <span className="text-sm font-semibold text-gray-900">{q.user.firstName}</span>
                  </div>
                  <p className="text-sm text-gray-800 mb-2">{q.question}</p>
                  {q.answers?.length > 0 && (
                    <div className="ml-4 space-y-2 border-l-2 border-gray-100 pl-3">
                      {q.answers.map((a: any) => (
                        <div key={a.id}>
                          <p className="text-sm text-gray-700">{a.answer}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-gray-400">— {a.user.firstName}</span>
                            <button onClick={() => upvoteAnswer(q.id, a.id)} className="text-xs text-gray-400 hover:text-primary-600">
                              <ThumbsUp className="w-3 h-3 inline" /> {a.helpfulCount}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {user && (
                    <div className="flex gap-2 mt-2 ml-4">
                      <input value={answerInputs[q.id] || ''} onChange={e => setAnswerInputs(prev => ({ ...prev, [q.id]: e.target.value }))}
                        placeholder="Answer..." className="flex-1 text-xs border border-gray-200 rounded-lg px-3 py-1.5" />
                      <button onClick={() => submitAnswer(q.id)} className="text-xs text-primary-600 font-semibold">Reply</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Related nearby */}
        {experience.related?.length > 0 && (
          <div className="py-4">
            <h3 className="font-bold text-gray-900 mb-3">Related Nearby</h3>
            <div className="grid grid-cols-2 gap-3">
              {experience.related.map((r: any) => (
                <Link key={r.id} to={`/experiences/${r.id}`} className="bg-white border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition">
                  {r.photoUrls?.[0] && <img src={r.photoUrls[0]} alt="" className="w-full aspect-[3/2] object-cover" />}
                  <div className="p-2.5">
                    <h4 className="text-sm font-semibold text-gray-900 truncate">{r.name}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Stars rating={r.avgRating} size="w-3 h-3" />
                      <span className="text-xs text-gray-500">({r.reviewCount})</span>
                      {r.distance && <span className="text-xs text-gray-400 ml-1">{r.distance.toFixed(1)} mi</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal experienceId={id!} experienceName={experience.name} onClose={() => setShowReviewModal(false)} onSubmit={() => { setShowReviewModal(false); load(); }} />
      )}
    </div>
  );
}
