// RVSpecsPage.tsx — RVUnicorn branded, enhanced UX
// Color palette: Navy (#1B3A6B), Gold (#F0B429), Campfire Orange (#E8622A)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown, ChevronRight, Save, ArrowLeft, CheckCircle,
  Droplets, Zap, Truck, Ruler, Weight, Star, Info
} from 'lucide-react';
import api from '../lib/api';
import { useAuth } from '../contexts/AuthContext';

// ─── Brand tokens ────────────────────────────────────────────────────────────
const brand = {
  navy:   '#1B3A6B',
  navyLight: '#243F75',
  gold:   '#F0B429',
  goldLight: '#FEF3C7',
  orange: '#E8622A',
  orangeLight: '#FFF0EB',
  cream:  '#FDFAF5',
  bark:   '#8B6F47',
  sage:   '#5A7A5A',
};

// ─── Form shape ───────────────────────────────────────────────────────────────
interface RVSpecsForm {
  rvMake: string; rvModel: string; rvType: string; rvYear: string;
  rvFloorplan: string; rvDescription: string;
  rvLength: string; rvWidth: string; rvHeight: string;
  rvSleeps: string; rvSlideouts: string; rvAxles: string;
  rvAwningFt: string; rvAirconditioners: string;
  rvWeight: string; rvGvwr: string; rvHitchWeight: string;
  rvFuelGal: string; rvFreshWaterGal: string; rvGreyWaterGal: string;
  rvBlackWaterGal: string; rvLpGasGal: string;
  rvShorepower: string; rvGeneratorWatts: string; rvBatteryAh: string; rvSolarWatts: string;
  rvMpg: string;
  licensePlate: string; licensePlateState: string;
  currentOdometer: string; tagExpiration: string;
}

const EMPTY: RVSpecsForm = {
  rvMake:'',rvModel:'',rvType:'',rvYear:'',rvFloorplan:'',rvDescription:'',
  rvLength:'',rvWidth:'',rvHeight:'',rvSleeps:'',rvSlideouts:'',rvAxles:'',
  rvAwningFt:'',rvAirconditioners:'',
  rvWeight:'',rvGvwr:'',rvHitchWeight:'',
  rvFuelGal:'',rvFreshWaterGal:'',rvGreyWaterGal:'',rvBlackWaterGal:'',rvLpGasGal:'',
  rvShorepower:'',rvGeneratorWatts:'',rvBatteryAh:'',rvSolarWatts:'',
  rvMpg:'',licensePlate:'',licensePlateState:'',
  currentOdometer:'',tagExpiration:'',
};

const RV_TYPES = [
  'Class A Motorhome','Class B Motorhome (Van)','Class B+ Motorhome','Class C Motorhome',
  'Fifth Wheel','Travel Trailer','Toy Hauler','Pop-Up / Folding Trailer',
  'Teardrop Trailer','Truck Camper','Skoolie (Converted Bus)','Converted Van','Other',
];
const SHOREPOWER = ['30 Amp','50 Amp','30/50 Amp Dual','15 Amp','None'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN',
  'IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const maybeNum = (v: string) => v.trim() === '' ? null : Number(v);
const maybeStr = (v: string) => v.trim() || null;

function completionScore(form: RVSpecsForm): number {
  const fields = Object.values(form).filter(v => v !== '');
  return Math.round((fields.length / Object.keys(form).length) * 100);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressRing({ pct }: { pct: number }) {
  const r = 20, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 52, height: 52 }}>
      <svg width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
        <circle
          cx="26" cy="26" r={r} fill="none"
          stroke={brand.gold} strokeWidth="3"
          strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color: brand.navy }}>{pct}%</span>
    </div>
  );
}

