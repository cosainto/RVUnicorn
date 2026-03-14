import { useState } from 'react';
import { Loader, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import api from '../services/api';

interface Props {
  campgroundId: string;
  campgroundName: string;
  defaultRvLength?: number;
  defaultRvType?: string;
}

export default function HitchRigCheck({ campgroundId, campgroundName, defaultRvLength, defaultRvType }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [shown, setShown] = useState(false);
  const [rvLength, setRvLength] = useState(defaultRvLength || 35);
  const [rvType, setRvType] = useState(defaultRvType || 'Class C');
  const [hasSlideouts, setHasSlideouts] = useState(false);

  const check = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/rig-check', { campgroundId, rvLength, rvType, hasSlideouts });
      setResult(data);
    } catch { alert('Failed to check. Try again!'); }
    finally { setLoading(false); }
  };

  if (!shown) return (
    <button onClick={() => setShown(true)}
      className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition">
      <img src="/hitch.png" className="w-5 h-5 rounded-full" />
      🚛 Check Rig Compatibility
    </button>
  );

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900">Rig Compatibility Check</p>
          <p className="text-xs text-gray-500">Will your RV fit at {campgroundName}?</p>
        </div>
      </div>

      {!result ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">RV Length (ft)</label>
              <input type="number" value={rvLength} onChange={e => setRvLength(parseInt(e.target.value))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">RV Type</label>
              <select value={rvType} onChange={e => setRvType(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                {['Class A', 'Class B', 'Class C', 'Travel Trailer', 'Fifth Wheel', 'Toy Hauler'].map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={hasSlideouts} onChange={e => setHasSlideouts(e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Has slideouts</span>
          </label>
          <button onClick={check} disabled={loading}
            className="w-full py-2.5 bg-primary-600 text-white font-semibold rounded-xl hover:bg-primary-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Checking...</> : '🚛 Check Compatibility'}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Verdict */}
          <div className={`flex items-center gap-3 p-3 rounded-xl ${result.compatible ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
            {result.compatible
              ? <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
              : <XCircle className="w-6 h-6 text-red-600 shrink-0" />}
            <div>
              <p className={`font-bold text-sm ${result.compatible ? 'text-green-800' : 'text-red-800'}`}>{result.verdict}</p>
              <p className="text-xs text-gray-500">{result.confidenceScore}% confidence</p>
            </div>
          </div>

          {result.warnings?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs font-bold text-amber-700 mb-1">⚠️ Warnings</p>
              {result.warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs text-amber-800">• {w}</p>
              ))}
            </div>
          )}

          {result.tips?.length > 0 && (
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <p className="text-xs font-bold text-blue-700 mb-1">💡 Tips</p>
              {result.tips.map((t: string, i: number) => (
                <p key={i} className="text-xs text-blue-800">• {t}</p>
              ))}
            </div>
          )}

          {result.siteRecommendation && (
            <div className="bg-green-50 rounded-xl p-3 border border-green-100">
              <p className="text-xs font-bold text-green-700 mb-1">🏕️ Site Recommendation</p>
              <p className="text-xs text-green-800">{result.siteRecommendation}</p>
            </div>
          )}

          <button onClick={() => setResult(null)} className="w-full text-xs text-gray-400 hover:text-gray-600 py-1">
            ← Check different RV specs
          </button>
        </div>
      )}
    </div>
  );
}
