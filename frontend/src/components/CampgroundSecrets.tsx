import { useState, useEffect } from 'react';
import { Key, ThumbsUp, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';

interface Secret {
  title: string;
  insight: string;
  category: 'access' | 'site' | 'cell' | 'timing' | 'trail' | 'tip';
  confidence: 'high' | 'medium';
}

interface SecretsData {
  secrets: Secret[];
  reviewCount: number;
  hasEnoughData: boolean;
  dataMessage?: string;
}

const CATEGORY_CONFIG: Record<string, { emoji: string; label: string; color: string }> = {
  access: { emoji: '🛣️', label: 'Access', color: 'bg-blue-50 border-blue-200 text-blue-800' },
  site:   { emoji: '📍', label: 'Best Sites', color: 'bg-green-50 border-green-200 text-green-800' },
  cell:   { emoji: '📶', label: 'Cell Service', color: 'bg-purple-50 border-purple-200 text-purple-800' },
  timing: { emoji: '🕐', label: 'Timing', color: 'bg-amber-50 border-amber-200 text-amber-800' },
  trail:  { emoji: '🥾', label: 'Hidden Spots', color: 'bg-emerald-50 border-emerald-200 text-emerald-800' },
  tip:    { emoji: '💡', label: 'Pro Tip', color: 'bg-orange-50 border-orange-200 text-orange-800' },
};

export default function CampgroundSecrets({ campgroundId }: { campgroundId: string }) {
  const [data, setData] = useState<SecretsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [helpfulVotes, setHelpfulVotes] = useState<Record<number, boolean>>({});

  const fetchSecrets = async () => {
    setLoading(true);
    try {
      const { data: res } = await api.get(`/hitch/campground-secrets/${campgroundId}`);
      setData(res);
    } catch {
      setData({ secrets: [], reviewCount: 0, hasEnoughData: false, dataMessage: 'Unable to load secrets.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSecrets(); }, [campgroundId]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Key className="w-5 h-5 text-amber-500" />
        <h3 className="font-bold text-gray-900">Campground Secrets</h3>
      </div>
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
      <button onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between p-5 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <Key className="w-5 h-5 text-amber-500" />
          <h3 className="font-bold text-gray-900">Campground Secrets</h3>
          {data?.reviewCount ? (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
              From {data.reviewCount} camper{data.reviewCount !== 1 ? 's' : ''}
            </span>
          ) : null}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-3">
          {!data?.hasEnoughData ? (
            <div className="text-center py-6 text-gray-500">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm font-medium text-gray-700 mb-1">Not enough data yet</p>
              <p className="text-xs text-gray-400">{data?.dataMessage || 'Be the first to submit a Campground Report to unlock secrets for this campground!'}</p>
            </div>
          ) : (
            <>
              {data?.secrets.map((s, i) => {
                const cfg = CATEGORY_CONFIG[s.category] || CATEGORY_CONFIG.tip;
                return (
                  <div key={i} className={`rounded-xl border p-3.5 ${cfg.color}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 flex-1">
                        <span className="text-lg shrink-0 mt-0.5">{cfg.emoji}</span>
                        <div>
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-xs font-bold uppercase tracking-wide opacity-70">{cfg.label}</span>
                            {s.confidence === 'high' && (
                              <span className="text-xs bg-white/60 px-1.5 rounded-full font-medium">High confidence</span>
                            )}
                          </div>
                          <p className="text-sm font-semibold mb-0.5">{s.title}</p>
                          <p className="text-xs opacity-80 leading-relaxed">{s.insight}</p>
                        </div>
                      </div>
                      <button onClick={() => setHelpfulVotes(v => ({ ...v, [i]: !v[i] }))}
                        className={`shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded-lg transition ${helpfulVotes[i] ? 'bg-white/60 font-semibold' : 'hover:bg-white/40'}`}>
                        <ThumbsUp className="w-3 h-3" />
                        {helpfulVotes[i] ? 'Helpful!' : 'Helpful'}
                      </button>
                    </div>
                  </div>
                );
              })}
              <div className="flex items-center justify-between pt-1">
                <p className="text-xs text-gray-400">🤖 AI-generated from community reports</p>
                <button onClick={fetchSecrets} className="text-xs text-gray-400 hover:text-primary-600 flex items-center gap-1 transition">
                  <RefreshCw className="w-3 h-3" /> Refresh
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
