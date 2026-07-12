import { useState, useRef } from 'react';
import { Map, Upload, Download, X, Maximize2, Crosshair, Loader2, Check } from 'lucide-react';
import api from '../services/api';
import { uploadAndGetUrl } from '../utils/uploadMedia';

const C = { bg: '#0F1C35', card: '#1B2B4B', cardLight: '#243352', border: '#2A3F5F', gold: '#C9A84C', orange: '#E8622A', cream: '#F5F0E8', muted: '#94A3B8', green: '#1D9E75' };

interface Props {
  tripId: string;
  campgroundId?: string;
  campgroundName?: string;
  campgroundMapUrl?: string | null;
  tripMapUrl?: string | null;
  siteNumber?: string | null;
  pinX?: number | null;
  pinY?: number | null;
  pinSetBy?: string | null;
  canEdit: boolean;
  onMapUploaded?: (url: string) => void;
  onPinPlaced?: (x: number, y: number, method: string) => void;
}

export default function CampsiteMapSection({ tripId, campgroundId, campgroundName, campgroundMapUrl, tripMapUrl, siteNumber, pinX, pinY, pinSetBy, canEdit, onMapUploaded, onPinPlaced }: Props) {
  const [uploading, setUploading] = useState(false);
  const [showLightbox, setShowLightbox] = useState(false);
  const [showSharePrompt, setShowSharePrompt] = useState(false);
  const [localMapUrl, setLocalMapUrl] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [localPin, setLocalPin] = useState<{ x: number; y: number } | null>(pinX != null && pinY != null ? { x: pinX, y: pinY } : null);
  const [manualMode, setManualMode] = useState(false);
  const [hitchMsg, setHitchMsg] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);

  const mapUrl = localMapUrl || tripMapUrl || campgroundMapUrl;
  const hasMap = !!mapUrl;
  const pin = localPin;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { alert('Max 20MB'); return; }
    setUploading(true);
    try {
      const url = await uploadAndGetUrl(file, 'rvunicorn/campsite-maps');
      await api.put(`/events/${tripId}`, { campsiteMapUrl: url });
      setLocalMapUrl(url);
      onMapUploaded?.(url);
      if (campgroundId && !campgroundMapUrl) setShowSharePrompt(true);
    } catch { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleDetectSite = async () => {
    if (!siteNumber || !mapUrl) return;
    setDetecting(true);
    setHitchMsg(null);
    try {
      const { data } = await api.post('/trips/detect-site-location', { tripId, siteNumber, mapUrl });
      if (data.found && data.x != null && data.y != null) {
        setLocalPin({ x: data.x, y: data.y });
        setHitchMsg(`Found your home base! Site ${siteNumber} is highlighted on your map. 🏕`);
        onPinPlaced?.(data.x, data.y, 'AI');
      } else {
        setHitchMsg(`Couldn't locate Site ${siteNumber} automatically — tap the map to place it manually.`);
        setManualMode(true);
      }
    } catch {
      setHitchMsg('Site detection failed — tap the map to place your marker manually.');
      setManualMode(true);
    } finally { setDetecting(false); }
  };

  const handleMapClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!manualMode || !mapRef.current) return;
    const rect = mapRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setLocalPin({ x, y });
    setManualMode(false);
    setHitchMsg(`Site ${siteNumber || ''} marked! You're all set. 👀`);

    // Save to backend
    api.put(`/events/${tripId}`, { siteMapPinX: x, siteMapPinY: y, siteMapPinSetBy: 'MANUAL' }).catch(() => {});
    onPinPlaced?.(x, y, 'MANUAL');
  };

  const handleShareWithCampground = async () => {
    if (!campgroundId || !mapUrl) return;
    try {
      await api.post(`/campgrounds/${campgroundId}/campsite-map`, { mapUrl });
      setShowSharePrompt(false);
    } catch {}
  };

  return (
    <>
      <div className="rounded-2xl p-4" style={{ background: C.card, border: `1px solid ${C.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.cream }}>
            <Map className="w-4 h-4" style={{ color: C.gold }} /> Campsite Map
            {siteNumber && pin && <span className="text-[10px] px-2 py-0.5 rounded-full ml-1" style={{ background: 'rgba(201,168,76,0.15)', color: C.gold }}>📍 Site {siteNumber}</span>}
          </h4>
          {hasMap && (
            <button onClick={() => setShowLightbox(true)} className="text-xs flex items-center gap-1 transition hover:brightness-125" style={{ color: C.gold }}>
              <Maximize2 className="w-3 h-3" /> Enlarge
            </button>
          )}
        </div>

        {hasMap ? (
          <div>
            {/* Map with pin overlay */}
            <div ref={mapRef} onClick={handleMapClick}
              className={`relative w-full rounded-xl overflow-hidden ${manualMode ? 'cursor-crosshair' : 'cursor-zoom-in'}`}
              style={{ maxHeight: 300, border: `1px solid rgba(201,168,76,0.2)` }}
              onClick2={() => !manualMode && setShowLightbox(true)}>

              <img src={mapUrl!} alt="Campsite map" className="w-full object-contain" style={{ maxHeight: 300 }}
                onClick={(e) => { if (!manualMode) { e.stopPropagation(); setShowLightbox(true); } }} />

              {/* Manual mode overlay */}
              {manualMode && (
                <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(15,28,53,0.6)' }}>
                  <div className="text-center">
                    <Crosshair className="w-8 h-8 mx-auto mb-2" style={{ color: C.gold }} />
                    <p className="text-sm font-semibold" style={{ color: C.cream }}>Tap where Site {siteNumber} is</p>
                    <button onClick={(e) => { e.stopPropagation(); setManualMode(false); }} className="text-xs mt-2" style={{ color: C.muted }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Site pin */}
              {pin && !manualMode && (
                <div style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)', zIndex: 10, pointerEvents: 'none' }}>
                  {/* Pulse ring */}
                  <div className="absolute" style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(201,168,76,0.3)', animation: 'sitepin-pulse 2s infinite', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }} />
                  {/* Pin */}
                  <div style={{ width: 20, height: 20, background: C.gold, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
                  {/* Label */}
                  {siteNumber && (
                    <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: C.bg, color: C.gold, padding: '1px 6px', borderRadius: 8, fontSize: 10, fontWeight: 700, border: `1px solid ${C.gold}`, whiteSpace: 'nowrap', marginBottom: 2 }}>
                      Site {siteNumber}
                    </div>
                  )}
                </div>
              )}
            </div>

            <style>{`@keyframes sitepin-pulse { 0%,100% { transform: translate(-50%,-50%) scale(1); opacity:0.6; } 50% { transform: translate(-50%,-50%) scale(2); opacity:0.1; } }`}</style>

            {/* Actions */}
            <div className="flex flex-wrap gap-2 mt-3">
              <a href={mapUrl!} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:brightness-110" style={{ background: C.cardLight, color: C.cream }}>
                <Download className="w-3.5 h-3.5" /> Download
              </a>
              {canEdit && siteNumber && !pin && (
                <button onClick={handleDetectSite} disabled={detecting} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110 disabled:opacity-50" style={{ background: C.orange, color: 'white' }}>
                  {detecting ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Scanning...</> : <><Crosshair className="w-3.5 h-3.5" /> Find Site {siteNumber}</>}
                </button>
              )}
              {canEdit && pin && (
                <button onClick={() => setManualMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition hover:brightness-110" style={{ background: 'rgba(232,168,56,0.1)', color: C.gold, border: `1px solid rgba(232,168,56,0.15)` }}>
                  Adjust pin
                </button>
              )}
              {canEdit && (
                <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition hover:brightness-110" style={{ background: 'rgba(232,168,56,0.1)', color: C.gold, border: `1px solid rgba(232,168,56,0.15)` }}>
                  <Upload className="w-3.5 h-3.5" /> New Map
                  <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" />
                </label>
              )}
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="text-center py-6">
            <Map className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: C.muted }} />
            <p className="text-sm mb-1" style={{ color: C.cream }}>No campsite map yet</p>
            <p className="text-xs mb-4" style={{ color: C.muted }}>Help future campers by uploading one!</p>
            {canEdit && (
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold cursor-pointer transition hover:brightness-110" style={{ background: C.orange, color: 'white' }}>
                {uploading ? 'Uploading...' : <><Upload className="w-4 h-4" /> Upload Campsite Map</>}
                <input type="file" accept="image/*,application/pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
              </label>
            )}
            <p className="text-xs mt-3" style={{ color: C.muted }}>Most campgrounds have a PDF at the front office or on their website</p>
          </div>
        )}

        {/* Hitch message */}
        {hitchMsg && (
          <div className="flex items-start gap-2 mt-3 p-3 rounded-xl" style={{ background: 'rgba(232,168,56,0.08)', border: '1px solid rgba(232,168,56,0.15)' }}>
            <img src="https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png" alt="Hitch" className="w-7 h-7 rounded-full object-cover flex-shrink-0" />
            <p className="text-xs leading-relaxed" style={{ color: C.cream }}>{hitchMsg}</p>
          </div>
        )}
      </div>

      {/* Share prompt */}
      {showSharePrompt && (
        <div className="mt-3 rounded-xl p-4" style={{ background: C.card, border: `1px solid rgba(232,168,56,0.2)` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: C.cream }}>🎉 Map uploaded!</p>
          <p className="text-xs mb-3" style={{ color: C.muted }}>{campgroundName || 'This campground'} doesn't have a map on RVUnicorn yet.</p>
          <div className="flex gap-2">
            <button onClick={handleShareWithCampground} className="px-3 py-1.5 rounded-lg text-xs font-semibold transition hover:brightness-110" style={{ background: C.gold, color: C.bg }}>✓ Share with campground</button>
            <button onClick={() => setShowSharePrompt(false)} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ color: C.muted }}>Keep private</button>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {showLightbox && mapUrl && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button className="absolute top-4 right-4 p-2 rounded-full" style={{ background: 'rgba(255,255,255,0.1)', color: 'white' }}><X className="w-6 h-6" /></button>
          <div className="relative max-w-full max-h-full" onClick={e => e.stopPropagation()}>
            <img src={mapUrl} alt="Campsite map" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
            {pin && (
              <div style={{ position: 'absolute', left: `${pin.x}%`, top: `${pin.y}%`, transform: 'translate(-50%, -100%)', zIndex: 10 }}>
                <div style={{ width: 24, height: 24, background: C.gold, borderRadius: '50% 50% 50% 0', transform: 'rotate(-45deg)', border: '2px solid white', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }} />
                {siteNumber && <div style={{ position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)', background: C.bg, color: C.gold, padding: '1px 6px', borderRadius: 8, fontSize: 11, fontWeight: 700, border: `1px solid ${C.gold}`, whiteSpace: 'nowrap', marginBottom: 3 }}>Site {siteNumber}</div>}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
