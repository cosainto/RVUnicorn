import { useRef, useState } from 'react';
import { Download, Share2, ArrowRight } from 'lucide-react';
import html2canvas from 'html2canvas';

interface RigData {
  firstName?: string;
  username?: string;
  rvYear?: number;
  rvMake?: string;
  rvModel?: string;
  rvType?: string;
  rvLength?: number;
  rvSleeps?: number;
  rvSlideouts?: number;
  homeCity?: string;
  homeState?: string;
  profilePicture?: string;
}

interface Props {
  rig: RigData;
  onSkip?: () => void;
  onPostToFeed?: (imageBlob: Blob) => void;
  showActions?: boolean;
}

const TYPE_EMOJIS: Record<string, string> = {
  'Class A': '🚌', 'Class B': '🚐', 'Class C': '🚍', 'Van': '🚐',
  'Fifth Wheel': '🏠', 'Travel Trailer': '🚗', 'Tent': '⛺',
  'Bus': '🚌', 'Other': '🚐',
};

export default function RigCard({ rig, onSkip, onPostToFeed, showActions = true }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [shared, setShared] = useState(false);

  const specs = [
    rig.rvLength && `${rig.rvLength}ft`,
    rig.rvType && (rig.rvType.includes('_') ? rig.rvType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()) : rig.rvType),
    rig.rvSleeps && `Sleeps ${rig.rvSleeps}`,
    rig.rvSlideouts && rig.rvSlideouts > 0 && `${rig.rvSlideouts} Slide-out${rig.rvSlideouts > 1 ? 's' : ''}`,
  ].filter(Boolean);

  const captureCard = async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, { scale: 2, useCORS: true, backgroundColor: null });
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  };

  const handleDownload = async () => {
    setExporting(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `my-rig-${rig.username || 'rvunicorn'}.png`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
    finally { setExporting(false); }
  };

  const handleShare = async () => {
    setExporting(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      if (navigator.share) {
        const file = new File([blob], `my-rig-${rig.username || 'rvunicorn'}.png`, { type: 'image/png' });
        await navigator.share({ title: `${rig.firstName}'s Rig — RVUnicorn`, files: [file] });
      } else {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {}
    finally { setExporting(false); }
  };

  const handlePostToFeed = async () => {
    setExporting(true);
    try {
      const blob = await captureCard();
      if (blob && onPostToFeed) onPostToFeed(blob);
    } catch {}
    finally { setExporting(false); }
  };

  return (
    <div>
      {/* The Card */}
      <div
        ref={cardRef}
        style={{
          width: 400, minHeight: 260, padding: 28,
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
          borderRadius: 20, position: 'relative', overflow: 'hidden',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        {/* Decorative gradient orb */}
        <div style={{
          position: 'absolute', top: -60, right: -60, width: 200, height: 200,
          background: 'radial-gradient(circle, rgba(245,158,11,0.15) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />
        <div style={{
          position: 'absolute', bottom: -40, left: -40, width: 160, height: 160,
          background: 'radial-gradient(circle, rgba(245,158,11,0.08) 0%, transparent 70%)',
          borderRadius: '50%',
        }} />

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, position: 'relative' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 20 }}>🦄</span>
            <span style={{ color: '#f59e0b', fontSize: 12, fontWeight: 700, letterSpacing: 0.5 }}>rvunicorn.com</span>
          </div>
          {rig.profilePicture && (
            <img src={rig.profilePicture} alt="" style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(245,158,11,0.4)', objectFit: 'cover' }} />
          )}
        </div>

        {/* Rig type emoji + name */}
        <div style={{ textAlign: 'center', marginBottom: 16, position: 'relative' }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>
            {TYPE_EMOJIS[rig.rvType || ''] || '🚐'}
          </div>
          <div style={{ color: '#ffffff', fontSize: 22, fontWeight: 800, letterSpacing: -0.5 }}>
            {rig.firstName ? `${rig.firstName}'s Rig` : 'My Rig'}
          </div>
          <div style={{ color: '#f59e0b', fontSize: 15, fontWeight: 700, marginTop: 4 }}>
            {[rig.rvYear, rig.rvMake, rig.rvModel].filter(Boolean).join(' ')}
          </div>
        </div>

        {/* Spec pills */}
        {specs.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 16, position: 'relative' }}>
            {specs.map((s, i) => (
              <span key={i} style={{
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)',
                color: '#fbbf24', fontSize: 11, fontWeight: 600,
                padding: '4px 10px', borderRadius: 20,
              }}>{s}</span>
            ))}
          </div>
        )}

        {/* Location + tagline */}
        <div style={{ textAlign: 'center', position: 'relative' }}>
          {(rig.homeCity || rig.homeState) && (
            <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, marginBottom: 8 }}>
              📍 {[rig.homeCity, rig.homeState].filter(Boolean).join(', ')}
            </div>
          )}
          <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, fontWeight: 500 }}>
            Just joined the campfire 🔥
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {showActions && (
        <div className="mt-6 space-y-3">
          <div className="flex gap-3">
            <button onClick={handleDownload} disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 bg-primary-600 text-white py-3 rounded-xl font-semibold text-sm hover:bg-primary-700 disabled:opacity-50 transition">
              <Download className="w-4 h-4" /> Download
            </button>
            <button onClick={handleShare} disabled={exporting}
              className="flex-1 flex items-center justify-center gap-2 bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm hover:bg-orange-600 disabled:opacity-50 transition">
              <Share2 className="w-4 h-4" /> {shared ? 'Copied!' : 'Share'}
            </button>
          </div>
          {onPostToFeed && (
            <button onClick={handlePostToFeed} disabled={exporting}
              className="w-full flex items-center justify-center gap-2 bg-gray-100 text-gray-700 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-200 disabled:opacity-50 transition">
              Post to Activity Feed
            </button>
          )}
          {onSkip && (
            <button onClick={onSkip} className="w-full text-sm text-gray-400 hover:text-gray-600 text-center">
              Skip for now →
            </button>
          )}
        </div>
      )}
    </div>
  );
}
