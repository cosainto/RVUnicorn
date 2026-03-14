import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface Props {
  locationId: string;
  locationType: 'campground' | 'host' | 'spot';
  refreshTrigger?: number;
}

export default function RVHerdHereNow({ locationId, locationType, refreshTrigger }: Props) {
  const [herd, setHerd] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchHerd(); }, [locationId, refreshTrigger]);

  const fetchHerd = async () => {
    try {
      const { data } = await api.get(`/checkins/herd/${locationType}/${locationId}`);
      setHerd(data);
    } catch { setHerd([]); }
    finally { setLoading(false); }
  };

  if (loading || herd.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">🐴</span>
        <h3 className="font-bold text-green-900">RV Herd Here Now</h3>
        <span className="ml-auto text-xs bg-green-600 text-white px-2 py-0.5 rounded-full font-bold">
          {herd.length} rig{herd.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {herd.map(checkIn => (
          <Link key={checkIn.id} to={`/profile/${checkIn.user.username}`}
            className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-green-100 hover:border-green-300 transition shadow-sm">
            {checkIn.user.profilePicture ? (
              <img src={checkIn.user.profilePicture} className="w-8 h-8 rounded-full object-cover" alt={checkIn.user.username} />
            ) : (
              <div className="w-8 h-8 rounded-full bg-green-200 flex items-center justify-center text-green-700 font-bold text-sm">
                {checkIn.user.firstName?.[0] || checkIn.user.username[0]}
              </div>
            )}
            <div>
              <p className="text-xs font-semibold text-gray-800">{checkIn.user.firstName || checkIn.user.username}</p>
              {checkIn.siteNumber && <p className="text-xs text-gray-400">Site {checkIn.siteNumber}</p>}
              {checkIn.notes && <p className="text-xs text-gray-500 italic max-w-[120px] truncate">"{checkIn.notes}"</p>}
            </div>
          </Link>
        ))}
      </div>
      <p className="text-xs text-green-700 mt-3">👋 Say hello! These RVers are parked here right now.</p>
    </div>
  );
}
