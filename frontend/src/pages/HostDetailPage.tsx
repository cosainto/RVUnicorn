import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { MapPin, Star, Phone, Globe, ArrowLeft, Camera, ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';


const HOST_BADGES = {
  first_night: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773457089/badges/rv_netwrok_1st-night-staying.png',
  rv_host: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773457090/badges/rv_host_badge.png',
  top_reviewer: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773457091/badges/top_reviewer_badge.png',
  brew_hopper: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773457093/badges/brewhopperbadge.png',
  vineyard_voyager: 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773457094/badges/vineyard_voyager_badge.png',
};

const REVIEWER_BADGE_THRESHOLD = 3;

const VIBE_BADGES: Record<string, string> = {
  'Social Host': '🍷', 'Quiet Farm': '🌾', 'Event Spot': '🎶',
  'Family Friendly': '👨‍👩‍👧', 'Stargazer Paradise': '🌌',
  'Party Patio': '🍺', 'Peaceful Retreat': '🧘', 'Big Rig Friendly': '🚛',
};

const ACTIVITY_ICONS: Record<string, string> = {
  'Wine Tasting': '🍷', 'Farm Animals': '🐄', 'Live Music': '🎶',
  'Food Trucks': '🚚', 'Stargazing': '🌌', 'Hiking Trails': '🥾',
  'Brewery Patio': '🍺', 'Orchard Picking': '🍎', 'Farm Stand': '🌽',
  'Fishing': '🎣', 'Swimming': '🏊', 'Kayaking': '🛶',
};

const HOST_TYPE_ICONS: Record<string, string> = {
  WINERY: '🍷', BREWERY: '🍺', FARM: '🌾', DISTILLERY: '🥃',
  RANCH: '🐄', MUSEUM: '🏛️', OTHER: '🌿', ATTRACTION: '🎡',
  ORCHARD: '🍎', EVENT_VENUE: '🎪',
};

export default function HostDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [host, setHost] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [reviewForm, setReviewForm] = useState({ rating: 5, hostFriendliness: 5, experienceQuality: 5, parkingConvenience: 5, overallVibe: 5, content: '', tags: [] as string[] });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isOwner = user && host?.claimedByUserId === user.id;

  useEffect(() => {
    api.get(`/harvest-hosts/${id}`).then(r => setHost(r.data)).catch(() => navigate('/campgrounds')).finally(() => setLoading(false));
  }, [id]);

  const allPhotos = host ? [host.imageUrl, ...(host.photos || [])].filter(Boolean) : [];

  const submitReview = async () => {
    setSubmitting(true);
    try {
      await api.post(`/harvest-hosts/${id}/reviews`, reviewForm);
      const r = await api.get(`/harvest-hosts/${id}`);
      setHost(r.data);
      setShowReviewForm(false);
    } catch (e) { alert('Failed to submit review'); }
    finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" /></div>;
  if (!host) return null;

  const avgRating = host.reviews?.length ? (host.reviews.reduce((a: number, r: any) => a + r.rating, 0) / host.reviews.length).toFixed(1) : null;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center text-gray-600 hover:text-gray-900 mb-4">
        <ArrowLeft className="w-5 h-5 mr-2" /> Back
      </button>

      {/* Photo Carousel */}
      <div className="relative h-72 bg-gradient-to-br from-green-100 to-emerald-200 rounded-2xl overflow-hidden mb-6 group">
        {allPhotos.length > 0 ? (
          <>
            <img src={allPhotos[photoIndex]} alt={host.name} className="w-full h-full object-cover" />
            {allPhotos.length > 1 && (
              <>
                <button onClick={() => setPhotoIndex(i => (i - 1 + allPhotos.length) % allPhotos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button onClick={() => setPhotoIndex(i => (i + 1) % allPhotos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/40 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition">
                  <ChevronRight className="w-5 h-5" />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {allPhotos.map((_, i) => <div key={i} className={`w-1.5 h-1.5 rounded-full ${i === photoIndex ? 'bg-white' : 'bg-white/50'}`} />)}
                </div>
              </>
            )}
          </>
        ) : (
          <div className="flex items-center justify-center h-full text-6xl">{HOST_TYPE_ICONS[host.hostType] || '🌿'}</div>
        )}

        {/* Status badge */}
        {host.status === 'PENDING' && (
          <div className="absolute top-3 left-3 bg-amber-500 text-white text-xs font-bold px-3 py-1 rounded-full">⏳ Pending Review</div>
        )}
        {isOwner && (
          <Link to={`/hosts/${id}/edit`} className="absolute top-3 right-3 bg-white text-gray-700 text-xs font-semibold px-3 py-1.5 rounded-full shadow hover:bg-gray-50 transition">
            ✏️ Edit Listing
          </Link>
        )}
      </div>

      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-2xl">{HOST_TYPE_ICONS[host.hostType] || '🌿'}</span>
            <span className="text-xs font-semibold bg-green-100 text-green-800 px-2 py-0.5 rounded-full">{host.hostType}</span>
            {host.networkType && host.networkType !== 'INDEPENDENT' && (
              <span className="text-xs font-semibold bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">{host.networkType.replace('_', ' ')}</span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{host.name}</h1>
          <div className="flex items-center gap-2 text-gray-500 text-sm mt-1">
            <MapPin className="w-4 h-4" />
            <span>{[host.city, host.state].filter(Boolean).join(', ')}</span>
            {avgRating && (
              <span className="flex items-center gap-1 text-amber-500 font-semibold ml-2">
                <Star className="w-4 h-4 fill-amber-400" /> {avgRating} ({host.reviews?.length} reviews)
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {host.website && (
            <a href={host.website} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition">
              <Globe className="w-4 h-4" /> Visit Site
            </a>
          )}
          {host.phone && (
            <a href={`tel:${host.phone}`} className="flex items-center gap-1.5 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
              <Phone className="w-4 h-4" /> Call Host
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">

          {/* Host Story */}
          {(host.description || host.hostStory) && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-2">🏡 About This Stop</h2>
              {host.hostStory && <p className="text-gray-600 text-sm mb-2 italic">"{host.hostStory}"</p>}
              {host.description && <p className="text-gray-600 text-sm">{host.description}</p>}
            </div>
          )}

          {/* Vibe Scores */}
          {host.vibeScores?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3">✨ Host Vibe</h2>
              <div className="flex flex-wrap gap-2">
                {host.vibeScores.map((v: string) => (
                  <span key={v} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-800 text-sm font-medium rounded-full">
                    {VIBE_BADGES[v] || '✨'} {v}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Activities */}
          {host.activityTags?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
              <h2 className="font-bold text-gray-900 mb-3">🎯 Experiences</h2>
              <div className="flex flex-wrap gap-2">
                {host.activityTags.map((a: string) => (
                  <span key={a} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 text-green-800 text-sm font-medium rounded-full">
                    {ACTIVITY_ICONS[a] || '🌿'} {a}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Support the Host */}
          {(host.supportMessage || host.suggestedPurchase || host.storeHours) && (
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl border border-amber-200 p-5">
              <h2 className="font-bold text-gray-900 mb-2">🤝 Support This Host</h2>
              {host.supportMessage && <p className="text-gray-700 text-sm mb-2">{host.supportMessage}</p>}
              {host.suggestedPurchase && <p className="text-sm text-amber-800"><strong>Suggested:</strong> {host.suggestedPurchase}</p>}
              {host.storeHours && <p className="text-sm text-amber-800 mt-1"><strong>Hours:</strong> {host.storeHours}</p>}
            </div>
          )}

          {/* Reviews */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-gray-900">⭐ Reviews</h2>
              {user && !showReviewForm && (
                <button onClick={() => setShowReviewForm(true)} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition">
                  <MessageSquare className="w-4 h-4" /> Write Review
                </button>
              )}
            </div>

            {showReviewForm && (
              <div className="bg-green-50 rounded-xl p-4 mb-4 space-y-3">
                <p className="text-sm font-bold text-gray-800">Your Review</p>
                {[['Overall', 'rating'], ['Host Friendliness', 'hostFriendliness'], ['Experience Quality', 'experienceQuality'], ['Parking', 'parkingConvenience'], ['Overall Vibe', 'overallVibe']].map(([label, key]) => (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-xs text-gray-600 w-36">{label}</span>
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} onClick={() => setReviewForm(f => ({ ...f, [key]: n }))}
                          className={`w-7 h-7 rounded-full text-sm transition ${(reviewForm as any)[key] >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <textarea value={reviewForm.content} onChange={e => setReviewForm(f => ({ ...f, content: e.target.value }))}
                  placeholder="Share your experience..." rows={3}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
                <div className="flex gap-2">
                  <button onClick={submitReview} disabled={submitting}
                    className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
                    {submitting ? 'Submitting...' : 'Submit Review'}
                  </button>
                  <button onClick={() => setShowReviewForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg">Cancel</button>
                </div>
              </div>
            )}

            {host.reviews?.length === 0 && <p className="text-sm text-gray-400 text-center py-6">No reviews yet — be the first!</p>}
            <div className="space-y-4">
              {host.reviews?.map((r: any) => (
                <div key={r.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    {r.user?.profilePicture && <img src={r.user.profilePicture} className="w-7 h-7 rounded-full object-cover" />}
                    <span className="font-semibold text-sm text-gray-800">{r.user?.firstName || r.user?.username}</span>
                    <span className="text-amber-500 text-sm">{'⭐'.repeat(r.rating)}</span>
                    {r.visitDate && <span className="text-xs text-gray-400 ml-auto">{new Date(r.visitDate).toLocaleDateString()}</span>}
                  </div>
                  {r.content && <p className="text-sm text-gray-600">{r.content}</p>}
                  {(r.hostFriendliness || r.experienceQuality) && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {r.hostFriendliness && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">Friendliness: {r.hostFriendliness}/5</span>}
                      {r.experienceQuality && <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Experience: {r.experienceQuality}/5</span>}
                      {r.parkingConvenience && <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">Parking: {r.parkingConvenience}/5</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">

          {/* RV Logistics */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">🚐 RV Logistics</h3>
            <div className="space-y-2 text-sm">
              {host.maxRvLength && <div className="flex justify-between"><span className="text-gray-500">Max RV Length</span><span className="font-medium">{host.maxRvLength} ft</span></div>}
              {host.maxRvs && <div className="flex justify-between"><span className="text-gray-500">Max Rigs</span><span className="font-medium">{host.maxRvs}</span></div>}
              {host.surfaceType && <div className="flex justify-between"><span className="text-gray-500">Surface</span><span className="font-medium capitalize">{host.surfaceType}</span></div>}
              <div className="flex justify-between"><span className="text-gray-500">Hookups</span><span className="font-medium">{host.hookups ? '✅ Yes' : '❌ No'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Big Rig</span><span className="font-medium">{host.bigRigFriendly ? '✅ Friendly' : '⚠️ Check first'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Turnaround</span><span className="font-medium">{host.turnaroundAvailable ? '✅ Yes' : '⚠️ Limited'}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Self-Contained</span><span className="font-medium">{host.selfContainedRequired ? '⚠️ Required' : '✅ Not required'}</span></div>
            </div>
          </div>

          {/* Stay Rules */}
          <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            <h3 className="font-bold text-gray-900 mb-3">📋 Stay Guidelines</h3>
            <div className="space-y-2 text-sm">
              {host.maxNights && <div className="flex justify-between"><span className="text-gray-500">Max Nights</span><span className="font-medium">{host.maxNights}</span></div>}
              {host.arrivalWindow && <div className="flex justify-between"><span className="text-gray-500">Arrival</span><span className="font-medium">{host.arrivalWindow}</span></div>}
              {host.departureTime && <div className="flex justify-between"><span className="text-gray-500">Departure</span><span className="font-medium">{host.departureTime}</span></div>}
              {host.quietHours && <div className="flex justify-between"><span className="text-gray-500">Quiet Hours</span><span className="font-medium">{host.quietHours}</span></div>}
              {host.generatorPolicy && <div className="flex justify-between"><span className="text-gray-500">Generator</span><span className="font-medium">{host.generatorPolicy}</span></div>}
              {host.petPolicy && <div className="flex justify-between"><span className="text-gray-500">Pets</span><span className="font-medium">{host.petPolicy}</span></div>}
            </div>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {host.familyFriendly && <span className="text-xs bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full">👨‍👩‍👧 Family</span>}
              {host.petPolicy?.toLowerCase().includes('welcome') && <span className="text-xs bg-orange-50 text-orange-700 border border-orange-200 px-2 py-0.5 rounded-full">🐾 Pet Friendly</span>}
              {host.bigRigFriendly && <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">🚛 Big Rig OK</span>}
              {host.selfContainedRequired && <span className="text-xs bg-gray-50 text-gray-700 border border-gray-200 px-2 py-0.5 rounded-full">🔒 Self-Contained</span>}
            </div>
          </div>

          {/* Check-in */}
          <div className="bg-green-50 rounded-2xl border border-green-200 p-4">
            <h3 className="font-bold text-gray-900 mb-2">🗓️ Stay Request</h3>
            <p className="text-xs text-gray-600 mb-3">
              {host.reservationType === 'INSTANT' ? 'This host accepts instant stays.' :
               host.reservationType === 'CALL' ? 'Call ahead to confirm availability.' :
               'Request a stay and the host will confirm.'}
            </p>
            {host.checkInInstructions && <p className="text-xs text-gray-600 bg-white rounded-lg p-2 mb-3 border border-green-100">{host.checkInInstructions}</p>}
            {host.website && (
              <a href={host.website} target="_blank" rel="noopener noreferrer"
                className="block w-full text-center py-2.5 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition">
                {host.reservationType === 'CALL' ? '📞 Call to Book' : '📩 Request Stay'}
              </a>
            )}
          </div>

          {/* Not claimed yet */}
      {user && (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
              <h3 className="font-bold text-gray-900 mb-3">🏅 RVUnicorn Badges</h3>
              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center gap-1">
                  <img src={HOST_BADGES.first_night} alt="First Night" className="w-14 h-14 object-contain" />
                  <span className="text-xs text-gray-500 text-center">1st Night Stay</span>
                </div>
                {host.hostType === 'BREWERY' && (
                  <div className="flex flex-col items-center gap-1">
                    <img src={HOST_BADGES.brew_hopper} alt="Brew Hopper" className="w-14 h-14 object-contain" />
                    <span className="text-xs text-gray-500 text-center">Brew Hopper</span>
                  </div>
                )}
                {host.hostType === 'WINERY' && (
                  <div className="flex flex-col items-center gap-1">
                    <img src={HOST_BADGES.vineyard_voyager} alt="Vineyard Voyager" className="w-14 h-14 object-contain" />
                    <span className="text-xs text-gray-500 text-center">Vineyard Voyager</span>
                  </div>
                )}
                {host.claimedByUserId === user?.id && (
                  <div className="flex flex-col items-center gap-1">
                    <img src={HOST_BADGES.rv_host} alt="RV Host" className="w-14 h-14 object-contain" />
                    <span className="text-xs text-gray-500 text-center">RV Host</span>
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-400 mt-2">Check in to earn these badges on your profile!</p>
            </div>
          )}

                    {!host.claimedByUserId && user && (
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <p className="text-sm font-bold text-amber-800 mb-1">🏡 Is this your place?</p>
              <p className="text-xs text-amber-700 mb-3">Claim this listing to add photos, update info, and manage your page.</p>
              <button onClick={async () => {
                try {
                  await api.post(`/harvest-hosts/${id}/claim`);
                  const r = await api.get(`/harvest-hosts/${id}`);
                  setHost(r.data);
                  alert('✅ Listing claimed! You can now edit your page.');
                } catch { alert('Failed to claim listing.'); }
              }} className="w-full py-2 bg-amber-500 text-white text-sm font-semibold rounded-xl hover:bg-amber-600 transition">
                Claim This Listing
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
