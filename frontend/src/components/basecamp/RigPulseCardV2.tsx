/**
 * RigPulseCardV2 — Two distinct rig sections on Basecamp:
 *
 * Section 1: Rig Identity / Influencer Hub
 *   Title = rig's actual name (not "My Rig")
 *   Condensed public rig page: cover photo, recent photos, followers, content activity.
 *   Influencer metrics: recent followers (live data), profile views (when accrued).
 *
 * Section 2: Owner's Dashboard ("My Rig Info")
 *   RV details (real values or "add" affordance), ownership stats, quick actions
 *   wired to existing create flows. Maintenance health.
 */
import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, Check, X } from 'lucide-react';
import api from '../../services/api';

const CN = { bg: '#0F1C35', card: '#162236', cardAlt: '#1A2A45', gold: '#E8A838', orange: '#D4621A', cream: '#F5F0E8', muted: '#8B9BB4', border: '#243552' };

interface MaintenanceRecord {
  id: string;
  title: string;
  category: string;
  cost: number | null;
  serviceDate: string;
  hasReceipt: boolean;
}

interface MaintenanceData {
  serviceCount: number;
  totalSpent: number;
  overdueCount: number;
  upcomingCount: number;
  overdue: { id: string; title: string; category: string }[];
  upcoming: { id: string; title: string; category: string; dueDate: string }[];
  recentRecords?: MaintenanceRecord[];
}

interface OwnerDetails {
  year: number | null;
  make: string | null;
  model: string | null;
  lengthFeet: number | null;
  grossWeight: number | null;
  fuelType: string | null;
  towingCapacity: number | null;
  slideoutCount: number | null;
  freshWaterGal: number | null;
  grayWaterGal: number | null;
  blackWaterGal: number | null;
  tireSizeFront: string | null;
  tireSizeRear: string | null;
  tireInstallDate: string | null;
  purchaseDate: string | null;
  purchasePrice: number | null;
  currentOdometer: number | null;
  avgMPG: number | null;
  solarWatts: number | null;
  generatorWatts: number | null;
}

interface RigPulseData {
  hasActiveTrip: boolean;
  trip: { name: string; destination: string | null; daysAway: number | null; totalMiles: number; totalNights: number; statesVisited: number } | null;
  lastCheckIn: { campgroundName: string; date: string; daysAgo: number | null } | null;
  lastPhoto: { url: string | null; tripName: string | null; date: string } | null;
  lastSavedCampground: { name: string; state: string; savedAt: string } | null;
  newFollowers: { userId: string; username: string; avatarUrl: string | null; firstName: string }[];
  totalMilesAllTime: number;
  totalNightsAllTime?: number;
  totalStatesVisited?: number;
  totalCampgroundsAllTime?: number;
  followerCount?: number;
  postCount?: number;
  rigName: string | null;
  rigSpec: string | null;
  rigEmoji: string;
  rigPhoto: string | null;
  rigSlug: string | null;
  rigClass?: string | null;
  coverPhoto?: string | null;
  recentPhotos?: string[];
  coPilots: { userId: string; username: string; avatarUrl: string | null }[];
  pinnedMemories?: { id: string; title: string; photoUrl: string | null; date: string | null }[];
  maintenance?: MaintenanceData;
  ownerDetails?: OwnerDetails;
}

