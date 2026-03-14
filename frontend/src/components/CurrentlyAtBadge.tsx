import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import api from '../services/api';

interface Props {
  userId: string;
  isOwnProfile?: boolean;
}

export default function CurrentlyAtBadge({ userId, isOwnProfile = false }: Props) {
  const [checkIn, setCheckIn] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/checkins/user/${userId}/active`)
      .then(r => setCheckIn(r.data))
      .catch(() => setCheckIn(null))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading || !checkIn) return null;

  const locationName = checkIn.campground?.name || checkIn.harvestHost?.name || checkIn.overnightSpot?.name || 'Unknown Location';
  const locationIcon = checkIn.harvestHost ? '🏡' : checkIn.overnightSpot ? '🅿️' : '🏕️';
  const locationLink = checkIn.campground
    ? `/campgrounds/${checkIn.campground.id}`
    : checkIn.harvestHost
    ? `/hosts/${checkIn.harvestHost.id}`
    : checkIn.overnightSpot
    ? `/overnight-spots/${checkIn.overnightSpot.id}`
    : null;

  const checkedInSince = new Date(checkIn.checkInDate);
  const now = new Date();
  const hoursAgo = Math.floor((now.getTime() - checkedInSince.getTime()) / (1000 * 60 * 60));
  const timeStr = hoursAgo < 1 ? 'Just arrived' : hoursAgo < 24 ? `${hoursAgo}h ago` : `${Math.floor(hoursAgo / 24)}d ago`;

  return (
    <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2 text-sm">
      <span className="text-lg">{locationIcon}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-green-600 font-semibold uppercase tracking-wide">Currently Parked</p>
        {locationLink ? (
          <Link to={locationLink} className="font-semibold text-gray-800 hover:text-primary-600 truncate block">
            {locationName}
          </Link>
        ) : (
          <p className="font-semibold text-gray-800 truncate">{locationName}</p>
        )}
        {checkIn.siteNumber && <p className="text-xs text-gray-500">Site {checkIn.siteNumber}</p>}
      </div>
      <span className="text-xs text-gray-400 shrink-0">{timeStr}</span>
      {isOwnProfile && (
        <button
          onClick={async () => {
            await api.delete('/checkins/active');
            setCheckIn(null);
          }}
          className="text-xs text-red-400 hover:text-red-600 shrink-0 ml-1"
          title="Check out"
        >
          ✕
        </button>
      )}
    </div>
  );
}
