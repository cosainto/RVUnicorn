import { useState } from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Star, Loader } from 'lucide-react';
import api from '../services/api';

const US_STATES = ['','AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

export default function HiddenGemFinder() {
  const [loading, setLoading] = useState(false);
  const [gems, setGems] = useState<any[]>([]);
  const [state, setState] = useState('');
  const [searched, setSearched] = useState(false);

  const find = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/hitch/hidden-gems?state=${state}&limit=8`);
      setGems(data.gems || []);
      setSearched(true);
    } catch { alert('Failed to find gems. Try again!'); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">💎</span>
        <div>
          <h3 className="font-bold text-gray-900">Hidden Gem Finder</h3>
          <p className="text-xs text-gray-500">High-rated campgrounds that most people haven't discovered yet</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <select value={state} onChange={e => setState(e.target.value)}
          className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
          <option value="">All States</option>
          {US_STATES.filter(s => s).map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={find} disabled={loading}
          className="px-4 py-2 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 disabled:opacity-50 transition flex items-center gap-2">
          {loading ? <Loader className="w-4 h-4 animate-spin" /> : '💎'}
          {loading ? 'Finding...' : 'Find Gems'}
        </button>
      </div>

      {searched && gems.length === 0 && (
        <p className="text-sm text-gray-500 text-center py-6">No hidden gems found — try a different state!</p>
      )}

      <div className="space-y-3">
        {gems.map((gem, i) => (
          <Link key={gem.id} to={`/campgrounds/${gem.id}`}
            className="flex gap-3 p-3 bg-gradient-to-r from-purple-50 to-primary-50 rounded-xl border border-purple-100 hover:border-purple-300 transition">
            <div className="shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
              {i + 1}
            </div>
            {gem.imageUrl && (
              <img src={gem.imageUrl} alt={gem.name} className="w-16 h-16 rounded-lg object-cover shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-gray-800 truncate">{gem.name}</p>
                <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full shrink-0 font-bold">
                  💎 Hidden Gem
                </span>
              </div>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <MapPin className="w-3 h-3" />{gem.city}, {gem.state}
              </p>
              <div className="flex items-center gap-3 mt-0.5">
                {gem.googleRating && (
                  <span className="text-xs text-amber-600 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />{gem.googleRating}
                  </span>
                )}
                <span className="text-xs text-gray-400">{gem._count?.followers || 0} followers</span>
                {gem.pricePerNight && <span className="text-xs text-green-600">${gem.pricePerNight}/night</span>}
              </div>
              {gem.tagline && (
                <p className="text-xs text-purple-600 italic mt-1">"{gem.tagline}"</p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