function humanizeClass(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function humanizeFuel(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function SkeletonCard() {
  return (
    <div style={{ background: CN.card, borderRadius: 16, padding: 20 }}>
      <div style={{ height: 120, borderRadius: 12, background: CN.border, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 16, width: '60%', borderRadius: 4, background: CN.border, marginBottom: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <div style={{ height: 12, width: '40%', borderRadius: 4, background: CN.border, animation: 'pulse 1.5s ease-in-out infinite' }} />
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4; } 50% { opacity: 0.8; } }`}</style>
    </div>
  );
}

// ─── RIG CLASS & FUEL TYPE OPTIONS ───
const RIG_CLASSES = [
  { value: 'CLASS_A', label: 'Class A' },
  { value: 'CLASS_B', label: 'Class B' },
  { value: 'CLASS_C', label: 'Class C' },
  { value: 'FIFTH_WHEEL', label: 'Fifth Wheel' },
  { value: 'TRAVEL_TRAILER', label: 'Travel Trailer' },
  { value: 'POP_UP', label: 'Pop-Up' },
  { value: 'TRUCK_CAMPER', label: 'Truck Camper' },
  { value: 'VAN', label: 'Van / Campervan' },
  { value: 'TOY_HAULER', label: 'Toy Hauler' },
];

const FUEL_TYPES = [
  { value: 'gas', label: 'Gas' },
  { value: 'diesel', label: 'Diesel' },
  { value: 'electric', label: 'Electric' },
  { value: 'hybrid', label: 'Hybrid' },
  { value: 'propane', label: 'Propane' },
];

// ─── EDITABLE DETAIL ROW ───
function EditableRow({ label, value, displayValue, fieldKey, inputType = 'text', unit, options, onSave }: {
  label: string;
  value: string | number | null | undefined;
  displayValue?: string;
  fieldKey: string;
  inputType?: 'text' | 'number' | 'date' | 'select';
  unit?: string;
  options?: { value: string; label: string }[];
  onSave: (key: string, val: string | number | null) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? ''));
  const [saving, setSaving] = useState(false);

  const startEdit = () => { setDraft(String(value ?? '')); setEditing(true); };
  const cancel = () => setEditing(false);
  const save = async () => {
    setSaving(true);
    try {
      const val = draft.trim() === '' ? null : (inputType === 'number' ? Number(draft) : draft);
      await onSave(fieldKey, val);
      setEditing(false);
    } catch { /* error handled by parent */ }
    setSaving(false);
  };

  if (editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', borderBottom: `1px solid ${CN.border}` }}>
        <span style={{ fontSize: 11, color: CN.muted, flexShrink: 0, width: 90 }}>{label}</span>
        {inputType === 'select' && options ? (
          <select value={draft} onChange={e => setDraft(e.target.value)}
            style={{ flex: 1, fontSize: 11, background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.gold}`, borderRadius: 4, padding: '3px 6px', outline: 'none' }}>
            <option value="">— None —</option>
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <input type={inputType === 'number' ? 'number' : inputType === 'date' ? 'date' : 'text'}
            value={draft} onChange={e => setDraft(e.target.value)} autoFocus
            onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
            style={{ flex: 1, fontSize: 11, background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.gold}`, borderRadius: 4, padding: '3px 6px', outline: 'none', minWidth: 0 }}
            placeholder={unit ? `e.g. 33` : ''} />
        )}
        {unit && <span style={{ fontSize: 9, color: CN.muted, flexShrink: 0 }}>{unit}</span>}
        <button onClick={save} disabled={saving} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
          <Check style={{ width: 14, height: 14, color: '#22c55e' }} />
        </button>
        <button onClick={cancel} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, flexShrink: 0 }}>
          <X style={{ width: 14, height: 14, color: CN.muted }} />
        </button>
      </div>
    );
  }

  const shown = displayValue ?? (value != null ? String(value) : null);

  return (
    <div onClick={startEdit} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: `1px solid ${CN.border}`, cursor: 'pointer' }}>
      <span style={{ fontSize: 11, color: CN.muted }}>{label}</span>
      {shown ? (
        <span style={{ fontSize: 11, fontWeight: 600, color: CN.cream }}>{shown}{unit ? ` ${unit}` : ''}</span>
      ) : (
        <span style={{ fontSize: 10, color: CN.gold, fontWeight: 600 }}>+ Add</span>
      )}
    </div>
  );
}

// ─── READ-ONLY ROW (for derived values like MPG, odometer) ───
function ReadOnlyRow({ label, value, unit, actionLabel, actionTo }: { label: string; value: string | number | null | undefined; unit?: string; actionLabel?: string; actionTo?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${CN.border}` }}>
      <span style={{ fontSize: 11, color: CN.muted }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {value != null ? (
          <span style={{ fontSize: 11, fontWeight: 600, color: CN.cream }}>{value}{unit ? ` ${unit}` : ''}</span>
        ) : (
          <span style={{ fontSize: 10, color: CN.muted }}>—</span>
        )}
        {actionLabel && actionTo && (
          <Link to={actionTo} style={{ fontSize: 9, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>{actionLabel}</Link>
        )}
      </div>
    </div>
  );
}

// ─── QUICK ACTION BUTTON ───
function QuickAction({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '8px 10px', borderRadius: 8, background: CN.cardAlt,
      border: `1px solid ${CN.border}`, fontSize: 11, fontWeight: 600,
      color: CN.gold, textDecoration: 'none', whiteSpace: 'nowrap',
    }}>
      {label}
    </Link>
  );
}

