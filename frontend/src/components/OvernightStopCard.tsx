import { useState, useEffect } from 'react';
import { Star, Shield, Volume2, MapPin, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, XCircle, Clock, Plus } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const STOP_TYPE_CONFIG: Record<string, { emoji: string; color: string; bg: string }> = {
  WALMART:       { emoji: '🛒', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  CRACKER_BARREL:{ emoji: '🪑', color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200' },
  CABELAS:       { emoji: '🎣', color: 'text-green-700',  bg: 'bg-green-50 border-green-200' },
  COSTCO:        { emoji: '🏪', color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200' },
  FLYING_J:      { emoji: '⛽', color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  LOVES:         { emoji: '⛽', color: 'text-red-700',    bg: 'bg-red-50 border-red-200' },
  PILOT:         { emoji: '⛽', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  REST_AREA:     { emoji: '🛑', color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' },
  CASINO:        { emoji: '🎰', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  OTHER:         { emoji: '📍', color: 'text-gray-700',   bg: 'bg-gray-50 border-gray-200' },
};

const CRIME_COLORS: Record<string, string> = {
  LOW:      'text-green-600 bg-green-50',
  MODERATE: 'text-amber-600 bg-amber-50',
  HIGH:     'text-red-600 bg-red-50',
  UNKNOWN:  'text-gray-500 bg-gray-50',
};

const UPDATE_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  STILL_ALLOWS:      { label: '✅ Still allows RVs', color: 'text-green-700' },
  NO_LONGER_ALLOWS:  { label: '❌ No longer allows RVs', color: 'text-red-700' },
  POLICE_PRESENCE:   { label: '🚔 Police presence noted', color: 'text-blue-700' },
  BUSY:              { label: '🚐 Busy/crowded right now', color: 'text-amber-700' },
  QUIET:             { label: '😴 Quiet and peaceful', color: 'text-green-700' },
  OTHER:             { label: '💬 Update', color: 'text-gray-700' },
};

interface Props {
  stop: any;
  onAddToPitStops?: (stop: any, overnightStopId: string) => void;
  compact?: boolean;
}

export default function OvernightStopCard({ stop, onAddToPitStops, compact }: Props) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [travelers, setTravelers] = useState<{ count: number; travelers: any[] } | null>(null);
  const [loadingTravelers, setLoadingTravelers] = useState(false);

  const fetchTravelers = async () => {
    if (travelers !== null) return; // already loaded
    setLoadingTravelers(true);
    try {
      const { data } = await api.get('/overnight-stops/' + stop.id + '/travelers');
      setTravelers(data);
    } catch (err) { console.error(err); }
    finally { setLoadingTravelers(false); }
  };

  useEffect(() => {
    if (expanded) fetchTravelers();
  }, [expanded]);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [reviews, setReviews] = useState<any[]>(stop.reviews || []);
  const [updates, setUpdates] = useState<any[]>(stop.updates || []);
  const [submitting, setSubmitting] = useState(false);

  const [reviewForm, setReviewForm] = useState({ rating: 5, safetyRating: 5, noiseLevel: 'MODERATE', content: '', wouldReturn: true });
  const [updateForm, setUpdateForm] = useState({ content: '', updateType: 'STILL_ALLOWS' });

  const config = STOP_TYPE_CONFIG[stop.stopType] || STOP_TYPE_CONFIG.OTHER;
  const avgRating = stop.avgRating ?? (reviews.length ? reviews.reduce((a: number, r: any) => a + r.rating, 0) / reviews.length : null);
  const avgSafety = stop.avgSafetyRating ?? (reviews.length ? reviews.reduce((a: number, r: any) => a + r.safetyRating, 0) / reviews.length : null);

  const handleSubmitReview = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/overnight-stops/' + stop.id + '/reviews', reviewForm);
      setReviews(prev => [data, ...prev.filter(r => r.userId !== user.id)]);
      setShowReviewForm(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleSubmitUpdate = async () => {
    if (!user || !updateForm.content.trim()) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/overnight-stops/' + stop.id + '/updates', updateForm);
      setUpdates(prev => [data, ...prev]);
      setShowUpdateForm(false);
      setUpdateForm({ content: '', updateType: 'STILL_ALLOWS' });
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const renderStars = (rating: number | null, size = 'w-3 h-3') => {
    if (!rating) return <span className="text-xs text-gray-400">No ratings</span>;
    return (
      <div className="flex items-center gap-0.5">
        {[1,2,3,4,5].map(i => (
          <Star key={i} className={size + ' ' + (i <= Math.round(rating) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200')} />
        ))}
        <span className="text-xs text-gray-500 ml-1">{rating.toFixed(1)}</span>
      </div>
    );
  };

  return (
    <div className={'rounded-xl border overflow-hidden transition-all ' + (expanded ? 'shadow-md ' + config.bg : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm')}>
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start gap-3">
          <div className="text-2xl">{config.emoji}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-bold text-gray-900">{stop.name}</p>
              {stop.stopType !== 'OTHER' && (
                <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-full border ' + config.bg + ' ' + config.color}>
                  {stop.stopType.replace(/_/g, ' ')}
                </span>
              )}
              {stop.allowsRvs ? (
                <span className="text-[10px] text-green-600 font-semibold flex items-center gap-0.5"><CheckCircle className="w-3 h-3" /> RV Friendly</span>
              ) : (
                <span className="text-[10px] text-red-600 font-semibold flex items-center gap-0.5"><XCircle className="w-3 h-3" /> Not Recommended</span>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-0.5">{`${[stop.address, stop.city].filter(Boolean).join(', ')}${stop.state ? `, ${stop.state}` : ''}${stop.zip ? ` ${stop.zip}` : ''}`}</p>
            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
                <span className="text-xs text-gray-600">{avgRating ? avgRating.toFixed(1) : 'No ratings'}</span>
                {reviews.length > 0 && <span className="text-xs text-gray-400">({reviews.length})</span>}
              </div>
              {avgSafety && (
                <div className="flex items-center gap-1">
                  <Shield className="w-3 h-3 text-blue-500" />
                  <span className="text-xs text-gray-600">Safety: {avgSafety.toFixed(1)}/5</span>
                </div>
              )}
              {stop.crimeLevel && stop.crimeLevel !== 'UNKNOWN' && (
                <span className={'text-[10px] font-semibold px-2 py-0.5 rounded-full ' + CRIME_COLORS[stop.crimeLevel]}>
                  {stop.crimeLevel} crime area
                </span>
              )}
              {stop.policeStationMiles && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  🚔 Police {stop.policeStationMiles.toFixed(1)} mi away
                </span>
              )}
              {travelers && travelers.count > 0 && (
                <span className="text-xs text-indigo-600 font-semibold flex items-center gap-1">
                  🚐 {travelers.count} RVer{travelers.count !== 1 ? 's' : ''} stopping here
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onAddToPitStops && (
              <button
                onClick={(e) => { e.stopPropagation(); onAddToPitStops(stop, stop.id); }}
                className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-1"
              >
                <Plus className="w-3 h-3" /> Add Stop
              </button>
            )}
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
          </div>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-gray-100 pt-3">
          {/* Notes & details */}
          {stop.notes && <p className="text-xs text-gray-600 leading-relaxed">{stop.notes}</p>}

          <div className="grid grid-cols-2 gap-2">
            {stop.requiresPermission && (
              <div className="text-xs bg-amber-50 text-amber-700 rounded-lg p-2 flex items-start gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                Ask permission before parking
              </div>
            )}
            {stop.maxNights && (
              <div className="text-xs bg-gray-50 text-gray-600 rounded-lg p-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Max {stop.maxNights} night{stop.maxNights > 1 ? 's' : ''}
              </div>
            )}
            {stop.website && (
              <a href={stop.website} target="_blank" rel="noopener noreferrer" className="text-xs bg-blue-50 text-blue-700 rounded-lg p-2 flex items-center gap-1.5 hover:bg-blue-100">
                <ExternalLink className="w-3.5 h-3.5" /> Website
              </a>
            )}
            <a href={'https://www.google.com/maps/search/?api=1&query=' + stop.latitude + ',' + stop.longitude} target="_blank" rel="noopener noreferrer" className="text-xs bg-green-50 text-green-700 rounded-lg p-2 flex items-center gap-1.5 hover:bg-green-100">
              <MapPin className="w-3.5 h-3.5" /> Directions
            </a>
          </div>

          {/* Recent updates */}
          {updates.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Recent Updates</p>
              <div className="space-y-2">
                {updates.slice(0, 3).map((u: any) => (
                  <div key={u.id} className="text-xs bg-white rounded-lg p-2.5 border border-gray-100">
                    <div className="flex items-center justify-between mb-1">
                      <span className={'font-semibold ' + (UPDATE_TYPE_LABELS[u.updateType]?.color || 'text-gray-700')}>
                        {UPDATE_TYPE_LABELS[u.updateType]?.label || u.updateType}
                      </span>
                      <span className="text-gray-400">{u.user?.firstName} · {new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                    {u.content && <p className="text-gray-600">{u.content}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reviews ({reviews.length})</p>
              <div className="space-y-2">
                {reviews.slice(0, 3).map((r: any) => (
                  <div key={r.id} className="text-xs bg-white rounded-lg p-3 border border-gray-100">
                    <div className="flex items-center gap-2 mb-1">
                      {renderStars(r.rating)}
                      <span className="text-gray-400">·</span>
                      <Shield className="w-3 h-3 text-blue-400" />
                      <span className="text-gray-600">Safety: {r.safetyRating}/5</span>
                      {r.noiseLevel && <span className="text-gray-400">· {r.noiseLevel.toLowerCase()}</span>}
                    </div>
                    {r.content && <p className="text-gray-600 leading-relaxed">{r.content}</p>}
                    <p className="text-gray-400 mt-1">{r.user?.firstName} {r.wouldReturn ? '· Would return ✓' : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Fellow travelers */}
          {loadingTravelers && <p className="text-xs text-gray-400">Loading travelers...</p>}
          {travelers && travelers.count > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
                🚐 {travelers.count} RVer{travelers.count !== 1 ? 's' : ''} also stopping here
              </p>
              <div className="flex flex-wrap gap-2">
                {travelers.travelers.slice(0, 8).map((t: any) => (
                  <div key={t.user.id} className="flex items-center gap-1.5 bg-white rounded-full px-2 py-1 border border-gray-100 text-xs text-gray-700">
                    {t.user.profilePicture
                      ? <img src={t.user.profilePicture} className="w-5 h-5 rounded-full object-cover" alt="" />
                      : <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center text-[10px] font-bold text-indigo-700">{t.user.firstName?.[0]}</div>
                    }
                    {t.user.firstName}
                    {t.estimatedArrival && (
                      <span className="text-gray-400">· {new Date(t.estimatedArrival).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )}
                  </div>
                ))}
                {travelers.count > 8 && (
                  <span className="text-xs text-gray-400 self-center">+{travelers.count - 8} more</span>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          {user && (
            <div className="flex gap-2">
              <button onClick={() => { setShowReviewForm(!showReviewForm); setShowUpdateForm(false); }}
                className="flex-1 py-2 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition">
                ⭐ Write a Review
              </button>
              <button onClick={() => { setShowUpdateForm(!showUpdateForm); setShowReviewForm(false); }}
                className="flex-1 py-2 text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition">
                📢 Post Update
              </button>
            </div>
          )}

          {/* Review form */}
          {showReviewForm && user && (
            <div className="bg-white rounded-xl border border-yellow-200 p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900">Your Review</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 font-medium">Overall Rating</label>
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4,5].map(i => (
                      <button key={i} onClick={() => setReviewForm(f => ({ ...f, rating: i }))}>
                        <Star className={'w-5 h-5 ' + (i <= reviewForm.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200')} />
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500 font-medium">Safety Rating</label>
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4,5].map(i => (
                      <button key={i} onClick={() => setReviewForm(f => ({ ...f, safetyRating: i }))}>
                        <Shield className={'w-5 h-5 ' + (i <= reviewForm.safetyRating ? 'text-blue-500 fill-blue-100' : 'text-gray-200')} />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 font-medium">Noise Level</label>
                <div className="flex gap-2 mt-1">
                  {['QUIET','MODERATE','LOUD'].map(n => (
                    <button key={n} onClick={() => setReviewForm(f => ({ ...f, noiseLevel: n }))}
                      className={'px-3 py-1 text-xs rounded-full border font-medium transition ' + (reviewForm.noiseLevel === n ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                      {n === 'QUIET' ? '😴 Quiet' : n === 'MODERATE' ? '🔉 Moderate' : '📢 Loud'}
                    </button>
                  ))}
                </div>
              </div>
              <textarea value={reviewForm.content} onChange={e => setReviewForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Share your experience — safety, noise, how to get permission, tips for future RVers..."
                rows={3} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-yellow-400 resize-none" />
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={reviewForm.wouldReturn} onChange={e => setReviewForm(f => ({ ...f, wouldReturn: e.target.checked }))} className="rounded" />
                I would stop here again
              </label>
              <div className="flex gap-2">
                <button onClick={handleSubmitReview} disabled={submitting}
                  className="flex-1 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-50 transition">
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
                <button onClick={() => setShowReviewForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}

          {/* Update form */}
          {showUpdateForm && user && (
            <div className="bg-white rounded-xl border border-blue-200 p-4 space-y-3">
              <p className="text-sm font-bold text-gray-900">Post an Update</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(UPDATE_TYPE_LABELS).map(([key, val]) => (
                  <button key={key} onClick={() => setUpdateForm(f => ({ ...f, updateType: key }))}
                    className={'px-3 py-1.5 text-xs rounded-full border font-medium transition ' + (updateForm.updateType === key ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 hover:border-gray-300')}>
                    {val.label}
                  </button>
                ))}
              </div>
              <textarea value={updateForm.content} onChange={e => setUpdateForm(f => ({ ...f, content: e.target.value }))}
                placeholder="Any details to share with other RVers?"
                rows={2} className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-400 resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSubmitUpdate} disabled={submitting || !updateForm.content.trim()}
                  className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                  {submitting ? 'Posting...' : 'Post Update'}
                </button>
                <button onClick={() => setShowUpdateForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
