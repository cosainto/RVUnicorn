import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Star, MapPin, ExternalLink, Plus, Filter, Leaf } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const HOST_TYPES = ['All', 'WINERY', 'BREWERY', 'FARM', 'DISTILLERY', 'RANCH', 'MUSEUM', 'OTHER'];
const HOST_ICONS: Record<string, string> = {
  WINERY: '🍷', BREWERY: '🍺', FARM: '🌾', DISTILLERY: '🥃',
  RANCH: '🐄', MUSEUM: '🏛️', OTHER: '🌿',
};

interface Props {
  campgroundLat?: number;
  campgroundLng?: number;
  campgroundState?: string;
  onAddAsWaypoint?: (host: any) => void;
  onAddAsDestination?: (host: any) => void;
}

export default function HarvestHostsTab({ campgroundLat, campgroundLng, campgroundState, onAddAsWaypoint, onAddAsDestination }: Props) {
  const { user } = useAuth();
  const [hosts, setHosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, content: '' });
  const [submitting, setSubmitting] = useState(false);

  const [addForm, setAddForm] = useState({
    name: '', hostType: 'WINERY', description: '', address: '',
    city: '', state: campgroundState || '', latitude: '', longitude: '',
    website: '', phone: '', maxRvLength: '', hookups: false, requiresMembership: true,
  });
  const [listingMode, setListingMode] = useState<'url' | 'manual'>('url');
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scraping, setScraping] = useState(false);
  const [scrapeError, setScrapeError] = useState('');
  const [networkType, setNetworkType] = useState('HARVEST_HOSTS');

  const NETWORKS = [
    { id: 'HARVEST_HOSTS', label: 'Harvest Hosts', url: 'https://harvesthosts.com', icon: '🍷', color: 'bg-green-100 text-green-800 border-green-300' },
    { id: 'BOONDOCKERS', label: "Boondockers Welcome", url: 'https://boondockerswelcome.com', icon: '🏕️', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    { id: 'RV_OVERNIGHTERS', label: 'RV Overnighters', url: 'https://rvovernighters.com', icon: '🌙', color: 'bg-purple-100 text-purple-800 border-purple-300' },
    { id: 'IOVERLANDER', label: 'iOverlander', url: 'https://ioverlander.com', icon: '🗺️', color: 'bg-orange-100 text-orange-800 border-orange-300' },
  ];

  useEffect(() => {
    fetchHosts();
  }, [campgroundLat, campgroundLng, campgroundState]);

  const fetchHosts = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (campgroundLat && campgroundLng) {
        params.append('lat', campgroundLat.toString());
        params.append('lng', campgroundLng.toString());
        params.append('radius', '75');
      } else if (campgroundState) {
        params.append('state', campgroundState);
      }
      const { data } = await api.get('/harvest-hosts?' + params.toString());
      setHosts(data);
    } catch (err) {
      console.error('Failed to fetch harvest hosts:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (hostId: string) => {
    setSubmitting(true);
    try {
      const { data } = await api.post('/harvest-hosts/' + hostId + '/reviews', reviewForm);
      setHosts(prev => prev.map(h => h.id === hostId ? {
        ...h,
        reviews: [data, ...(h.reviews || []).filter((r: any) => r.userId !== user?.id)],
        avgRating: null, // will recalculate on next fetch
      } : h));
      setReviewingId(null);
      setReviewForm({ rating: 5, content: '' });
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const handleSubmitHost = async () => {
    if (!addForm.name || !addForm.address || !addForm.latitude || !addForm.longitude) {
      alert('Name, address, latitude and longitude are required');
      return;
    }
    setSubmitting(true);
    try {
      const { data } = await api.post('/harvest-hosts', addForm);
      setHosts(prev => [{ ...data, reviews: [], avgRating: null }, ...prev]);
      setShowAddForm(false);
    } catch (err) { console.error(err); }
    finally { setSubmitting(false); }
  };

  const filtered = filter === 'All' ? hosts : hosts.filter(h => h.hostType === filter);

  const renderStars = (rating: number | null, interactive = false, onChange?: (r: number) => void) => (
    <div className="flex gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star
          key={i}
          className={'w-4 h-4 ' + (i <= Math.round(rating || 0) ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200') + (interactive ? ' cursor-pointer hover:scale-110 transition-transform' : '')}
          onClick={interactive && onChange ? () => onChange(i) : undefined}
        />
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1773413639/rv-host-networks-icon.png" alt="RV Host Networks" className="w-6 h-6 rounded-full object-cover" /> RV Host Networks
          </h3>
          <p className="text-sm text-gray-500 mt-0.5">
            Wineries, farms, driveways &amp; more that welcome RV overnight stays
          </p>
        </div>
        {user && (
          <button onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition">
            <Plus className="w-4 h-4" /> List Your Location
          </button>
        )}
      </div>

      {/* Network partner banner */}
      {!showAddForm && (
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-5 mb-4">
          <p className="text-sm font-bold text-gray-800 mb-1">🦄 Are you an RV host?</p>
          <p className="text-sm text-gray-600 mb-3">
            RVUnicorn matches your location with thousands of RV travelers — whether they're looking for a short overnight stop or a destination along their route. List your spot and get discovered.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {NETWORKS.map(n => (
              <a key={n.id} href={n.url} target="_blank" rel="noopener noreferrer"
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold ${n.color} hover:opacity-80 transition`}>
                <span>{n.icon}</span>{n.label}
              </a>
            ))}
          </div>
          <p className="text-xs text-gray-500">Already a member of one of these networks? Click <strong>List Your Location</strong> above and paste your listing URL — we'll do the rest.</p>
        </div>
      )}

      {/* Add host form */}
      {showAddForm && (
        <div className="bg-green-50 rounded-xl border border-green-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-gray-900">List Your RV Host Location</p>
            <button onClick={() => setShowAddForm(false)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
          </div>
          <p className="text-xs text-gray-500">RVUnicorn will use your information to match with our users and recommend your spot as a destination or overnight stop along their route.</p>

          {/* Network selector */}
          <div>
            <label className="text-xs text-gray-500 font-medium block mb-1">Which network are you part of?</label>
            <div className="flex flex-wrap gap-2">
              {NETWORKS.map(n => (
                <button key={n.id} onClick={() => setNetworkType(n.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${networkType === n.id ? n.color + ' ring-2 ring-offset-1 ring-green-400' : 'bg-white text-gray-600 border-gray-200'}`}>
                  {n.icon} {n.label}
                </button>
              ))}
              <button onClick={() => setNetworkType('INDEPENDENT')}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${networkType === 'INDEPENDENT' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200'}`}>
                🏠 Independent
              </button>
            </div>
          </div>

          {/* Mode toggle */}
          <div className="flex gap-2">
            <button onClick={() => setListingMode('url')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${listingMode === 'url' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              🔗 Paste My Listing URL
            </button>
            <button onClick={() => setListingMode('manual')}
              className={`flex-1 py-2 rounded-lg text-sm font-medium border transition ${listingMode === 'manual' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-gray-600 border-gray-200'}`}>
              ✏️ Enter Info Manually
            </button>
          </div>

          {listingMode === 'url' && (
            <div className="space-y-2">
              <label className="text-xs text-gray-500 font-medium">Your listing URL</label>
              <div className="flex gap-2">
                <input value={scrapeUrl} onChange={e => { setScrapeUrl(e.target.value); setScrapeError(''); }}
                  placeholder="https://harvesthosts.com/locations/your-place"
                  className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2" />
                <button onClick={async () => {
                  if (!scrapeUrl) return;
                  setScraping(true); setScrapeError('');
                  try {
                    const res = await api.post('/harvest-hosts/scrape', { url: scrapeUrl, networkType });
                    if (res.data.success) {
                      alert('✅ Your location has been submitted! Our team will review and publish it shortly.');
                      setShowAddForm(false); setScrapeUrl('');
                    } else {
                      setScrapeError(res.data.error || 'Could not read that URL. Try entering manually.');
                    }
                  } catch { setScrapeError('Could not read that URL. Try entering info manually instead.'); }
                  finally { setScraping(false); }
                }} disabled={scraping}
                  className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition whitespace-nowrap">
                  {scraping ? '⏳ Loading...' : '🔍 Import'}
                </button>
              </div>
              {scrapeError && <p className="text-xs text-red-600">{scrapeError}</p>}
              <p className="text-xs text-gray-400">We'll pull your name, location, description and amenities automatically. You can review before it goes live.</p>
            </div>
          )}

          {listingMode === 'manual' && (
          <div className="grid grid-cols-2 gap-3">
          <p className="col-span-2 text-sm font-bold text-gray-900">Submit a Host Location</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-500 font-medium">Name *</label>
              <input value={addForm.name} onChange={e => setAddForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sunny Valley Winery" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Type *</label>
              <select value={addForm.hostType} onChange={e => setAddForm(f => ({ ...f, hostType: e.target.value }))}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white">
                {HOST_TYPES.filter(t => t !== 'All').map(t => (
                  <option key={t} value={t}>{HOST_ICONS[t]} {t}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-500 font-medium">Address *</label>
              <input value={addForm.address} onChange={e => setAddForm(f => ({ ...f, address: e.target.value }))}
                placeholder="123 Vineyard Rd" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">City</label>
              <input value={addForm.city} onChange={e => setAddForm(f => ({ ...f, city: e.target.value }))}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">State</label>
              <input value={addForm.state} onChange={e => setAddForm(f => ({ ...f, state: e.target.value }))}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Latitude *</label>
              <input value={addForm.latitude} onChange={e => setAddForm(f => ({ ...f, latitude: e.target.value }))}
                placeholder="38.1234" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Longitude *</label>
              <input value={addForm.longitude} onChange={e => setAddForm(f => ({ ...f, longitude: e.target.value }))}
                placeholder="-122.1234" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Website</label>
              <input value={addForm.website} onChange={e => setAddForm(f => ({ ...f, website: e.target.value }))}
                placeholder="https://..." className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Max RV Length (ft)</label>
              <input value={addForm.maxRvLength} onChange={e => setAddForm(f => ({ ...f, maxRvLength: e.target.value }))}
                type="number" placeholder="40" className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2" />
            </div>
            <div>
              <label className="text-xs text-gray-500 font-medium">Description</label>
              <textarea value={addForm.description} onChange={e => setAddForm(f => ({ ...f, description: e.target.value }))}
                rows={2} className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none col-span-2" />
            </div>
          </div>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={addForm.hookups} onChange={e => setAddForm(f => ({ ...f, hookups: e.target.checked }))} className="rounded" />
              Has hookups
            </label>
            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
              <input type="checkbox" checked={addForm.requiresMembership} onChange={e => setAddForm(f => ({ ...f, requiresMembership: e.target.checked }))} className="rounded" />
              Requires membership
            </label>
          </div>
          <div className="flex gap-2">
            <button onClick={handleSubmitHost} disabled={submitting}
              className="flex-1 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 disabled:opacity-50 transition">
              {submitting ? 'Submitting...' : 'Submit Host'}
            </button>
            <button onClick={() => setShowAddForm(false)} className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg">Cancel</button>
          </div>
          </div>
          )}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <Filter className="w-4 h-4 text-gray-400 shrink-0" />
        {HOST_TYPES.map(t => (
          <button key={t} onClick={() => setFilter(t)}
            className={'shrink-0 text-xs font-medium px-3 py-1.5 rounded-full transition ' + (filter === t ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200')}>
            {t !== 'All' ? HOST_ICONS[t] + ' ' : ''}{t === 'All' ? 'All' : t.charAt(0) + t.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Host list */}
      {loading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading harvest hosts...</div>
      ) : filtered.length === 0 ? (
        <div className="py-12 text-center bg-green-50 rounded-xl border border-green-100">
          <p className="text-3xl mb-2">🌾</p>
          <p className="text-sm font-medium text-gray-600">No harvest hosts found nearby</p>
          <p className="text-xs text-gray-400 mt-1">Know of one? Click "Add Host" to submit it!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(host => {
            const isExpanded = expandedId === host.id;
            const isReviewing = reviewingId === host.id;
            return (
              <div key={host.id} className={'rounded-xl border overflow-hidden transition-all ' + (isExpanded ? 'shadow-md bg-green-50 border-green-200' : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm')}>
                <div className="p-4 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : host.id)}>
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">{HOST_ICONS[host.hostType] || '🌿'}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900">{host.name}</p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                          {host.hostType.charAt(0) + host.hostType.slice(1).toLowerCase()}
                        </span>
                        {host.requiresMembership && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Members only</span>
                        )}
                        {host.hookups && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">⚡ Hookups</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">{host.city}{host.state ? ', ' + host.state : ''}{host.maxRvLength ? ' · Max ' + host.maxRvLength + 'ft' : ''}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        {renderStars(host.avgRating)}
                        <span className="text-xs text-gray-400">({host._count?.reviews || 0} reviews)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {onAddAsWaypoint && (
                        <button onClick={e => { e.stopPropagation(); onAddAsWaypoint(host); }}
                          className="text-xs px-2 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium whitespace-nowrap">
                          + Waypoint
                        </button>
                      )}
                      {onAddAsDestination && (
                        <button onClick={e => { e.stopPropagation(); onAddAsDestination(host); }}
                          className="text-xs px-2 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium whitespace-nowrap">
                          Set Destination
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3 border-t border-green-100 pt-3">
                    {host.description && <p className="text-xs text-gray-600 leading-relaxed">{host.description}</p>}
                    <div className="flex flex-wrap gap-2">
                      {host.website && (
                        <a href={host.website} target="_blank" rel="noopener noreferrer"
                          className="text-xs flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-blue-600 hover:bg-blue-50">
                          <ExternalLink className="w-3 h-3" /> Website
                        </a>
                      )}
                      <a href={'https://www.google.com/maps/search/?api=1&query=' + host.latitude + ',' + host.longitude} target="_blank" rel="noopener noreferrer"
                        className="text-xs flex items-center gap-1 px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-green-600 hover:bg-green-50">
                        <MapPin className="w-3 h-3" /> Directions
                      </a>
                    </div>

                    {/* Reviews */}
                    {host.reviews?.length > 0 && (
                      <div>
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Reviews</p>
                        {host.reviews.slice(0, 3).map((r: any) => (
                          <div key={r.id} className="text-xs bg-white rounded-lg p-3 border border-gray-100 mb-2">
                            {renderStars(r.rating)}
                            {r.content && <p className="text-gray-600 mt-1">{r.content}</p>}
                            <p className="text-gray-400 mt-1">{r.user?.firstName}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {user && (
                      <button onClick={() => setReviewingId(isReviewing ? null : host.id)}
                        className="w-full py-2 text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 rounded-lg hover:bg-yellow-100 transition">
                        ⭐ Write a Review
                      </button>
                    )}

                    {isReviewing && user && (
                      <div className="bg-white rounded-xl border border-yellow-200 p-3 space-y-2">
                        <div>
                          <label className="text-xs text-gray-500">Rating</label>
                          {renderStars(reviewForm.rating, true, r => setReviewForm(f => ({ ...f, rating: r })))}
                        </div>
                        <textarea value={reviewForm.content} onChange={e => setReviewForm(f => ({ ...f, content: e.target.value }))}
                          placeholder="Share your experience..." rows={2}
                          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none" />
                        <div className="flex gap-2">
                          <button onClick={() => handleSubmitReview(host.id)} disabled={submitting}
                            className="flex-1 py-2 bg-yellow-500 text-white text-sm font-semibold rounded-lg hover:bg-yellow-600 disabled:opacity-50">
                            {submitting ? 'Submitting...' : 'Submit'}
                          </button>
                          <button onClick={() => setReviewingId(null)} className="px-3 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
