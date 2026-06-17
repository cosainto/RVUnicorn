/**
 * SocialMapCard — Friend-centric social map for Basecamp.
 * Three layers: Live Friends (avatar markers), Recent Albums (thumbnail markers),
 * Upcoming Friend Trips (faded calendar markers). Google Maps + MarkerClusterer.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { Users, Image, Calendar, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import api from '../services/api';

// ── Types ──────────────────────────────────────────────────────────────

interface LiveFriend {
  userId: string;
  username: string;
  firstName: string;
  avatarUrl: string | null;
  campgroundId: string;
  campgroundName: string;
  latitude: number;
  longitude: number;
  state: string | null;
  checkedInAt: string;
}

interface RecentAlbum {
  albumId: string;
  albumTitle: string;
  ownerUsername: string;
  ownerFirstName: string;
  ownerAvatarUrl: string | null;
  coverImageUrl: string | null;
  campgroundName: string | null;
  campgroundId: string | null;
  latitude: number;
  longitude: number;
  createdAt: string;
}

interface UpcomingFriendTrip {
  tripId: string;
  tripTitle: string;
  ownerUsername: string;
  ownerFirstName: string;
  ownerAvatarUrl: string | null;
  campgroundName: string | null;
  campgroundId: string | null;
  latitude: number;
  longitude: number;
  departureDate: string;
}

type SocialLayer = 'live' | 'albums' | 'upcoming';

// ── Constants ──────────────────────────────────────────────────────────

const ALBUM_CAP = 15;
const UPCOMING_CAP = 10;

// ── Component ──────────────────────────────────────────────────────────

export default function SocialMapCard() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const [loading, setLoading] = useState(true);
  const [liveFriends, setLiveFriends] = useState<LiveFriend[]>([]);
  const [recentAlbums, setRecentAlbums] = useState<RecentAlbum[]>([]);
  const [upcomingTrips, setUpcomingTrips] = useState<UpcomingFriendTrip[]>([]);
  const [activeLayers, setActiveLayers] = useState<SocialLayer[]>(['live', 'albums', 'upcoming']);

  const hasAnyData = liveFriends.length > 0 || recentAlbums.length > 0 || upcomingTrips.length > 0;

  // ── Fetch data ────────────────────────────────────────────────────────
  useEffect(() => {
    api.get('/basecamp/social-map')
      .then(({ data }) => {
        setLiveFriends(data.liveFriends || []);
        setRecentAlbums(data.recentAlbums || []);
        setUpcomingTrips(data.upcomingFriendTrips || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // ── Init map ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8, lng: -98.5 },
      zoom: 4,
      mapTypeId: 'terrain',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });
    infoRef.current = new google.maps.InfoWindow();
  }, []);

  // ── Curation: de-dupe albums against live ──────────────────────────────
  const getCuratedAlbums = useCallback((): RecentAlbum[] => {
    // Remove albums at same campground where friend is currently live
    const liveCampgroundIds = new Set(liveFriends.map(f => f.campgroundId));
    const deduped = recentAlbums.filter(a => !a.campgroundId || !liveCampgroundIds.has(a.campgroundId));
    // Newest first, cap at ALBUM_CAP
    return deduped
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, ALBUM_CAP);
  }, [liveFriends, recentAlbums]);

  // ── Build markers ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!googleMapRef.current) return;

    // Clear existing
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    if (clustererRef.current) {
      clustererRef.current.clearMarkers();
      clustererRef.current = null;
    }

    const bounds = new google.maps.LatLngBounds();
    let markerCount = 0;

    // ── Live Friends (avatar markers) ───────────────────────────────────
    if (activeLayers.includes('live')) {
      liveFriends.forEach(friend => {
        const initial = friend.firstName?.[0] || '?';
        const avatarUrl = friend.avatarUrl;

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
          <defs><clipPath id="av${friend.userId.slice(0, 6)}"><circle cx="22" cy="20" r="16"/></clipPath></defs>
          <circle cx="22" cy="20" r="20" fill="#22c55e" opacity="0.3"/>
          <circle cx="22" cy="20" r="18" fill="#22c55e" stroke="white" stroke-width="2"/>
          ${avatarUrl
            ? `<image href="${avatarUrl}" x="6" y="4" width="32" height="32" clip-path="url(#av${friend.userId.slice(0, 6)})" preserveAspectRatio="xMidYMid slice"/>`
            : `<circle cx="22" cy="20" r="16" fill="#1B2B4B"/><text x="22" y="25" text-anchor="middle" fill="#E8A838" font-size="16" font-weight="bold" font-family="sans-serif">${initial}</text>`
          }
        </svg>`;

        const marker = new google.maps.Marker({
          position: { lat: friend.latitude, lng: friend.longitude },
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(44, 52),
            anchor: new google.maps.Point(22, 26),
          },
          title: `${friend.firstName} at ${friend.campgroundName}`,
          zIndex: 100, // Live friends on top
        });

        marker.addListener('click', () => {
          if (!infoRef.current || !googleMapRef.current) return;
          infoRef.current.setContent(`
            <div style="padding:8px;max-width:220px">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
                ${avatarUrl
                  ? `<img src="${avatarUrl}" style="width:32px;height:32px;border-radius:50%;object-fit:cover;border:2px solid #22c55e"/>`
                  : `<div style="width:32px;height:32px;border-radius:50%;background:#1B2B4B;color:#E8A838;display:flex;align-items:center;justify-content:center;font-weight:bold">${initial}</div>`
                }
                <div>
                  <p style="margin:0;font-weight:600;font-size:14px">${friend.firstName}</p>
                  <p style="margin:0;font-size:11px;color:#22c55e;font-weight:500">Camping now</p>
                </div>
              </div>
              <p style="margin:0 0 8px;font-size:13px;color:#666">📍 ${friend.campgroundName}${friend.state ? ', ' + friend.state : ''}</p>
              <a href="/profile/${friend.username}" style="font-size:12px;color:#E8622A;text-decoration:none;font-weight:600">View activity →</a>
            </div>
          `);
          infoRef.current.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        markerCount++;
      });
    }

    // ── Recent Albums (thumbnail markers) ───────────────────────────────
    if (activeLayers.includes('albums')) {
      const albums = getCuratedAlbums();
      albums.forEach(album => {
        const initial = album.ownerFirstName?.[0] || '?';

        // Rounded square thumbnail marker with owner badge
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="50" viewBox="0 0 44 50">
          <defs>
            <clipPath id="th${album.albumId.slice(0, 6)}"><rect x="4" y="2" width="36" height="36" rx="6"/></clipPath>
            <clipPath id="ob${album.albumId.slice(0, 6)}"><circle cx="36" cy="38" r="7"/></clipPath>
          </defs>
          <rect x="4" y="2" width="36" height="36" rx="6" fill="#1B2B4B" stroke="#C9A84C" stroke-width="1.5"/>
          ${album.coverImageUrl
            ? `<image href="${album.coverImageUrl}" x="4" y="2" width="36" height="36" clip-path="url(#th${album.albumId.slice(0, 6)})" preserveAspectRatio="xMidYMid slice"/>`
            : `<text x="22" y="24" text-anchor="middle" fill="#C9A84C" font-size="14" font-family="sans-serif">📷</text>`
          }
          <circle cx="36" cy="38" r="8" fill="white"/>
          ${album.ownerAvatarUrl
            ? `<image href="${album.ownerAvatarUrl}" x="29" y="31" width="14" height="14" clip-path="url(#ob${album.albumId.slice(0, 6)})" preserveAspectRatio="xMidYMid slice"/>`
            : `<circle cx="36" cy="38" r="7" fill="#1B2B4B"/><text x="36" y="41" text-anchor="middle" fill="#E8A838" font-size="8" font-weight="bold" font-family="sans-serif">${initial}</text>`
          }
        </svg>`;

        const marker = new google.maps.Marker({
          position: { lat: album.latitude, lng: album.longitude },
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(44, 50),
            anchor: new google.maps.Point(22, 38),
          },
          title: `${album.ownerFirstName}'s album: ${album.albumTitle}`,
          zIndex: 50,
        });

        marker.addListener('click', () => {
          if (!infoRef.current || !googleMapRef.current) return;
          const dateStr = new Date(album.createdAt).toLocaleDateString();
          infoRef.current.setContent(`
            <div style="padding:8px;max-width:240px">
              ${album.coverImageUrl ? `<img src="${album.coverImageUrl}" style="width:100%;height:80px;object-fit:cover;border-radius:6px;margin-bottom:8px"/>` : ''}
              <p style="margin:0 0 2px;font-size:14px;font-weight:600">${album.albumTitle}</p>
              <p style="margin:0 0 4px;font-size:12px;color:#666">by ${album.ownerFirstName} · ${dateStr}</p>
              ${album.campgroundName ? `<p style="margin:0 0 8px;font-size:12px;color:#888">📍 ${album.campgroundName}</p>` : ''}
              <a href="/albums/${album.albumId}" style="font-size:12px;color:#E8622A;text-decoration:none;font-weight:600">View album →</a>
            </div>
          `);
          infoRef.current.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        markerCount++;
      });
    }

    // ── Upcoming Friend Trips (faded calendar markers) ──────────────────
    if (activeLayers.includes('upcoming')) {
      const capped = upcomingTrips.slice(0, UPCOMING_CAP);
      capped.forEach(trip => {
        const dateStr = new Date(trip.departureDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const initial = trip.ownerFirstName?.[0] || '?';

        // Faded/desaturated pin with calendar glyph
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="52" viewBox="0 0 40 52" opacity="0.65">
          <path d="M20 0C8.96 0 0 8.96 0 20c0 14 20 28 20 28s20-14 20-28C40 8.96 31.04 0 20 0z" fill="#6366f1" stroke="white" stroke-width="1.5"/>
          <rect x="10" y="8" width="20" height="18" rx="3" fill="white"/>
          <rect x="10" y="8" width="20" height="6" rx="3" fill="#6366f1"/>
          <text x="20" y="22" text-anchor="middle" fill="#1B2B4B" font-size="8" font-weight="bold" font-family="sans-serif">${dateStr}</text>
          ${trip.ownerAvatarUrl
            ? `<defs><clipPath id="up${trip.tripId.slice(0, 6)}"><circle cx="32" cy="40" r="6"/></clipPath></defs><circle cx="32" cy="40" r="7" fill="white"/><image href="${trip.ownerAvatarUrl}" x="26" y="34" width="12" height="12" clip-path="url(#up${trip.tripId.slice(0, 6)})" preserveAspectRatio="xMidYMid slice"/>`
            : `<circle cx="32" cy="40" r="7" fill="#1B2B4B"/><text x="32" y="43" text-anchor="middle" fill="#E8A838" font-size="7" font-weight="bold" font-family="sans-serif">${initial}</text>`
          }
        </svg>`;

        const marker = new google.maps.Marker({
          position: { lat: trip.latitude, lng: trip.longitude },
          map: googleMapRef.current,
          icon: {
            url: 'data:image/svg+xml,' + encodeURIComponent(svg),
            scaledSize: new google.maps.Size(40, 52),
            anchor: new google.maps.Point(20, 52),
          },
          title: `${trip.ownerFirstName}'s trip: ${trip.tripTitle}`,
          zIndex: 25,
        });

        marker.addListener('click', () => {
          if (!infoRef.current || !googleMapRef.current) return;
          const fullDate = new Date(trip.departureDate).toLocaleDateString();
          infoRef.current.setContent(`
            <div style="padding:8px;max-width:220px">
              <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
                <span style="font-size:16px">📅</span>
                <span style="font-size:11px;color:#6366f1;font-weight:600">UPCOMING</span>
              </div>
              <p style="margin:0 0 2px;font-size:14px;font-weight:600">${trip.tripTitle}</p>
              <p style="margin:0 0 4px;font-size:12px;color:#666">${trip.ownerFirstName} · ${fullDate}</p>
              ${trip.campgroundName ? `<p style="margin:0 0 8px;font-size:12px;color:#888">📍 ${trip.campgroundName}</p>` : ''}
              <a href="/trips/${trip.tripId}" style="font-size:12px;color:#E8622A;text-decoration:none;font-weight:600">View trip →</a>
            </div>
          `);
          infoRef.current.open(googleMapRef.current, marker);
        });

        markersRef.current.push(marker);
        bounds.extend(marker.getPosition()!);
        markerCount++;
      });
    }

    // ── Clustering ──────────────────────────────────────────────────────
    if (markersRef.current.length > 10) {
      clustererRef.current = new MarkerClusterer({
        map: googleMapRef.current,
        markers: markersRef.current,
        renderer: {
          render: ({ count, position }) => {
            // Cluster face = highest priority visible marker (live > album > upcoming)
            return new google.maps.Marker({
              position,
              icon: {
                url: `data:image/svg+xml,${encodeURIComponent(`
                  <svg width="48" height="48" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                    <circle cx="24" cy="24" r="22" fill="#1B2B4B" stroke="#E8A838" stroke-width="2"/>
                    <text x="24" y="29" text-anchor="middle" font-size="14" font-weight="bold" fill="white" font-family="sans-serif">${count}</text>
                  </svg>
                `)}`,
                scaledSize: new google.maps.Size(48, 48),
                anchor: new google.maps.Point(24, 24),
              },
              zIndex: 200,
            });
          },
        },
      });
    }

    // ── Fit bounds ──────────────────────────────────────────────────────
    if (markerCount > 0) {
      googleMapRef.current!.fitBounds(bounds);
      const listener = google.maps.event.addListener(googleMapRef.current!, 'idle', () => {
        const zoom = googleMapRef.current!.getZoom();
        if (zoom && zoom > 12) googleMapRef.current!.setZoom(12);
        google.maps.event.removeListener(listener);
      });
    }
  }, [liveFriends, recentAlbums, upcomingTrips, activeLayers, getCuratedAlbums]);

  // ── Toggle layers ─────────────────────────────────────────────────────
  const toggleLayer = (layer: SocialLayer) => {
    setActiveLayers(prev =>
      prev.includes(layer) ? prev.filter(l => l !== layer) : [...prev, layer]
    );
  };

  // ── Render ────────────────────────────────────────────────────────────
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-[#E8622A]" />
            Friends Map
          </h3>
          {liveFriends.length > 0 && (
            <span className="text-xs text-green-600 font-medium">{liveFriends.length} camping now</span>
          )}
        </div>
        <p className="text-xs text-gray-500 mb-3">Where your community is — now, recently, and next</p>

        {/* Layer toggles */}
        <div className="flex gap-2 mb-2 flex-wrap">
          <button
            onClick={() => toggleLayer('live')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
              activeLayers.includes('live')
                ? 'bg-green-50 border-green-300 text-green-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <Users size={12} />
            Live ({liveFriends.length})
          </button>
          <button
            onClick={() => toggleLayer('albums')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
              activeLayers.includes('albums')
                ? 'bg-amber-50 border-amber-300 text-amber-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <Image size={12} />
            Albums ({recentAlbums.length})
          </button>
          <button
            onClick={() => toggleLayer('upcoming')}
            className={`flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border transition ${
              activeLayers.includes('upcoming')
                ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                : 'bg-gray-50 border-gray-200 text-gray-400'
            }`}
          >
            <Calendar size={12} />
            Upcoming ({upcomingTrips.length})
          </button>
        </div>
      </div>

      {/* Map or empty state */}
      <div className="relative" style={{ height: '280px' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="animate-pulse text-gray-400 text-sm">Loading map...</div>
          </div>
        )}

        {!loading && !hasAnyData && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-gray-50 to-white z-10 px-6 text-center">
            <div className="text-3xl mb-2">🗺️</div>
            <p className="text-sm font-medium text-gray-700 mb-1">Your friends' trips will show up here</p>
            <p className="text-xs text-gray-400">Follow some campers to fill the map with their adventures.</p>
          </div>
        )}

        <div ref={mapRef} className="w-full h-full" />
      </div>
    </div>
  );
}
