import { useState, useEffect, useCallback } from 'react';
import { Heart } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  campgroundId: string;
  size?: 'sm' | 'md';
  showCount?: boolean;
  className?: string;
}

export default function CampgroundFavoriteButton({ campgroundId, size = 'sm', showCount = false, className = '' }: Props) {
  const { user } = useAuth();
  const [isFavorited, setIsFavorited] = useState(false);
  const [count, setCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user || !campgroundId) return;
    let cancelled = false;
    api.get(`/campgrounds/${campgroundId}/is-favorited`).then(r => {
      if (!cancelled) { setIsFavorited(r.data.isFavorited); setLoaded(true); }
    }).catch(() => { if (!cancelled) setLoaded(true); });

    if (showCount) {
      api.get(`/campgrounds/${campgroundId}/followers`).then(r => {
        if (!cancelled) setCount(r.data.total || 0);
      }).catch(() => {});
    }

    return () => { cancelled = true; };
  }, [campgroundId, user]);

  const toggle = useCallback(async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) return;

    // Optimistic update
    const wasFavorited = isFavorited;
    setIsFavorited(!wasFavorited);
    setCount(c => wasFavorited ? Math.max(0, c - 1) : c + 1);

    try {
      if (wasFavorited) {
        await api.delete(`/campgrounds/${campgroundId}/favorite`);
      } else {
        await api.post(`/campgrounds/${campgroundId}/favorite`);
      }
    } catch {
      // Revert on failure
      setIsFavorited(wasFavorited);
      setCount(c => wasFavorited ? c + 1 : Math.max(0, c - 1));
    }
  }, [campgroundId, isFavorited, user]);

  if (!user || !loaded) return null;

  const iconSize = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';

  return (
    <button
      onClick={toggle}
      className={`flex items-center gap-1 transition-all ${className}`}
      title={isFavorited ? 'Unfavorite' : 'Favorite'}
    >
      <Heart
        className={`${iconSize} transition-colors ${isFavorited ? 'text-red-500' : 'text-gray-400 hover:text-red-400'}`}
        fill={isFavorited ? '#ef4444' : 'none'}
      />
      {showCount && count > 0 && (
        <span className="text-[10px] text-gray-500">{count}</span>
      )}
    </button>
  );
}
