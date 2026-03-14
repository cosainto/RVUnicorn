import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Loader } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

export default function CampersLikeYou() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [shown, setShown] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const contextRes = await api.get('/hitch/user-context');
      const ctx = contextRes.data;
      const { data } = await api.post('/hitch/campers-like-you', {
        interests: ctx.interests || [],
        rvType: ctx.rv?.type,
        state: ctx.homeState,
      });
      setResults(data);
      setShown(true);
    } catch { alert('Failed to load recommendations'); }
    finally { setLoading(false); }
  };

  if (!user) return null;

  if (!shown) return (
    <button onClick={generate} disabled={loading}
      className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-primary-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition shadow-sm">
      {loading ? <Loader className="w-4 h-4 animate-spin" /> : <img src="/hitch.png" className="w-5 h-5 rounded-full" />}
      {loading ? 'Finding matches...' : '👥 Campers Like You'}
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900">Campers Like You</p>
          <p className="text-xs text-gray-500">
            Based on {results?.similarUserCount || 0} campers with similar interests
          </p>
        </div>
        <button onClick={generate} className="ml-auto text-xs text-gray-400 hover:text-primary-600">Refresh</button>
      </div>

      {results?.campgrounds?.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6">
          Not enough data yet — add more camping interests to your profile!
        </p>
      )}

      <div className="space-y-3">
        {results?.campgrounds?.map((camp: any, i: number) => (
          <Link key={camp.id} to={`/campgrounds/${camp.id}`}
            className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition">
            {camp.imageUrl && (
              <img src={camp.imageUrl} alt={camp.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800 truncate">{camp.name}</p>
                {camp.matchScore && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0 font-bold">
                    {camp.matchScore}% match
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{camp.city}, {camp.state}
              </p>
              {camp.googleRating && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-400" />{camp.googleRating}
                </p>
              )}
              {camp.matchReason && (
                <p className="text-xs text-purple-600 italic mt-1">"{camp.matchReason}"</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
