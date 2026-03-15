import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Trophy, Star } from "lucide-react";
import api from "../services/api";

interface LeaderEntry {
  userId: string;
  username: string;
  firstName: string;
  profilePicture: string | null;
  reportCount: number;
  rank: number;
}

export default function CampgroundReportLeaderboard({ campgroundId, compact = false }: { campgroundId?: string; compact?: boolean }) {
  const [leaders, setLeaders] = useState<LeaderEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/hitch/report-leaderboard${campgroundId ? "?campgroundId=" + campgroundId : ""}`)
      .then(r => setLeaders(r.data.leaders || []))
      .catch(() => setLeaders([]))
      .finally(() => setLoading(false));
  }, [campgroundId]);

  const RANK_CONFIG = [
    { icon: "🥇", color: "text-amber-500" },
    { icon: "🥈", color: "text-gray-400" },
    { icon: "🥉", color: "text-amber-700" },
  ];

  if (loading) return <div className="h-20 bg-gray-100 rounded-xl animate-pulse" />;
  if (leaders.length === 0) return null;

  return (
    <div className={`bg-white rounded-2xl border border-gray-100 ${compact ? "p-3" : "p-5"}`}>
      <div className="flex items-center gap-2 mb-3">
        <Trophy className="w-4 h-4 text-amber-500" />
        <h3 className={`font-bold text-gray-900 ${compact ? "text-sm" : "text-base"}`}>
          {campgroundId ? "Top Contributors" : "Report Leaderboard"}
        </h3>
      </div>
      <div className="space-y-2">
        {leaders.slice(0, compact ? 3 : 10).map((entry, i) => {
          const rank = RANK_CONFIG[i] || { icon: `${i+1}`, color: "text-gray-500" };
          return (
            <div key={entry.userId} className="flex items-center gap-2.5">
              <span className={`text-lg w-6 text-center shrink-0 ${rank.color}`}>{rank.icon}</span>
              {entry.profilePicture
                ? <img src={entry.profilePicture} className="w-7 h-7 rounded-full object-cover shrink-0" alt={entry.firstName} />
                : <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center text-xs font-bold text-primary-600 shrink-0">{entry.firstName[0]}</div>
              }
              <Link to={`/profile/${entry.username}`} className="flex-1 text-sm font-medium text-gray-800 hover:text-primary-600 transition truncate">
                {entry.firstName}
              </Link>
              <div className="flex items-center gap-1 text-xs text-gray-500 shrink-0">
                <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                {entry.reportCount} report{entry.reportCount !== 1 ? "s" : ""}
              </div>
            </div>
          );
        })}
      </div>
      {!compact && (
        <p className="text-xs text-gray-400 mt-3 text-center">Submit Campground Reports to climb the ranks</p>
      )}
    </div>
  );
}
