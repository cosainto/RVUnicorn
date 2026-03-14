import { useState, useEffect } from 'react';
import { Loader } from 'lucide-react';
import api from '../services/api';

interface Props {
  campgroundId: string;
  campgroundName: string;
  isAdmin?: boolean;
}

const INSIGHT_LABELS: Record<string, string> = {
  quiet: 'Quiet', familyFriendly: 'Family Friendly', bigRigFriendly: 'Big Rig Friendly',
  scenic: 'Scenic', petFriendly: 'Pet Friendly', valueForMoney: 'Value for Money',
};

const INSIGHT_COLORS: Record<string, string> = {
  high: 'bg-green-100 text-green-700 border-green-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-red-100 text-red-700 border-red-200',
};

const RIG_STRESS_COLORS = ['', 'bg-green-500', 'bg-lime-500', 'bg-yellow-500', 'bg-orange-500', 'bg-red-500'];

export default function CampgroundVibeCard({ campgroundId, campgroundName, isAdmin }: Props) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generated, setGenerated] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/analyze-campground', { campgroundId });
      setAnalysis(data);
      setGenerated(true);
    } catch { alert('Failed to analyze. Try again!'); }
    finally { setLoading(false); }
  };

  if (!analysis) {
    return (
      <div className="bg-gradient-to-br from-primary-50 to-purple-50 rounded-2xl border border-primary-100 p-5">
        <div className="flex items-center gap-3 mb-3">
          <img src="/hitch.png" className="w-10 h-10 rounded-full object-cover" alt="Hitch" />
          <div>
            <p className="font-bold text-gray-900">Hitch AI Analysis</p>
            <p className="text-xs text-gray-500">Campground personality, vibe score & review insights</p>
          </div>
        </div>
        <button onClick={generate} disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-gradient-to-r from-primary-600 to-purple-600 text-white font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 transition">
          {loading ? <><Loader className="w-4 h-4 animate-spin" /> Analyzing reviews...</> : '✨ Generate AI Analysis'}
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
      {/* Vibe header */}
      <div className="bg-gradient-to-r from-primary-600 to-purple-600 p-4">
        <div className="flex items-center gap-3">
          <span className="text-4xl">{analysis.vibeEmoji}</span>
          <div>
            <p className="text-xs text-white/70 uppercase tracking-widest font-semibold">Campground Vibe</p>
            <h3 className="text-xl font-black text-white">{analysis.vibeLabel}</h3>
            <p className="text-sm text-white/80 mt-0.5">{analysis.vibeDescription}</p>
          </div>
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Personality tags */}
        {analysis.personalityTags?.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {analysis.personalityTags.map((tag: string) => (
              <span key={tag} className="px-3 py-1 bg-primary-50 text-primary-700 border border-primary-200 text-xs font-semibold rounded-full">
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Review insights */}
        {analysis.insights && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Community Insights</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(analysis.insights).map(([key, value]: [string, any]) => (
                <div key={key} className={`flex items-center justify-between px-3 py-1.5 rounded-lg border text-xs font-medium ${INSIGHT_COLORS[value] || 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <span>{INSIGHT_LABELS[key] || key}</span>
                  <span className="capitalize">{value}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Rig Stress Score */}
        {analysis.rigStressScore && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">🚛 Rig Stress Score</p>
              <span className={`text-xs font-bold text-white px-2 py-0.5 rounded-full ${RIG_STRESS_COLORS[analysis.rigStressScore]}`}>
                {analysis.rigStressScore}/5
              </span>
            </div>
            <div className="flex gap-1 mb-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className={`flex-1 h-2 rounded-full ${i <= analysis.rigStressScore ? RIG_STRESS_COLORS[analysis.rigStressScore] : 'bg-gray-100'}`} />
              ))}
            </div>
            <p className="text-xs text-gray-500">{analysis.rigStressReason}</p>
          </div>
        )}

        {/* Best for */}
        {analysis.bestFor?.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Best For</p>
            <div className="flex flex-wrap gap-1.5">
              {analysis.bestFor.map((item: string) => (
                <span key={item} className="text-xs bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">✓ {item}</span>
              ))}
            </div>
          </div>
        )}

        {/* Community insight */}
        {analysis.communityInsight && (
          <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
            <p className="text-xs font-bold text-amber-700 mb-1">💬 Community Says</p>
            <p className="text-xs text-amber-800">{analysis.communityInsight}</p>
          </div>
        )}

        {/* Booking tip */}
        {analysis.bookingTip && (
          <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
            <p className="text-xs font-bold text-blue-700 mb-1">💡 Booking Tip</p>
            <p className="text-xs text-blue-800">{analysis.bookingTip}</p>
          </div>
        )}

        {/* Hidden gem badge */}
        {analysis.hiddenGem && (
          <div className="flex items-center gap-2 bg-purple-50 rounded-xl p-3 border border-purple-100">
            <span className="text-2xl">💎</span>
            <div>
              <p className="text-xs font-bold text-purple-700">Hidden Gem</p>
              <p className="text-xs text-purple-600">Under-discovered with high satisfaction scores</p>
            </div>
          </div>
        )}

        <button onClick={generate} disabled={loading}
          className="w-full text-xs text-gray-400 hover:text-primary-600 transition py-1">
          {loading ? '⏳ Regenerating...' : '🔄 Regenerate Analysis'}
        </button>
      </div>
    </div>
  );
}
