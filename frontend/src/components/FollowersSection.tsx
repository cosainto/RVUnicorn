import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, BadgeCheck, ChevronRight, Loader2, UserPlus } from 'lucide-react';
import api from '../services/api';

interface Follower {
  id: string;
  username: string;
  firstName?: string;
  lastName?: string;
  profilePicture?: string;
  isCreator?: boolean;
  creatorVerified?: boolean;
}

interface FollowersSectionProps {
  creatorId: string;
  isOwnProfile: boolean;
  className?: string;
}

export default function FollowersSection({ creatorId, isOwnProfile, className = '' }: FollowersSectionProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadFollowers();
  }, [creatorId]);

  const loadFollowers = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/creators/${creatorId}/followers?limit=6`);
      setFollowers(data.followers || []);
      setTotal(data.total || 0);
    } catch (error) {
      console.error('Error loading followers:', error);
    } finally {
      setLoading(false);
    }
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
          <Users className="w-5 h-5 text-purple-500" />
          {isOwnProfile ? 'My Followers' : 'Followers'}
        </h3>
        <span className="text-sm text-gray-500">{total} followers</span>
      </div>

      {followers.length === 0 ? (
        <div className="text-center py-8">
          <Users className="w-12 h-12 mx-auto mb-3 text-gray-200" />
          <p className="text-gray-500 mb-2">
            {isOwnProfile ? "You don\'t have any followers yet" : "No followers yet"}
          </p>
          {isOwnProfile && (
            <p className="text-xs text-gray-400">Share your content to grow your audience!</p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {followers.map((follower) => (
              <Link
                key={follower.id}
                to={`/profile/${follower.username}`}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition group"
              >
                {follower.profilePicture ? (
                  <img
                    src={follower.profilePicture.startsWith('http') ? follower.profilePicture : follower.profilePicture}
                    alt={follower.username}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold">
                    {(follower.firstName?.[0] || follower.username[0]).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <p className="font-medium text-gray-900 truncate group-hover:text-purple-600 transition">
                      {follower.firstName && follower.lastName
                        ? `${follower.firstName} ${follower.lastName}`
                        : follower.username}
                    </p>
                    {follower.creatorVerified && (
                      <BadgeCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-500 truncate">@{follower.username}</p>
                  {follower.isCreator && (
                    <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">Creator</span>
                  )}
                </div>

                <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-purple-500" />
              </Link>
            ))}
          </div>

          {total > 6 && (
            <Link
              to={`/creators/${creatorId}/followers`}
              className="block text-center text-sm text-purple-600 hover:text-purple-700 mt-4 py-2"
            >
              View all {total} followers →
            </Link>
          )}
        </>
      )}
    </div>
  );
}
