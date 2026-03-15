import { useState } from 'react';
import { Flame, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface RoastData {
  hasEnoughData: boolean;
  roastLines: string[];
  positiveCounterpoint: string;
  verdict: string;
  reviewCount: number;
}

export default function RoastMode({ campgroundId, campgroundName }: { campgroundId: string; campgroundName: string }) {
  const [data, setData] = useState<RoastData | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const loadRoast = async () => {
    if (data || loading) { setExpanded(e => !e); return; }
    setLoading(true);
    setExpanded(true);
    try {
      const { data: res } = await api.get(`/hitch/roast/${campgroundId}`);
      setData(res);
    } catch {
      setData({ hasEnoughData: false, roastLines: [], positiveCounterpoint: '', verdict: '', reviewCount: 0 });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden">
      <button onClick={loadRoast} className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎭</span>
          <div className="text-left">
            <p className="font-bold text-white">Walter\"s Roast</p>
            <p className="text-xs text-gray-400">Honest. Comedic. Community-based.</p>
          </div>
        </div>
        {expanded
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {expanded && (
        <div className="px-5 pb-5 border-t border-white/10 pt-4">
          {loading && (
            <div className="flex items-center gap-2 text-gray-400 text-sm">
              <Flame className="w-4 h-4 animate-pulse text-orange-500" />
              Walter is warming up his roast...
            </div>
          )}
          {!loading && data && !data.hasEnoughData && (
            <div className="text-gray-400 text-sm text-center py-4">
              <p className="text-2xl mb-2">🎭</p>
              <p>Not enough reviews for Walter to work with yet.</p>
              <p className="text-xs mt-1 text-gray-500">Be the first to leave a Campground Report!</p>
            </div>
          )}
          {!loading && data && data.hasEnoughData && (
            <div className="space-y-4">
              {/* Walter avatar & intro */}
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-700 flex items-center justify-center text-xl shrink-0">🎭</div>
                <div>
                  <p className="text-white font-bold text-sm">Walter</p>
                  <p className="text-gray-400 text-xs">Veteran RVer · Seen it all</p>
                </div>
              </div>

              {/* Roast lines */}
              <div className="space-y-2">
                {data.roastLines.map((line, i) => (
                  <div key={i} className="bg-white/10 rounded-xl px-4 py-3 text-sm text-gray-200 leading-relaxed">
                    {line}
                  </div>
                ))}
              </div>

              {/* Positive counterpoint */}
              <div className="bg-green-900/40 border border-green-700/50 rounded-xl px-4 py-3">
                <p className="text-xs font-bold text-green-400 mb-1">✅ But in all fairness...</p>
                <p className="text-sm text-green-200 leading-relaxed">{data.positiveCounterpoint}</p>
              </div>

              {/* Verdict */}
              <div className="border-t border-white/10 pt-3">
                <p className="text-xs font-bold text-amber-400 mb-1">🎙️ Walter"s verdict</p>
                <p className="text-sm text-gray-300 italic">"{data.verdict}"</p>
              </div>

              <p className="text-xs text-gray-600">Based on {data.reviewCount} community review{data.reviewCount !== 1 ? "s" : ""}. Walter's humor ≠ official RVUnicorn opinion.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
