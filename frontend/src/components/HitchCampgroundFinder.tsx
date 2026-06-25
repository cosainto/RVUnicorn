import { useState } from 'react';
import { Search, Loader, MapPin, Star } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';

const US_STATES = ['Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut','Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa','Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan','Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire','New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio','Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota','Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia','Wisconsin','Wyoming'];

export default function HitchCampgroundFinder() {
  const [loading, setLoading] = useState(false);
  const [likedCampground, setLikedCampground] = useState('');
  const [targetState, setTargetState] = useState('');
  const [results, setResults] = useState<any>(null);

  const search = async () => {
    if (!likedCampground || !targetState) return;
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/find-similar-campground', {
        campgroundName: likedCampground,
        targetState,
      });
      setResults(data);
    } catch { alert('Hitch had trouble searching. Try again!'); }
    finally { setLoading(false); }
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900">Find Similar Campgrounds</p>
          <p className="text-xs text-gray-500">Tell Hitch what you loved and where to look</p>
        </div>
      </div>

      <div className="space-y-3 mb-4">
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">I loved this campground</label>
          <input value={likedCampground} onChange={e => setLikedCampground(e.target.value)}
            placeholder="e.g. Disney Fort Wilderness, Lake George RV Park..."
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5" />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-500 block mb-1">Find similar ones in</label>
          <select value={targetState} onChange={e => setTargetState(e.target.value)}
            className="w-full text-sm border border-gray-200 rounded-xl px-4 py-2.5 bg-white">
            <option value="">Select a state...</option>
            {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <button onClick={search} disabled={loading || !likedCampground || !targetState}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition">
          {loading ? <><Loader className="w-4 h-4 animate-spin" /> Searching...</> : <><Search className="w-4 h-4" /> Find Matches</>}
        </button>
      </div>

      {results && (
        <div className="space-y-3">
          {results.tip && (
            <div className="bg-amber-50 rounded-xl p-3 text-xs text-amber-800 border border-amber-100">
              💡 {results.tip}
            </div>
          )}
          {results.matches?.length === 0 && (
            <p className="text-sm text-gray-500 text-center py-4">No matches found yet — more campgrounds coming soon!</p>
          )}
          {results.matches?.map((match: any, i: number) => (
            <Link key={i} to={`/campgrounds/${match.campground.id}`}
              className="flex gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100 hover:border-primary-200 hover:shadow-sm transition">
              {match.campground.imageUrl && (
                <img src={match.campground.imageUrl} alt={match.campground.name}
                  className="w-16 h-16 rounded-lg object-cover shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-800 truncate">{match.campground.name}</p>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />{match.campground.city}{match.campground.state ? `, ${match.campground.state}` : ''}{(match.campground as any).zipCode ? ` ${(match.campground as any).zipCode}` : ''}
                </p>
                {match.campground.rating && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Star className="w-3 h-3 fill-amber-400" />{match.campground.rating}
                  </p>
                )}
                <p className="text-xs text-primary-600 mt-1 italic">"{match.reason}"</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
