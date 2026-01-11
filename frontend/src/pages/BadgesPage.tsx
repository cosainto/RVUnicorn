// BadgesPage.tsx
import { useState, useEffect } from 'react';
import { Trophy, Award, Users, TrendingUp, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import BadgeDisplay from '../components/BadgeDisplay';

interface LeaderboardEntry {
  rank: number;
  user: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
  };
  badgeCount: number;
}

export default function BadgesPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [checking, setChecking] = useState(false);
  const [newBadges, setNewBadges] = useState<any[]>([]);
  const [stats, setStats] = useState({ earned: 0, total: 0 });

  useEffect(() => {
    loadLeaderboard();
    loadStats();
  }, []);

  const loadLeaderboard = async () => {
    try {
      const { data } = await api.get('/badges/leaderboard?limit=10');
      setLeaderboard(data);
    } catch (error) {
      console.error('Load leaderboard error:', error);
    }
  };

  const loadStats = async () => {
    try {
      const { data } = await api.get('/badges/my');
      setStats({
        earned: data.earnedCount || 0,
        total: data.total || 0
      });
    } catch (error) {
      console.error('Load stats error:', error);
    }
  };

  const checkForNewBadges = async () => {
    try {
      setChecking(true);
      const { data } = await api.post('/badges/check');
      setNewBadges(data.newBadges || []);
      
      if (data.newBadges?.length > 0) {
        loadStats();
      }
    } catch (error) {
      console.error('Check badges error:', error);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-100 rounded-full">
            <Trophy className="w-8 h-8 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Badges & Achievements</h1>
            <p className="text-gray-600">Earn badges by being active in the community</p>
          </div>
        </div>

        <button
          onClick={checkForNewBadges}
          disabled={checking}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Checking...' : 'Check for New Badges'}
        </button>
      </div>

      {newBadges.length > 0 && (
        <div className="mb-6 bg-gradient-to-r from-amber-50 to-yellow-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-400 rounded-full">
              <Award className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-800">🎉 New Badge{newBadges.length > 1 ? 's' : ''} Earned!</h3>
              <p className="text-amber-700">
                {newBadges.map(b => b.name).join(', ')}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Award className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.earned}</p>
              <p className="text-sm text-gray-500">Badges Earned</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Trophy className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              <p className="text-sm text-gray-500">Total Available</p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">
                {stats.total > 0 ? Math.round((stats.earned / stats.total) * 100) : 0}%
              </p>
              <p className="text-sm text-gray-500">Completion</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-md p-6">
            <BadgeDisplay showAll={true} />
          </div>
        </div>

        <div>
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
              <Users className="w-5 h-5 text-primary-600" />
              Badge Leaderboard
            </h3>

            {leaderboard.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No data yet</p>
            ) : (
              <div className="space-y-3">
                {leaderboard.map((entry) => (
                  <Link
                    key={entry.user.id}
                    to={`/profile/${entry.user.username}`}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                      entry.rank === 1 ? 'bg-amber-400 text-white' :
                      entry.rank === 2 ? 'bg-gray-300 text-gray-700' :
                      entry.rank === 3 ? 'bg-amber-600 text-white' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {entry.rank}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {entry.user.profilePicture ? (
                          <img
                            src={entry.user.profilePicture.startsWith('http') ? entry.user.profilePicture : `http://127.0.0.1:3001${entry.user.profilePicture}`}
                            alt={entry.user.firstName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                            <span className="text-primary-600 font-medium text-sm">
                              {entry.user.firstName?.[0]}
                            </span>
                          </div>
                        )}
                        <div className="truncate">
                          <p className="font-medium text-gray-900 text-sm truncate">
                            {entry.user.firstName} {entry.user.lastName}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 text-amber-600">
                      <Trophy className="w-4 h-4" />
                      <span className="font-bold">{entry.badgeCount}</span>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
