import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, MapPin, ArrowRight } from 'lucide-react';
import api from '../../services/api';

interface TripKit {
  id: string;
  title: string;
  description?: string;
  coverImageUrl?: string;
  rigType?: string;
  estimatedDays?: number;
  tags: string[];
  _count: { saves: number; purchases: number; stops: number };
}

export default function CreatorTripKits({ creatorId }: { creatorId: string }) {
  const navigate = useNavigate();
  const [kits, setKits] = useState<TripKit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/trip-kits/creator/${creatorId}`).then(({ data }) => setKits(data.kits || [])).catch(() => {}).finally(() => setLoading(false));
  }, [creatorId]);

  if (loading) return <div className="animate-pulse h-32 bg-gray-100 rounded-xl" />;
  if (kits.length === 0) return null;

  async function useKit(kitId: string) {
    try {
      const { data } = await api.post(`/trip-kits/${kitId}/use`);
      navigate(`/events/${data.eventId || data.tripId}`);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create trip');
    }
  }

  async function toggleSave(kitId: string) {
    try {
      await api.post(`/trip-kits/${kitId}/save`);
      setKits(prev => [...prev]); // trigger re-render
    } catch {}
  }

  return (
    <div>
      <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
        <MapPin className="w-4 h-4 text-amber-500" /> Trip Kits
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {kits.map((kit) => (
          <div key={kit.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-md transition">
            {kit.coverImageUrl && (
              <Link to={`/trip-kits/${kit.id}`}>
                <img src={kit.coverImageUrl} alt={kit.title} className="w-full h-32 object-cover" />
              </Link>
            )}
            <div className="p-3">
              <div className="flex items-start justify-between gap-2">
                <Link to={`/trip-kits/${kit.id}`} className="font-semibold text-gray-900 text-sm hover:text-amber-600 transition line-clamp-1">
                  {kit.title}
                </Link>
                <button onClick={() => toggleSave(kit.id)} className="text-gray-400 hover:text-amber-500 transition flex-shrink-0">
                  <Bookmark className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {kit._count.stops} stops{kit.estimatedDays ? ` · ${kit.estimatedDays} days` : ''}{kit.rigType && kit.rigType !== 'ANY' ? ` · ${kit.rigType.replace('_', ' ')}` : ''}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-xs font-bold text-green-600">FREE</span>
                <button onClick={() => useKit(kit.id)}
                  className="flex items-center gap-1 text-xs font-semibold text-amber-600 hover:text-amber-700 transition">
                  Use This Trip <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
