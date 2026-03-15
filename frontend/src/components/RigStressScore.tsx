import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

interface StressData {
  score: number;         // 1-5
  label: string;         // Easy, Mild, Moderate, Challenging, Extreme
  color: string;         // green/yellow/orange/red
  reason: string;        // Main explanation
  bigRigTips: string[];  // Specific tips for big rigs
  userRigNote?: string;  // Personalized note for user's specific rig
  factors: { label: string; impact: 'positive' | 'negative' | 'neutral'; detail: string }[];
  dataSource: 'community' | 'ai' | 'minimal';
}

const SCORE_CONFIG = [
  { score: 1, label: 'Very Easy',    bar: 'bg-green-500',  text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', emoji: '✅' },
  { score: 2, label: 'Easy',         bar: 'bg-green-400',  text: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200', emoji: '🟢' },
  { score: 3, label: 'Moderate',     bar: 'bg-yellow-500', text: 'text-yellow-700', bg: 'bg-yellow-50', border: 'border-yellow-200', emoji: '🟡' },
  { score: 4, label: 'Challenging',  bar: 'bg-orange-500', text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', emoji: '🟠' },
  { score: 5, label: 'Very Stressful',bar: 'bg-red-500',   text: 'text-red-700',   bg: 'bg-red-50',   border: 'border-red-200', emoji: '🔴' },
];

export default function RigStressScore({ campgroundId }: { campgroundId: string }) {
  const { user } = useAuth();
  const [data, setData] = useState<StressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    api.get(`/hitch/rig-stress/${campgroundId}`)
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [campgroundId]);

  if (loading) return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="w-5 h-5 text-orange-400" />
        <h3 className="font-bold text-gray-900">Rig Stress Score™</h3>
      </div>
      <div className="h-12 bg-gray-100 rounded-xl animate-pulse" />
    </div>
  );

  if (!data) return null;

  const cfg = SCORE_CONFIG[Math.min(data.score - 1, 4)] || SCORE_CONFIG[2];
  const rvLength = (user as any)?.rvLength;
  const rvType = (user as any)?.rvType;

  return (
    <div className={`rounded-2xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <button onClick={() => setExpanded(e => !e)} className="w-full p-5 text-left hover:bg-black/5 transition">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`w-5 h-5 ${cfg.text}`} />
            <h3 className="font-bold text-gray-900">Rig Stress Score™</h3>
            {data.dataSource === 'community' && (
              <span className="text-xs bg-white/70 px-2 py-0.5 rounded-full text-gray-600">Community verified</span>
            )}
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>

        {/* Score bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-white/60 rounded-full h-3">
            <div className={`h-3 rounded-full transition-all ${cfg.bar}`} style={{ width: `${(data.score / 5) * 100}%` }} />
          </div>
          <div className="text-right shrink-0">
            <span className={`text-2xl font-black ${cfg.text}`}>{data.score}/5</span>
            <span className={`block text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
          </div>
        </div>

        <p className={`text-sm mt-2 ${cfg.text} font-medium`}>{cfg.emoji} {data.reason}</p>

        {/* Personalized note */}
        {data.userRigNote && (rvLength || rvType) && (
          <div className="mt-2 bg-white/60 rounded-lg px-3 py-2 text-xs text-gray-700">
            <strong>For your {rvType || 'rig'}{rvLength ? ` (${rvLength}ft)` : ''}:</strong> {data.userRigNote}
          </div>
        )}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-white/60 pt-4">
          {/* Big rig tips */}
          {data.bigRigTips?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">🚛 Big Rig Tips</p>
              <ul className="space-y-1.5">
                {data.bigRigTips.map((tip, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-gray-700">
                    <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-gray-500" />
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Factors */}
          {data.factors?.length > 0 && (
            <div>
              <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">What we considered</p>
              <div className="space-y-1.5">
                {data.factors.map((f, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs">
                    <span>{f.impact === 'positive' ? '✅' : f.impact === 'negative' ? '⚠️' : 'ℹ️'}</span>
                    <div>
                      <span className="font-semibold text-gray-700">{f.label}: </span>
                      <span className="text-gray-600">{f.detail}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 text-xs text-gray-400 pt-1">
            <Info className="w-3 h-3" />
            <span>Score based on campground data + community reports. Always verify before arrival.</span>
          </div>
        </div>
      )}
    </div>
  );
}
