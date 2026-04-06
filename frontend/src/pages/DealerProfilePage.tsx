import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { MapPin, Phone, Globe, Play, ChevronLeft, Eye, Truck } from 'lucide-react';
import api from '../services/api';

interface Listing {
  id: string; title: string; description?: string; videoUrl?: string; thumbnailUrl?: string;
  imageUrls: string[]; rigClass?: string; make?: string; model?: string; year?: number;
  price?: number; mileage?: number; condition?: string; features: string[]; viewCount: number;
}

interface Dealer {
  id: string; dealerName: string; description?: string; address?: string; city?: string;
  state?: string; phone?: string; website?: string; logoUrl?: string; bannerUrl?: string;
  isVerified: boolean; tier: string; listings: Listing[];
  user?: { firstName: string; lastName: string; profilePicture?: string };
}

const RIG_CLASSES: Record<string, string> = {
  class_a: 'Class A', class_b: 'Class B', class_c: 'Class C',
  fifth_wheel: 'Fifth Wheel', travel_trailer: 'Travel Trailer',
  pop_up: 'Pop-Up', truck_camper: 'Truck Camper', toy_hauler: 'Toy Hauler',
};

export default function DealerProfilePage() {
  const { dealerId } = useParams<{ dealerId: string }>();
  const [dealer, setDealer] = useState<Dealer | null>(null);
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (!dealerId) return;
    api.get(`/dealers/${dealerId}`).then(r => setDealer(r.data.dealer)).catch(() => {});
  }, [dealerId]);

  if (!dealer) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#F7F9FC' }}>
      <div className="animate-pulse text-[14px]" style={{ color: '#94A3B8' }}>Loading dealer...</div>
    </div>
  );

  const classes = ['all', ...new Set(dealer.listings.map(l => l.rigClass).filter(Boolean))];
  const filtered = filter === 'all' ? dealer.listings : dealer.listings.filter(l => l.rigClass === filter);

  const trackView = (listing: Listing) => {
    setSelectedListing(listing);
    api.post(`/dealers/listings/${listing.id}/view`).catch(() => {});
  };

  return (
    <div className="min-h-screen" style={{ background: '#F7F9FC', color: '#1E293B', fontFamily: "'DM Sans',sans-serif" }}>
      {/* Banner */}
      <div className="relative h-48 md:h-64" style={{ background: dealer.bannerUrl ? `url(${dealer.bannerUrl}) center/cover` : 'linear-gradient(135deg, #FFFFFF, #F7F9FC)' }}>
        <div className="absolute inset-0" style={{ background: 'linear-gradient(to bottom, transparent 40%, #F7F9FC)' }} />
        <Link to="/dealers" className="absolute top-4 left-4 flex items-center gap-1 text-[12px] px-3 py-1.5 rounded-full" style={{ background: 'rgba(0,0,0,0.4)', color: '#1E293B' }}>
          <ChevronLeft className="w-3.5 h-3.5" /> All Dealers
        </Link>
      </div>

      <div className="max-w-5xl mx-auto px-4 -mt-16 relative z-10">
        {/* Profile header */}
        <div className="flex items-end gap-4 mb-6">
          {dealer.logoUrl ? (
            <img src={dealer.logoUrl} alt={dealer.dealerName} className="w-24 h-24 rounded-xl object-cover border-4" style={{ borderColor: '#F7F9FC' }} />
          ) : (
            <div className="w-24 h-24 rounded-xl flex items-center justify-center border-4" style={{ background: '#FFFFFF', borderColor: '#F7F9FC' }}>
              <Truck className="w-10 h-10" style={{ color: '#0EA5E9' }} />
            </div>
          )}
          <div className="pb-1">
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold" style={{ fontFamily: "'Playfair Display',serif" }}>{dealer.dealerName}</h1>
              {dealer.isVerified && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#10B981' }}>Verified</span>}
            </div>
            <p className="text-[12px] mt-1" style={{ color: '#94A3B8' }}>
              {[dealer.city, dealer.state].filter(Boolean).join(', ')}
              {dealer.listings.length > 0 && <span> &middot; {dealer.listings.length} listing{dealer.listings.length !== 1 ? 's' : ''}</span>}
            </p>
          </div>
        </div>

        {/* Contact bar */}
        <div className="flex flex-wrap gap-3 mb-6">
          {dealer.phone && <a href={`tel:${dealer.phone}`} className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full" style={{ background: '#FFFFFF', color: '#0EA5E9' }}><Phone className="w-3.5 h-3.5" />{dealer.phone}</a>}
          {dealer.website && <a href={dealer.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full" style={{ background: '#FFFFFF', color: '#0EA5E9' }}><Globe className="w-3.5 h-3.5" />Website</a>}
          {dealer.address && <span className="flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full" style={{ background: '#FFFFFF', color: '#64748B' }}><MapPin className="w-3.5 h-3.5" />{dealer.address}</span>}
        </div>

        {dealer.description && <p className="text-[13px] mb-6 leading-relaxed" style={{ color: '#64748B' }}>{dealer.description}</p>}

        {/* Rig class filter */}
        {classes.length > 2 && (
          <div className="flex gap-2 overflow-x-auto mb-5 pb-1" style={{ scrollbarWidth: 'none' }}>
            {classes.map(c => (
              <button key={c!} onClick={() => setFilter(c!)} className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap transition"
                style={{ background: filter === c ? '#0EA5E9' : '#FFFFFF', color: filter === c ? '#F7F9FC' : '#64748B', fontWeight: filter === c ? 700 : 400 }}>
                {c === 'all' ? 'All RVs' : RIG_CLASSES[c!] || c}
              </button>
            ))}
          </div>
        )}

        {/* Listings grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 pb-12">
          {filtered.map(listing => (
            <div key={listing.id} onClick={() => trackView(listing)} className="rounded-xl overflow-hidden cursor-pointer transition hover:scale-[1.02]" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
              {/* Thumbnail / Video */}
              <div className="relative aspect-[4/3]" style={{ background: '#F7F9FC' }}>
                {listing.thumbnailUrl || listing.imageUrls[0] ? (
                  <img src={listing.thumbnailUrl || listing.imageUrls[0]} alt={listing.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center"><Truck className="w-12 h-12" style={{ color: 'rgba(232,168,56,0.2)' }} /></div>
                )}
                {listing.videoUrl && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)' }}>
                      <Play className="w-5 h-5 ml-0.5" style={{ color: '#1E293B' }} />
                    </div>
                  </div>
                )}
                {listing.condition && <span className="absolute top-2 left-2 text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: listing.condition === 'new' ? 'rgba(22,163,74,0.9)' : 'rgba(232,168,56,0.9)', color: '#F7F9FC' }}>{listing.condition === 'new' ? 'New' : 'Pre-Owned'}</span>}
              </div>

              <div className="p-3">
                <p className="text-[13px] font-semibold truncate" style={{ color: '#1E293B' }}>{listing.title}</p>
                <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                  {[listing.year, listing.make, listing.model].filter(Boolean).join(' ')}
                  {listing.rigClass && <span> &middot; {RIG_CLASSES[listing.rigClass] || listing.rigClass}</span>}
                </p>
                <div className="flex items-center justify-between mt-2">
                  {listing.price ? (
                    <span className="text-[15px] font-bold" style={{ color: '#0EA5E9' }}>${listing.price.toLocaleString()}</span>
                  ) : (
                    <span className="text-[12px]" style={{ color: '#94A3B8' }}>Contact for pricing</span>
                  )}
                  <span className="flex items-center gap-1 text-[10px]" style={{ color: '#94A3B8' }}>
                    <Eye className="w-3 h-3" />{listing.viewCount}
                  </span>
                </div>
                {listing.mileage && <p className="text-[10px] mt-1" style={{ color: '#94A3B8' }}>{listing.mileage.toLocaleString()} miles</p>}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Truck className="w-12 h-12 mx-auto mb-3" style={{ color: '#E2E8F0' }} />
            <p className="text-[13px]" style={{ color: '#94A3B8' }}>No listings available</p>
          </div>
        )}
      </div>

      {/* Listing detail modal */}
      {selectedListing && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={() => setSelectedListing(null)}>
          <div className="rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ background: '#F7F9FC', border: '1px solid rgba(232,168,56,0.18)' }} onClick={e => e.stopPropagation()}>
            {/* Media */}
            {selectedListing.videoUrl ? (
              <div className="aspect-video">
                <iframe src={selectedListing.videoUrl} className="w-full h-full" allowFullScreen title={selectedListing.title} />
              </div>
            ) : (selectedListing.thumbnailUrl || selectedListing.imageUrls[0]) ? (
              <img src={selectedListing.thumbnailUrl || selectedListing.imageUrls[0]} alt={selectedListing.title} className="w-full aspect-video object-cover" />
            ) : null}

            <div className="p-5">
              <h2 className="text-xl font-bold mb-1" style={{ fontFamily: "'Playfair Display',serif" }}>{selectedListing.title}</h2>
              <p className="text-[12px] mb-3" style={{ color: '#94A3B8' }}>
                {[selectedListing.year, selectedListing.make, selectedListing.model].filter(Boolean).join(' ')}
                {selectedListing.rigClass && ` \u2022 ${RIG_CLASSES[selectedListing.rigClass] || selectedListing.rigClass}`}
                {selectedListing.mileage && ` \u2022 ${selectedListing.mileage.toLocaleString()} mi`}
              </p>

              {selectedListing.price && <p className="text-2xl font-bold mb-4" style={{ color: '#0EA5E9' }}>${selectedListing.price.toLocaleString()}</p>}

              {selectedListing.description && <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#64748B' }}>{selectedListing.description}</p>}

              {selectedListing.features.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-4">
                  {selectedListing.features.map(f => (
                    <span key={f} className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: '#E2E8F0', color: '#38BDF8' }}>{f}</span>
                  ))}
                </div>
              )}

              {/* Image gallery */}
              {selectedListing.imageUrls.length > 1 && (
                <div className="grid grid-cols-3 gap-2 mb-4">
                  {selectedListing.imageUrls.map((url, i) => (
                    <img key={i} src={url} alt="" className="rounded-lg aspect-square object-cover" />
                  ))}
                </div>
              )}

              <div className="flex gap-3 mt-4">
                {dealer.phone && (
                  <a href={`tel:${dealer.phone}`} onClick={() => api.post(`/dealers/listings/${selectedListing.id}/inquiry`).catch(() => {})}
                    className="flex-1 py-3 rounded-xl text-[13px] font-bold text-center transition hover:brightness-110" style={{ background: '#F97316', color: 'white' }}>
                    <Phone className="w-4 h-4 inline mr-1.5" />Call Dealer
                  </a>
                )}
                {dealer.website && (
                  <a href={dealer.website} target="_blank" rel="noopener noreferrer"
                    className="flex-1 py-3 rounded-xl text-[13px] font-bold text-center transition hover:brightness-110" style={{ background: '#0EA5E9', color: '#F7F9FC' }}>
                    <Globe className="w-4 h-4 inline mr-1.5" />Visit Website
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
