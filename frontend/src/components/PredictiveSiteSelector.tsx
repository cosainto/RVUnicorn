import { useState } from "react";
import { MapPin, Send } from "lucide-react";
import api from "../services/api";

interface SitePrediction {
  siteNumbers: string[];
  reason: string;
  tips: string[];
  avoidSites: string[];
  avoidReason: string | null;
}

export default function PredictiveSiteSelector({ campgroundId, campgroundName }: { campgroundId: string; campgroundName: string }) {
  const [prediction, setPrediction] = useState<SitePrediction | null>(null);
  const [loading, setLoading] = useState(false);
  const [asked, setAsked] = useState(false);

  const getSuggestion = async () => {
    setLoading(true);
    setAsked(true);
    try {
      const { data } = await api.get(`/hitch/site-prediction/${campgroundId}`);
      setPrediction(data);
    } catch {
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  };

  if (!asked) return (
    <button onClick={getSuggestion}
      className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary-50 hover:bg-primary-100 border border-primary-200 rounded-xl text-sm font-semibold text-primary-700 transition">
      <MapPin className="w-4 h-4" /> Which site should I book?
    </button>
  );

  if (loading) return (
    <div className="bg-primary-50 rounded-xl p-3 text-sm text-primary-600 flex items-center gap-2 animate-pulse">
      <span>🦄</span> Analyzing community reports for best sites...
    </div>
  );

  if (!prediction) return null;

  return (
    <div className="bg-primary-50 border border-primary-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🦄</span>
        <p className="font-bold text-primary-800 text-sm">Hitch recommends</p>
      </div>

      {prediction.siteNumbers.length > 0 && (
        <div>
          <p className="text-xs font-bold text-gray-600 mb-1.5">Best sites to request</p>
          <div className="flex flex-wrap gap-1.5">
            {prediction.siteNumbers.map((s, i) => (
              <span key={i} className="bg-primary-600 text-white text-xs font-bold px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>
      )}

      <p className="text-xs text-gray-700 leading-relaxed">{prediction.reason}</p>

      {prediction.tips?.length > 0 && (
        <div className="space-y-1">
          {prediction.tips.map((tip, i) => (
            <p key={i} className="text-xs text-gray-600 flex items-start gap-1.5">
              <span className="shrink-0">💡</span>{tip}
            </p>
          ))}
        </div>
      )}

      {prediction.avoidSites?.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
          <p className="text-xs font-bold text-amber-700 mb-1">Sites to avoid</p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {prediction.avoidSites.map((s, i) => (
              <span key={i} className="bg-amber-200 text-amber-800 text-xs font-bold px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
          {prediction.avoidReason && <p className="text-xs text-amber-700">{prediction.avoidReason}</p>}
        </div>
      )}

      <p className="text-xs text-gray-400">Based on community Campground Reports</p>
    </div>
  );
}
