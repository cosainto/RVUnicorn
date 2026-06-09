import { useRef, useState, useEffect } from 'react';
import { X, Share2, Download } from 'lucide-react';

interface ShareCardProps {
  type: 'checkin' | 'trip';
  title: string;
  subtitle?: string;
  stat?: string;
  campgroundName?: string;
  campgroundId?: string;
  campgroundImage?: string;
  location?: string;
  userName: string;
  userAvatar?: string;
  onClose: () => void;
}

/**
 * Preload an image via a temp <img> with crossOrigin so html2canvas
 * can read its pixels without tainting the canvas.  Returns a data-URL
 * on success, or undefined if the image can't be fetched.
 */
function preloadImage(src: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext('2d')!.drawImage(img, 0, 0);
        resolve(c.toDataURL('image/png'));
      } catch {
        resolve(undefined);
      }
    };
    img.onerror = () => resolve(undefined);
    // Force Cloudinary to serve with CORS headers
    img.src = src.includes('cloudinary.com') && !src.includes('/upload/f_')
      ? src.replace('/upload/', '/upload/f_png/')
      : src;
  });
}

export default function ShareCard({ type, title, subtitle, stat, campgroundName, campgroundId, campgroundImage, location, userName, userAvatar, onClose }: ShareCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>();
  const [campImgDataUrl, setCampImgDataUrl] = useState<string | undefined>();
  const [imagesReady, setImagesReady] = useState(false);

  // Pre-convert external images to data-URLs so html2canvas renders them
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [a, c] = await Promise.all([
        userAvatar ? preloadImage(userAvatar) : Promise.resolve(undefined),
        campgroundImage ? preloadImage(campgroundImage) : Promise.resolve(undefined),
      ]);
      if (cancelled) return;
      setAvatarDataUrl(a);
      setCampImgDataUrl(c);
      setImagesReady(true);
    })();
    return () => { cancelled = true; };
  }, [userAvatar, campgroundImage]);

  const campgroundUrl = campgroundId
    ? `https://rvunicorn.com/campgrounds/${campgroundId}`
    : 'https://rvunicorn.com';

  const captureCanvas = async () => {
    const html2canvas = (await import('html2canvas')).default;
    return html2canvas(cardRef.current!, { backgroundColor: null, scale: 2, useCORS: true });
  };

  const handleDownload = async () => {
    try {
      const canvas = await captureCanvas();
      const link = document.createElement('a');
      link.download = `rvunicorn-${type}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch {}
  };

  const handleShare = async () => {
    try {
      const canvas = await captureCanvas();
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        if (navigator.share) {
          const file = new File([blob], `rvunicorn-${type}.png`, { type: 'image/png' });
          // Include the URL in the text body so recipients always get a clickable link,
          // even on platforms that strip the url field when files are present.
          const shareText = campgroundName
            ? `${title} — ${campgroundName}\n${campgroundUrl}`
            : `${title}\n${campgroundUrl}`;
          await navigator.share({
            title: `${userName} on RVUnicorn`,
            text: shareText,
            url: campgroundUrl,
            files: [file],
          });
        } else {
          handleDownload();
        }
      });
    } catch { handleDownload(); }
  };

  const displayAvatar = avatarDataUrl || userAvatar;
  const displayCampImg = campImgDataUrl || campgroundImage;

  return (
    <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="max-w-sm w-full" onClick={e => e.stopPropagation()}>
        {/* The card to capture */}
        <div ref={cardRef} className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(145deg, #0F1C35 0%, #1B2E50 50%, #0F1C35 100%)' }}>
          {/* Header gradient */}
          <div className="px-6 pt-6 pb-4" style={{ background: 'linear-gradient(to bottom, rgba(232,98,42,0.15), transparent)' }}>
            <div className="flex items-center gap-3 mb-4">
              <img src="/images/Logo_RVUnicorn.png" alt="RVUnicorn" className="w-8 h-8 rounded-full" crossOrigin="anonymous" />
              <span className="text-[13px] font-bold" style={{ color: '#E8A838', fontFamily: "'Playfair Display',serif" }}>RVUnicorn</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto" style={{ background: 'rgba(232,168,56,0.1)', color: '#E8A838' }}>
                {type === 'checkin' ? 'Checked In' : 'Trip Complete'}
              </span>
            </div>

            <div className="flex items-center gap-3 mb-4">
              {displayAvatar ? <img src={displayAvatar} alt="" crossOrigin="anonymous" className="w-11 h-11 rounded-full object-cover border-2" style={{ borderColor: '#E8A838' }} />
              : <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: 'rgba(232,168,56,0.2)', color: '#E8A838' }}>{userName[0]}</div>}
              <div>
                <p className="text-[14px] font-bold" style={{ color: '#F5F0E8' }}>{userName}</p>
                {subtitle && <p className="text-[11px]" style={{ color: 'rgba(245,240,232,0.5)' }}>{subtitle}</p>}
              </div>
            </div>
          </div>

          {/* Campground image */}
          {displayCampImg && (
            <div className="px-4">
              <img src={displayCampImg} alt={campgroundName || ''} crossOrigin="anonymous" className="w-full h-32 object-cover rounded-lg" style={{ border: '1px solid rgba(232,168,56,0.15)' }} />
            </div>
          )}

          {/* Content */}
          <div className="px-6 pb-6">
            <h2 className="text-xl font-bold mb-1 mt-3" style={{ color: '#F5F0E8', fontFamily: "'Playfair Display',serif" }}>{title}</h2>
            {campgroundName && <p className="text-[13px] mb-1" style={{ color: '#E8A838' }}>{'\u{1F3D5}'} {campgroundName}</p>}
            {location && <p className="text-[11px] mb-3" style={{ color: 'rgba(245,240,232,0.4)' }}>{'\u{1F4CD}'} {location}</p>}
            {stat && <p className="text-[15px] font-bold mt-3" style={{ color: '#E8A838' }}>{stat}</p>}

            {/* Prominent campground link in the card */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid rgba(232,168,56,0.1)' }}>
              <p className="text-[12px] font-semibold mb-1" style={{ color: '#E8A838' }}>
                {campgroundId
                  ? `rvunicorn.com/campgrounds/${campgroundId}`
                  : 'rvunicorn.com'}
              </p>
              <p className="text-[10px]" style={{ color: 'rgba(245,240,232,0.35)' }}>Your Kind of People</p>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-4 justify-center">
          <button onClick={handleShare} disabled={!imagesReady} className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50" style={{ background: '#E8622A', color: 'white' }}>
            <Share2 className="w-4 h-4" /> {imagesReady ? 'Share' : 'Loading...'}
          </button>
          <button onClick={handleDownload} disabled={!imagesReady} className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold disabled:opacity-50" style={{ border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}>
            <Download className="w-4 h-4" /> Save Image
          </button>
          <button onClick={onClose} className="p-2.5 rounded-full" style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
            <X className="w-4 h-4" style={{ color: 'rgba(245,240,232,0.4)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
