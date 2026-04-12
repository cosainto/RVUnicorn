import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Zap, X } from 'lucide-react';
import api from '../../services/api';

interface Insight {
  id: string;
  type: string;
  headline: string;
  detail: string;
  actionLabel?: string;
  actionUrl?: string;
}

export default function HitchSuggestsCreator() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/creator-events/insights').then(({ data }) => setInsights(data.insights || [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  async function dismiss(id: string) {
    try {
      await api.patch(`/creator-events/insights/${id}/dismiss`);
      setInsights(prev => prev.filter(i => i.id !== id));
    } catch {}
  }

  if (loading || insights.length === 0) return null;

  return (
    <div className="bg-gradient-to-r from-amber-50 to-orange-50 rounded-2xl border border-amber-200 p-4 mb-4">
      <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-500" /> Hitch Suggests
      </h3>
      <div className="space-y-2">
        {insights.map((insight) => (
          <div key={insight.id} className="bg-white rounded-xl border border-amber-100 p-3 flex items-start gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900">{insight.headline}</p>
              <p className="text-xs text-gray-500 mt-0.5">{insight.detail}</p>
              {insight.actionLabel && insight.actionUrl && (
                <Link to={insight.actionUrl} className="inline-block mt-2 text-xs font-semibold text-amber-600 hover:text-amber-700 transition">
                  {insight.actionLabel} →
                </Link>
              )}
            </div>
            <button onClick={() => dismiss(insight.id)} className="text-gray-300 hover:text-gray-500 transition flex-shrink-0 mt-0.5">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
