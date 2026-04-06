import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Truck, ChevronRight } from 'lucide-react';
import api from '../services/api';

const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

interface Dealer {
  id: string; dealerName: string; description?: string; city?: string; state?: string;
  logoUrl?: string; isVerified: boolean; listings: { id: string; thumbnailUrl?: string; imageUrls: string[]; title: string; price?: number }[];
}

export default function DealersPage() {
  const [dealers, setDealers] = useState<Dealer[]>([]);
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (state) params.set('state', state);
    api.get(`/dealers?${params}`).then(r => {
      setDealers(r.data.dealers || []);
      setTotalPages(r.data.pages || 1);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [state, page]);

  return (
    <div className="min-h-screen px-4 py-8" style={{ background: '#F7F9FC', color: '#1E293B', fontFamily: "'DM Sans',sans-serif" }}>
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display',serif" }}>RV Dealers</h1>
          <p className="text-[13px]" style={{ color: '#64748B' }}>Browse verified dealers and find your next rig</p>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <select value={state} onChange={e => { setState(e.target.value); setPage(1); }}
            className="px-3 py-2 rounded-lg text-[13px]" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0', color: '#1E293B' }}>
            <option value="">All States</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="text-center py-16">
            <div className="animate-pulse text-[13px]" style={{ color: '#94A3B8' }}>Loading dealers...</div>
          </div>
        ) : dealers.length === 0 ? (
          <div className="text-center py-16">
            <Truck className="w-16 h-16 mx-auto mb-4" style={{ color: 'rgba(245,240,232,0.1)' }} />
            <p className="text-[14px] font-medium mb-2">No dealers yet</p>
            <p className="text-[12px]" style={{ color: '#94A3B8' }}>Are you an RV dealer? <Link to="/dealer-signup" className="underline" style={{ color: '#0EA5E9' }}>List your inventory</Link></p>
          </div>
        ) : (
          <div className="space-y-4">
            {dealers.map(dealer => (
              <Link key={dealer.id} to={`/dealers/${dealer.id}`} className="block rounded-xl p-4 transition hover:brightness-110" style={{ background: '#FFFFFF', border: '1px solid #E2E8F0' }}>
                <div className="flex gap-4">
                  {dealer.logoUrl ? (
                    <img src={dealer.logoUrl} alt={dealer.dealerName} className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-16 h-16 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E2E8F0' }}>
                      <Truck className="w-7 h-7" style={{ color: '#0EA5E9' }} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="text-[15px] font-bold truncate">{dealer.dealerName}</h2>
                      {dealer.isVerified && <span className="text-[9px] px-1.5 py-0.5 rounded-full font-bold" style={{ background: 'rgba(22,163,74,0.1)', color: '#10B981' }}>Verified</span>}
                      <ChevronRight className="w-4 h-4 ml-auto flex-shrink-0" style={{ color: '#CBD5E1' }} />
                    </div>
                    <p className="text-[11px] mt-0.5" style={{ color: '#94A3B8' }}>
                      {[dealer.city, dealer.state].filter(Boolean).join(', ')}
                      {dealer.listings.length > 0 && ` \u2022 ${dealer.listings.length} listing${dealer.listings.length !== 1 ? 's' : ''}`}
                    </p>
                    {dealer.description && <p className="text-[11px] mt-1 line-clamp-1" style={{ color: '#64748B' }}>{dealer.description}</p>}
                  </div>
                </div>

                {/* Preview thumbnails */}
                {dealer.listings.length > 0 && (
                  <div className="flex gap-2 mt-3 overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
                    {dealer.listings.slice(0, 4).map(l => (
                      <div key={l.id} className="flex-shrink-0 w-28">
                        <div className="aspect-[4/3] rounded-lg overflow-hidden" style={{ background: '#F7F9FC' }}>
                          {(l.thumbnailUrl || l.imageUrls[0]) ? (
                            <img src={l.thumbnailUrl || l.imageUrls[0]} alt={l.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center"><Truck className="w-6 h-6" style={{ color: 'rgba(232,168,56,0.15)' }} /></div>
                          )}
                        </div>
                        <p className="text-[10px] mt-1 truncate" style={{ color: '#94A3B8' }}>{l.title}</p>
                        {l.price && <p className="text-[10px] font-bold" style={{ color: '#0EA5E9' }}>${l.price.toLocaleString()}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg text-[12px] font-medium transition"
                style={{ background: p === page ? '#0EA5E9' : '#FFFFFF', color: p === page ? '#F7F9FC' : '#64748B' }}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
