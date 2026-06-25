import { useState, useEffect } from 'react';
import { Fuel } from 'lucide-react';
import api from '../../services/api';

interface FuelStop {
  id: string;
  stationName: string | null;
  city: string | null;
  state: string | null;
  gallonsAdded: number | null;
  pricePerGallon: number | null;
  totalCost: number | null;
  loggedAt: string;
  tripId: string | null;
}

export default function RigFuelHistory({ slug }: { slug: string }) {
  const [stops, setStops] = useState<FuelStop[]>([]);
  const [totals, setTotals] = useState({ totalGallons: 0, totalCost: 0, totalStops: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/rigs/${slug}/fuel-stops`)
      .then(r => {
        setStops(r.data?.stops || []);
        setTotals({ totalGallons: r.data?.totalGallons || 0, totalCost: r.data?.totalCost || 0, totalStops: r.data?.totalStops || 0 });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
  if (stops.length === 0 && totals.totalStops === 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-bold text-gray-900 flex items-center gap-2 mb-4">
        <Fuel className="w-5 h-5 text-amber-600" /> Fuel History
      </h3>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{totals.totalStops}</p>
          <p className="text-[10px] text-gray-400">Fill-ups</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{Math.round(totals.totalGallons)}</p>
          <p className="text-[10px] text-gray-400">Gallons</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-gray-900">${Math.round(totals.totalCost)}</p>
          <p className="text-[10px] text-gray-400">Total Cost</p>
        </div>
      </div>

      {/* Stop list */}
      <div className="space-y-2">
        {stops.slice(0, 10).map(s => (
          <div key={s.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div>
              <p className="text-sm font-medium text-gray-800">{s.stationName || 'Fuel Stop'}</p>
              <p className="text-[10px] text-gray-400">
                {[s.city, s.state].filter(Boolean).join(', ')} · {new Date(s.loggedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </p>
            </div>
            <div className="text-right">
              {s.gallonsAdded && <p className="text-xs font-medium text-gray-700">{s.gallonsAdded} gal</p>}
              {s.totalCost && <p className="text-[10px] text-gray-400">${s.totalCost.toFixed(2)}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