function Section({
  id, icon, title, subtitle, accentColor, children, defaultOpen = true,
}: {
  id: string; icon: string; title: string; subtitle: string;
  accentColor: string; children: React.ReactNode; defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'white',
        boxShadow: '0 1px 4px rgba(27,58,107,0.08), 0 4px 16px rgba(27,58,107,0.04)',
        border: '1px solid rgba(27,58,107,0.07)',
      }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50"
      >
        {/* Icon badge */}
        <span
          className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
          style={{ background: accentColor + '18' }}
        >
          {icon}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-sm" style={{ color: brand.navy }}>{title}</p>
          <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
        </div>
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center transition-transform"
          style={{
            background: open ? brand.navy : '#f3f4f6',
            transform: open ? 'rotate(0deg)' : 'rotate(-90deg)',
          }}
        >
          <ChevronDown className="w-3.5 h-3.5" style={{ color: open ? 'white' : '#9ca3af' }} />
        </div>
      </button>

      {/* Left accent bar */}
      <div
        style={{
          height: open ? 'auto' : 0,
          overflow: 'hidden',
          transition: 'height 0.2s ease',
          borderLeft: `3px solid ${accentColor}`,
          marginLeft: '1px',
        }}
      >
        <div className="px-5 pb-5 pt-2">{children}</div>
      </div>
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────────────────────
const inp = `w-full px-3 py-2.5 rounded-xl text-sm border transition-all
  bg-gray-50 focus:bg-white focus:outline-none
  border-gray-200 focus:border-[#1B3A6B] focus:ring-2 focus:ring-[#1B3A6B]/10
  placeholder-gray-300`;

function Field({ label, hint, tip, children }: {
  label: string; hint?: string; tip?: string; children: React.ReactNode;
}) {
  const [showTip, setShowTip] = useState(false);
  return (
    <div>
      <div className="flex items-center gap-1 mb-1.5">
        <label className="text-xs font-semibold uppercase tracking-wide" style={{ color: brand.navy + 'cc' }}>
          {label}
          {hint && <span className="ml-1 font-normal normal-case text-gray-400">{hint}</span>}
        </label>
        {tip && (
          <button type="button" className="relative" onClick={() => setShowTip(!showTip)}>
            <Info className="w-3 h-3 text-gray-300 hover:text-gray-400" />
            {showTip && (
              <div className="absolute left-0 bottom-5 w-48 p-2 bg-gray-800 text-white text-xs rounded-lg z-10 shadow-xl">
                {tip}
              </div>
            )}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

// ─── Tank visual ──────────────────────────────────────────────────────────────
function TankInput({
  emoji, label, field, form, set, color, maxGal = 120,
}: {
  emoji: string; label: string; field: keyof RVSpecsForm;
  form: RVSpecsForm; set: (f: keyof RVSpecsForm) => any;
  color: string; maxGal?: number;
}) {
  const val = parseFloat(form[field] as string) || 0;
  const pct = Math.min((val / maxGal) * 100, 100);
  return (
    <div
      className="rounded-xl p-3 border"
      style={{ borderColor: color + '30', background: color + '08' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{emoji}</span>
        <span className="text-xs font-semibold" style={{ color: brand.navy }}>{label}</span>
      </div>
      {/* Visual fill bar */}
      <div className="h-2 rounded-full bg-gray-100 mb-2.5 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          step="0.5"
          placeholder="0"
          value={form[field]}
          onChange={set(field)}
          className={inp}
          style={{ paddingRight: '2.5rem' }}
        />
        <span className="text-xs text-gray-400 -ml-10 pointer-events-none select-none">gal</span>
      </div>
    </div>
  );
}

// ─── Stat chip ────────────────────────────────────────────────────────────────
function StatChip({ label, value, unit }: { label: string; value: string; unit?: string }) {
  if (!value) return null;
  return (
    <div
      className="rounded-xl px-3 py-2.5 text-center border"
      style={{ borderColor: brand.navy + '15', background: brand.goldLight }}
    >
      <p className="text-sm font-bold" style={{ color: brand.navy }}>
        {value}<span className="text-xs font-normal ml-0.5 text-gray-500">{unit}</span>
      </p>
      <p className="text-[10px] text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function RVSpecsPage() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth() as any;
  const [form, setForm] = useState<RVSpecsForm>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    const u = user as any;
    setForm({
      rvMake: u.rvMake ?? '', rvModel: u.rvModel ?? '', rvType: u.rvType ?? '',
      rvYear: u.rvYear?.toString() ?? '', rvFloorplan: u.rvFloorplan ?? '',
      rvDescription: u.rvDescription ?? '',
      rvLength: u.rvLength?.toString() ?? '', rvWidth: u.rvWidth?.toString() ?? '',
      rvHeight: u.rvHeight?.toString() ?? '', rvSleeps: u.rvSleeps?.toString() ?? '',
      rvSlideouts: u.rvSlideouts?.toString() ?? '', rvAxles: u.rvAxles?.toString() ?? '',
      rvAwningFt: u.rvAwningFt?.toString() ?? '',
      rvAirconditioners: u.rvAirconditioners?.toString() ?? '',
      rvWeight: u.rvWeight?.toString() ?? '', rvGvwr: u.rvGvwr?.toString() ?? '',
      rvHitchWeight: u.rvHitchWeight?.toString() ?? '',
      rvFuelGal: (u.rvFuelGal ?? u.rvTankGallons)?.toString() ?? '',
      rvFreshWaterGal: u.rvFreshWaterGal?.toString() ?? '',
      rvGreyWaterGal: u.rvGreyWaterGal?.toString() ?? '',
      rvBlackWaterGal: u.rvBlackWaterGal?.toString() ?? '',
      rvLpGasGal: u.rvLpGasGal?.toString() ?? '',
      rvShorepower: u.rvShorepower ?? '',
      rvGeneratorWatts: u.rvGeneratorWatts?.toString() ?? '',
      rvBatteryAh: u.rvBatteryAh?.toString() ?? '',
      rvSolarWatts: u.rvSolarWatts?.toString() ?? '',
      rvMpg: u.rvMpg?.toString() ?? '',
      licensePlate: u.licensePlate ?? '',
      licensePlateState: u.licensePlateState ?? '',
      currentOdometer: u.currentOdometer?.toString() ?? '',
      tagExpiration: u.tagExpiration ? new Date(u.tagExpiration).toISOString().split('T')[0] : '',
    });
  }, [user]);

  const set = (field: keyof RVSpecsForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      const payload: Record<string, any> = {
        rvMake: maybeStr(form.rvMake), rvModel: maybeStr(form.rvModel),
        rvType: maybeStr(form.rvType), rvYear: maybeNum(form.rvYear),
        rvFloorplan: maybeStr(form.rvFloorplan), rvDescription: maybeStr(form.rvDescription),
        rvLength: maybeNum(form.rvLength), rvWidth: maybeNum(form.rvWidth),
        rvHeight: maybeNum(form.rvHeight), rvSleeps: maybeNum(form.rvSleeps),
        rvSlideouts: maybeNum(form.rvSlideouts), rvAxles: maybeNum(form.rvAxles),
        rvAwningFt: maybeNum(form.rvAwningFt), rvAirconditioners: maybeNum(form.rvAirconditioners),
        rvWeight: maybeNum(form.rvWeight), rvGvwr: maybeNum(form.rvGvwr),
        rvHitchWeight: maybeNum(form.rvHitchWeight),
        rvFuelGal: maybeNum(form.rvFuelGal), rvFreshWaterGal: maybeNum(form.rvFreshWaterGal),
        rvGreyWaterGal: maybeNum(form.rvGreyWaterGal), rvBlackWaterGal: maybeNum(form.rvBlackWaterGal),
        rvLpGasGal: maybeNum(form.rvLpGasGal),
        rvShorepower: maybeStr(form.rvShorepower),
        rvGeneratorWatts: maybeNum(form.rvGeneratorWatts), rvBatteryAh: maybeNum(form.rvBatteryAh),
        rvSolarWatts: maybeNum(form.rvSolarWatts), rvMpg: maybeNum(form.rvMpg),
        licensePlate: maybeStr(form.licensePlate), licensePlateState: maybeStr(form.licensePlateState),
        currentOdometer: form.currentOdometer ? parseInt(form.currentOdometer) : null,
        tagExpiration: form.tagExpiration ? new Date(form.tagExpiration).toISOString() : null,
      };
      const res = await api.put(`/profile/${user.username}`, payload);
      if (setUser) setUser(res.data.user ?? res.data);
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } catch (e: any) {
      setError(e.response?.data?.message || 'Save failed — please try again.');
    } finally { setSaving(false); }
  };

  const score = completionScore(form);
  const rvTitle = [form.rvYear, form.rvMake, form.rvModel].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen" style={{ background: brand.cream }}>

      {/* ── Top bar ────────────────────────────────────────────────────────── */}
      <div
        className="sticky top-0 z-20 px-4 py-3 flex items-center gap-3"
        style={{
          background: brand.navy,
          boxShadow: '0 2px 12px rgba(27,58,107,0.3)',
        }}
      >
        <button
          onClick={() => navigate(-1)}
          className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>

        <div className="flex-1 min-w-0">
          <h1 className="font-bold text-white text-sm leading-tight">
            {rvTitle || 'My RV'}
          </h1>
          <p className="text-xs" style={{ color: brand.gold }}>
            Spec Sheet
          </p>
        </div>

        <ProgressRing pct={score} />

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 rounded-xl font-semibold text-sm transition-all active:scale-95 disabled:opacity-60"
          style={{
            background: saved ? brand.sage : brand.gold,
            color: brand.navy,
          }}
        >
          {saved ? (
            <><CheckCircle className="w-4 h-4" />Saved!</>
          ) : saving ? (
            <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Save className="w-4 h-4" />Save</>
          )}
        </button>
      </div>

      {/* ── Hero banner ────────────────────────────────────────────────────── */}
      <div
        className="px-4 py-5 flex items-center gap-4"
        style={{
          background: `linear-gradient(135deg, ${brand.navy} 0%, ${brand.navyLight} 100%)`,
        }}
      >
        {/* RV icon */}
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl shrink-0"
          style={{ background: 'rgba(240,180,41,0.15)', border: '1px solid rgba(240,180,41,0.3)' }}
        >
          🚐
        </div>
        <div className="flex-1 min-w-0">
          {rvTitle ? (
            <>
              <h2 className="font-bold text-white text-lg leading-tight truncate">{rvTitle}</h2>
              {form.rvType && (
                <span
                  className="inline-block text-xs px-2 py-0.5 rounded-full mt-1 font-medium"
                  style={{ background: brand.orange + '30', color: brand.gold }}
                >
                  {form.rvType}
                </span>
              )}
            </>
          ) : (
            <p className="text-sm font-medium" style={{ color: brand.gold }}>
              Add your rig's details below
            </p>
          )}
          {form.rvDescription && (
            <p className="text-xs text-gray-400 mt-1 truncate">{form.rvDescription}</p>
          )}
        </div>
      </div>

      {/* ── Quick stats row ─────────────────────────────────────────────────── */}
      {(form.rvLength || form.rvSleeps || form.rvSlideouts || form.rvMpg) && (
        <div
          className="px-4 py-3 grid grid-cols-4 gap-2"
          style={{ background: brand.navyLight }}
        >
          {form.rvLength && <StatChip label="Length" value={form.rvLength} unit="ft" />}
          {form.rvSleeps && <StatChip label="Sleeps" value={form.rvSleeps} />}
          {form.rvSlideouts && <StatChip label="Slides" value={form.rvSlideouts} />}
          {form.rvMpg && <StatChip label="MPG" value={form.rvMpg} />}
        </div>
      )}

      {/* ── Form sections ─────────────────────────────────────────────────── */}
      <div className="px-4 py-5 space-y-3 max-w-2xl mx-auto">

        {error && (
          <div
            className="p-3 rounded-xl text-sm flex items-center gap-2"
            style={{ background: '#FEF2F2', color: '#DC2626', border: '1px solid #FCA5A5' }}
          >
            ⚠️ {error}
          </div>
        )}

        {/* Completion hint */}
        {score < 50 && (
          <div
            className="p-3 rounded-xl text-xs flex items-center gap-2"
            style={{ background: brand.goldLight, color: brand.bark, border: `1px solid ${brand.gold}40` }}
          >
            <Star className="w-4 h-4 shrink-0" style={{ color: brand.gold }} />
            Complete your spec sheet to unlock campground compatibility matching and help Hitch give better advice!
          </div>
        )}

        {/* ── 1. Basic Info ──────────────────────────────────────────────── */}
        <Section
          id="basic" icon="🚐" title="Basic Info"
          subtitle="Year, make, model & type"
          accentColor={brand.navy}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="Year">
              <input className={inp} type="number" value={form.rvYear} onChange={set('rvYear')}
                placeholder="2023" min={1950} max={2030} />
            </Field>
            <Field label="Make">
              <input className={inp} value={form.rvMake} onChange={set('rvMake')} placeholder="Winnebago" />
            </Field>
            <Field label="Model">
              <input className={inp} value={form.rvModel} onChange={set('rvModel')} placeholder="Minnie 2500FL" />
            </Field>
            <Field label="Floorplan">
              <input className={inp} value={form.rvFloorplan} onChange={set('rvFloorplan')} placeholder="Rear Bedroom" />
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Type">
              <select className={inp} value={form.rvType} onChange={set('rvType')}>
                <option value="">Select RV type...</option>
                {RV_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Nickname / Description">
              <textarea className={`${inp} resize-none`} rows={2} value={form.rvDescription}
                onChange={set('rvDescription')} placeholder="The Blue Beast, our home on wheels..." />
            </Field>
          </div>
        </Section>

        {/* ── 2. Dimensions ─────────────────────────────────────────────── */}
        <Section
          id="dims" icon="📐" title="Dimensions & Layout"
          subtitle="Size, sleeps, slides & features"
          accentColor={brand.orange}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Length" hint="ft">
              <input className={inp} type="number" value={form.rvLength} onChange={set('rvLength')} placeholder="28" />
            </Field>
            <Field label="Width" hint="in"
              tip="Exterior width in inches. Important for tight campsite clearances.">
              <input className={inp} type="number" value={form.rvWidth} onChange={set('rvWidth')} placeholder="96" />
            </Field>
            <Field label="Height" hint="in"
              tip="Roof height in inches. Used to check for bridge & canopy clearances.">
              <input className={inp} type="number" value={form.rvHeight} onChange={set('rvHeight')} placeholder="140" />
            </Field>
            <Field label="Sleeps">
              <input className={inp} type="number" value={form.rvSleeps} onChange={set('rvSleeps')} placeholder="4" min={1} max={20} />
            </Field>
            <Field label="Slideouts">
              <input className={inp} type="number" value={form.rvSlideouts} onChange={set('rvSlideouts')} placeholder="2" min={0} max={6} />
            </Field>
            <Field label="Axles">
              <input className={inp} type="number" value={form.rvAxles} onChange={set('rvAxles')} placeholder="2" min={1} max={4} />
            </Field>
            <Field label="Awning" hint="ft">
              <input className={inp} type="number" step="0.5" value={form.rvAwningFt} onChange={set('rvAwningFt')} placeholder="16" />
            </Field>
            <Field label="AC Units">
              <input className={inp} type="number" value={form.rvAirconditioners} onChange={set('rvAirconditioners')} placeholder="1" min={0} max={4} />
            </Field>
            <Field label="MPG">
              <input className={inp} type="number" step="0.1" value={form.rvMpg} onChange={set('rvMpg')} placeholder="9.5" />
            </Field>
          </div>
        </Section>

        {/* ── 3. Tanks & Fluids ─────────────────────────────────────────── */}
        <Section
          id="tanks" icon="💧" title="Tanks & Fluids"
          subtitle="Water, waste, propane & fuel"
          accentColor="#0EA5E9"
        >
          <p className="text-xs text-gray-400 mb-3">Enter capacity in gallons — the bars fill as you type.</p>
          <div className="grid grid-cols-2 gap-3">
            <TankInput emoji="🚿" label="Fresh Water" field="rvFreshWaterGal"
              form={form} set={set} color="#0EA5E9" maxGal={80} />
            <TankInput emoji="🪣" label="Grey Water" field="rvGreyWaterGal"
              form={form} set={set} color="#94A3B8" maxGal={60} />
            <TankInput emoji="🚽" label="Black Water" field="rvBlackWaterGal"
              form={form} set={set} color="#64748B" maxGal={40} />
            <TankInput emoji="🔥" label="LP / Propane" field="rvLpGasGal"
              form={form} set={set} color={brand.orange} maxGal={20} />
            <TankInput emoji="⛽" label="Fuel Tank" field="rvFuelGal"
              form={form} set={set} color="#F59E0B" maxGal={150} />
          </div>
        </Section>

        {/* ── 4. Electrical ─────────────────────────────────────────────── */}
        <Section
          id="elec" icon="⚡" title="Electrical"
          subtitle="Shore power, generator, solar & batteries"
          accentColor={brand.gold}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Shore Power">
                <select className={inp} value={form.rvShorepower} onChange={set('rvShorepower')}>
                  <option value="">Select...</option>
                  {SHOREPOWER.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Generator" hint="watts">
              <input className={inp} type="number" value={form.rvGeneratorWatts}
                onChange={set('rvGeneratorWatts')} placeholder="4000" />
            </Field>
            <Field label="Battery Bank" hint="Ah"
              tip="Total amp-hour capacity of your battery bank (lithium or AGM).">
              <input className={inp} type="number" value={form.rvBatteryAh}
                onChange={set('rvBatteryAh')} placeholder="200" />
            </Field>
            <Field label="Solar Array" hint="watts">
              <input className={inp} type="number" value={form.rvSolarWatts}
                onChange={set('rvSolarWatts')} placeholder="400" />
            </Field>
          </div>
        </Section>

        {/* ── 5. Weight Ratings ─────────────────────────────────────────── */}
        <Section
          id="weight" icon="⚖️" title="Weight Ratings"
          subtitle="Dry weight, GVWR & hitch weight"
          accentColor={brand.bark}
          defaultOpen={false}
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Dry Weight" hint="lbs">
              <input className={inp} type="number" value={form.rvWeight}
                onChange={set('rvWeight')} placeholder="8,500" />
            </Field>
            <Field label="GVWR" hint="lbs"
              tip="Gross Vehicle Weight Rating — the maximum total loaded weight allowed.">
              <input className={inp} type="number" value={form.rvGvwr}
                onChange={set('rvGvwr')} placeholder="12,500" />
            </Field>
            <Field label="Hitch Weight" hint="lbs"
              tip="Tongue weight for towables, or pin weight for fifth wheels.">
              <input className={inp} type="number" value={form.rvHitchWeight}
                onChange={set('rvHitchWeight')} placeholder="1,200" />
            </Field>
          </div>
        </Section>

        {/* ── 6. Registration ───────────────────────────────────────────── */}
        <Section
          id="reg" icon="🪪" title="Registration"
          subtitle="License plate & state — private, only visible to you"
          accentColor={brand.sage}
          defaultOpen={false}
        >
          <div className="grid grid-cols-2 gap-3">
            <Field label="License Plate">
              <input className={`${inp} uppercase`} value={form.licensePlate}
                onChange={set('licensePlate')} placeholder="ABC-1234" />
            </Field>
            <Field label="State">
              <select className={inp} value={form.licensePlateState} onChange={set('licensePlateState')}>
                <option value="">Select...</option>
                {US_STATES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </Field>
            <Field label="Tag Expiration">
              <input className={inp} type="date" value={form.tagExpiration}
                onChange={set('tagExpiration')} />
            </Field>
            <Field label="Odometer (mi)">
              <input className={inp} type="number" value={form.currentOdometer}
                onChange={set('currentOdometer')} placeholder="45000" />
            </Field>
          </div>
          <div
            className="mt-3 flex items-center gap-2 text-xs rounded-lg px-3 py-2"
            style={{ background: brand.sage + '12', color: brand.sage }}
          >
            🔒 License info is private and never shown to other users.
          </div>
        </Section>

        {/* ── Bottom save ───────────────────────────────────────────────── */}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base transition-all active:scale-[0.98] disabled:opacity-60"
          style={{
            background: saved
              ? brand.sage
              : `linear-gradient(135deg, ${brand.orange} 0%, #c94d1f 100%)`,
            color: 'white',
            boxShadow: saved ? 'none' : `0 4px 16px ${brand.orange}55`,
          }}
        >
          {saved ? (
            <><CheckCircle className="w-5 h-5" /> All changes saved!</>
          ) : saving ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <><Save className="w-5 h-5" /> Save Spec Sheet</>
          )}
        </button>

        <div className="h-6" />
      </div>
    </div>
  );
}
