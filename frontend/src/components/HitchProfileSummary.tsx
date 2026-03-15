import { useState, useEffect } from "react";
import { Sparkles, RefreshCw } from "lucide-react";
import api from "../services/api";

export default function HitchProfileSummary({ username }: { username: string }) {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/hitch/profile-summary/${username}`)
      .then(r => setSummary(r.data.summary || ""))
      .catch(() => setSummary(""))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return (
    <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl p-4 border border-primary-100">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">🦄</span>
        <div className="h-4 bg-primary-200 rounded w-32 animate-pulse" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-primary-100 rounded animate-pulse" />
        <div className="h-3 bg-primary-100 rounded w-4/5 animate-pulse" />
      </div>
    </div>
  );

  if (!summary) return null;

  const preview = summary.length > 180 ? summary.substring(0, 180) + "..." : summary;

  return (
    <div className="bg-gradient-to-r from-primary-50 to-purple-50 rounded-2xl p-4 border border-primary-100">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-lg">🦄</span>
          <span className="text-sm font-bold text-primary-700">Hitch says...</span>
        </div>
        <button onClick={() => {
          setLoading(true);
          api.get(`/hitch/profile-summary/${username}?refresh=1`)
            .then(r => setSummary(r.data.summary || ""))
            .catch(() => {})
            .finally(() => setLoading(false));
        }} className="text-primary-400 hover:text-primary-600 transition">
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">
        {expanded ? summary : preview}
      </p>
      {summary.length > 180 && (
        <button onClick={() => setExpanded(e => !e)}
          className="text-xs text-primary-600 font-semibold mt-1 hover:text-primary-800 transition">
          {expanded ? "Show less" : "Read more"}
        </button>
      )}
    </div>
  );
}
