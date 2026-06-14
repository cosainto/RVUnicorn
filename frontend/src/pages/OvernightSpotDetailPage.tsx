import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MapPin, Star, ArrowLeft, Wifi, Zap, Droplets, Coffee, Truck } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const CATEGORY_ICONS: Record<string, string> = {
  RETAIL: '🛒', OUTDOOR_RETAIL: '⛺', HARDWARE: '🔧', FARM_RANCH: '🌾',
  RESTAURANT: '🍽️', TRUCK_STOP: '🚛', GAS_STATION: '⛽', LODGE: '🏨',
  CASINO: '🎰', GROCERY: '🛒', MALL: '🏬', REST_AREA: '🚻',
  BLM: '🌲', NATIONAL_FOREST: '🌲', OTHER: '📍',
};

const REVIEW_TAGS = ['Quiet', 'Safe', 'Level Ground', 'Good Cell Signal', 'Clean', 'Well Lit', 'Easy Access', 'Security Asked Us to Leave', 'Would Return'];

export default function OvernightSpotDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [spot, setSpot] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5, wouldReturn: true, notes: '', tags: [] as string[], visitDate: ''
  });

  const [flagBreakdown, setFlagBreakdown] = useState<any>(null);
  const [tips, setTips] = useState<any[]>([]);

  useEffect(() => {
    api.get(`/overnight-stops/${id}`)
      .then(r => {
        setSpot(r.data);
        if (r.data.flagBreakdown) setFlagBreakdown(r.data.flagBreakdown);
        if (r.data.tips) setTips(r.data.tips);
      })
      .catch(() => navigate('/campgrounds'))
      .finally(() => setLoading(false));
  }, [id]);

  const toggleTag = (tag: string) => {
    setReviewForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag]
    }));
  };

  const submitReview = async () => {
    setSubmitting(true);
    try {
      await api.post(`/overnight-spots/${id}/reviews`, reviewForm);
      const r = await api.get(`/overnight-spots/${id}`);
      setSpot(r.data);
      setShowReviewForm(false);
      setReviewForm({ rating: 5, wouldReturn: true, notes: '', tags: [], visitDate: '' });
    } catch { alert('Failed to submit review'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" /></div>;
  if (!spot) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-3xl">{CATEGORY_ICONS[spot.category] || '📍'}</span>
              <span className="text-xs font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{spot.category?.replace('_', ' ')}</span>
              {spot.chain && <span className="text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{spot.chain}</span>}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{spot.name}</h1>
            <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
              <MapPin className="w-4 h-4" />
              <span>{[spot.address, spot.city, spot.state].filter(Boolean).join(', ')}</span>
            </div>
            {/* RV-Friendly trust score */}
            {flagBreakdown?.rvFriendly ? (
              <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-bold ${flagBreakdown.rvFriendly.pct >= 70 ? 'bg-green-100 text-green-700' : flagBreakdown.rvFriendly.pct >= 40 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                {flagBreakdown.rvFriendly.pct >= 70 ? '\u2705' : '\u26A0\uFE0F'} {flagBreakdown.rvFriendly.pct}% say RV-friendly
              </div>
            ) : spot.visitCount === 0 ? (
              <div className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-500">
                {'\u{1F319}'} Unknown — be the first to visit!
              </div>
            ) : null}
            {spot.visitCount > 0 && (
              <p className="text-xs text-gray-400 mt-1">{spot.visitCount} RVUnicorn member{spot.visitCount !== 1 ? 's have' : ' has'} overnighted here</p>
            )}
            {spot.avgRating && (
              <div className="flex items-center gap-1.5 mt-2">
                <div className="flex">
                  {[1,2,3,4,5].map(n => (
                    <Star key={n} className={`w-4 h-4 ${n <= Math.round(parseFloat(spot.avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />
                  ))}
                </div>
                <span className="text-sm font-semibold text-gray-700">{spot.avgRating}</span>
                <span className="text-xs text-gray-400">({spot.reviewCount} reviews)</span>
              </div>
            )}
          </div>
          {user && !showReviewForm && (
            <button onClick={() => setShowReviewForm(true)}
              className="px-4 py-2 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition whitespace-nowrap">
              ⭐ Rate This Spot
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">

          {/* Review Form */}
          {showReviewForm && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-4">⭐ Your Review</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">Rating *</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} onClick={() => setReviewForm(f => ({ ...f, rating: n }))}
                        className={`w-10 h-10 rounded-xl text-lg transition ${reviewForm.rating >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                        ⭐
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">Tags</label>
                  <div className="flex flex-wrap gap-2">
                    {REVIEW_TAGS.map(tag => (
                      <button key={tag} onClick={() => toggleTag(tag)}
                        className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${reviewForm.tags.includes(tag) ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Would you return?</label>
                  <div className="flex gap-2">
                    <button onClick={() => setReviewForm(f => ({ ...f, wouldReturn: true }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${reviewForm.wouldReturn ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
                      👍 Yes
                    </button>
                    <button onClick={() => setReviewForm(f => ({ ...f, wouldReturn: false }))}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition ${!reviewForm.wouldReturn ? 'bg-red-500 text-white border-red-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      👎 No
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Visit Date</label>
                  <input type="date" value={reviewForm.visitDate} onChange={e => setReviewForm(f => ({ ...f, visitDate: e.target.value }))}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
                  <textarea value={reviewForm.notes} onChange={e => setReviewForm(f => ({ ...f, notes: e.target.value }))}
                    placeholder="What was your experience like? Any tips for other RVers?" rows={3}
                    className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 resize-none" />
                </div>
                <div className="flex gap-3">
                  <button onClick={submitReview} disabled={submitting}
                    className="flex-1 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button onClick={() => setShowReviewForm(false)}
                    className="px-4 py-2.5 border border-gray-200 text-gray-600 font-semibold rounded-xl">
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Community Flags */}
          {flagBreakdown && Object.values(flagBreakdown).some((v: any) => v !== null) && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">{'\u{1F6A9}'} Community Reports</h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { key: 'rvFriendly', label: 'RV-Friendly', emoji: '\u{1F690}' },
                  { key: 'feltSafe', label: 'Felt Safe', emoji: '\u{1F512}' },
                  { key: 'bigRigOK', label: 'Big Rig OK', emoji: '\u{1F69B}' },
                  { key: 'quietNight', label: 'Quiet Night', emoji: '\u{1F319}' },
                  { key: 'goodSignal', label: 'Good Signal', emoji: '\u{1F4F6}' },
                  { key: 'wellLit', label: 'Well-Lit', emoji: '\u{1F4A1}' },
                  { key: 'petFriendly', label: 'Pet-Friendly', emoji: '\u{1F436}' },
                  { key: 'hasShowers', label: 'Showers', emoji: '\u{1F6BF}' },
                  { key: 'hasElectric', label: 'Electric', emoji: '\u26A1' },
                  { key: 'hasDump', label: 'Dump Station', emoji: '\u{1F5D1}\uFE0F' },
                  { key: 'tightLot', label: 'Tight Lot', emoji: '\u26A0\uFE0F' },
                  { key: 'policyUnclear', label: 'Policy Unclear', emoji: '\u2753' },
                ].map(flag => {
                  const data = (flagBreakdown as any)[flag.key];
                  if (!data) return null;
                  const isPositive = flag.key !== 'tightLot' && flag.key !== 'policyUnclear';
                  const color = data.pct >= 70 ? (isPositive ? 'text-green-600 bg-green-50' : 'text-amber-600 bg-amber-50') : data.pct <= 30 ? (isPositive ? 'text-gray-400 bg-gray-50' : 'text-green-600 bg-green-50') : 'text-gray-500 bg-gray-50';
                  return (
                    <div key={flag.key} className={`flex items-center gap-2 px-3 py-2 rounded-lg ${color}`}>
                      <span className="text-sm">{flag.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold">{flag.label}</p>
                        <p className="text-[10px]">{data.yes} of {data.total} ({data.pct}%)</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tips */}
          {tips.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <h3 className="font-bold text-gray-900 mb-3">{'\u{1F4A1}'} Tips from RVers</h3>
              <div className="space-y-3">
                {tips.map((t: any, i: number) => (
                  <div key={i} className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
                    <p className="text-sm text-gray-700">{t.tip}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{new Date(t.date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 className="font-bold text-gray-900 mb-4">{'\u{1F4AC}'} Community Reviews</h3>
            {spot.reviews?.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-3xl mb-2">🌙</p>
                <p className="text-sm text-gray-500">No reviews yet — be the first to rate this spot!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {spot.reviews?.map((r: any) => (
                  <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                    <div className="flex items-center gap-2 mb-1">
                      {r.user?.profilePicture && <img src={r.user.profilePicture} className="w-7 h-7 rounded-full object-cover" />}
                      <span className="font-semibold text-sm">{r.user?.firstName || r.user?.username}</span>
                      <div className="flex">
                        {[1,2,3,4,5].map(n => <Star key={n} className={`w-3 h-3 ${n <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-200'}`} />)}
                      </div>
                      {r.wouldReturn !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${r.wouldReturn ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          {r.wouldReturn ? '👍 Would return' : '👎 Would not return'}
                        </span>
                      )}
                      {r.visitDate && <span className="text-xs text-gray-400 ml-auto">{new Date(r.visitDate).toLocaleDateString()}</span>}
                    </div>
                    {r.tags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-1">
                        {r.tags.map((tag: string) => (
                          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                        ))}
                      </div>
                    )}
                    {r.notes && <p className="text-sm text-gray-600">{r.notes}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <h3 className="font-bold text-gray-900 mb-3">🚐 Spot Details</h3>
            <div className="space-y-2 text-sm">
              {spot.maxNights && <div className="flex justify-between"><span className="text-gray-500">Max Nights</span><span className="font-medium">{spot.maxNights === 0 ? 'Unlimited' : spot.maxNights}</span></div>}
              {spot.maxRvLength && <div className="flex justify-between"><span className="text-gray-500">Max Length</span><span className="font-medium">{spot.maxRvLength} ft</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">24 Hours</span><span className="font-medium">{spot.is24Hours ? '✅ Yes' : '❌ No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Membership</span><span className="font-medium">{spot.membershipRequired ? `⚠️ ${spot.membershipType || 'Required'}` : '✅ Not required'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Permission</span><span className="font-medium">{spot.requiresPermission ? '⚠️ Required' : '✅ Not required'}</span></div>
            </div>
            <div className="grid grid-cols-2 gap-2 mt-3">
              {spot.hasWifi && <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-lg"><Wifi className="w-3 h-3" /> WiFi</span>}
              {spot.hasDump && <span className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded-lg"><Droplets className="w-3 h-3" /> Dump</span>}
              {spot.hasWater && <span className="flex items-center gap-1 text-xs bg-cyan-50 text-cyan-700 px-2 py-1 rounded-lg"><Droplets className="w-3 h-3" /> Water</span>}
              {spot.hasElectric && <span className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded-lg"><Zap className="w-3 h-3" /> Electric</span>}
              {spot.hasFuel && <span className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded-lg"><Truck className="w-3 h-3" /> Fuel</span>}
              {spot.hasFood && <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2 py-1 rounded-lg"><Coffee className="w-3 h-3" /> Food</span>}
            </div>
          </div>

          {spot.notes && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <h3 className="font-bold text-gray-900 mb-2">📝 Notes</h3>
              <p className="text-sm text-gray-700">{spot.notes}</p>
            </div>
          )}

          <a href={`https://www.google.com/maps/dir/?api=1&destination=${spot.latitude},${spot.longitude}`}
            target="_blank" rel="noopener noreferrer"
            className="block w-full text-center py-2.5 bg-primary-600 text-white text-sm font-semibold rounded-xl hover:bg-primary-700 transition">
            🗺️ Get Directions
          </a>
        </div>
      </div>
    </div>
  );
}
