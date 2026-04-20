import { useEffect, useRef, useState } from 'react';
import { Users, MapPin } from 'lucide-react';
import api from '../services/api';

interface Camper {
  id: string;
  firstName: string;
  username: string;
  profilePicture: string | null;
  checkInDate: string;
}

interface CommunityPin {
  campground: {
    id: string;
    name: string;
    latitude: number;
    longitude: number;
    state: string | null;
  };
  campers: Camper[];
}

export default function CommunityMapCard() {
  const mapRef = useRef<HTMLDivElement>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  const [pins, setPins] = useState<CommunityPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCampers, setTotalCampers] = useState(0);

  // Fetch community check-ins
  useEffect(() => {
    api.get('/checkins/community-map')
      .then(({ data }) => {
        setPins(data.pins || []);
        setTotalCampers((data.pins || []).reduce((sum: number, p: CommunityPin) => sum + p.campers.length, 0));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Init map
  useEffect(() => {
    if (!mapRef.current || !window.google) return;
    googleMapRef.current = new google.maps.Map(mapRef.current, {
      center: { lat: 39.8, lng: -98.5 },
      zoom: 4,
      mapTypeId: 'terrain',
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      styles: [
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
      ],
    });
    infoRef.current = new google.maps.InfoWindow();
  }, []);

  // Create avatar markers
  useEffect(() => {
    if (!googleMapRef.current || pins.length === 0) return;

    // Clear old markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    const bounds = new google.maps.LatLngBounds();

    pins.forEach((pin) => {
      const { campground, campers } = pin;
      if (!campground.latitude || !campground.longitude) return;

      const primary = campers[0];
      const count = campers.length;

      // Build avatar marker SVG
      const avatarUrl = primary.profilePicture;
      const initial = primary.firstName?.[0] || '?';
      const badgeCount = count > 1 ? count : 0;

      // Use a custom HTML overlay via InfoWindow-style marker
      const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52">
        <defs><clipPath id="c${campground.id.slice(0, 6)}"><circle cx="22" cy="20" r="16"/></clipPath></defs>
        <path d="M22 0C10 0 0 10 0 22c0 15 22 30 22 30s22-15 22-30C44 10 34 0 22 0z" fill="#E8A838"/>
        <circle cx="22" cy="20" r="17" fill="white"/>
        ${avatarUrl
          ? `<image href="${avatarUrl}" x="6" y="4" width="32" height="32" clip-path="url(#c${campground.id.slice(0, 6)})" preserveAspectRatio="xMidYMid slice"/>`
          : `<circle cx="22" cy="20" r="16" fill="#1a2d4a"/><text x="22" y="25" text-anchor="middle" fill="#E8A838" font-size="16" font-weight="bold" font-family="sans-serif">${initial}</text>`
        }
        ${badgeCount > 0 ? `<circle cx="36" cy="8" r="8" fill="#ef4444"/><text x="36" y="12" text-anchor="middle" fill="white" font-size="10" font-weight="bold" font-family="sans-serif">${badgeCount}</text>` : ''}
      </svg>`;

      const marker = new google.maps.Marker({
        position: { lat: campground.latitude, lng: campground.longitude },
        map: googleMapRef.current,
        icon: {
          url: 'data:image/svg+xml,' + encodeURIComponent(svgIcon),
          scaledSize: new google.maps.Size(44, 52),
          anchor: new google.maps.Point(22, 52),
        },
        title: `${count} camper${count > 1 ? 's' : ''} at ${campground.name}`,
      });

      marker.addListener('click', () => {
        if (!infoRef.current || !googleMapRef.current) return;
        const camperHtml = campers.slice(0, 5).map(c =>
          `<div style="display:flex;align-items:center;gap:6px;margin:4px 0">
            ${c.profilePicture
              ? `<img src="${c.profilePicture}" style="width:24px;height:24px;border-radius:50%;object-fit:cover"/>`
              : `<div style="width:24px;height:24px;border-radius:50%;background:#1a2d4a;color:#E8A838;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold">${c.firstName?.[0] || '?'}</div>`
            }
            <a href="/profile/${c.username}" style="font-size:12px;color:#1a2d4a;text-decoration:none;font-weight:500">${c.firstName}</a>
          </div>`
        ).join('');
        const extra = campers.length > 5 ? `<p style="font-size:11px;color:#888;margin:4px 0 0">+${campers.length - 5} more</p>` : '';

        infoRef.current.setContent(`
          <div style="padding:8px;max-width:220px">
            <p style="margin:0 0 4px;font-size:14px;font-weight:600">${campground.name}</p>
            <p style="margin:0 0 8px;font-size:11px;color:#888">${campground.state || ''}</p>
            ${camperHtml}${extra}
            <a href="/campgrounds/${campground.id}" style="display:block;margin-top:8px;font-size:12px;color:#E8A838;text-decoration:none;font-weight:600">View Campground &rarr;</a>
          </div>
        `);
        infoRef.current.open(googleMapRef.current, marker);
      });

      markersRef.current.push(marker);
      bounds.extend(marker.getPosition()!);
    });

    if (markersRef.current.length > 0) {
      googleMapRef.current.fitBounds(bounds);
      const listener = google.maps.event.addListener(googleMapRef.current, 'idle', () => {
        if (googleMapRef.current!.getZoom()! > 10) googleMapRef.current!.setZoom(10);
        google.maps.event.removeListener(listener);
      });
    }
  }, [pins]);

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="p-4 pb-2">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-bold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-green-600" />
            Community Map
            {totalCampers > 0 && (
              <span className="text-xs font-normal text-gray-400">({totalCampers} camping now)</span>
            )}
          </h3>
        </div>
        <p className="text-xs text-gray-500 mb-2">See where the RVUnicorn herd is parked right now</p>
      </div>
      <div style={{ height: 300, position: 'relative' }}>
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50 z-10">
            <div className="animate-spin w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full" />
          </div>
        )}
        <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
        {!loading && pins.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
            <div className="text-center">
              <MapPin className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No one checked in yet</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
