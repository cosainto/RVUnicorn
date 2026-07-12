import { useState, useEffect } from 'react';

/**
 * Global photo lightbox that intercepts clicks on any element with
 * data-feed-photo attribute, anywhere in the app.
 * Mount once at the App level — works on every page automatically.
 */
export default function GlobalPhotoLightbox() {
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  // Document-level capture click handler
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const photoEl = target.closest('[data-feed-photo]') as HTMLElement | null;
      if (!photoEl) return;

      e.preventDefault();
      e.stopPropagation();

      try {
        const json = photoEl.getAttribute('data-all-photos') || '[]';
        const parsed = JSON.parse(json);
        const idx = parseInt(photoEl.getAttribute('data-photo-index') || '0');
        if (parsed.length > 0) {
          setPhotos(parsed);
          setIndex(Math.min(idx, parsed.length - 1));
          setOpen(true);
        }
      } catch {
        // Fallback: use the img src directly
        const img = photoEl.tagName === 'IMG' ? photoEl : photoEl.querySelector('img');
        if (img && (img as HTMLImageElement).src) {
          setPhotos([(img as HTMLImageElement).src]);
          setIndex(0);
          setOpen(true);
        }
      }
    };

    document.addEventListener('click', handleClick, true);
    return () => document.removeEventListener('click', handleClick, true);
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setIndex(i => Math.min(photos.length - 1, i + 1));
      if (e.key === 'ArrowLeft') setIndex(i => Math.max(0, i - 1));
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, photos.length]);

  if (!open || photos.length === 0) return null;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 999999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={() => setOpen(false)}
    >
      {/* Close */}
      <button onClick={() => setOpen(false)}
        style={{ position: 'fixed', top: 16, right: 16, background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 44, height: 44, borderRadius: '50%', fontSize: 22, cursor: 'pointer', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        ×
      </button>

      {/* Previous */}
      {index > 0 && (
        <button onClick={(e) => { e.stopPropagation(); setIndex(i => i - 1); }}
          style={{ position: 'fixed', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 52, height: 52, borderRadius: '50%', fontSize: 28, cursor: 'pointer', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ‹
        </button>
      )}

      {/* Photo */}
      <img
        src={photos[index]}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '92vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 8 }}
        alt=""
      />

      {/* Next */}
      {index < photos.length - 1 && (
        <button onClick={(e) => { e.stopPropagation(); setIndex(i => i + 1); }}
          style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.15)', border: 'none', color: 'white', width: 52, height: 52, borderRadius: '50%', fontSize: 28, cursor: 'pointer', zIndex: 1000000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          ›
        </button>
      )}

      {/* Counter */}
      <div style={{ position: 'fixed', bottom: 20, color: 'rgba(255,255,255,0.6)', fontSize: 14 }}>
        {index + 1} / {photos.length}
      </div>
    </div>
  );
}
