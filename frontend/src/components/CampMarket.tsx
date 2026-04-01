import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, X, Tag, MapPin, Clock, Send, CheckCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { CampMarketRepBadge } from './CampMarketProfile';
import CampMarketFeedbackModal from './CampMarketFeedbackModal';

interface Listing {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  imageUrl: string | null;
  siteNumber: string | null;
  isFree: boolean;
  completedBuyerId?: string | null;
  expiresAt: string;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
  _count?: { interests: number };
}

interface InterestedBuyer {
  id: string;
  buyerId: string;
  buyer: { id: string; firstName: string; lastName: string; username: string; profilePicture?: string };
}

interface Props {
  campgroundId: string;
  compact?: boolean;
}

export default function CampMarket({ campgroundId, compact = false }: Props) {
  const { user } = useAuth() as any;
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [interestSent, setInterestSent] = useState<Set<string>>(new Set());

  // Mark as Sold modal
  const [soldListingId, setSoldListingId] = useState<string | null>(null);
  const [interestedBuyers, setInterestedBuyers] = useState<InterestedBuyer[]>([]);
  const [loadingBuyers, setLoadingBuyers] = useState(false);
  const [completingWith, setCompletingWith] = useState<string | null>(null);

  // Feedback modal
  const [feedbackListing, setFeedbackListing] = useState<{ id: string; title: string; otherName: string; otherPic?: string } | null>(null);

  // Pending feedback banner
  const [pendingFeedback, setPendingFeedback] = useState<any[]>([]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [siteNumber, setSiteNumber] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    api.get(`/camp-market/${campgroundId}`)
      .then(({ data }) => setListings(data.listings))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [campgroundId]);

  // Load pending feedback
  useEffect(() => {
    if (!user) return;
    api.get('/camp-market/pending-feedback/me')
      .then(({ data }) => setPendingFeedback(data.pending || []))
      .catch(() => {});
  }, [user]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('title', title.trim());
      if (description.trim()) formData.append('description', description.trim());
      if (price) formData.append('price', price);
      if (siteNumber.trim()) formData.append('siteNumber', siteNumber.trim());
      if (imageFile) formData.append('image', imageFile);

      const { data } = await api.post(`/camp-market/${campgroundId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setListings(prev => [data.listing, ...prev]);
      setShowForm(false);
      setTitle(''); setDescription(''); setPrice(''); setSiteNumber('');
      setImageFile(null); setImagePreview(null);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create listing');
    } finally { setSubmitting(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this listing?')) return;
    try {
      await api.delete(`/camp-market/listing/${id}`);
      setListings(prev => prev.filter(l => l.id !== id));
    } catch (e) { console.error(e); }
  };

  const handleInterest = async (listing: Listing) => {
    try {
      await api.post(`/camp-market/listing/${listing.id}/interest`);
      setInterestSent(prev => new Set(prev).add(listing.id));
    } catch (e) { console.error(e); }
  };

  const openMarkSold = async (listingId: string) => {
    setSoldListingId(listingId);
    setLoadingBuyers(true);
    try {
      const { data } = await api.get(`/camp-market/listing/${listingId}/interests`);
      setInterestedBuyers(data.interests || []);
    } catch (e) { console.error(e); }
    finally { setLoadingBuyers(false); }
  };

  const completeSale = async (buyerId: string) => {
    if (!soldListingId) return;
    setCompletingWith(buyerId);
    try {
      await api.post(`/camp-market/listing/${soldListingId}/complete`, { buyerId });
      setListings(prev => prev.filter(l => l.id !== soldListingId));
      setSoldListingId(null);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to complete sale');
    } finally { setCompletingWith(null); }
  };

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-orange-500" />
            <span className="font-semibold text-gray-900 text-sm">Camp Market</span>
            {listings.length > 0 && (
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-1.5 py-0.5 rounded-full">{listings.length}</span>
            )}
          </div>
        </div>
        {listings.length === 0 ? (
          <p className="text-xs text-gray-400">No items listed at this campground</p>
        ) : (
          <div className="space-y-2">
            {listings.slice(0, 3).map(l => (
              <div key={l.id} className="flex items-center gap-2 text-sm">
                {l.isFree ? (
                  <span className="text-xs font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded">FREE</span>
                ) : (
                  <span className="text-xs font-bold text-gray-700">${l.price?.toFixed(2)}</span>
                )}
                <span className="text-gray-700 truncate flex-1">{l.title}</span>
              </div>
            ))}
            {listings.length > 3 && <p className="text-xs text-orange-500 font-medium">+{listings.length - 3} more</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-white" />
            <h3 className="text-white font-bold">Camp Market</h3>
            {listings.length > 0 && (
              <span className="bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">{listings.length}</span>
            )}
          </div>
          {user && (
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 text-white px-3 py-1.5 rounded-xl text-sm font-semibold transition"
            >
              <Plus className="w-4 h-4" /> Post Item
            </button>
          )}
        </div>
        <p className="text-orange-100 text-xs mt-1">Buy, sell, or share with fellow campers</p>
      </div>

      {/* Pending feedback banner */}
      {pendingFeedback.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 flex items-center justify-between">
          <p className="text-xs text-amber-800 font-medium">
            <span className="mr-1">⏰</span>
            You have {pendingFeedback.length} feedback request{pendingFeedback.length !== 1 ? 's' : ''} pending
          </p>
          <button
            onClick={() => {
              const p = pendingFeedback[0];
              if (p) setFeedbackListing({ id: p.listingId, title: p.title, otherName: p.otherParty.firstName || 'Camper', otherPic: p.otherParty.profilePicture });
            }}
            className="text-xs text-amber-700 font-semibold hover:text-amber-900"
          >
            Leave Feedback
          </button>
        </div>
      )}

      {/* Listings */}
      <div className="p-4">
        {listings.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-3xl mb-2">🛒</div>
            <p className="text-sm text-gray-500">No items for sale right now — got something to share with fellow campers?</p>
            {user && (
              <button onClick={() => setShowForm(true)} className="mt-3 bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:bg-orange-600 transition">
                Post First Item
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {listings.map(listing => (
              <div key={listing.id} className="border border-gray-100 rounded-xl overflow-hidden hover:border-orange-200 transition">
                <div className="flex gap-3 p-3">
                  {listing.imageUrl && (
                    <img src={listing.imageUrl} alt={listing.title} className="w-20 h-20 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-gray-900 text-sm leading-snug">{listing.title}</h4>
                      {listing.isFree ? (
                        <span className="flex-shrink-0 text-xs font-bold text-green-700 bg-green-100 px-2 py-0.5 rounded-full">FREE</span>
                      ) : (
                        <span className="flex-shrink-0 text-sm font-bold text-gray-900">${listing.price?.toFixed(2)}</span>
                      )}
                    </div>
                    {listing.description && (
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">{listing.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        {listing.user.profilePicture ? (
                          <img src={listing.user.profilePicture} className="w-5 h-5 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700">{listing.user.firstName[0]}</div>
                        )}
                        <span className="text-xs text-gray-500">{listing.user.firstName}</span>
                      </div>
                      <CampMarketRepBadge userId={listing.user.id} />
                      {listing.siteNumber && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <MapPin className="w-3 h-3" /> Site {listing.siteNumber}
                        </span>
                      )}
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Clock className="w-3 h-3" /> Expires {formatDistanceToNow(new Date(listing.expiresAt), { addSuffix: true })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-2">
                      {user && user.id !== listing.user.id && (
                        interestSent.has(listing.id) ? (
                          <span className="text-xs text-green-600 font-medium">Sent!</span>
                        ) : (
                          <button
                            onClick={() => handleInterest(listing)}
                            className="flex items-center gap-1 text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-2.5 py-1 rounded-lg font-semibold transition"
                          >
                            <Send className="w-3 h-3" /> I'm Interested
                          </button>
                        )
                      )}
                      {user && user.id === listing.user.id && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openMarkSold(listing.id)}
                            className="flex items-center gap-1 text-xs bg-green-50 text-green-600 hover:bg-green-100 px-2.5 py-1 rounded-lg font-semibold transition"
                          >
                            <CheckCircle className="w-3 h-3" /> Mark as Sold
                          </button>
                          <button
                            onClick={() => handleDelete(listing.id)}
                            className="text-xs text-red-400 hover:text-red-600 transition"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mark as Sold Modal */}
      {soldListingId && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setSoldListingId(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Mark as Sold</h2>
              <button onClick={() => setSoldListingId(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5">
              {loadingBuyers ? (
                <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />
              ) : interestedBuyers.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">No one has expressed interest yet.</p>
              ) : (
                <>
                  <p className="text-xs text-gray-500 mb-3">Select who you completed the trade with:</p>
                  <div className="space-y-2">
                    {interestedBuyers.map(interest => (
                      <button
                        key={interest.id}
                        onClick={() => completeSale(interest.buyerId)}
                        disabled={completingWith !== null}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-green-300 hover:bg-green-50 transition text-left disabled:opacity-50"
                      >
                        {interest.buyer.profilePicture ? (
                          <img src={interest.buyer.profilePicture} className="w-8 h-8 rounded-full object-cover" alt="" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-orange-200 flex items-center justify-center text-sm font-bold text-orange-700">{interest.buyer.firstName[0]}</div>
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-gray-800">{interest.buyer.firstName} {interest.buyer.lastName}</p>
                          <p className="text-xs text-gray-400">@{interest.buyer.username}</p>
                        </div>
                        {completingWith === interest.buyerId ? (
                          <span className="text-xs text-green-600">Completing...</span>
                        ) : (
                          <CheckCircle className="w-5 h-5 text-gray-300" />
                        )}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Listing Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h2 className="font-bold text-gray-900">Post an Item</h2>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Title *</label>
                <input
                  value={title} onChange={e => setTitle(e.target.value)} placeholder="What are you selling or giving away?"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Description</label>
                <textarea
                  value={description} onChange={e => setDescription(e.target.value)} placeholder="Details, condition, etc."
                  rows={3} className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                    <Tag className="w-3 h-3 inline mr-1" />Price
                  </label>
                  <input
                    value={price} onChange={e => setPrice(e.target.value)} placeholder="Free if blank"
                    type="number" step="0.01" min="0"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                    <MapPin className="w-3 h-3 inline mr-1" />Site #
                  </label>
                  <input
                    value={siteNumber} onChange={e => setSiteNumber(e.target.value)} placeholder="e.g. A-12"
                    className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Photo</label>
                {imagePreview ? (
                  <div className="relative">
                    <img src={imagePreview} className="w-full h-40 object-cover rounded-xl" alt="" />
                    <button onClick={() => { setImageFile(null); setImagePreview(null); }}
                      className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"><X className="w-4 h-4" /></button>
                  </div>
                ) : (
                  <label className="flex items-center justify-center w-full h-24 border-2 border-dashed border-gray-200 rounded-xl cursor-pointer hover:border-orange-300 transition">
                    <span className="text-sm text-gray-400">Tap to add photo</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                )}
              </div>
              <button
                onClick={handleSubmit}
                disabled={!title.trim() || submitting}
                className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 disabled:opacity-50 transition"
              >
                {submitting ? 'Posting...' : 'Post Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {feedbackListing && (
        <CampMarketFeedbackModal
          listingId={feedbackListing.id}
          listingTitle={feedbackListing.title}
          otherPartyName={feedbackListing.otherName}
          otherPartyPicture={feedbackListing.otherPic}
          onClose={() => setFeedbackListing(null)}
          onSubmitted={() => {
            setPendingFeedback(prev => prev.filter(p => p.listingId !== feedbackListing.id));
          }}
        />
      )}
    </div>
  );
}
