import { useState, useEffect } from 'react';
import { MapPin, Phone, Globe, Clock, ChevronRight } from 'lucide-react';
import api from '../services/api';

const CATEGORY_ICONS: Record<string, string> = {
  restaurant: '\u{1F354}', gas_station: '\u26FD', grocery: '\u{1F6D2}', outdoor_gear: '\u{1F3D5}',
  activities: '\u{1F3AF}', brewery: '\u{1F37A}', coffee: '\u2615', laundry: '\u{1F9FA}',
  repair: '\u{1F527}', entertainment: '\u{1F3AC}', other: '\u{1F4CD}',
};

const CATEGORY_LABELS: Record<string, string> = {
  restaurant: 'Restaurant', gas_station: 'Gas Station', grocery: 'Grocery', outdoor_gear: 'Outdoor Gear',
  activities: 'Activities', brewery: 'Brewery', coffee: 'Coffee', laundry: 'Laundry',
  repair: 'Repair', entertainment: 'Entertainment', other: 'Other',
};

interface Business {
  id: string; name: string; description?: string; category: string; address?: string;
  city?: string; state?: string; phone?: string; website?: string; imageUrl?: string;
  hoursOfOperation?: string; priceRange?: string; distanceMiles?: number;
}

export default function NearbyBusinesses({ campgroundId }: { campgroundId: string }) {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get(`/local-business/near/${campgroundId}`).then(r => setBusinesses(r.data?.businesses || [])).catch(() => {});
  }, [campgroundId]);

  if (businesses.length === 0) return null;

  const categories = ['all', ...new Set(businesses.map(b => b.category))];
  const filtered = filter === 'all' ? businesses : businesses.filter(b => b.category === filter);

  return (
    <div className="rounded-xl overflow-hidden" style={{ background: '#F7F9FC', border: '1px solid #E2E8F0' }}>
      <div className="p-4 flex items-center justify-between" style={{ borderBottom: '1px solid #E2E8F0' }}>
        <h3 className="text-[15px] font-bold" style={{ color: '#1E293B' }}>
          <MapPin className="w-4 h-4 inline mr-1.5" style={{ color: '#0EA5E9' }} />
          Near This Campground
        </h3>
        <span className="text-[11px]" style={{ color: '#94A3B8' }}>{businesses.length} businesses</span>
      </div>

      {/* Category filter pills */}
      <div className="px-4 pt-3 flex gap-2 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className="text-[11px] px-3 py-1 rounded-full whitespace-nowrap transition"
            style={{
              background: filter === cat ? '#0EA5E9' : '#FFFFFF',
              color: filter === cat ? '#F7F9FC' : '#64748B',
              border: filter === cat ? 'none' : '1px solid #E2E8F0',
              fontWeight: filter === cat ? 700 : 400,
            }}>
            {cat === 'all' ? 'All' : `${CATEGORY_ICONS[cat] || ''} ${CATEGORY_LABELS[cat] || cat}`}
          </button>
        ))}
      </div>

      {/* Business cards */}
      <div className="p-4 space-y-3">
        {filtered.slice(0, 8).map(b => (
          <div key={b.id} className="flex gap-3 p-3 rounded-lg transition hover:brightness-110" style={{ background: '#FFFFFF' }}>
            {b.imageUrl ? (
              <img src={b.imageUrl} alt={b.name} className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#E2E8F0' }}>
                <span className="text-xl">{CATEGORY_ICONS[b.category] || '\u{1F4CD}'}</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[13px] font-semibold truncate" style={{ color: '#1E293B' }}>{b.name}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: '#94A3B8' }}>
                    {CATEGORY_LABELS[b.category] || b.category}
                    {b.distanceMiles != null && <span> &middot; {b.distanceMiles} mi</span>}
                    {b.priceRange && <span> &middot; {b.priceRange}</span>}
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 mt-1" style={{ color: '#CBD5E1' }} />
              </div>
              {b.description && <p className="text-[11px] mt-1 line-clamp-2" style={{ color: '#64748B' }}>{b.description}</p>}
              <div className="flex items-center gap-3 mt-1.5">
                {b.phone && <a href={`tel:${b.phone}`} className="flex items-center gap-1 text-[10px]" style={{ color: '#0EA5E9' }}><Phone className="w-3 h-3" />Call</a>}
                {b.website && <a href={b.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[10px]" style={{ color: '#0EA5E9' }}><Globe className="w-3 h-3" />Website</a>}
                {b.hoursOfOperation && <span className="flex items-center gap-1 text-[10px]" style={{ color: '#94A3B8' }}><Clock className="w-3 h-3" />{b.hoursOfOperation}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      {filtered.length > 8 && (
        <div className="px-4 pb-4 text-center">
          <button className="text-[12px] font-medium" style={{ color: '#0EA5E9' }}>View all {filtered.length} businesses</button>
        </div>
      )}
    </div>
  );
}
