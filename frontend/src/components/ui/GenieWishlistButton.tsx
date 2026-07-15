/**
 * GenieWishlistButton — universal wishlist toggle for campgrounds and places.
 * Replaces the heart Save button everywhere.
 *
 * Props:
 *   itemId    — campground or place ID
 *   itemType  — 'campground' | 'place'
 *   itemName  — for the Place wishlist (required when type='place')
 *   saved     — initial saved state (optional, will fetch if not provided)
 *   size      — 'sm' (24px) | 'md' (32px) | 'lg' (48px)
 *   onToggle  — callback after toggle completes
 *   showLabel — show text label next to icon
 *   scrim     — render on a dark scrim (for over photos)
 */
import { useState, useCallback } from 'react';
import api from '../../services/api';

const CN = {
  gold: '#C9A84C',
  deep: '#0F1C35',
  border: '#2A3F5F',
  cream: '#F5F0E8',
  muted: '#8B9BB4',
};

// Genie mascot icon — uses the prepped transparent PNG
function GenieMascotIcon({ size = 24 }: { size?: number }) {
  return (
    <img
      src="/images/genie-full-v2.png"
      alt="Add to wishlist"
      width={size}
      height={size}
      style={{ width: size, height: size, objectFit: 'contain', pointerEvents: 'none' }}
    />
  );
}

interface Props {
  itemId: string;
  itemType: 'campground' | 'place';
  itemName?: string;
  saved?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onToggle?: (saved: boolean) => void;
  showLabel?: boolean;
  scrim?: boolean;
  className?: string;
}

export default function GenieWishlistButton({
  itemId, itemType, itemName, saved: savedProp, size = 'md',
  onToggle, showLabel = false, scrim = false, className = '',
}: Props) {
  const [isSaved, setIsSaved] = useState(savedProp ?? false);
  const [animating, setAnimating] = useState(false);
  const [loading, setLoading] = useState(false);

  const iconSize = size === 'sm' ? 18 : size === 'lg' ? 28 : 22;
  const btnSize = size === 'sm' ? 28 : size === 'lg' ? 44 : 34;

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    const newState = !isSaved;
    setIsSaved(newState); // Optimistic
    setLoading(true);

    if (newState) {
      setAnimating(true);
      setTimeout(() => setAnimating(false), 700);
    }

    try {
      if (newState) {
        await api.post('/dream-trips/save', {
          ...(itemType === 'campground' ? { campgroundId: itemId } : { placeId: itemId }),
          name: itemName || '',
        });
      } else {
        await api.delete(`/dream-trips/unsave?${itemType === 'campground' ? 'campgroundId' : 'placeId'}=${itemId}`);
      }
      onToggle?.(newState);
    } catch {
      setIsSaved(!newState); // Rollback
    } finally {
      setLoading(false);
    }
  }, [isSaved, loading, itemId, itemType, itemName, onToggle]);

  return (
    <button
      onClick={toggle}
      aria-pressed={isSaved}
      aria-label={isSaved ? 'In your wishlist' : 'Add to wishlist'}
      title={isSaved ? 'In your wishlist' : 'Add to wishlist'}
      className={`inline-flex items-center justify-center gap-1.5 transition-all ${className}`}
      style={{
        width: showLabel ? 'auto' : btnSize,
        height: btnSize,
        padding: showLabel ? '0 12px' : 0,
        borderRadius: btnSize / 2,
        border: `2px solid ${isSaved ? CN.gold : scrim ? 'rgba(255,255,255,0.3)' : CN.border}`,
        background: scrim
          ? (isSaved ? 'rgba(201,168,76,0.2)' : 'rgba(0,0,0,0.4)')
          : (isSaved ? 'rgba(201,168,76,0.15)' : 'transparent'),
        color: isSaved ? CN.gold : scrim ? 'white' : CN.muted,
        cursor: 'pointer',
        position: 'relative',
        overflow: 'visible',
        backdropFilter: scrim ? 'blur(4px)' : undefined,
      }}
    >
      <GenieMascotIcon size={iconSize} />
      {showLabel && (
        <span style={{ fontSize: size === 'sm' ? 10 : 12, fontWeight: 600 }}>
          {isSaved ? 'Wished' : 'Wish'}
        </span>
      )}

      {/* Sparkle burst animation on save */}
      {animating && (
        <div style={{ position: 'absolute', inset: -8, pointerEvents: 'none' }}>
          <style>{`
            @keyframes genie-sparkle {
              0% { transform: scale(0.5); opacity: 1; }
              100% { transform: scale(2); opacity: 0; }
            }
            @media (prefers-reduced-motion: reduce) {
              .genie-sparkle-ring { display: none; }
            }
          `}</style>
          <div className="genie-sparkle-ring" style={{
            position: 'absolute', inset: 0,
            border: `2px solid ${CN.gold}`,
            borderRadius: '50%',
            animation: 'genie-sparkle 0.6s ease-out forwards',
          }} />
          {/* Small sparkle dots */}
          {[0, 60, 120, 180, 240, 300].map((deg, i) => (
            <div key={i} className="genie-sparkle-ring" style={{
              position: 'absolute',
              width: 4, height: 4, borderRadius: '50%',
              background: CN.gold,
              top: '50%', left: '50%',
              transform: `rotate(${deg}deg) translateY(-${btnSize * 0.8}px)`,
              animation: `genie-sparkle 0.5s ease-out ${i * 0.05}s forwards`,
            }} />
          ))}
        </div>
      )}
    </button>
  );
}
