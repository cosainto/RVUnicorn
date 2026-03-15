import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Sparkles, MapPin, Star, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import api from "../services/api";
import { useAuth } from "../contexts/AuthContext";

interface MatchedCampground {
  id: string;
  name: string;
  city: string;
  state: string;
  imageUrl: string | null;
  googleRating: number | null;
  pricePerNight: number | null;
  matchScore: number;
  matchTier: "Perfect Match" | "Great Fit" | "Worth Checking Out";
  whyItFits: string;
  watchOut: string | null;
  highlights: string[];
}

const TIER_CONFIG = {
  "Perfect Match":        { color: "bg-green-100 text-green-800 border-green-200", dot: "bg-green-500",  border: "border-green-200" },
  "Great Fit":            { color: "bg-blue-100 text-blue-800 border-blue-200",    dot: "bg-blue-500",   border: "border-blue-200"  },
  "Worth Checking Out":   { color: "bg-amber-100 text-amber-800 border-amber-200", dot: "bg-amber-500",  border: "border-amber-200" },
};

export default function YourKindOfPlace() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<MatchedCampground[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [missingFields, setMissingFields] = useState<string[]>([]);

  const fetchMatches = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/hitch/for-you");
      setMatches(data.matches || []);
      setMissingFields(data.missingFields || []);
    } catch {
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchMatches(); }, []);

  if (!user) return (
    <div className="text-center py-12 text-gray-500">
      <p>Sign in to see campgrounds matched to your rig and style.</p>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary-500" /> Your Kind of Place
          </h2>
          <p className="text-sm text-gray-500 mt-0.5">Matched to your rig, style, and interests</p>
        </div>
        <button onClick={fetchMatches} disabled={loading} className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary-600 transition">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {missingFields.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm">
          <p className="font-semibold text-amber-800 mb-1">Better matches with more info</p>
          <p className="text-amber-700 text-xs">Add your {missingFields.join(", ")} for more personalized recommendations.</p>
          <Link to="/my-rv" className="text-xs text-amber-800 font-bold underline mt-1 block">Update your profile</Link>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 animate-pulse">
              <div className="flex gap-3">
                <div className="w-20 h-20 bg-gray-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-200 rounded w-1/2" />
                  <div className="h-3 bg-gray-200 rounded w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && matches.length === 0 && (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🏕️</div>
          <p className="font-semibold text-gray-700">No matches yet</p>
          <p className="text-sm text-gray-500 mt-1">Complete your RV profile and camping interests to get personalized matches.</p>
          <Link to="/my-rv" className="btn btn-primary btn-sm mt-4 inline-block">Complete Profile</Link>
        </div>
      )}

      {!loading && matches.map(c => {
        const tier = TIER_CONFIG[c.matchTier] || TIER_CONFIG["Worth Checking Out"];
        const isExpanded = expanded[c.id];
        return (
          <div key={c.id} className={`bg-white rounded-2xl border ${tier.border} overflow-hidden`}>
            <div className="flex gap-3 p-4">
              <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-gray-100">
                {c.imageUrl
                  ? <img src={c.imageUrl} alt={c.name} className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-2xl">🏕️</div>
                }
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <Link to={`/campgrounds/${c.id}`} className="font-bold text-gray-900 hover:text-primary-600 transition text-sm leading-tight block">{c.name}</Link>
                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><MapPin className="w-3 h-3" />{c.city}, {c.state}</p>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full border shrink-0 ${tier.color}`}>{c.matchTier}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                    <div className={`h-1.5 rounded-full ${tier.dot}`} style={{ width: `${c.matchScore}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-500">{c.matchScore}%</span>
                </div>
                <p className="text-xs text-gray-700 mt-1.5 leading-relaxed">
                  <span className="font-semibold text-green-700">Why it fits: </span>{c.whyItFits}
                </p>
              </div>
            </div>
            <button onClick={() => setExpanded(e => ({ ...e, [c.id]: !e[c.id] }))}
              className="w-full flex items-center justify-between px-4 py-2 border-t border-gray-100 hover:bg-gray-50 transition text-xs text-gray-500">
              <span>{isExpanded ? "Less detail" : "More detail"}</span>
              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2.5 border-t border-gray-100 pt-3">
                {c.highlights?.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-gray-600 mb-1">Highlights</p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.highlights.map((h, i) => <span key={i} className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full">{h}</span>)}
                    </div>
                  </div>
                )}
                {c.watchOut && (
                  <div className="bg-amber-50 rounded-lg p-2.5 text-xs">
                    <span className="font-semibold text-amber-700">Watch out: </span>
                    <span className="text-amber-800">{c.watchOut}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  {c.googleRating && <div className="flex items-center gap-1 text-xs text-gray-600"><Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />{c.googleRating.toFixed(1)}</div>}
                  {c.pricePerNight && <span className="text-xs text-gray-600">${c.pricePerNight}/night</span>}
                  <Link to={`/campgrounds/${c.id}`} className="text-xs font-semibold text-primary-600 hover:text-primary-800 transition">View campground</Link>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <p className="text-xs text-gray-400 text-center">Powered by RVUnicorn AI</p>
    </div>
  );
}
