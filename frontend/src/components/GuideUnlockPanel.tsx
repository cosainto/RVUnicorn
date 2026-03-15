import { Lock, CheckCircle, ChevronRight } from "lucide-react";
import { GUIDES } from "../config/hitchGuides";
import { useGuideUnlocks } from "../hooks/useGuideUnlocks";
import { useAuth } from "../contexts/AuthContext";
import { Link } from "react-router-dom";

export default function GuideUnlockPanel() {
  const { user } = useAuth();
  const { isUnlocked, getProgress } = useGuideUnlocks();

  if (!user) return (
    <div className="text-center py-8">
      <p className="text-gray-500 text-sm">Sign in to see your guide unlocks.</p>
    </div>
  );

  const unlocked = GUIDES.filter(g => isUnlocked(g.id));
  const locked   = GUIDES.filter(g => !isUnlocked(g.id));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">Your AI Guides</h2>
        <p className="text-sm text-gray-500">Unlock guides by being an active member of the RVUnicorn community.</p>
      </div>

      {/* Unlocked */}
      {unlocked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Unlocked ({unlocked.length})</p>
          <div className="grid grid-cols-2 gap-2">
            {unlocked.map(g => (
              <div key={g.id} className="flex items-center gap-2 bg-white border border-green-200 rounded-xl px-3 py-2.5">
                {g.avatarUrl
                  ? <img src={g.avatarUrl} className="w-8 h-8 rounded-full object-cover" alt={g.name} />
                  : <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${g.bgGradient} flex items-center justify-center text-sm`}>{g.emoji}</div>
                }
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-gray-800 truncate">{g.name}</p>
                  <p className="text-xs text-green-600 font-medium">Unlocked</p>
                </div>
                <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Locked ({locked.length})</p>
          <div className="space-y-3">
            {locked.map(g => {
              const conditions = getProgress(g.id);
              const metCount = conditions.filter(c => c.met).length;
              const pct = conditions.length > 0 ? Math.round((metCount / conditions.length) * 100) : 0;
              return (
                <div key={g.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="relative shrink-0">
                      {g.avatarUrl
                        ? <img src={g.avatarUrl} className="w-12 h-12 rounded-full object-cover opacity-40 grayscale" alt={g.name} />
                        : <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-2xl opacity-40">{g.emoji}</div>
                      }
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Lock className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-gray-800">{g.name}</p>
                      <p className="text-xs text-gray-500 mb-1">{g.tagline}</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-primary-400 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400">{pct}%</span>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    {conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2">
                        {c.met
                          ? <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                        }
                        <span className={`text-xs ${c.met ? "text-green-700 line-through" : "text-gray-600"}`}>
                          {c.label}{!c.met && c.required > 1 ? ` (${c.current}/${c.required})` : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 bg-amber-50 border border-amber-100 rounded-xl p-3 text-xs text-amber-800">
            <strong>Pro tip:</strong> Submit Campground Reports after your stays — they count toward unlocking Walter, Diesel Dave, Luna, and more.
            <Link to="/campgrounds" className="block mt-1 text-amber-700 font-semibold underline">Browse campgrounds to get started</Link>
          </div>
        </div>
      )}
    </div>
  );
}
