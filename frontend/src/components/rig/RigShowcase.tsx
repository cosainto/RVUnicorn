import { useState, useEffect } from 'react';
import { Camera, X, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../../services/api';

const CATEGORIES = [
  { key: 'ALL', label: 'All' },
  { key: 'RIG_EXTERIOR', label: 'Exterior' },
  { key: 'RIG_INTERIOR', label: 'Interior' },
  { key: 'RIG_FLOORPLAN', label: 'Floorplan' },
  { key: 'RIG_DETAIL', label: 'Details' },
  { key: 'RIG_SETUP', label: 'Setup' },
];

interface Props {
  slug: string;
  rigName: string;
  rigSubtitle: string;
  isOwner: boolean;
  galleryPhotoUrls?: string[];
}

export default function RigShowcase({ slug, rigName, rigSubtitle, isOwner, galleryPhotoUrls }: Props) {
  const [posts, setPosts] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => { load(); }, [slug]);

  const load = async () => {
    try {
      const { data } = await api.get(`/rigs/${slug}/showcase`);
      setPosts(data || []);
    } catch {}
    setLoading(false);
  };

  // Combine: showcase photos from posts + gallery photos from rig record
  const showcasePhotos: { url: string; category: string; id?: string }[] = [];
  for (const p of posts) {
    for (const url of (p.photos || [])) {
      showcasePhotos.push({ url, category: p.photoCategory || 'RIG_EXTERIOR', id: p.id });
    }
  }
  // Add gallery photos not already in posts
  const postPhotoSet = new Set(showcasePhotos.map(p => p.url));
  for (const url of (galleryPhotoUrls || [])) {
    if (!postPhotoSet.has(url)) {
      showcasePhotos.push({ url, category: 'RIG_EXTERIOR' });
    }
  }

  const filtered = filter === 'ALL' ? showcasePhotos : showcasePhotos.filter(p => p.category === filter);
  const display = showAll ? filtered : filtered.slice(0, 6);

  // Empty — hide for visitors, show prompt for owner
  if (!loading && showcasePhotos.length === 0 && !isOwner) return null;

  return (
    <>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5" style={{ background: '#1E2D42' }}>
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">🚐 The Rig</h3>
            <p className="text-[11px] text-white/40">{rigName} · {rigSubtitle}</p>
          </div>
          {isOwner && showcasePhotos.length > 0 && (
            <button className="flex items-center gap-1 px-3 py-1.5 text-[10px] font-semibold rounded-lg bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 transition">
              <Camera className="w-3 h-3" /> Add Photos
            </button>
          )}
        </div>

        {/* Empty state for owner */}
        {!loading && showcasePhotos.length === 0 && isOwner && (
          <div className="text-center py-8 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px dashed rgba(255,255,255,0.1)' }}>
            <Camera className="w-8 h-8 mx-auto text-white/15 mb-2" />
            <p className="text-sm text-white/40">Show off your rig!</p>
            <p className="text-xs text-white/25 mt-1">Add exterior and interior photos so other RVers can admire the details.</p>
            <button className="mt-3 px-4 py-2 bg-amber-500 text-gray-900 font-semibold rounded-xl text-xs">Upload Rig Photos</button>
          </div>
        )}

        {/* Category filter */}
        {showcasePhotos.length > 0 && (
          <>
            <div className="flex gap-1.5 overflow-x-auto pb-3 scrollbar-hide">
              {CATEGORIES.map(c => {
                const count = c.key === 'ALL' ? showcasePhotos.length : showcasePhotos.filter(p => p.category === c.key).length;
                if (c.key !== 'ALL' && count === 0) return null;
                return (
                  <button key={c.key} onClick={() => { setFilter(c.key); setShowAll(false); }}
                    className={`px-3 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition ${
                      filter === c.key ? 'bg-amber-500/20 text-amber-400' : 'bg-white/5 text-white/40 hover:bg-white/10'
                    }`}>
                    {c.label} {count > 0 && `(${count})`}
                  </button>
                );
              })}
            </div>

            {/* Photo grid */}
            <div className="grid grid-cols-3 gap-2">
              {display.map((photo, i) => (
                <button key={`${photo.url}-${i}`} onClick={() => setLightboxIdx(i)} className="relative aspect-square rounded-xl overflow-hidden group shadow-sm">
                  <img src={photo.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                </button>
              ))}
            </div>

            {/* View all button */}
            {filtered.length > 6 && !showAll && (
              <button onClick={() => setShowAll(true)} className="w-full mt-3 py-2 text-center text-xs font-semibold text-amber-400 hover:text-amber-300 transition">
                View All {filtered.length} Photos →
              </button>
            )}
            {showAll && filtered.length > 6 && (
              <button onClick={() => setShowAll(false)} className="w-full mt-3 py-2 text-center text-xs text-white/30 hover:text-white/50 transition">
                Show Less
              </button>
            )}
          </>
        )}
      </div>

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center" onClick={() => setLightboxIdx(null)}>
          <button onClick={() => setLightboxIdx(null)} className="absolute top-4 right-4 p-2 text-white/60 hover:text-white z-10">
            <X className="w-6 h-6" />
          </button>
          {lightboxIdx > 0 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx - 1); }} className="absolute left-4 p-2 text-white/60 hover:text-white">
              <ChevronLeft className="w-8 h-8" />
            </button>
          )}
          {lightboxIdx < filtered.length - 1 && (
            <button onClick={e => { e.stopPropagation(); setLightboxIdx(lightboxIdx + 1); }} className="absolute right-4 p-2 text-white/60 hover:text-white">
              <ChevronRight className="w-8 h-8" />
            </button>
          )}
          <img src={filtered[lightboxIdx].url} alt="" className="max-w-[90vw] max-h-[85vh] object-contain rounded-xl" onClick={e => e.stopPropagation()} />
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-center">
            <span className="text-xs text-white/40 px-3 py-1 rounded-full bg-black/50 backdrop-blur-sm">
              {filtered[lightboxIdx].category.replace('RIG_', '').replace(/_/g, ' ')} · {lightboxIdx + 1} / {filtered.length}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
