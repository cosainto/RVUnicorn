import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  profilePicture: string | null;
}

interface Camper {
  user: User;
  startDate: string;
  endDate: string;
  isCurrentlyHere: boolean;
  tripTitle: string;
}

interface CampgroundCommunityProps {
  campgroundId: string;
  campgroundName: string;
}

export default function CampgroundCommunity({ campgroundId, campgroundName }: CampgroundCommunityProps) {
  const [followers, setFollowers] = useState<User[]>([]);
  const [followersTotal, setFollowersTotal] = useState(0);
  const [currentCampers, setCurrentCampers] = useState<Camper[]>([]);
  const [upcomingCampers, setUpcomingCampers] = useState<Camper[]>([]);
  const [showAllFollowers, setShowAllFollowers] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (campgroundId) {
      loadCommunity();
    }
  }, [campgroundId]);

  const loadCommunity = async () => {
    try {
      setLoading(true);
      setError(false);
      
      // Load followers
      const followersRes = await api.get(`/campgrounds/${campgroundId}/followers?limit=50`);
      setFollowers(followersRes.data?.followers || []);
      setFollowersTotal(followersRes.data?.total || 0);
      
      // Load campers
      const campersRes = await api.get(`/campgrounds/${campgroundId}/campers`);
      setCurrentCampers(campersRes.data?.currentCampers || []);
      setUpcomingCampers(campersRes.data?.upcomingCampers || []);
    } catch (err) {
      console.error('Failed to load community:', err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  // Get camping status for a user
  const getCampingStatus = (userId: string): 'camping' | 'upcoming' | null => {
    if (currentCampers.find(c => c.user.id === userId)) return 'camping';
    if (upcomingCampers.find(c => c.user.id === userId)) return 'upcoming';
    return null;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-gray-200 rounded w-1/3"></div>
          <div className="flex gap-2">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="w-12 h-12 bg-gray-200 rounded-full"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return null;
  }

  if (followers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-primary-600" />
          Community
        </h3>
        <p className="text-gray-500 text-sm">
          No followers yet. Be the first to follow {campgroundName}!
        </p>
      </div>
    );
  }

  // Sort followers: camping first, then upcoming, then others
  const sortedFollowers = [...followers].sort((a, b) => {
    const statusA = getCampingStatus(a.id);
    const statusB = getCampingStatus(b.id);
    
    if (statusA === 'camping' && statusB !== 'camping') return -1;
    if (statusA !== 'camping' && statusB === 'camping') return 1;
    if (statusA === 'upcoming' && statusB === null) return -1;
    if (statusA === null && statusB === 'upcoming') return 1;
    return 0;
  });

  const displayedFollowers = showAllFollowers ? sortedFollowers : sortedFollowers.slice(0, 12);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <button
        onClick={() => setShowAllFollowers(!showAllFollowers)}
        className="w-full flex items-center justify-between mb-4"
      >
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Users className="w-5 h-5 text-primary-600" />
          Community ({followersTotal} {followersTotal === 1 ? 'follower' : 'followers'})
        </h3>
        {followersTotal > 12 && (
          showAllFollowers ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )
        )}
      </button>
      
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
        {displayedFollowers.map(follower => {
          const campingStatus = getCampingStatus(follower.id);
          
          return (
            <Link
              key={follower.id}
              to={`/profile/${follower.username}`}
              className="group flex flex-col items-center"
            >
              <div className="relative overflow-hidden rounded-full">
                {follower.profilePicture ? (
                  <img
                    src={follower.profilePicture.startsWith('http') ? follower.profilePicture : `${follower.profilePicture}`}
                    alt={follower.firstName}
                    className={`w-16 h-16 rounded-full object-cover ${
                      campingStatus === 'camping' 
                        ? 'ring-3 ring-green-500' 
                        : campingStatus === 'upcoming' 
                          ? 'ring-3 ring-blue-500' 
                          : 'group-hover:ring-2 ring-primary-400'
                    } transition-all`}
                  />
                ) : (
                  <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
                    campingStatus === 'camping'
                      ? 'bg-green-100 ring-3 ring-green-500'
                      : campingStatus === 'upcoming'
                        ? 'bg-blue-100 ring-3 ring-blue-500'
                        : 'bg-gray-100 group-hover:ring-2 ring-primary-400'
                  } transition-all`}>
                    <span className={`font-semibold text-xl ${
                      campingStatus === 'camping'
                        ? 'text-green-700'
                        : campingStatus === 'upcoming'
                          ? 'text-blue-700'
                          : 'text-gray-600'
                    }`}>
                      {follower.firstName?.[0] || '?'}
                    </span>
                  </div>
                )}
                
                {/* Banner across the picture */}
                {campingStatus && (
                  <div className={`absolute bottom-0 left-0 right-0 text-center py-0.5 text-[10px] font-bold text-white ${
                    campingStatus === 'camping'
                      ? 'bg-green-500'
                      : 'bg-blue-500'
                  }`}>
                    {campingStatus === 'camping' ? 'CAMPING' : 'CAMPING SOON'}
                  </div>
                )}
              </div>
              
              <span className="text-xs text-gray-700 mt-1.5 font-medium truncate max-w-full text-center">
                {follower.firstName}
              </span>
            </Link>
          );
        })}
      </div>
      
      {!showAllFollowers && followersTotal > 12 && (
        <button
          onClick={() => setShowAllFollowers(true)}
          className="w-full mt-4 py-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
        >
          Show all {followersTotal} followers
        </button>
      )}
    </div>
  );
}
