import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Star, Heart, Share2, Navigation, Phone, Globe, Mail, Copy, ChevronDown, ThumbsUp, Send, X, ExternalLink } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Helmet } from 'react-helmet-async';

const TYPE_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  CAMPGROUND: { emoji: '\u{1F3D5}\uFE0F', label: 'Campground', color: '#16a34a' },
  OVERNIGHT_STOP: { emoji: '\u{1F319}', label: 'Overnight Stop', color: '#1B2B4B' },
  BOONDOCKING: { emoji: '\u{1F332}', label: 'Boondocking', color: '#854d0e' },
  STATE_PARK: { emoji: '\u{1F3DE}\uFE0F', label: 'State Park', color: '#15803d' },
  RV_PARK: { emoji: '\u{1F690}', label: 'RV Park', color: '#0369a1' },
  REST_AREA: { emoji: '\u{1F6D1}', label: 'Rest Area', color: '#6b7280' },
  HARVEST_HOST: { emoji: '\u{1F347}', label: 'Harvest Host', color: '#7c3aed' },
};

export default function LocationDetailPage() {
  const { type = 'campground', id } = useParams();
  const { user } = useAuth();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showTipModal, setShowTipModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({ overallRating: 0, cleanlinessRating: 0, safetyRating: 0, noiseRating: 0, internetRating: 0, scenicRating: 0, body: '', wouldStayAgain: true, tips: [''] });
  const [tipContent, setTipContent] = useState('');
  const [tipCategory, setTipCategory] = useState('GENERAL');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    api.get(`/locations/${type}/${id}`).then(r => {
      setData(r.data);
      setSaved(r.data.isSavedByCurrentUser);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [type, id]);

  const handleSave = async () => {
    const { data: result } = await api.post(`/locations/${type}/${id}/save`);
    setSaved(result.saved);
  };

  const handleHelpful = async (reviewId: string) => {
    await api.post(`/locations/${type}/${id}/reviews/${reviewId}/helpful`);
    setData((d: any) => ({
      ...d,
      reviews: d.reviews.map((r: any) => r.id === reviewId ? { ...r, helpfulCount: r.helpfulCount + 1 } : r),
    }));
  };

  const submitReview = async () => {
    if (reviewForm.overallRating === 0) return;
    setSubmitting(true);
    try {
      await api.post(`/locations/${type}/${id}/reviews`, {
        ...reviewForm,
        tips: reviewForm.tips.filter(t => t.trim()),
      });
      const r = await api.get(`/locations/${type}/${id}`);
      setData(r.data);
      setShowReviewModal(false);
      setReviewForm({ overallRating: 0, cleanlinessRating: 0, safetyRating: 0, noiseRating: 0, internetRating: 0, scenicRating: 0, body: '', wouldStayAgain: true, tips: [''] });
    } catch { alert('Failed to submit review'); }
    setSubmitting(false);
  };

  const submitTip = async () => {
    if (!tipContent.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/locations/${type}/${id}/tips`, { content: tipContent, category: tipCategory });
      const r = await api.get(`/locations/${type}/${id}`);
      setData(r.data);
      setShowTipModal(false);
      setTipContent('');
    } catch { alert('Failed to add tip'); }
    setSubmitting(false);
  };

  const copyText = (text: string) => { navigator.clipboard.writeText(text).catch(() => {}); };

  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500" /></div>;
  if (!data) return <div className="text-center py-20 text-gray-500">Location not found</div>;

  const loc = data.location;
  const typeConfig = TYPE_CONFIG[data.locationType] || TYPE_CONFIG.CAMPGROUND;
  const heroPhoto = loc.imageUrl || loc.photoUrls?.[0] || null;
  const locName = loc.name;
  const address = [loc.address, loc.city, loc.state].filter(Boolean).join(', ') || loc.location || '';
  const lat = loc.latitude || loc.gpsLat;
  const lng = loc.longitude || loc.gpsLng;

  return (
    <>
      <Helmet>
        <title>{locName} — {loc.city || loc.state || ''} | RVUnicorn</title>
        <meta name="description" content={`${data.communityStats.uniqueVisitorCount || 0} RVUnicorn members have stayed at ${locName}. Read reviews, tips, and RV-specific info.`} />
      </Helmet>

      <div className="min-h-screen" style={{ background: '#0F1C35' }}>
        {/* ── HERO ── */}
        <div className="relative h-[300px] overflow-hidden">
          {heroPhoto ? (
            <img src={heroPhoto} alt={locName} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B2B4B, #0F1C35)' }}>
              <span className="text-7xl">{typeConfig.emoji}</span>
            </div>
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(15,28,53,1) 0%, rgba(15,28,53,0.4) 40%, transparent 100%)' }} />

          {/* Type badge top-left */}
          <div className="absolute top-4 left-4">
            <span className="px-3 py-1.5 rounded-full text-xs font-bold text-white" style={{ background: typeConfig.color }}>
              {typeConfig.emoji} {typeConfig.label}
            </span>
          </div>

          {/* Trust badges top-right */}
          <div className="absolute top-4 right-4 flex gap-2">
            {data.trustScore?.isVerified && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>{'\u2713'} Verified</span>}
            {data.trustScore?.recentlyReviewed && <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-orange-500 text-white">{'\u{1F525}'} Recently Reviewed</span>}
          </div>

          {/* Name overlaid */}
          <div className="absolute bottom-4 left-4 right-4">
            <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg" style={{ fontFamily: "'Playfair Display', serif" }}>{locName}</h1>
            {address && <p className="text-sm text-white/60 mt-1 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {address}</p>}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto" style={{ background: '#162236' }}>
          {lat && lng && (
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap" style={{ border: '1px solid #E8A838', color: '#E8A838' }}>
              <Navigation className="w-3.5 h-3.5" /> Directions
            </a>
          )}
          <button onClick={handleSave} className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap ${saved ? 'bg-red-500/20 text-red-400' : ''}`} style={!saved ? { border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' } : { border: '1px solid rgba(239,68,68,0.3)' }}>
            <Heart className="w-3.5 h-3.5" fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save'}
          </button>
          <button onClick={() => navigator.share?.({ title: locName, url: window.location.href }).catch(() => {})}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.6)' }}>
            <Share2 className="w-3.5 h-3.5" /> Share
          </button>
        </div>

        <div className="max-w-3xl mx-auto px-4 pb-12 space-y-4">

          {/* ── OVERVIEW ── */}
          <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
            <h2 className="text-lg font-bold mb-3" style={{ color: '#F5F0E8' }}>{locName}</h2>
            {address && (
              <button onClick={() => copyText(address)} className="flex items-center gap-2 text-sm mb-2 hover:opacity-80" style={{ color: '#8B9BB4' }}>
                <MapPin className="w-4 h-4" /> {address} <Copy className="w-3 h-3" />
              </button>
            )}
            {lat && lng && (
              <button onClick={() => copyText(`${lat}, ${lng}`)} className="flex items-center gap-2 text-xs mb-2 hover:opacity-80" style={{ color: '#8B9BB4' }}>
                {'\u{1F4CD}'} {lat.toFixed(5)}, {lng.toFixed(5)} <Copy className="w-3 h-3" />
              </button>
            )}
            <div className="flex flex-wrap gap-3 mt-3">
              {loc.phone && <a href={`tel:${loc.phone}`} className="flex items-center gap-1.5 text-xs" style={{ color: '#E8A838' }}><Phone className="w-3.5 h-3.5" /> {loc.phone}</a>}
              {(loc.websiteUrl || loc.website) && <a href={loc.websiteUrl || loc.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs" style={{ color: '#E8A838' }}><Globe className="w-3.5 h-3.5" /> Website <ExternalLink className="w-3 h-3" /></a>}
              {loc.businessEmail && <a href={`mailto:${loc.businessEmail}`} className="flex items-center gap-1.5 text-xs" style={{ color: '#E8A838' }}><Mail className="w-3.5 h-3.5" /> Email</a>}
            </div>
            {loc.chain && <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838' }}>{loc.chain.replace(/_/g, ' ')}</span>}
          </div>

          {/* ── RV FRIENDLINESS ── */}
          {data.rvFriendliness && (
            <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#F5F0E8' }}>{'\u{1F690}'} RV Friendliness</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {[
                  { key: 'isBigRigFriendly', label: 'Big Rig Friendly', emoji: '\u{1F69B}', extra: data.rvFriendliness.maxRigLength ? `Up to ${data.rvFriendliness.maxRigLength}ft` : null },
                  { key: 'hasPullThrough', label: 'Pull-Through', emoji: '\u{1F6E3}\uFE0F' },
                  { key: 'hasDumpStation', label: 'Dump Station', emoji: '\u{1F5D1}\uFE0F' },
                  { key: 'hasPotableWater', label: 'Potable Water', emoji: '\u{1F4A7}' },
                  { key: 'hasElectric', label: 'Electric', emoji: '\u26A1', extra: data.rvFriendliness.maxAmpService ? `${data.rvFriendliness.maxAmpService}A` : null },
                  { key: 'hasFullHookups', label: 'Full Hookups', emoji: '\u{1F50C}' },
                  { key: 'isPetFriendly', label: 'Pet Friendly', emoji: '\u{1F436}' },
                  { key: 'hasWifi', label: 'WiFi', emoji: '\u{1F4F6}' },
                  { key: 'hasShowers', label: 'Showers', emoji: '\u{1F6BF}' },
                  { key: 'isRVFriendly', label: 'RV-Friendly', emoji: '\u2705' },
                  { key: 'isWellLit', label: 'Well-Lit', emoji: '\u{1F4A1}' },
                  { key: 'hasDump', label: 'Dump Station', emoji: '\u{1F5D1}\uFE0F' },
                ].filter(f => data.rvFriendliness[f.key] !== undefined && data.rvFriendliness[f.key] !== null).map(f => (
                  <div key={f.key} className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-medium ${data.rvFriendliness[f.key] ? 'text-green-400' : 'text-red-400'}`}
                    style={{ background: data.rvFriendliness[f.key] ? 'rgba(74,175,130,0.1)' : 'rgba(239,68,68,0.1)' }}>
                    <span>{f.emoji}</span> {f.label}{f.extra ? ` (${f.extra})` : ''} {data.rvFriendliness[f.key] ? '\u2713' : '\u2717'}
                  </div>
                ))}
              </div>
              {data.rvFriendliness.cellSignalStrength && (
                <div className="mt-2 flex items-center gap-2 text-xs" style={{ color: '#8B9BB4' }}>
                  {'\u{1F4F6}'} Cell Signal: {'★'.repeat(data.rvFriendliness.cellSignalStrength)}{'☆'.repeat(5 - data.rvFriendliness.cellSignalStrength)}
                </div>
              )}
            </div>
          )}

          {/* ── COMMUNITY STATS ── */}
          {data.communityStats && (
            <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#F5F0E8' }}>{'\u{1F4CA}'} Community Intelligence</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                {[
                  { value: data.communityStats.avgRating ? `${data.communityStats.avgRating} \u2B50` : 'N/A', label: 'Avg Rating' },
                  { value: String(data.communityStats.totalReviews), label: 'Reviews' },
                  { value: String(data.communityStats.uniqueVisitorCount), label: 'Visitors' },
                  { value: String(data.communityStats.totalNightsLogged), label: 'Nights Logged' },
                  { value: data.communityStats.wouldStayAgainPct != null ? `${data.communityStats.wouldStayAgainPct}%` : 'N/A', label: 'Would Stay Again' },
                ].map(s => (
                  <div key={s.label} className="text-center p-3 rounded-xl" style={{ background: '#1A2A45' }}>
                    <p className="text-lg font-bold" style={{ color: '#E8A838' }}>{s.value}</p>
                    <p className="text-[10px]" style={{ color: '#8B9BB4' }}>{s.label}</p>
                  </div>
                ))}
              </div>
              {data.communityStats.uniqueVisitorCount > 0 && (
                <p className="text-center text-xs" style={{ color: '#E8A838' }}>
                  {data.communityStats.uniqueVisitorCount} RVUnicorn members have spent {data.communityStats.totalNightsLogged} nights here
                </p>
              )}
            </div>
          )}

          {/* ── RECENT TRAVELERS ── */}
          {data.recentVisitors?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#F5F0E8' }}>{'\u{1F465}'} Recent Travelers</h3>
              {data.friendsWhoStayed?.length > 0 && (
                <div className="flex items-center gap-2 mb-3 px-3 py-2 rounded-lg" style={{ background: 'rgba(232,168,56,0.08)' }}>
                  <span className="text-xs font-bold" style={{ color: '#E8A838' }}>Friends who stayed here</span>
                  <div className="flex -space-x-2">
                    {data.friendsWhoStayed.slice(0, 4).map((f: any) => (
                      f.avatarUrl ? <img key={f.userId} src={f.avatarUrl} className="w-6 h-6 rounded-full object-cover border-2" style={{ borderColor: '#162236' }} alt="" />
                        : <div key={f.userId} className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2" style={{ borderColor: '#162236', background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{f.firstName?.[0]}</div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide" style={{ scrollbarWidth: 'none' }}>
                {data.recentVisitors.map((v: any, i: number) => (
                  <Link key={i} to={`/profile/${v.username}`} className="flex-shrink-0 text-center w-16">
                    {v.avatarUrl ? <img src={v.avatarUrl} className="w-14 h-14 rounded-full object-cover mx-auto border-2" style={{ borderColor: '#243552' }} alt="" />
                      : <div className="w-14 h-14 rounded-full mx-auto flex items-center justify-center text-sm font-bold border-2" style={{ borderColor: '#243552', background: 'rgba(232,168,56,0.15)', color: '#E8A838' }}>{v.firstName?.[0] || '?'}</div>}
                    <p className="text-[10px] mt-1 truncate" style={{ color: '#8B9BB4' }}>{v.firstName || v.username}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── REVIEWS ── */}
          <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: '#F5F0E8' }}>{'\u2B50'} Reviews & Feedback</h3>
              {user && (
                <button onClick={() => setShowReviewModal(true)} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: '#E8A838', color: '#0F1C35' }}>
                  Write a Review
                </button>
              )}
            </div>

            {data.reviews?.length === 0 ? (
              <div className="text-center py-8">
                <span className="text-3xl block mb-2">{'\u2B50'}</span>
                <p className="text-sm" style={{ color: '#8B9BB4' }}>No reviews yet — be the first!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {data.reviews.map((r: any) => (
                  <div key={r.id} className="p-3 rounded-xl" style={{ background: '#1A2A45' }}>
                    <div className="flex items-center gap-2 mb-2">
                      {r.author?.profilePicture ? <img src={r.author.profilePicture} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{r.author?.firstName?.[0]}</div>}
                      <div className="flex-1">
                        <p className="text-xs font-semibold" style={{ color: '#F5F0E8' }}>{r.author?.firstName} {r.author?.lastName || ''}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-xs" style={{ color: '#E8A838' }}>{'★'.repeat(r.overallRating)}{'☆'.repeat(5 - r.overallRating)}</span>
                          <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{new Date(r.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                      {r.wouldStayAgain != null && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${r.wouldStayAgain ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                          {r.wouldStayAgain ? '\u2713 Would stay again' : '\u2717 Would not return'}
                        </span>
                      )}
                    </div>
                    {r.body && <p className="text-xs mb-2" style={{ color: 'rgba(245,240,232,0.7)' }}>{r.body}</p>}
                    {r.photoUrls?.length > 0 && (
                      <div className="flex gap-1 mb-2">{r.photoUrls.slice(0, 4).map((url: string, i: number) => <img key={i} src={url} className="w-14 h-14 rounded-lg object-cover" alt="" />)}</div>
                    )}
                    <button onClick={() => handleHelpful(r.id)} className="flex items-center gap-1 text-[10px] hover:opacity-80" style={{ color: '#8B9BB4' }}>
                      <ThumbsUp className="w-3 h-3" /> Helpful ({r.helpfulCount})
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── TIPS ── */}
          <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold" style={{ color: '#F5F0E8' }}>{'\u{1F4A1}'} Traveler Tips</h3>
              {user && <button onClick={() => setShowTipModal(true)} className="text-xs font-semibold" style={{ color: '#E8A838' }}>+ Add Tip</button>}
            </div>
            {data.tips?.length === 0 ? (
              <p className="text-xs text-center py-4" style={{ color: '#8B9BB4' }}>No tips yet — share yours!</p>
            ) : (
              <div className="space-y-2">
                {data.tips.map((t: any) => (
                  <div key={t.id} className="p-3 rounded-xl" style={{ background: '#1A2A45' }}>
                    <div className="flex items-start gap-2">
                      <span className="text-sm mt-0.5" style={{ color: '#E8A838' }}>{'\u{1F4A1}'}</span>
                      <div className="flex-1">
                        <p className="text-xs" style={{ color: 'rgba(245,240,232,0.7)' }}>{t.content}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{t.author?.firstName || 'RVer'} {'\u00B7'} {t.category}</span>
                          <span className="text-[10px]" style={{ color: '#8B9BB4' }}>{'\u{1F44D}'} {t.helpfulCount}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── ACTIVITY FEED ── */}
          {data.activityFeed?.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
              <h3 className="text-sm font-bold mb-3" style={{ color: '#F5F0E8' }}>{'\u{1F4CB}'} Recent Activity</h3>
              <div className="space-y-2">
                {data.activityFeed.slice(0, 10).map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 py-1.5" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <span className="text-xs">{a.activityType === 'CHECKIN' ? '\u{1F3D5}\uFE0F' : a.activityType === 'REVIEW' ? '\u2B50' : a.activityType === 'PHOTO_UPLOAD' ? '\u{1F4F8}' : a.activityType === 'PLANNED_STAY' ? '\u{1F4C5}' : '\u{1F4CB}'}</span>
                    <p className="text-xs flex-1" style={{ color: '#8B9BB4' }}>
                      {a.actor?.firstName || 'Someone'} {a.activityType === 'CHECKIN' ? 'checked in' : a.activityType === 'REVIEW' ? 'left a review' : a.activityType === 'PHOTO_UPLOAD' ? 'uploaded photos' : a.activityType === 'PLANNED_STAY' ? 'is planning to stay' : 'visited'}
                    </p>
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.3)' }}>{timeAgo(a.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── TRUST & SAFETY ── */}
          <div className="rounded-2xl p-5" style={{ background: '#162236', border: '1px solid #243552' }}>
            <h3 className="text-sm font-bold mb-3" style={{ color: '#F5F0E8' }}>{'\u{1F6E1}\uFE0F'} Trust & Safety</h3>
            <div className="grid grid-cols-2 gap-2">
              {data.trustScore?.isVerified && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-green-400" style={{ background: 'rgba(74,175,130,0.1)' }}>{'\u2713'} Verified Location</div>}
              {data.trustScore?.recentlyReviewed && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium text-orange-400" style={{ background: 'rgba(232,168,56,0.1)' }}>{'\u{1F525}'} Recently Reviewed</div>}
              {data.trustScore?.safetyScore && <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#1A2A45', color: '#8B9BB4' }}>{'\u{1F6E1}\uFE0F'} Safety: {'★'.repeat(Math.round(data.trustScore.safetyScore))}{'☆'.repeat(5 - Math.round(data.trustScore.safetyScore))}</div>}
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium" style={{ background: '#1A2A45', color: '#8B9BB4' }}>{'\u{1F4CB}'} {data.trustScore?.totalReviews || 0} reviews</div>
            </div>
          </div>
        </div>

        {/* ── REVIEW MODAL ── */}
        {showReviewModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[90vh] overflow-y-auto">
              <div className="sticky top-0 bg-white border-b px-5 py-4 flex items-center justify-between rounded-t-2xl z-10">
                <h2 className="font-bold">Write a Review</h2>
                <button onClick={() => setShowReviewModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-2">Overall Rating *</label>
                  <div className="flex gap-2">
                    {[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setReviewForm(f => ({ ...f, overallRating: n }))}
                        className={`w-10 h-10 rounded-xl text-lg transition ${reviewForm.overallRating >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>{'\u2B50'}</button>
                    ))}
                  </div>
                </div>
                {[{ key: 'cleanlinessRating', label: 'Cleanliness' }, { key: 'safetyRating', label: 'Safety' }, { key: 'noiseRating', label: 'Noise Level' }, { key: 'internetRating', label: 'Internet/Cell' }, { key: 'scenicRating', label: 'Scenery' }].map(cat => (
                  <div key={cat.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-600">{cat.label}</span>
                    <div className="flex gap-1">{[1,2,3,4,5].map(n => (
                      <button key={n} type="button" onClick={() => setReviewForm(f => ({ ...f, [cat.key]: n }))}
                        className={`w-6 h-6 rounded text-xs ${(reviewForm as any)[cat.key] >= n ? 'bg-amber-400 text-white' : 'bg-gray-100 text-gray-400'}`}>{'\u2605'}</button>
                    ))}</div>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-gray-500 block mb-1">Your Review</label>
                  <textarea value={reviewForm.body} onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))} rows={4} placeholder="What was your experience like?" className="w-full px-3 py-2 border rounded-xl text-sm resize-none" />
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setReviewForm(f => ({ ...f, wouldStayAgain: true }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${reviewForm.wouldStayAgain ? 'bg-green-600 text-white border-green-600' : 'text-gray-600 border-gray-200'}`}>{'\u{1F44D}'} Would stay again</button>
                  <button type="button" onClick={() => setReviewForm(f => ({ ...f, wouldStayAgain: false }))}
                    className={`flex-1 py-2 rounded-xl text-sm font-semibold border ${!reviewForm.wouldStayAgain ? 'bg-red-500 text-white border-red-500' : 'text-gray-600 border-gray-200'}`}>{'\u{1F44E}'} Would not return</button>
                </div>
                <button onClick={submitReview} disabled={submitting || reviewForm.overallRating === 0}
                  className="w-full py-2.5 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: '#E8A838' }}>
                  {submitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TIP MODAL ── */}
        {showTipModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold">{'\u{1F4A1}'} Add a Tip</h2>
                <button onClick={() => setShowTipModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="flex gap-1.5 flex-wrap mb-3">
                {['GENERAL', 'ARRIVAL', 'SITE', 'SIGNAL', 'HOOKUPS', 'SAFETY'].map(cat => (
                  <button key={cat} type="button" onClick={() => setTipCategory(cat)}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium border ${tipCategory === cat ? 'bg-amber-500 text-white border-amber-500' : 'border-gray-200 text-gray-600'}`}>{cat}</button>
                ))}
              </div>
              <textarea value={tipContent} onChange={e => setTipContent(e.target.value)} rows={3} placeholder="Share a tip for other RVers..." className="w-full px-3 py-2 border rounded-xl text-sm resize-none mb-3" />
              <button onClick={submitTip} disabled={submitting || !tipContent.trim()} className="w-full py-2.5 rounded-xl text-white font-semibold disabled:opacity-50" style={{ background: '#E8A838' }}>
                {submitting ? 'Adding...' : 'Add Tip'}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

function timeAgo(dateStr: string): string {
  const s = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  if (s < 604800) return `${Math.floor(s / 86400)}d`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