export default function RigPulseCardV2({ data }: { data: RigPulseData | null }) {
  if (!data) return <SkeletonCard />;

  const rigPageUrl = data.rigSlug ? `/rig/${data.rigSlug}` : '/my-rv';
  const editUrl = data.rigSlug ? `/rig/${data.rigSlug}/edit` : '/my-rv';
  const hasStats = data.totalMilesAllTime > 0 || (data.totalStatesVisited ?? 0) > 0 || (data.totalCampgroundsAllTime ?? 0) > 0 || (data.postCount ?? 0) > 0;
  const [rigInfoOpen, setRigInfoOpen] = useState(true);
  const [localDetails, setLocalDetails] = useState(data.ownerDetails || {} as any);
  const [localClass, setLocalClass] = useState(data.rigClass);
  const maint = data.maintenance;
  const od = localDetails;

  const saveField = useCallback(async (key: string, val: string | number | null) => {
    try {
      await api.patch('/basecamp/v2/rig-details', { [key]: val });
      setLocalDetails((prev: any) => ({ ...prev, [key]: val }));
      if (key === 'rigClass') setLocalClass(val as string | null);
    } catch (err) {
      console.error('[RigPulse] save failed:', err);
      throw err;
    }
  }, []);
  const coverImg = data.coverPhoto || data.rigPhoto;
  // User truly has no rig when there's no slug (no rig record found at all)
  const hasNoRig = !data.rigSlug;
  const displayTitle = data.rigName || data.rigSpec || 'My Rig';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 1 — RIG IDENTITY / INFLUENCER HUB
          Title = rig's actual name. Condensed public rig page.
          ════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>

        {/* Header — rig name as title, spec as subtitle */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${CN.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>{data.rigEmoji || '\u{1F690}'}</span>
            <div style={{ minWidth: 0 }}>
              {hasNoRig ? (
                <p style={{ fontSize: 14, fontWeight: 700, color: CN.cream, margin: 0 }}>Set Up Your Rig</p>
              ) : (
                <Link to={rigPageUrl} style={{ textDecoration: 'none', display: 'block', minWidth: 0 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: CN.cream, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {displayTitle}
                  </p>
                  {data.rigName && data.rigSpec && (
                    <p style={{ fontSize: 10, color: CN.muted, margin: 0 }}>{data.rigSpec}</p>
                  )}
                </Link>
              )}
            </div>
          </div>
          {!hasNoRig && (
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
              <Link to={editUrl} style={{ fontSize: 10, color: CN.muted, textDecoration: 'none', fontWeight: 600 }}>Edit</Link>
              <Link to={rigPageUrl} style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>View &rarr;</Link>
            </div>
          )}
        </div>

        {/* Cover photo */}
        {coverImg ? (
          <img src={coverImg} alt={displayTitle} style={{ width: '100%', height: 140, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', background: CN.cardAlt }}>
            <div style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 36 }}>{data.rigEmoji || '\u{1F690}'}</span>
              <p style={{ fontSize: 10, color: CN.muted, marginTop: 4 }}>
                <Link to={editUrl} style={{ color: CN.gold, textDecoration: 'none' }}>Add a cover photo &rarr;</Link>
              </p>
            </div>
          </div>
        )}

        <div style={{ padding: 16 }}>
          {/* Identity subtitle */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            {data.rigClass && <span style={{ fontSize: 11, color: CN.muted }}>{humanizeClass(data.rigClass)}</span>}
            {(data.followerCount ?? 0) > 0 && (
              <Link to={rigPageUrl} style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 500 }}>
                {data.followerCount} follower{data.followerCount !== 1 ? 's' : ''}
              </Link>
            )}
          </div>

          {/* Recent photos strip */}
          {data.recentPhotos && data.recentPhotos.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recent Photos</p>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                {data.recentPhotos.map((url, i) => (
                  <Link key={i} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                      <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Memory Wall peek */}
          {data.pinnedMemories && data.pinnedMemories.length > 0 && !data.recentPhotos?.length && (
            <div style={{ marginBottom: 12 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Memory Wall</p>
              <div style={{ display: 'flex', gap: 4, overflowX: 'auto' }}>
                {data.pinnedMemories.map(m => (
                  <Link key={m.id} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                    <div style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                      {m.photoUrl ? <img src={m.photoUrl} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u{1F4F8}'}</div>}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* Stats row */}
          {hasStats && (
            <div style={{ display: 'flex', gap: 2, marginBottom: 12, background: CN.cardAlt, borderRadius: 8, padding: '8px 10px' }}>
              {data.totalMilesAllTime > 0 && <div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalMilesAllTime.toLocaleString()}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Miles</p></div>}
              {(data.totalStatesVisited ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalStatesVisited}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>States</p></div></>}
              {(data.totalNightsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalNightsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Nights</p></div></>}
              {(data.totalCampgroundsAllTime ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.totalCampgroundsAllTime}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Camps</p></div></>}
              {(data.postCount ?? 0) > 0 && <><div style={{ width: 1, background: CN.border, margin: '4px 4px' }} /><div style={{ flex: 1, textAlign: 'center' }}><p style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>{data.postCount}</p><p style={{ fontSize: 9, color: CN.muted, textTransform: 'uppercase' }}>Posts</p></div></>}
            </div>
          )}

          {/* New followers (influencer metric — live data) */}
          {data.newFollowers?.length > 0 && (
            <Link to={rigPageUrl} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', background: CN.cardAlt, borderRadius: 8, marginBottom: 12, textDecoration: 'none' }}>
              <div style={{ display: 'flex' }}>
                {data.newFollowers.slice(0, 4).map((f, i) => (
                  <div key={f.userId} style={{ width: 24, height: 24, borderRadius: '50%', background: CN.border, border: `2px solid ${CN.cardAlt}`, marginLeft: i > 0 ? -8 : 0, overflow: 'hidden', zIndex: 4 - i }}>
                    {f.avatarUrl ? <img src={f.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: CN.gold, fontWeight: 700 }}>{f.firstName?.[0]}</div>}
                  </div>
                ))}
              </div>
              <span style={{ fontSize: 11, color: CN.gold, fontWeight: 600 }}>+{data.newFollowers.length} new follower{data.newFollowers.length > 1 ? 's' : ''} this week</span>
            </Link>
          )}

          {/* Active trip banner */}
          {data.hasActiveTrip && data.trip && (
            <div style={{ background: CN.cardAlt, borderRadius: 10, padding: '10px 12px', borderLeft: `3px solid ${CN.orange}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 11, color: CN.muted }}>Active Trip</p>
                  <p style={{ fontSize: 13, fontWeight: 700, color: CN.cream }}>{data.trip.name}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: 20, fontWeight: 800, color: CN.gold }}>{data.trip.daysAway ?? '?'}</span>
                  <span style={{ fontSize: 10, color: CN.gold, marginLeft: 3 }}>days</span>
                </div>
              </div>
            </div>
          )}

          {/* Empty state — ONLY when user truly has no rig record */}
          {hasNoRig && (
            <div style={{ textAlign: 'center', padding: '8px 0' }}>
              <p style={{ fontSize: 12, color: CN.cream, fontWeight: 600, marginBottom: 4 }}>Your rig's story starts here</p>
              <p style={{ fontSize: 11, color: CN.muted, marginBottom: 8 }}>Set up your rig profile to track trips, share photos, and connect with other RVers.</p>
              <Link to="/my-rv" style={{ fontSize: 11, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>Set up your rig profile &rarr;</Link>
            </div>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════════════════════════════
          SECTION 2 — OWNER'S DASHBOARD ("My Rig Info")
          Operational data: RV details, maintenance, quick actions.
          ════════════════════════════════════════════════════════════════ */}
      <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>

        {/* Header — clickable to expand/collapse */}
        <button
          onClick={() => setRigInfoOpen(o => !o)}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', width: '100%', background: 'none', border: 'none', borderBottom: rigInfoOpen ? `1px solid ${CN.border}` : 'none', cursor: 'pointer' }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>My Rig Info</span>
          <ChevronDown style={{ width: 16, height: 16, color: CN.muted, transition: 'transform 0.2s', transform: rigInfoOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        </button>

        {rigInfoOpen && <div style={{ padding: 16 }}>
          {/* RV Details — inline editable */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>RV Details</p>
            <EditableRow label="Year" value={od?.year} fieldKey="year" inputType="number" onSave={saveField} />
            <EditableRow label="Make" value={od?.make} fieldKey="make" onSave={saveField} />
            <EditableRow label="Model" value={od?.model} fieldKey="model" onSave={saveField} />
            <EditableRow label="Class" value={localClass} displayValue={humanizeClass(localClass)} fieldKey="rigClass" inputType="select" options={RIG_CLASSES} onSave={saveField} />
            <EditableRow label="Length" value={od?.lengthFeet} fieldKey="lengthFeet" inputType="number" unit="ft" onSave={saveField} />
            <EditableRow label="Weight" value={od?.grossWeight} fieldKey="grossWeight" inputType="number" unit="lbs" onSave={saveField} />
            <EditableRow label="Fuel Type" value={od?.fuelType} displayValue={humanizeFuel(od?.fuelType)} fieldKey="fuelType" inputType="select" options={FUEL_TYPES} onSave={saveField} />
            <EditableRow label="Towing" value={od?.towingCapacity} fieldKey="towingCapacity" inputType="number" unit="lbs" onSave={saveField} />
            <EditableRow label="Slideouts" value={od?.slideoutCount} fieldKey="slideoutCount" inputType="number" onSave={saveField} />
            <EditableRow label="Solar" value={od?.solarWatts} fieldKey="solarWatts" inputType="number" unit="W" onSave={saveField} />
            <EditableRow label="Generator" value={od?.generatorWatts} fieldKey="generatorWatts" inputType="number" unit="W" onSave={saveField} />
          </div>

          {/* Tanks & Tires — inline editable */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Tanks & Tires</p>
            <EditableRow label="Fresh Water" value={od?.freshWaterGal} fieldKey="freshWaterGal" inputType="number" unit="gal" onSave={saveField} />
            <EditableRow label="Gray Water" value={od?.grayWaterGal} fieldKey="grayWaterGal" inputType="number" unit="gal" onSave={saveField} />
            <EditableRow label="Black Water" value={od?.blackWaterGal} fieldKey="blackWaterGal" inputType="number" unit="gal" onSave={saveField} />
            <EditableRow label="Tires (Front)" value={od?.tireSizeFront} fieldKey="tireSizeFront" onSave={saveField} />
            <EditableRow label="Tires (Rear)" value={od?.tireSizeRear} fieldKey="tireSizeRear" onSave={saveField} />
          </div>

          {/* Ownership — editable + derived fields */}
          <div style={{ marginBottom: 14 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Ownership</p>
            <EditableRow label="Purchase Date" value={od?.purchaseDate ? od.purchaseDate.slice(0, 10) : null} displayValue={od?.purchaseDate ? new Date(od.purchaseDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : undefined} fieldKey="purchaseDate" inputType="date" onSave={saveField} />
            <ReadOnlyRow label="Odometer" value={od?.currentOdometer ? od.currentOdometer.toLocaleString() : null} unit="mi" actionLabel="+ Fuel Log" actionTo={rigPageUrl} />
            <ReadOnlyRow label="Avg MPG" value={od?.avgMPG ? od.avgMPG.toFixed(1) : null} actionLabel="+ Fuel Log" actionTo={rigPageUrl} />
            {data.totalMilesAllTime > 0 && <ReadOnlyRow label="Miles Traveled" value={data.totalMilesAllTime.toLocaleString()} />}
            {(data.totalStatesVisited ?? 0) > 0 && <ReadOnlyRow label="States Visited" value={data.totalStatesVisited!} />}
            {(data.totalCampgroundsAllTime ?? 0) > 0 && <ReadOnlyRow label="Campgrounds" value={data.totalCampgroundsAllTime!} />}
          </div>

          {/* Rig Health / Maintenance */}
          <div style={{ background: CN.cardAlt, borderRadius: 10, padding: 12, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>Rig Health</p>
              <Link to="/maintenance" style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>View All &rarr;</Link>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
              <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: CN.cream }}>{maint?.serviceCount ?? 0}</p>
                <p style={{ fontSize: 9, color: CN.muted }}>Service Records</p>
              </div>
              <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>${(maint?.totalSpent ?? 0).toLocaleString()}</p>
                <p style={{ fontSize: 9, color: CN.muted }}>Total Spent</p>
              </div>
              <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center', border: (maint?.overdueCount ?? 0) > 0 ? '1px solid rgba(239,68,68,0.3)' : undefined }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: (maint?.overdueCount ?? 0) > 0 ? '#ef4444' : CN.cream }}>{maint?.overdueCount ?? 0}</p>
                <p style={{ fontSize: 9, color: (maint?.overdueCount ?? 0) > 0 ? '#ef4444' : CN.muted }}>Overdue</p>
              </div>
              <div style={{ background: CN.card, borderRadius: 8, padding: '8px 10px', textAlign: 'center' }}>
                <p style={{ fontSize: 16, fontWeight: 700, color: CN.gold }}>{maint?.upcomingCount ?? 0}</p>
                <p style={{ fontSize: 9, color: CN.muted }}>Upcoming</p>
              </div>
            </div>

            {/* Overdue alerts */}
            {maint?.overdue && maint.overdue.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {maint.overdue.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                    <span style={{ color: '#ef4444' }}>{'\u26A0\uFE0F'}</span>
                    <span style={{ color: CN.cream }}>{item.title}</span>
                    <span style={{ fontSize: 9, color: CN.muted }}>({item.category})</span>
                  </div>
                ))}
              </div>
            )}

            {/* Upcoming reminders */}
            {maint?.upcoming && maint.upcoming.length > 0 && (
              <div style={{ marginBottom: 6 }}>
                {maint.upcoming.map(item => (
                  <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 11 }}>
                    <span style={{ color: CN.gold }}>{'\u{1F527}'}</span>
                    <span style={{ color: CN.cream }}>{item.title}</span>
                    <span style={{ fontSize: 9, color: CN.muted }}>{item.dueDate ? new Date(item.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Service History */}
            {maint?.recentRecords && maint.recentRecords.length > 0 && (
              <div style={{ borderTop: `1px solid ${CN.border}`, paddingTop: 8, marginTop: 4 }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Recent Service History</p>
                {maint.recentRecords.map(rec => (
                  <Link key={rec.id} to="/maintenance" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: `1px solid ${CN.border}`, textDecoration: 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 11, fontWeight: 600, color: CN.cream, margin: 0 }}>{rec.title}</p>
                      <p style={{ fontSize: 9, color: CN.muted, margin: 0 }}>
                        {rec.category} &middot; {new Date(rec.serviceDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </p>
                    </div>
                    {rec.cost != null && <span style={{ fontSize: 11, fontWeight: 600, color: CN.cream, flexShrink: 0 }}>${rec.cost.toLocaleString()}</span>}
                    {rec.hasReceipt && <span style={{ fontSize: 10, flexShrink: 0 }} title="Receipt attached">{'\u{1F4CE}'}</span>}
                  </Link>
                ))}
              </div>
            )}

            {/* Empty maintenance state */}
            {(!maint || maint.serviceCount === 0) && (
              <div style={{ textAlign: 'center', padding: '8px 0' }}>
                <p style={{ fontSize: 11, color: CN.muted, marginBottom: 6 }}>No service records yet. Track maintenance to stay on top of your rig.</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <p style={{ fontSize: 10, fontWeight: 700, color: CN.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Quick Actions</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
            <QuickAction label="+ Add Service Record" to="/maintenance" />
            <QuickAction label="+ Upload Receipt" to="/maintenance" />
            <QuickAction label="+ Modification" to={data.rigSlug ? `/rig/${data.rigSlug}/mods` : '/my-rv'} />
            <QuickAction label="+ Fuel Log" to={rigPageUrl} />
          </div>
        </div>}
      </div>
    </div>
  );
}
