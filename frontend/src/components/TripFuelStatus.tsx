import { useState, useEffect } from 'react';
import { Fuel, Plus, X } from 'lucide-react';
import api from '../services/api';

interface FuelStatus {
  available: boolean;
  currentPct: number;
  currentGallons: number;
  estimatedRangeMiles: number;
  effectiveMpg: number;
  gallonsUsed: number;
  gallonsAdded: number;
  totalFuelCost: number;
}

export default function TripFuelStatus({ rigSlug, tripPlanId, isTowing }: { rigSlug: string; tripPlanId: string; isTowing?: boolean }) {
  const [status, setStatus] = useState<FuelStatus | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [logForm, setLogForm] = useState({ stationName: '', gallonsAdded: '', pricePerGallon: '' });
  const [logSaving, setLogSaving] = useState(false);

  useEffect(() => {
    loadStatus();
  }, [rigSlug, tripPlanId]);

  const loadStatus = async () => {
    try {
      const { data } = await api.get(`/rigs/${rigSlug}/trips/${tripPlanId}/fuel-status`);
      setStatus(data);
    } catch {}
  };

  const handleLogFuelStop = async () => {
    if (!logForm.gallonsAdded) return;
    setLogSaving(true);
    try {
      await api.post(`/rigs/${rigSlug}/fuel-stops`, {
        tripId: tripPlanId,
        stationName: logForm.stationName || null,
        gallonsAdded: logForm.gallonsAdded,
        pricePerGallon: logForm.pricePerGallon || null,
        totalCost: logForm.gallonsAdded && logForm.pricePerGallon
          ? (parseFloat(logForm.gallonsAdded) * parseFloat(logForm.pricePerGallon)).toFixed(2)
          : null,
      });
      setShowLogModal(false);
      setLogForm({ stationName: '', gallonsAdded: '', pricePerGallon: '' });
      loadStatus();
    } catch {} finally { setLogSaving(false); }
  };

  if (!status || !status.available) return null;

  const pct = status.currentPct;
  const barColor = pct > 35 ? 'bg-emerald-500' : pct > 15 ? 'bg-amber-500' : 'bg-red-500';
  const isLow = pct <= 35;
  const isCritical = pct <= 15;

  return (
    <div className={`rounded-xl border p-4 ${isCritical ? 'bg-red-50 border-red-200' : isLow ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Fuel className={`w-5 h-5 ${isCritical ? 'text-red-600' : isLow ? 'text-amber-600' : 'text-gray-600'}`} />
          <span className="font-bold text-gray-900 text-sm">Fuel Status</span>
          {isTowing && <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-medium">Towing · {status.effectiveMpg} MPG</span>}
        </div>
        <button onClick={() => setShowLogModal(true)} className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded-lg transition">
          <Plus className="w-3 h-3" /> Log Fuel Stop
        </button>
      </div>

      {/* Tank bar */}
      <div className="mb-2">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="font-semibold text-gray-700">Tank: ~{Math.round(pct)}%</span>
          <span className="text-gray-400">{status.currentGallons} gal remaining</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor} ${isCritical ? 'animate-pulse' : ''}`} style={{ width: `${Math.max(2, pct)}%` }} />
        </div>
      </div>

      <p className="text-xs text-gray-500">
        Range: ~{status.estimatedRangeMiles} miles remaining · {status.effectiveMpg} MPG
      </p>

      {isLow && !isCritical && (
        <p className="text-xs text-amber-600 font-medium mt-2">⛽ Approaching your preferred fill-up point</p>
      )}
      {isCritical && (
        <p className="text-xs text-red-600 font-medium mt-2">⚠️ Low fuel — prioritizing fuel recommendations</p>
      )}

      {status.totalFuelCost > 0 && (
        <p className="text-[10px] text-gray-400 mt-2">
          Trip fuel: {status.gallonsAdded} gal · ${status.totalFuelCost.toFixed(2)}
        </p>
      )}

      {/* Log Fuel Stop Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-gray-900">Log Fuel Stop</h3>
              <button onClick={() => setShowLogModal(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Station Name</label>
                <input type="text" value={logForm.stationName} onChange={e => setLogForm(f => ({ ...f, stationName: e.target.value }))} placeholder="e.g. Flying J" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Gallons Added *</label>
                  <input type="number" step="0.1" value={logForm.gallonsAdded} onChange={e => setLogForm(f => ({ ...f, gallonsAdded: e.target.value }))} placeholder="45" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">$/Gallon</label>
                  <input type="number" step="0.01" value={logForm.pricePerGallon} onChange={e => setLogForm(f => ({ ...f, pricePerGallon: e.target.value }))} placeholder="3.89" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              {logForm.gallonsAdded && logForm.pricePerGallon && (
                <p className="text-xs text-gray-500">Total: ${(parseFloat(logForm.gallonsAdded) * parseFloat(logForm.pricePerGallon)).toFixed(2)}</p>
              )}
              <button onClick={handleLogFuelStop} disabled={logSaving || !logForm.gallonsAdded} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
                {logSaving ? 'Saving...' : 'Save Fuel Stop'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
