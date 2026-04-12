import { Link } from 'react-router-dom';

interface AlbumPreviewGridProps {
  photos: { id: string; url: string }[];
  albumId: string;
  albumTitle: string;
  totalCount: number;
}

export default function AlbumPreviewGrid({ photos, albumId, albumTitle, totalCount }: AlbumPreviewGridProps) {
  if (photos.length === 0) return null;

  const overflow = totalCount > 5 ? totalCount - 5 : 0;

  // Single photo (1-2 photos)
  if (photos.length < 3) {
    return (
      <div className="mt-2">
        <Link to={`/albums/${albumId}`} className="block rounded-xl overflow-hidden hover:brightness-110 transition-all duration-200">
          <img
            src={photos[0].url}
            alt={albumTitle}
            loading="lazy"
            className="w-full object-cover rounded-xl"
            style={{ maxHeight: 280 }}
          />
        </Link>
        <Link to={`/albums/${albumId}`} className="block mt-1">
          <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
            {albumTitle} · {totalCount} photo{totalCount !== 1 ? 's' : ''}
          </p>
        </Link>
      </div>
    );
  }

  // 3 photos: large left + 2 stacked right
  if (photos.length === 3) {
    return (
      <div className="mt-2">
        <Link to={`/albums/${albumId}`} className="block rounded-xl overflow-hidden hover:brightness-110 transition-all duration-200" style={{ background: '#0F1C35' }}>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: '2fr 1fr', height: 220 }}>
            <img src={photos[0].url} alt="" loading="lazy" className="w-full h-full object-cover rounded-l-md" />
            <div className="grid gap-0.5" style={{ gridTemplateRows: '1fr 1fr' }}>
              <img src={photos[1].url} alt="" loading="lazy" className="w-full h-full object-cover rounded-tr-md" />
              <PhotoCell photo={photos[2]} overflow={overflow} isLast />
            </div>
          </div>
        </Link>
        <Caption albumId={albumId} albumTitle={albumTitle} totalCount={totalCount} />
      </div>
    );
  }

  // 4 photos: equal row
  if (photos.length === 4) {
    return (
      <div className="mt-2">
        <Link to={`/albums/${albumId}`} className="block rounded-xl overflow-hidden hover:brightness-110 transition-all duration-200" style={{ background: '#0F1C35' }}>
          <div className="grid gap-0.5" style={{ gridTemplateColumns: 'repeat(4, 1fr)', height: 220 }}>
            <img src={photos[0].url} alt="" loading="lazy" className="w-full h-full object-cover rounded-l-md" />
            <img src={photos[1].url} alt="" loading="lazy" className="w-full h-full object-cover" />
            <img src={photos[2].url} alt="" loading="lazy" className="w-full h-full object-cover" />
            <PhotoCell photo={photos[3]} overflow={overflow} isLast />
          </div>
        </Link>
        <Caption albumId={albumId} albumTitle={albumTitle} totalCount={totalCount} />
      </div>
    );
  }

  // 5 photos: large left spanning 2 rows + 4 small right
  return (
    <div className="mt-2">
      <Link to={`/albums/${albumId}`} className="block rounded-xl overflow-hidden hover:brightness-110 transition-all duration-200" style={{ background: '#0F1C35' }}>
        <div className="grid gap-0.5" style={{ gridTemplateColumns: '2fr 1fr 1fr', gridTemplateRows: '1fr 1fr', height: 220 }}>
          <img src={photos[0].url} alt="" loading="lazy" className="w-full h-full object-cover rounded-l-md" style={{ gridRow: '1 / 3' }} />
          <img src={photos[1].url} alt="" loading="lazy" className="w-full h-full object-cover" />
          <img src={photos[2].url} alt="" loading="lazy" className="w-full h-full object-cover rounded-tr-md" />
          <img src={photos[3].url} alt="" loading="lazy" className="w-full h-full object-cover" />
          <PhotoCell photo={photos[4]} overflow={overflow} isLast />
        </div>
      </Link>
      <Caption albumId={albumId} albumTitle={albumTitle} totalCount={totalCount} />
    </div>
  );
}

function PhotoCell({ photo, overflow, isLast }: { photo: { id: string; url: string }; overflow: number; isLast: boolean }) {
  if (isLast && overflow > 0) {
    return (
      <div className="relative w-full h-full">
        <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover rounded-br-md" />
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-br-md">
          <span className="text-white font-semibold text-sm">+{overflow} more</span>
        </div>
      </div>
    );
  }
  return <img src={photo.url} alt="" loading="lazy" className="w-full h-full object-cover rounded-br-md" />;
}

function Caption({ albumId, albumTitle, totalCount }: { albumId: string; albumTitle: string; totalCount: number }) {
  return (
    <Link to={`/albums/${albumId}`} className="block mt-1">
      <p className="text-sm" style={{ color: 'rgba(245,240,232,0.5)' }}>
        {albumTitle} · {totalCount} photo{totalCount !== 1 ? 's' : ''}
      </p>
    </Link>
  );
}
