import { useState, useEffect } from 'react';
import { Fuel, Check, ChevronDown, ChevronUp } from 'lucide-react';
import api from '../../services/api';

interface FuelProfile {
  fuelType: string | null;
  tankCapacityGallons: number | null;
  auxTankGallons: number | null;
  averageMpg: number | null;
  towingMpg: number | null;
  fuelProfileConfirmed: boolean;
  fuelProfileUpdatedAt: string | null;
  fillUpPreferencePct: number;
  reserveWarningPct: number;
  rangeAnxiety: string;
  manufacturerSpecs: any | null;
}

interface DetectResult {
  detected: boolean;
  specs?: any;
  requiresConfirmation?: boolean;
}

export default function RigFuelProfile({ slug, isOwner }: { slug: string; isOwner: boolean }) {
  const [profile, setProfile] = useState<FuelProfile | null>(null);
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Form state
  const [fuelType, setFuelType] = useState('GAS');
  const [tankGal, setTankGal] = useState('');
  const [auxGal, setAuxGal] = useState('');
  const [mpg, setMpg] = useState('');
  const [towMpg, setTowMpg] = useState('');
  const [fillUpPct, setFillUpPct] = useState(35);
  const [reservePct, setReservePct] = useState(15);
  const [anxiety, setAnxiety] = useState('NORMAL');

  useEffect(() => {
    loadProfile();
  }, [slug]);

  const loadProfile = async () => {
    try {
      const [profileRes, detectRes] = await Promise.all([
        api.get(`/rigs/${slug}/fuel-profile`),
        api.post(`/rigs/${slug}/fuel-profile/detect`),
      ]);
      setProfile(profileRes.data);
      setDetect(detectRes.data);
      const p = profileRes.data;
      setFuelType(p.fuelType || 'GAS');
      setTankGal(p.tankCapacityGallons ? String(p.tankCapacityGallons) : '');
      setAuxGal(p.auxTankGallons ? String(p.auxTankGallons) : '');
      setMpg(p.averageMpg ? String(p.averageMpg) : '');
      setTowMpg(p.towingMpg ? String(p.towingMpg) : '');
      setFillUpPct(p.fillUpPreferencePct || 35);
      setReservePct(p.reserveWarningPct || 15);
      setAnxiety(p.rangeAnxiety || 'NORMAL');
    } catch {} finally { setLoading(false); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put(`/rigs/${slug}/fuel-profile`, {
        fuelType, tankCapacityGallons: tankGal, auxTankGallons: auxGal || null,
        averageMpg: mpg, towingMpg: towMpg || null,
        fillUpPreferencePct: fillUpPct, reserveWarningPct: reservePct, rangeAnxiety: anxiety,
      });
      await loadProfile();
    } catch {} finally { setSaving(false); }
  };

  const handleConfirmSpecs = async () => {
    if (!detect?.specs) return;
    setSaving(true);
    try {
      await api.post(`/rigs/${slug}/fuel-profile/confirm`, {
        fuelType: detect.specs.fuelType,
        tankCapacityGallons: detect.specs.tankCapacityGallons,
        averageMpg: detect.specs.avgMpgEstimate,
      });
      await loadProfile();
      setDetect(null);
    } catch {} finally { setSaving(false); }
  };

  if (loading) return <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />;
  if (!isOwner) return null;

  const totalTank = (parseFloat(tankGal) || 0) + (parseFloat(auxGal) || 0);
  const estimatedRange = totalTank > 0 && parseFloat(mpg) > 0 ? Math.round(totalTank * parseFloat(mpg)) : null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-gray-50 transition">
        <div className="flex items-center gap-2">
          <Fuel className="w-5 h-5 text-amber-600" />
          <span className="font-bold text-gray-900">Fuel Profile</span>
          {profile?.fuelProfileConfirmed && <span className="text-[10px] text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full font-medium">Confirmed</span>}
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {expanded && (
        <div className="px-5 pb-5 space-y-4 border-t border-gray-100 pt-4">
          {/* Auto-detect banner */}
          {detect?.requiresConfirmation && detect.specs && !profile?.fuelProfileConfirmed && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <p className="text-sm font-semibold text-amber-800">
                We found fuel specs for your {detect.specs.year} {detect.specs.make} {detect.specs.model}
              </p>
              <p className="text-xs text-amber-600 mt-1">
                Tank: {detect.specs.tankCapacityGallons} gal · MPG: {detect.specs.avgMpgEstimate} · {detect.specs.fuelType}
              </p>
              <div className="flex gap-2 mt-3">
                <button onClick={handleConfirmSpecs} disabled={saving} className="text-xs font-semibold bg-amber-500 text-white px-3 py-1.5 rounded-lg hover:bg-amber-600 transition disabled:opacity-50">
                  <Check className="w-3 h-3 inline mr-1" />Confirm These Specs
                </button>
                <button onClick={() => setDetect(null)} className="text-xs text-amber-600 px-3 py-1.5 rounded-lg hover:bg-amber-100 transition">
                  Edit Before Confirming
                </button>
              </div>
            </div>
          )}

          {/* Fuel Type */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Fuel Type</label>
            <div className="flex gap-2">
              {[{ id: 'GAS', label: '⛽ Gas' }, { id: 'DIESEL', label: '🛢️ Diesel' }].map(t => (
                <button key={t.id} onClick={() => setFuelType(t.id)}
                  className={`px-4 py-2 rounded-full text-sm font-semibold border transition ${fuelType === t.id ? 'bg-amber-100 text-amber-800 border-amber-300' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tank Capacity */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Tank Capacity</label>
              <div className="flex items-center gap-1">
                <input type="number" value={tankGal} onChange={e => setTankGal(e.target.value)} placeholder="80" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <span className="text-xs text-gray-400">gal</span>
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Aux Tank</label>
              <div className="flex items-center gap-1">
                <input type="number" value={auxGal} onChange={e => setAuxGal(e.target.value)} placeholder="None" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
                <span className="text-xs text-gray-400">gal</span>
              </div>
            </div>
          </div>
          {estimatedRange && (
            <p className="text-xs text-gray-400 -mt-2">Combined range: ~{estimatedRange} miles at {mpg} MPG</p>
          )}

          {/* MPG */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Average MPG</label>
              <input type="number" step="0.1" value={mpg} onChange={e => setMpg(e.target.value)} placeholder="8.5" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Towing MPG</label>
              <input type="number" step="0.1" value={towMpg} onChange={e => setTowMpg(e.target.value)} placeholder="7" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm" />
              <p className="text-[10px] text-gray-400 mt-0.5">Used when towing is enabled on a trip</p>
            </div>
          </div>

          {/* Fill-up Preference */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Fill-up Preference: {fillUpPct}%</label>
            <input type="range" min="20" max="60" value={fillUpPct} onChange={e => setFillUpPct(parseInt(e.target.value))} className="w-full accent-amber-500" />
            <p className="text-[10px] text-gray-400">I like to fill up when tank hits {fillUpPct}%
              {totalTank > 0 && ` (~${Math.round(totalTank * fillUpPct / 100 * parseFloat(mpg || '0'))} miles remaining)`}
            </p>
          </div>

          {/* Reserve Warning */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-1">Reserve Warning: {reservePct}%</label>
            <input type="range" min="10" max="30" value={reservePct} onChange={e => setReservePct(parseInt(e.target.value))} className="w-full accent-red-500" />
            <p className="text-[10px] text-gray-400">Warn me when tank hits {reservePct}%</p>
          </div>

          {/* Range Anxiety */}
          <div>
            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">Range Anxiety</label>
            <div className="space-y-1.5">
              {[
                { id: 'CONSERVATIVE', label: 'Conservative', desc: 'Fill up early, never stress about fuel' },
                { id: 'NORMAL', label: 'Normal', desc: 'Fill up when recommended' },
                { id: 'STRETCH', label: 'Stretch Range', desc: 'Comfortable running lower' },
              ].map(opt => (
                <label key={opt.id} className={`flex items-center gap-3 p-2.5 rounded-lg border cursor-pointer transition ${anxiety === opt.id ? 'border-amber-300 bg-amber-50' : 'border-gray-100 hover:bg-gray-50'}`}>
                  <input type="radio" name="anxiety" checked={anxiety === opt.id} onChange={() => setAnxiety(opt.id)} className="accent-amber-500" />
                  <div>
                    <span className="text-sm font-medium text-gray-800">{opt.label}</span>
                    <span className="text-xs text-gray-400 ml-2">{opt.desc}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Save */}
          <button onClick={handleSave} disabled={saving} className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-xl transition text-sm disabled:opacity-50">
            {saving ? 'Saving...' : 'Save Fuel Profile'}
          </button>

          {profile?.fuelProfileConfirmed && profile.fuelProfileUpdatedAt && (
            <p className="text-[10px] text-gray-400 text-center">
              Confirmed · Last updated {new Date(profile.fuelProfileUpdatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
