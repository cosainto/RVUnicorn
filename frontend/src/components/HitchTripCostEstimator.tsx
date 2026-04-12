import { useState, useEffect } from 'react';
import { DollarSign, Loader, Fuel, MapPin, Moon } from 'lucide-react';
import api from '../services/api';

interface Props {
  eventId?: string;
  destination?: string;
  startLocation?: string;
  startDate?: string;
  endDate?: string;
  rvType?: string;
  rvLength?: number;
  nights?: number;
  autoRun?: boolean;
}

export default function HitchTripCostEstimator({ eventId, destination, startLocation, startDate, endDate, rvType, rvLength, nights: nightsProp, autoRun }: Props) {
  const [loading, setLoading] = useState(false);
  const [estimate, setEstimate] = useState<any>(null);
  const computedNights = nightsProp || (endDate && startDate ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / 86400000) : 3);
  const [form, setForm] = useState({
    from: startLocation || '',
    to: destination || '',
    nights: computedNights,
    rvType: rvType || 'Class C',
    tankSize: 55,
    mpg: 12,
    fuelPrice: 3.80,
    campingFeePerNight: 45,
    groupSize: 2,
  });
  const [shown, setShown] = useState(!!autoRun);
  const [autoRan, setAutoRan] = useState(false);

  // Update form when props change (e.g. itinerary loaded after Hitch runs)
  useEffect(() => {
    const updates: any = {};
    if (startLocation && startLocation !== form.from) updates.from = startLocation;
    if (destination && destination !== form.to) updates.to = destination;
    if (computedNights !== form.nights) updates.nights = computedNights;
    if (Object.keys(updates).length > 0) setForm(f => ({ ...f, ...updates }));
  }, [startLocation, destination, computedNights]);

  // Auto-run when autoRun is true and we have from + to
  useEffect(() => {
    if (autoRun && !autoRan && !loading && !estimate && form.from && form.to) {
      setAutoRan(true);
      calculateCost();
    }
  }, [autoRun, autoRan, form.from, form.to]);

  const calculateCost = async () => {
    setLoading(true);
    try {
      const { data } = await api.post('/hitch/trip-cost', form);
      setEstimate(data);
    } catch { alert('Failed to calculate. Try again!'); }
    finally { setLoading(false); }
  };

  const RV_MPG: Record<string, number> = {
    'Class A': 8, 'Class B': 22, 'Class C': 12,
    'Travel Trailer': 13, 'Fifth Wheel': 11, 'Toy Hauler': 10,
  };

  if (!shown) {
    return (
      <button onClick={() => setShown(true)}
        className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-green-600 to-teal-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 transition shadow-sm">
        <img src="/hitch.png" className="w-5 h-5 rounded-full" />
        💰 Estimate Trip Cost
      </button>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-4">
        <img src="/hitch.png" className="w-8 h-8 rounded-full" />
        <div>
          <p className="font-bold text-gray-900">Trip Cost Estimator</p>
          <p className="text-xs text-gray-500">Hitch crunches the numbers for you</p>
        </div>
        <button onClick={() => setShown(false)} className="ml-auto text-gray-400 hover:text-gray-600 text-lg">✕</button>
      </div>

      {!estimate ? (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">From</label>
              <input value={form.from} onChange={e => setForm(f => ({ ...f, from: e.target.value }))}
                placeholder="Starting city" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">To</label>
              <input value={form.to} onChange={e => setForm(f => ({ ...f, to: e.target.value }))}
                placeholder="Destination" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Nights</label>
              <input type="number" value={form.nights} onChange={e => setForm(f => ({ ...f, nights: parseInt(e.target.value) || 1 }))}
                min="1" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">RV Type</label>
              <select value={form.rvType} onChange={e => setForm(f => ({ ...f, rvType: e.target.value, mpg: RV_MPG[e.target.value] || 12 }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 bg-white">
                {Object.keys(RV_MPG).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Fuel Price ($/gal)</label>
              <input type="number" value={form.fuelPrice} onChange={e => setForm(f => ({ ...f, fuelPrice: parseFloat(e.target.value) || 3.80 }))}
                step="0.10" className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Camp Fee/Night ($)</label>
              <input type="number" value={form.campingFeePerNight} onChange={e => setForm(f => ({ ...f, campingFeePerNight: parseInt(e.target.value) || 45 }))}
                className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2" />
            </div>
          </div>
          <button onClick={calculateCost} disabled={loading || !form.from || !form.to}
            className="w-full py-2.5 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {loading ? <><Loader className="w-4 h-4 animate-spin" /> Calculating...</> : '💰 Calculate Cost'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Summary */}
          <div className="bg-green-50 rounded-xl p-4 border border-green-200 text-center">
            <p className="text-xs text-green-600 font-semibold uppercase tracking-wide mb-1">Estimated Total</p>
            <p className="text-3xl font-black text-green-700">${estimate.totalMin} – ${estimate.totalMax}</p>
            <p className="text-xs text-green-600 mt-1">{form.nights} nights · {estimate.estimatedMiles} miles</p>
          </div>

          {/* Breakdown */}
          <div className="space-y-2">
            {[
              { icon: '⛽', label: 'Fuel', min: estimate.fuelMin, max: estimate.fuelMax },
              { icon: '🏕️', label: 'Campsite Fees', min: estimate.campingMin, max: estimate.campingMax },
              { icon: '🍔', label: 'Food & Supplies', min: estimate.foodMin, max: estimate.foodMax },
              { icon: '🎯', label: 'Activities', min: estimate.activitiesMin, max: estimate.activitiesMax },
              { icon: '🔧', label: 'Misc / Emergency', min: estimate.miscMin, max: estimate.miscMax },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-600">{item.icon} {item.label}</span>
                <span className="text-sm font-semibold text-gray-800">${item.min} – ${item.max}</span>
              </div>
            ))}
          </div>

          {estimate.tips?.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-3 border border-amber-100">
              <p className="text-xs font-bold text-amber-700 mb-1">💡 Money-Saving Tips</p>
              {estimate.tips.map((tip: string, i: number) => (
                <p key={i} className="text-xs text-amber-800">• {tip}</p>
              ))}
            </div>
          )}

          <button onClick={() => setEstimate(null)}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition">
            ← Recalculate
          </button>
        </div>
      )}
    </div>
  );
}
