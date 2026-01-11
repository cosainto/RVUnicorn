import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Video,
  BadgeCheck,
  UserPlus,
  UserMinus,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import api from '../services/api';

interface Creator {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  creatorBio?: string;
  creatorSpecialties?: string[];
  creatorVerified?: boolean;
  isFollowing?: boolean;
  creatorStats?: {
    followerCount: number;
    totalViews: number;
  };
  _count?: {
    creatorContent: number;
  };
}

interface FollowingSectionProps {
  userId: string;
  isOwnProfile: boolean;
  className?: string;
}

export default function FollowingSection({ 
  userId, 
  isOwnProfile,
  className = ''
}: FollowingSectionProps) {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [followingStates, setFollowingStates] = useState<{ [key: string]: boolean }>({});

  useEffect(() => {
    loadFollowing();
  }, [userId]);

  const loadFollowing = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/creators/following/${userId}?limit=6`);
      setCreators(data.creators || []);
      setTotal(data.total || 0);
      
      const states: { [key: string]: boolean } = {};
      (data.creators || []).forEach((c: Creator) => {
        states[c.id] = c.isFollowing ?? true;
      });
      setFollowingStates(states);
    } catch (error) {
      console.error('Error loading following:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async (creatorId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const isCurrentlyFollowing = followingStates[creatorId];
    
    try {
      if (isCurrentlyFollowing) {
        await api.delete(`/creators/${creatorId}/follow`);
      } else {
        await api.post(`/creators/${creatorId}/follow`);
      }
      
      setFollowingStates(prev => ({
        ...prev,
        [creatorId]: !isCurrentlyFollowing,
      }));
    } catch (error) {
      console.error('Error toggling follow:', error);
    }
  };

  const formatNumber = (num?: number) => {
    if (!num) return '0';
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  if (loading) {
    return (
      <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-purple-500" />
        </div>
      </div>
    );
  }

  return (
    <div className={`bg-white rounded-lg shadow-md p-6 ${className}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-500" />
          Following Creators
        </h3>
        <span className="text-sm text-gray-500">{total} following</span>
      </div>

      {creators.length === 0 ? (
        <div className="text-center py-8">
          <Video className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 mb-2">
            {isOwnProfile ? "You're not following any creators yet" : "Not following any creators"}
          </p>
          {isOwnProfile && (
            <Link
              to="/creators"
              className="inline-flex items-center gap-2 mt-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition text-sm"
            >
              <UserPlus className="w-4 h-4" />
              Discover Creators
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {creators.map((creator) => (
              <Link
                key={creator.id}
                to={`/creators/${creator.username}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition group"
              >
                {creator.profilePicture ? (
                  <img
                    src={creator.profilePicture.startsWith('http') ? creator.profilePicture : `http://127.0.0.1:3001${creator.profilePicture}`}
                    alt={creator.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-white font-bold">
                    {(creator.firstName?.[0] || creator.username[0]).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition">
                      {creator.firstName && creator.lastName 
                        ? `${creator.firstName} ${creator.lastName}`
                        : creator.username}
                    </p>
                    {creator.creatorVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">@{creator.username}</p>
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                    <span>{formatNumber(creator.creatorStats?.followerCount)} followers</span>
                    <span>{creator._count?.creatorContent || 0} videos</span>
                  </div>
                </div>

                {!isOwnProfile && (
                  <button
                    onClick={(e) => handleFollow(creator.id, e)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
                      followingStates[creator.id]
                        ? 'bg-gray-100 text-gray-700 hover:bg-red-50 hover:text-red-600'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200'
                    }`}
                  >
                    {followingStates[creator.id] ? (
                      <span className="flex items-center gap-1">
                        <UserMinus className="w-3 h-3" />
                        Following
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <UserPlus className="w-3 h-3" />
                        Follow
                      </span>
                    )}
                  </button>
                )}

                {isOwnProfile && (
                  <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500" />
                )}
              </Link>
            ))}
          </div>

          {total > 6 && (
            <Link
              to={`/profile/${userId}/following`}
              className="block text-center text-sm text-purple-600 hover:text-purple-700 mt-4 py-2"
            >
              View all {total} creators →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
