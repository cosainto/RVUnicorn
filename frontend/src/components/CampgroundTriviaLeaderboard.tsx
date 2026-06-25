import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

interface CampgroundScore {
  campgroundId: string;
  totalPoints: number;
  playerCount: number;
  weekRank: number;
  campground: { id: string; name: string; city: string; state: string; imageUrl?: string };
}

interface Props {
  campgroundId?: string; // if provided, show this campground's rank
}

export default function CampgroundTriviaLeaderboard({ campgroundId }: Props) {
  const [leaderboard, setLeaderboard] = useState<CampgroundScore[]>([]);
  const [myRank, setMyRank] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/campfire-phase4/leaderboard/global'),
      campgroundId ? api.get(`/campfire-phase4/leaderboard/${campgroundId}`) : Promise.resolve(null),
    ]).then(([global, local]) => {
      setLeaderboard(global.data?.leaderboard || []);
      if (local) setMyRank(local.data);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, [campgroundId]);

  const medals = ['🥇','🥈','🥉'];

  if (loading) return <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🏆</span>
          <div>
            <div className="text-white font-semibold text-sm">Campground Trivia Leaderboard</div>
            <div className="text-amber-100 text-xs">Weekly rankings across all campgrounds</div>
          </div>
        </div>
      </div>

      {/* Top campers at this campground */}
      {myRank && myRank.topPlayers && myRank.topPlayers.length > 0 && (
        <div className="border-b border-gray-100">
          <div className="px-4 py-2 bg-orange-50 flex items-center justify-between">
            <span className="text-xs font-bold text-orange-700 uppercase tracking-wide">🔥 Top Campers This Week</span>
            {myRank.rank && (
              <span className="text-xs text-orange-500">Campground rank #{myRank.rank}</span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {myRank.topPlayers.map((player: any, i: number) => (
              <div key={player.userId} className={`flex items-center gap-3 px-4 py-2.5 ${i === 0 ? 'bg-amber-50' : ''}`}>
                <div className="w-6 text-center">
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : <span className="text-xs font-bold text-gray-400">#{i+1}</span>}
                </div>
                {player.user?.profilePicture
                  ? <img src={player.user.profilePicture} className="w-7 h-7 rounded-full object-cover flex-shrink-0" alt="" />
                  : <div className="w-7 h-7 rounded-full bg-orange-200 flex items-center justify-center text-xs font-bold text-orange-700 flex-shrink-0">{player.user?.firstName?.[0] || '?'}</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-gray-800">{player.user?.firstName} {player.user?.lastName}</div>
                  <div className="text-xs text-gray-400">@{player.user?.username}</div>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-bold text-orange-600">{player.totalPoints}</div>
                  <div className="text-xs text-gray-400">{player.correctAnswers} correct</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My campground rank banner */}
      {myRank && myRank.rank && (
        <div className="bg-amber-50 border-b border-amber-100 px-4 py-2.5 flex items-center justify-between">
          <div className="text-sm font-semibold text-amber-800">
            Campground ranked #{myRank.rank} of {myRank.totalCampgrounds}
          </div>
          <div className="text-xs text-amber-600">{myRank.totalPoints} pts · {myRank.playerCount} players</div>
        </div>
      )}

      {/* Empty state */}
      {leaderboard.length === 0 && (
        <div className="text-center py-8 text-gray-400 text-sm">
          <div className="text-3xl mb-2">🔥</div>
          No scores yet this week — trivia starts at 5:30 PM!
        </div>
      )}

      {/* Leaderboard list */}
      <div className="divide-y divide-gray-50">
        {leaderboard.map((entry, i) => (
          <Link
            key={entry.campgroundId}
            to={`/campgrounds/${entry.campgroundId}`}
            className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition ${campgroundId === entry.campgroundId ? 'bg-amber-50' : ''}`}
          >
            <div className="w-8 text-center">
              {i < 3 ? <span className="text-lg">{medals[i]}</span> : <span className="text-sm font-bold text-gray-400">#{i+1}</span>}
            </div>
            {entry.campground.imageUrl
              ? <img src={entry.campground.imageUrl} className="w-8 h-8 rounded-lg object-cover flex-shrink-0" alt="" />
              : <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-sm flex-shrink-0">🏕️</div>
            }
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-gray-800 truncate">{entry.campground.name}</div>
              <div className="text-xs text-gray-400">{entry.campground.city}, {entry.campground.state} · {entry.playerCount} players</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-sm font-bold text-orange-600">{entry.totalPoints}</div>
              <div className="text-xs text-gray-400">pts</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
