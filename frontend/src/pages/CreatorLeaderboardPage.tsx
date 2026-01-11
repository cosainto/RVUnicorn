import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Trophy,
  Eye,
  Heart,
  Users,
  TrendingUp,
  Crown,
  Medal,
  Award,
  ChevronLeft,
  Star,
  Flame,
  Snowflake,
} from 'lucide-react';
import api from '../services/api';

interface Creator {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  profilePicture: string | null;
  creatorBio: string | null;
  creatorVerified: boolean;
  creatorHandle?: string;
  creatorDisplayName?: string;
  creatorStats?: {
    totalViews: number;
    totalLikes: number;
    followerCount: number;
    viewsThisWeek?: number;
    followersThisWeek?: number;
  };
  lastPostDate?: string;
  isInactive?: boolean;
  heatLevel?: number;
  
  _count?: {
    creatorContent: number;
  };
}

type SortBy = 'views' | 'likes' | 'followers' | 'content';

export default function CreatorLeaderboardPage() {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<SortBy>('views');

  useEffect(() => {
    fetchLeaderboard();
  }, [sortBy]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/creators/leaderboard?sortBy=${sortBy}&limit=50`);
      setCreators(data);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (index: number) => {
    if (index === 0) return <Crown className="w-8 h-8 text-yellow-500" />;
    if (index === 1) return <Medal className="w-7 h-7 text-gray-400" />;
    if (index === 2) return <Award className="w-6 h-6 text-amber-600" />;
    return <span className="text-2xl font-bold text-gray-400 w-8 text-center">#{index + 1}</span>;
  };

  const getRankBg = (index: number) => {
    if (index === 0) return 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-300';
    if (index === 1) return 'bg-gradient-to-r from-gray-50 to-gray-100 border-gray-300';
    if (index === 2) return 'bg-gradient-to-r from-amber-50 to-amber-100 border-amber-300';
    return 'bg-white border-gray-200';
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-6xl mx-auto px-4 py-8">
          <Link to="/basecamp" className="inline-flex items-center gap-2 text-primary-100 hover:text-white mb-4">
            <ChevronLeft className="w-5 h-5" />
            Back to Basecamp
          </Link>
          <div className="flex items-center gap-4">
            <Trophy className="w-12 h-12 text-yellow-400" />
            <div>
              <h1 className="text-3xl font-bold">Top 50 Content Creators</h1>
              <p className="text-primary-100">The most influential creators in our RV community</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sort Options */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-gray-600 font-medium">Sort by:</span>
            <button
              onClick={() => setSortBy('views')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'views' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Most Views
            </button>
            <button
              onClick={() => setSortBy('likes')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'likes' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Heart className="w-4 h-4 inline mr-2" />
              Most Likes
            </button>
            <button
              onClick={() => setSortBy('followers')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'followers' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <Users className="w-4 h-4 inline mr-2" />
              Most Followers
            </button>
            <button
              onClick={() => setSortBy('content')}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                sortBy === 'content' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <TrendingUp className="w-4 h-4 inline mr-2" />
              Most Content
            </button>
          </div>
        </div>

        {/* Leaderboard */}
        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-500">Loading leaderboard...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {creators.map((creator, index) => (
              <Link
                key={creator.id}
                to={`/creators/${creator.username}`}
                className={`block rounded-xl border-2 p-4 hover:shadow-lg transition ${getRankBg(index)}`}
              >
                <div className="flex items-center gap-4">
                  {/* Rank */}
                  <div className="flex-shrink-0 w-12 flex justify-center">
                    {getRankIcon(index)}
                  </div>

                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    {creator.profilePicture ? (
                      <img
                        src={creator.profilePicture}
                        alt={creator.username}
                        className="w-16 h-16 rounded-full object-cover border-2 border-white shadow"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary-400 to-primary-600 flex items-center justify-center text-white text-2xl font-bold border-2 border-white shadow">
                        {creator.firstName?.[0] || creator.username[0]}
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-grow min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {creator.creatorDisplayName || `${creator.firstName} ${creator.lastName}`}
                      </h3>
                      {creator.creatorVerified && (
                        <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                      )}
                      {creator.heatLevel === 1 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded-full text-xs font-medium">
                          <Flame className="w-4 h-4" /> Heating Up
                        </span>
                      )}
                      {creator.heatLevel === 2 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-600 rounded-full text-xs font-medium">
                          <Flame className="w-4 h-4" /> Boomshakalaka!
                        </span>
                      )}
                      {creator.heatLevel === 3 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-orange-200 text-orange-700 rounded-full text-xs font-medium">
                          <Flame className="w-4 h-4" /> Slam-a-jamma!
                        </span>
                      )}
                      {creator.heatLevel === 4 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full text-xs font-medium">
                          <Flame className="w-4 h-4" /> Is it the shoes?!
                        </span>
                      )}
                      {creator.heatLevel === 5 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-red-200 text-red-700 rounded-full text-xs font-medium">
                          <Flame className="w-4 h-4" /> Whoomp, there it is!
                        </span>
                      )}
                      {creator.heatLevel === 6 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full text-xs font-medium animate-pulse">
                          <Flame className="w-4 h-4" /> From downtown!
                        </span>
                      )}
                      {creator.heatLevel === 7 && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-full text-xs font-medium animate-pulse">
                          <Flame className="w-4 h-4" /> THE NAIL IN THE COFFIN!
                        </span>
                      )}
                      {creator.isInactive && (
                        <span className="flex items-center gap-1 px-2 py-0.5 bg-cyan-100 text-cyan-700 rounded-full text-xs font-medium">
                          <Snowflake className="w-4 h-4" /> Ice Cold
                        </span>
                      )}
                    </div>
                    <p className="text-gray-500">@{creator.creatorHandle || creator.username}</p>
                    {creator.creatorBio && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-1">{creator.creatorBio}</p>
                    )}
                  </div>

                  {/* Stats */}
                  <div className="flex-shrink-0 flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">
                        {formatNumber(creator.creatorStats?.totalViews || 0)}
                      </p>
                      <p className="text-gray-500 flex items-center gap-1">
                        <Eye className="w-4 h-4" /> Views
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">
                        {formatNumber(creator.creatorStats?.totalLikes || 0)}
                      </p>
                      <p className="text-gray-500 flex items-center gap-1">
                        <Heart className="w-4 h-4" /> Likes
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">
                        {formatNumber(creator.creatorStats?.followerCount || 0)}
                      </p>
                      <p className="text-gray-500 flex items-center gap-1">
                        <Users className="w-4 h-4" /> Followers
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-bold text-gray-900">
                        {creator._count?.creatorContent || 0}
                      </p>
                      <p className="text-gray-500">Posts</p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}

            {creators.length === 0 && (
              <div className="text-center py-12 bg-white rounded-xl">
                <Trophy className="w-16 h-16 text-gray-300 mx-auto" />
                <p className="mt-4 text-gray-500">No creators found yet. Be the first!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
