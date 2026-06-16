import { useState, useEffect } from 'react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', body: '#1E2D42', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552', success: '#4CAF82' };
const JOURNEY_COLORS = ['#C9A84C', '#E8622A', '#1D9E75', '#5B8DEF', '#D94F8C', '#8B6CC1'];

interface MapStop {
  id: string;
  tripId: string;
  name: string;
  lat: number | null;
  lng: number | null;
  order: number;
  arrivedAt: string;
  departedAt: string | null;
  nightsStayed: number;
  stopType: string;
  albumData: {
    photoCount: number;
    coverPhotoUrl: string;
    topPhotoUrl: string;
    topPhotoLikes: number;
    allPhotos: string[];
  } | null;
}

interface TripGroup {
  tripId: string;
  tripName: string;
  color: string;
  stops: MapStop[];
}

type PhotoMode = 'cover' | 'top';

export default function RigMapWithPhotos({ slug }: { slug: string }) {
  const [stops, setStops] = useState<MapStop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expandedStopId, setExpandedStopId] = useState<string | null>(null);
  const [photoMode, setPhotoMode] = useState<PhotoMode>('cover');

  useEffect(() => {
    api.get(`/rigs/${slug}/map-with-albums`)
      .then(r => setStops(r.data || []))
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  // Group stops by trip
  const tripGroups: TripGroup[] = [];
  const tripMap = new Map<string, TripGroup>();
  stops.forEach(stop => {
    let group = tripMap.get(stop.tripId);
    if (!group) {
      group = {
        tripId: stop.tripId,
        tripName: `Journey ${tripMap.size + 1}`,
        color: JOURNEY_COLORS[tripMap.size % JOURNEY_COLORS.length],
        stops: [],
      };
      tripMap.set(stop.tripId, group);
      tripGroups.push(group);
    }
    group.stops.push(stop);
  });

  // Sort stops within each group
  tripGroups.forEach(g => g.stops.sort((a, b) => a.order - b.order));

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return ''; }
  };

  const getThumbUrl = (stop: MapStop): string | null => {
    if (!stop.albumData) return null;
    return photoMode === 'top' && stop.albumData.topPhotoUrl
      ? stop.albumData.topPhotoUrl
      : stop.albumData.coverPhotoUrl || null;
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl p-5" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-32 rounded animate-pulse" style={{ background: CN.cardAlt }} />
          <div className="h-7 w-44 rounded-full animate-pulse" style={{ background: CN.cardAlt }} />
        </div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="flex items-center gap-4 mb-5">
            <div className="w-12 h-12 rounded-full animate-pulse" style={{ background: CN.cardAlt }} />
            <div className="flex-1">
              <div className="h-4 w-40 rounded animate-pulse mb-2" style={{ background: CN.cardAlt }} />
              <div className="h-3 w-24 rounded animate-pulse" style={{ background: CN.cardAlt }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error || stops.length === 0) {
    return (
      <div className="text-center py-12">
        <span className="text-4xl block mb-2">{error ? '⚠️' : '🗺️'}</span>
        <p className="text-sm" style={{ color: CN.muted }}>
          {error ? 'Could not load route map data' : 'No trip stops with location data yet'}
        </p>
        <p className="text-xs mt-1" style={{ color: `${CN.muted}80` }}>
          {error ? 'Try refreshing the page' : 'Start a trip and add stops to see your route map here'}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: CN.card, border: `1px solid ${CN.border}` }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <h3 className="text-sm font-bold" style={{ color: CN.cream }}>Route Map</h3>
        <div className="flex items-center rounded-full p-0.5" style={{ background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
          <button
            onClick={() => setPhotoMode('cover')}
            className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200"
            style={{
              background: photoMode === 'cover' ? CN.gold : 'transparent',
              color: photoMode === 'cover' ? CN.bg : CN.muted,
            }}
          >
            Cover Photo
          </button>
          <button
            onClick={() => setPhotoMode('top')}
            className="px-3 py-1 rounded-full text-[10px] font-semibold transition-all duration-200"
            style={{
              background: photoMode === 'top' ? CN.gold : 'transparent',
              color: photoMode === 'top' ? CN.bg : CN.muted,
            }}
          >
            Top Moment
          </button>
        </div>
      </div>

      {/* Route display */}
      <div className="px-5 pb-5">
        {tripGroups.map((group, gi) => (
          <div key={group.tripId} className={gi > 0 ? 'mt-6' : ''}>
            {/* Trip header */}
            {tripGroups.length > 1 && (
              <div className="flex items-center gap-2 mb-3">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: group.color }} />
                <span className="text-xs font-bold uppercase tracking-wider" style={{ color: group.color }}>
                  {group.tripName}
                </span>
                <span className="text-[10px]" style={{ color: CN.muted }}>
                  {group.stops.length} stop{group.stops.length !== 1 ? 's' : ''}
                </span>
              </div>
            )}

            {/* Stops route */}
            <div className="relative">
              {group.stops.map((stop, si) => {
                const isLast = si === group.stops.length - 1;
                const isExpanded = expandedStopId === stop.id;
                const thumbUrl = getThumbUrl(stop);
                const hasPhotos = !!stop.albumData && stop.albumData.photoCount > 0;

                return (
                  <div key={stop.id}>
                    {/* Stop row */}
                    <div
                      className="flex items-start gap-3 relative cursor-pointer group"
                      onClick={() => setExpandedStopId(isExpanded ? null : stop.id)}
                    >
                      {/* Vertical line + pin */}
                      <div className="flex flex-col items-center flex-shrink-0" style={{ width: 48 }}>
                        {/* Photo thumbnail or pin */}
                        {thumbUrl ? (
                          <div
                            className="w-12 h-12 rounded-full overflow-hidden flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                            style={{
                              border: `3px solid ${group.color}`,
                              boxShadow: isExpanded ? `0 0 12px ${group.color}60` : 'none',
                            }}
                          >
                            <img src={thumbUrl} alt={stop.name} className="w-full h-full object-cover" />
                          </div>
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-110"
                            style={{
                              background: `${group.color}20`,
                              border: `3px solid ${group.color}`,
                            }}
                          >
                            <span className="text-lg">
                              {stop.stopType === 'campground' ? '🏕️' :
                               stop.stopType === 'fuel' ? '⛽' :
                               stop.stopType === 'attraction' ? '⭐' :
                               stop.stopType === 'waypoint' ? '📍' : '📌'}
                            </span>
                          </div>
                        )}
                        {/* Connecting line */}
                        {!isLast && (
                          <div
                            className="flex-1 min-h-[24px]"
                            style={{
                              width: 2,
                              background: `linear-gradient(to bottom, ${group.color}, ${group.color}40)`,
                              marginTop: 4,
                              marginBottom: 4,
                            }}
                          />
                        )}
                      </div>

                      {/* Stop info */}
                      <div className="flex-1 min-w-0 pb-4" style={{ paddingTop: 6 }}>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate" style={{ color: CN.cream }}>
                            {stop.name}
                          </p>
                          {hasPhotos && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0" style={{ background: `${CN.gold}20`, color: CN.gold }}>
                              {stop.albumData!.photoCount} photo{stop.albumData!.photoCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px]" style={{ color: CN.muted }}>
                            {formatDate(stop.arrivedAt)}
                            {stop.departedAt && ` - ${formatDate(stop.departedAt)}`}
                          </span>
                          {stop.nightsStayed > 0 && (
                            <span className="text-[10px]" style={{ color: `${CN.muted}90` }}>
                              {stop.nightsStayed} night{stop.nightsStayed !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {stop.lat != null && stop.lng != null && (
                          <span className="text-[10px] mt-0.5 block" style={{ color: `${CN.muted}60` }}>
                            {stop.lat.toFixed(2)}, {stop.lng.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {/* Expand indicator */}
                      {hasPhotos && (
                        <span
                          className="text-xs mt-2 flex-shrink-0 transition-transform duration-200"
                          style={{
                            color: CN.muted,
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}
                        >
                          ▾
                        </span>
                      )}
                    </div>

                    {/* Expanded photo preview card */}
                    {isExpanded && hasPhotos && (
                      <div
                        className="ml-[60px] mb-4 rounded-xl p-3 transition-all duration-300"
                        style={{
                          background: CN.cardAlt,
                          border: `1px solid ${group.color}30`,
                          animation: 'slideDown 200ms ease-out',
                        }}
                      >
                        {/* Photo strip */}
                        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                          {(stop.albumData!.allPhotos || []).slice(0, 5).map((photoUrl, pi) => (
                            <img
                              key={pi}
                              src={photoUrl}
                              alt={`${stop.name} photo ${pi + 1}`}
                              className="w-20 h-20 rounded-lg object-cover flex-shrink-0 transition hover:brightness-110"
                              style={{ border: `1px solid ${CN.border}` }}
                            />
                          ))}
                          {stop.albumData!.photoCount > 5 && (
                            <div
                              className="w-20 h-20 rounded-lg flex-shrink-0 flex items-center justify-center"
                              style={{ background: `${CN.border}80`, border: `1px solid ${CN.border}` }}
                            >
                              <span className="text-xs font-bold" style={{ color: CN.muted }}>
                                +{stop.albumData!.photoCount - 5}
                              </span>
                            </div>
                          )}
                        </div>
                        {/* Footer */}
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-[10px]" style={{ color: CN.muted }}>
                            {stop.albumData!.photoCount} photo{stop.albumData!.photoCount !== 1 ? 's' : ''} from this stop
                          </span>
                          {photoMode === 'top' && stop.albumData!.topPhotoLikes > 0 && (
                            <span className="text-[10px]" style={{ color: CN.gold }}>
                              ❤️ {stop.albumData!.topPhotoLikes} likes on top photo
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {/* Journey legend */}
        {tripGroups.length > 1 && (
          <div className="mt-4 pt-4 flex flex-wrap gap-3" style={{ borderTop: `1px solid ${CN.border}` }}>
            <span className="text-[10px] uppercase tracking-wider" style={{ color: CN.muted }}>Journeys:</span>
            {tripGroups.map(g => (
              <div key={g.tripId} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: g.color }} />
                <span className="text-[10px] font-semibold" style={{ color: g.color }}>{g.tripName}</span>
                <span className="text-[10px]" style={{ color: CN.muted }}>({g.stops.length})</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
