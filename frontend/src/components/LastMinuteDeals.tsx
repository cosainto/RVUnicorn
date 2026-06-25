import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Tag, Check, Dog } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface Deal {
  id: string;
  title: string;
  description: string | null;
  availableFrom: string;
  availableTo: string;
  sitesAvailable: number;
  originalPrice: number | null;
  discountPrice: number | null;
  discountPercent: number | null;
  maxRigLength: number | null;
  allowsPets: boolean;
  distance?: number;
  campground: { id: string; name: string; city?: string; state?: string; zipCode?: string; imageUrl?: string };
}

interface Props {
  compact?: boolean;
  lat?: number;
  lon?: number;
  radiusMiles?: number;
}

export default function LastMinuteDeals({ compact = false, lat, lon, radiusMiles }: Props) {
  const { user } = useAuth() as any;
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      let userLat = lat;
      let userLon = lon;

      if (!userLat || !userLon) {
        try {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
          );
          userLat = pos.coords.latitude;
          userLon = pos.coords.longitude;
        } catch {
          // Fallback: use feed endpoint instead
          try {
            const { data } = await api.get('/last-minute/feed');
            setDeals(data.deals || []);
          } catch {}
          setLoading(false);
          return;
        }
      }

      try {
        const params: any = { lat: userLat, lon: userLon };
        if (radiusMiles) params.radiusMiles = radiusMiles;
        const { data } = await api.get('/last-minute/nearby', { params });
        setDeals(data.deals || []);
      } catch {}
      setLoading(false);
    };
    load();
  }, [lat, lon, radiusMiles]);

  if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  if (deals.length === 0) return null;

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  if (compact) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <span className="text-base">🔥</span>
          <h3 className="font-bold text-sm text-gray-900">Last-Minute Near You</h3>
          <span className="bg-red-100 text-red-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{deals.length}</span>
        </div>
        <div className="divide-y divide-gray-50">
          {deals.slice(0, 3).map(deal => (
            <Link key={deal.id} to={`/campgrounds/${deal.campground.id}?deal=${deal.id}`}
              className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-800 truncate">{deal.campground.name}</p>
                <p className="text-[10px] text-gray-400">{formatDate(deal.availableFrom)} – {formatDate(deal.availableTo)} {deal.distance ? `· ${deal.distance}mi` : ''}</p>
              </div>
              {deal.discountPercent && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">{deal.discountPercent}% off</span>
              )}
            </Link>
          ))}
        </div>
        <Link to="/deals" className="block text-center py-2 text-xs text-orange-600 font-semibold hover:bg-orange-50 transition">
          See all deals →
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
        🔥 Last-Minute Deals Near You
        <span className="bg-red-100 text-red-700 text-xs font-bold px-2 py-0.5 rounded-full">{deals.length}</span>
      </h2>
      {deals.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 p-8 text-center">
          <p className="text-2xl mb-2">🏕️</p>
          <p className="text-sm text-gray-500">No last-minute deals near you right now — check back soon!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {deals.map(deal => (
            <Link key={deal.id} to={`/campgrounds/${deal.campground.id}?deal=${deal.id}`}
              className="bg-white rounded-2xl border border-gray-100 overflow-hidden hover:shadow-lg hover:border-orange-200 transition group">
              <div className="h-32 bg-gray-100 overflow-hidden relative">
                {deal.campground.imageUrl ? (
                  <img src={deal.campground.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition duration-300" alt="" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-3xl">🏕️</div>
                )}
                {deal.discountPercent && (
                  <div className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-lg">
                    {deal.discountPercent}% OFF
                  </div>
                )}
              </div>
              <div className="p-3">
                <h3 className="font-bold text-gray-900 text-sm">{deal.campground.name}</h3>
                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                  <MapPin className="w-3 h-3" />
                  {`${deal.campground.city || ''}${deal.campground.state ? `, ${deal.campground.state}` : ''}${deal.campground.zipCode ? ` ${deal.campground.zipCode}` : ''}`}
                  {deal.distance && ` · ${deal.distance}mi`}
                </p>
                <p className="text-xs text-gray-600 mt-2 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {formatDate(deal.availableFrom)} – {formatDate(deal.availableTo)}
                </p>
                <div className="flex items-center gap-2 mt-2">
                  {deal.originalPrice && deal.discountPrice && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-400 line-through">${deal.originalPrice}</span>
                      <span className="text-sm font-bold text-red-600">${deal.discountPrice}/night</span>
                    </div>
                  )}
                  <span className="text-xs text-gray-500">{deal.sitesAvailable} site{deal.sitesAvailable > 1 ? 's' : ''}</span>
                </div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {(user as any)?.rvLength && (!deal.maxRigLength || (user as any).rvLength <= deal.maxRigLength) && (
                    <span className="text-[10px] bg-green-50 text-green-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Check className="w-2.5 h-2.5" /> Fits your rig
                    </span>
                  )}
                  {deal.allowsPets && (
                    <span className="text-[10px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                      <Dog className="w-2.5 h-2.5" /> Pet friendly
                    </span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
