import { Tent } from 'lucide-react';

interface Props {
  photos: string[];
  totalPhotoCount: number;
  campgroundName?: string;
  campgroundPhoto?: string;
  onClick?: () => void;
}

export default function AlbumPhotoGrid({ photos, totalPhotoCount, campgroundName, campgroundPhoto, onClick }: Props) {
  const showBadge = totalPhotoCount > 5;
  const displayed = photos.slice(0, 5);

  // 0 photos — campground fallback or gradient placeholder
  if (displayed.length === 0) {
    return (
      <div className="relative cursor-pointer" onClick={onClick}>
        {campgroundPhoto ? (
          <div className="relative" style={{ borderRadius: 8, overflow: 'hidden' }}>
            <img src={campgroundPhoto} alt={campgroundName || ''} loading="lazy" className="w-full object-cover" style={{ aspectRatio: '16/9' }} />
            {campgroundName && (
              <div className="absolute bottom-2 left-2 px-2 py-1 rounded-lg text-[11px] font-semibold" style={{ background: 'rgba(0,0,0,0.55)', color: '#F5F0E8' }}>
                📍 {campgroundName}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center" style={{ aspectRatio: '16/9', background: 'linear-gradient(135deg, #162236, #1A2A45)', borderRadius: 8 }}>
            <Tent className="w-8 h-8 mb-2" style={{ color: '#E8A838' }} />
            {campgroundName && <p className="text-xs" style={{ color: '#8B9BB4' }}>{campgroundName}</p>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="relative cursor-pointer" onClick={onClick} style={{ borderRadius: 8, overflow: 'hidden' }}>
      {/* 1 PHOTO */}
      {displayed.length === 1 && (
        <img src={displayed[0]} alt="" loading="lazy" className="w-full object-cover" style={{ aspectRatio: '16/9' }} />
      )}

      {/* 2 PHOTOS */}
      {displayed.length === 2 && (
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '1fr 1fr', aspectRatio: '16/9' }}>
          <img src={displayed[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
          <img src={displayed[1]} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 3 PHOTOS — large left (60%) + 2 stacked right (40%) */}
      {displayed.length === 3 && (
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '3fr 2fr', height: 220 }}>
          <img src={displayed[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
          <div className="grid gap-0.5" style={{ gridTemplateRows: '1fr 1fr' }}>
            <img src={displayed[1]} alt="" loading="lazy" className="w-full h-full object-cover" />
            <img src={displayed[2]} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* 4 PHOTOS — 2×2 grid */}
      {displayed.length === 4 && (
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', height: 240 }}>
          <img src={displayed[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
          <img src={displayed[1]} alt="" loading="lazy" className="w-full h-full object-cover" />
          <img src={displayed[2]} alt="" loading="lazy" className="w-full h-full object-cover" />
          <img src={displayed[3]} alt="" loading="lazy" className="w-full h-full object-cover" />
        </div>
      )}

      {/* 5 PHOTOS — top row (2) + bottom row (3) */}
      {displayed.length === 5 && (
        <div className="grid gap-0.5" style={{ gridTemplateRows: '1fr 1fr', height: 260 }}>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <img src={displayed[0]} alt="" loading="lazy" className="w-full h-full object-cover" />
            <img src={displayed[1]} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <img src={displayed[2]} alt="" loading="lazy" className="w-full h-full object-cover" />
            <img src={displayed[3]} alt="" loading="lazy" className="w-full h-full object-cover" />
            <img src={displayed[4]} alt="" loading="lazy" className="w-full h-full object-cover" />
          </div>
        </div>
      )}

      {/* Photo count badge — only when more photos exist than shown */}
      {showBadge && (
        <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-lg text-[11px] font-semibold flex items-center gap-1"
          style={{ background: 'rgba(0,0,0,0.55)', color: '#F5F0E8' }}>
          📷 {totalPhotoCount}
        </div>
      )}
    </div>
  );
}
