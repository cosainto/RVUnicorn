import { useState } from 'react';
import { Map, Upload, Download, X, Maximize2 } from 'lucide-react';
import api from '../services/api';

const C = { bg: '#0F1C35', card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F', gold: '#C9A84C', orange: '#E8622A', cream: '#F5F0E8', muted: '#94A3B8', green: '#1D9E75' };

interface Props {
  tripId: string;
  campgroundId?: string;
  campgroundName?: string;
  campgroundMapUrl?: string | null;
  tripMapUrl?: string | null;
  canEdit: boolean;
  onMapUploaded?: (url: string) => void;
}

export default function CampsiteMapSection({ tripId, campgroundId, campgroundName, campgroundMapUrl, tripMapUrl, canEdit, onMapUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [localMapUrl, setLocalMapUrl] = useState<string | null>(null);

  const mapUrl = localMapUrl || tripMapUrl || campgroundMapUrl;
  const hasMap = !!mapUrl;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('Max 20MB'); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      const { data } = await api.post('/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      const url = data.url;

      // Save to trip
      await api.put(`/events/${tripId}`, { campsiteMapUrl: url });
      setLocalMapUrl(url);
      onMapUploaded?.(url);

      // If campground has no map, offer to share
      if (campgroundId && !campgroundMapUrl) {
        setShowSharePrompt(true);
      }
    } catch (err) {
      console.error('Map upload failed:', err);
      alert('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleShareWithCampground = async () => {
    if (!campgroundId || !mapUrl) return;
    try {
      await api.post(`/campgrounds/${campgroundId}/campsite-map`, { mapUrl });
      setShowSharePrompt(false);
    } catch (err) {
      console.error('Share failed:', err);
    }
  };

  return (
    <>
      <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.cream }}>
            <Map className="w-4 h-4" style={{ color: C.gold }} /> Campsite Map
          </h4>
          {hasMap && (
            <button onClick={() => setShowLightbox(true)} className="text-xs flex items-center gap-1 transition hover:brightness-125" style={{ color: C.gold }}>
              <Maximize2 className="w-3 h-3" /> Enlarge
            </button>
          )}
        </div>

        {hasMap ? (
          <div>
            <button onClick={() => setShowLightbox(true)} className="w-full rounded-lg overflow-hidden cursor-zoom-in" style={{ maxHeight: 300 }}>
              <img src={mapUrl!} alt="Campsite map" className="w-full object-contain rounded-lg" style={{ maxHeight: 300 }} />
            </button>
            <div className="flex gap-2 mt-3">
              <a href={mapUrl!} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:brightness-110"
                style={{ background: C.cardLight, color: C.cream }}>
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              {canEdit && (
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition hover:brightness-110"
                  style={{ background: 'rgba(232,168,56,0.1)', color: C.gold, border: `1px solid rgba(232,168,56,0.15)` }}>
                  <Upload className="w-3.5 h-3.5" /> Upload Better Map
                  <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <Map className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: C.muted }} />
            <p className="text-sm mb-1" style={{ color: C.cream }}>No campsite map yet</p>
            <p className="text-xs mb-4" style={{ color: C.muted }}>Help future campers by uploading one!</p>
            {canEdit && (
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition hover:brightness-110"
                style={{ background: C.orange, color: 'white' }}>
                {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload Campsite Map</>}
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>
            )}
            <p className="text-xs mt-3" style={{ color: C.muted }}>
              Tip: Most campgrounds have a PDF or image of their site layout at the front office or on their website
            </p>
          </div>
        )}
      </div>

      {/* Share with campground prompt */}
      {showSharePrompt && (
        <div className="mt-3 rounded-xl p-4" style={{ background: C.card, border: `1px solid rgba(232,168,56,0.2)` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: C.cream }}>🎉 Map uploaded!</p>
          <p className="text-xs mb-3" style={{ color: C.muted }}>
            {campgroundName || 'This campground'} doesn't have a campsite map on RVUnicorn yet. Share yours to help other campers!
          </p>
          <div className="flex gap-2">
            <button onClick={handleShareWithCampground}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110"
              style={{ background: C.gold, color: C.bg }}>
              ✓ Share with {campgroundName || 'campground'}
            </button>
            <button onClick={() => setShowSharePrompt(false)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: C.muted }}>
              Keep for my trip only
            </button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {showLightbox && mapUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}>
            <X className="w-6 h-6" />
          </button>
          <img src={mapUrl} alt="Campsite map" className="max-w-full max-h-full object-contain rounded-lg" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
