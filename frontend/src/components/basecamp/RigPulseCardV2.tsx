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
import { ChevronDown, Check, X, AlertTriangle, Sparkles, Loader2 } from 'lucide-react';
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
  socialStats?: {
    followerCount: number;
    followerCountChange30d: number;
    viewsThisWeek: number;
    viewsLastWeek: number;
    avgEngagementPerPost: number;
    totalPosts: number;
    lastPostDaysAgo: number;
    activityStatus: 'ACTIVE' | 'QUIET' | 'INACTIVE';
    topPostThisMonth: { id: string; preview: string | null; likeCount: number; commentCount: number } | null;
  } | null;
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

// ─── FIELD LABELS FOR DISPLAY ───
const FIELD_LABELS: Record<string, string> = {
  lengthFeet: 'Length', grossWeight: 'Weight (GVWR)', towingCapacity: 'Towing Capacity',
  slideoutCount: 'Slideouts', freshWaterGal: 'Fresh Water', grayWaterGal: 'Gray Water',
  blackWaterGal: 'Black Water', fuelType: 'Fuel Type', fuelCapacityGal: 'Fuel Capacity',
  solarWatts: 'Solar', generatorWatts: 'Generator', tireSizeFront: 'Tires (Front)',
  tireSizeRear: 'Tires (Rear)', sleeps: 'Sleeps', engineSize: 'Engine', chassisMake: 'Chassis',
};

const FIELD_UNITS: Record<string, string> = {
  lengthFeet: 'ft', grossWeight: 'lbs', towingCapacity: 'lbs',
  freshWaterGal: 'gal', grayWaterGal: 'gal', blackWaterGal: 'gal',
  fuelCapacityGal: 'gal', solarWatts: 'W', generatorWatts: 'W', sleeps: 'people',
};

const SAFETY_FIELDS = new Set(['grossWeight', 'towingCapacity', 'fuelCapacityGal']);

// ─── HITCH REVIEW SCREEN ───
function HitchReviewScreen({ specs, onConfirm, onCancel }: {
  specs: Record<string, { value: any; unit: string | null; confidence: string; source: string; isSafetyCritical: boolean; verifiedByUser: boolean }>;
  onConfirm: (confirmed: Record<string, any>) => Promise<void>;
  onCancel: () => void;
}) {
  const [edits, setEdits] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    for (const [k, v] of Object.entries(specs)) {
      init[k] = v.value != null ? String(v.value) : '';
    }
    return init;
  });
  const [confirmed, setConfirmed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const toggleConfirm = (key: string) => {
    setConfirmed(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    const result: Record<string, any> = {};
    const confidenceMap: Record<string, string> = {};
    for (const [key, spec] of Object.entries(specs)) {
      const edited = edits[key]?.trim();
      if (!edited) continue; // skip empty/unknown
      const wasEdited = String(spec.value) !== edited;
      result[key] = edited;
      if (!wasEdited && !confirmed.has(key) && SAFETY_FIELDS.has(key)) continue; // safety fields need explicit confirm
      confidenceMap[key] = spec.confidence;
    }
    try {
      await onConfirm(result);
    } catch {}
    setSaving(false);
  };

  const fieldKeys = Object.entries(specs).sort(([, a], [, b]) => {
    if (a.value != null && b.value == null) return -1;
    if (a.value == null && b.value != null) return 1;
    return 0;
  });

  return (
    <div style={{ background: CN.card, borderRadius: 16, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${CN.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Sparkles style={{ width: 16, height: 16, color: CN.gold }} />
        <span style={{ fontSize: 14, fontWeight: 700, color: CN.cream }}>Hitch found your RV specs</span>
      </div>

      <div style={{ padding: '8px 16px' }}>
        <p style={{ fontSize: 10, color: CN.muted, marginBottom: 10 }}>
          These are Hitch's suggestions based on your RV model. Review each field — tap to edit, confirm what's correct, skip what's not.
        </p>

        {fieldKeys.map(([key, spec]) => {
          const label = FIELD_LABELS[key] || key;
          const unit = FIELD_UNITS[key] || spec.unit || '';
          const hasValue = spec.value != null;
          const isSafety = SAFETY_FIELDS.has(key);
          const isConfirmed = confirmed.has(key);
          const editValue = edits[key] || '';

          return (
            <div key={key} style={{ padding: '6px 0', borderBottom: `1px solid ${CN.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {/* Confirm checkbox */}
                <button onClick={() => hasValue && toggleConfirm(key)} style={{
                  width: 20, height: 20, borderRadius: 4, border: `1px solid ${isConfirmed ? '#22c55e' : CN.border}`,
                  background: isConfirmed ? 'rgba(34,197,94,0.15)' : 'transparent', cursor: hasValue ? 'pointer' : 'default',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, padding: 0,
                }}>
                  {isConfirmed && <Check style={{ width: 12, height: 12, color: '#22c55e' }} />}
                </button>

                {/* Label */}
                <span style={{ fontSize: 11, color: CN.muted, width: 85, flexShrink: 0 }}>{label}</span>

                {/* Value / Input */}
                {hasValue ? (
                  <input value={editValue} onChange={e => setEdits(prev => ({ ...prev, [key]: e.target.value }))}
                    style={{ flex: 1, fontSize: 11, background: CN.cardAlt, color: CN.cream, border: `1px solid ${CN.border}`, borderRadius: 4, padding: '3px 6px', outline: 'none', minWidth: 0 }} />
                ) : (
                  <span style={{ flex: 1, fontSize: 10, color: CN.muted, fontStyle: 'italic' }}>Unknown — add manually</span>
                )}

                {unit && hasValue && <span style={{ fontSize: 9, color: CN.muted, flexShrink: 0 }}>{unit}</span>}

                {/* Confidence badge */}
                {hasValue && (
                  <span style={{
                    fontSize: 8, padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                    background: spec.confidence === 'high' ? 'rgba(34,197,94,0.15)' : spec.confidence === 'medium' ? 'rgba(232,168,56,0.15)' : 'rgba(239,68,68,0.15)',
                    color: spec.confidence === 'high' ? '#22c55e' : spec.confidence === 'medium' ? CN.gold : '#ef4444',
                  }}>
                    {spec.confidence}
                  </span>
                )}
              </div>

              {/* Safety warning */}
              {isSafety && hasValue && !isConfirmed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3, marginLeft: 26 }}>
                  <AlertTriangle style={{ width: 10, height: 10, color: CN.orange }} />
                  <span style={{ fontSize: 9, color: CN.orange }}>Verify against your door sticker or owner's manual</span>
                </div>
              )}

              {/* Unconfirmed indicator */}
              {hasValue && !isConfirmed && !isSafety && (
                <p style={{ fontSize: 9, color: CN.muted, marginLeft: 26, marginTop: 1 }}>Hitch's suggestion — tap checkbox to confirm</p>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ padding: '12px 16px', display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{
          flex: 1, padding: '9px 0', borderRadius: 8, background: 'transparent',
          border: `1px solid ${CN.border}`, color: CN.muted, fontWeight: 600, fontSize: 12, cursor: 'pointer',
        }}>Cancel</button>
        <button onClick={handleSave} disabled={saving} style={{
          flex: 1, padding: '9px 0', borderRadius: 8, background: CN.gold,
          border: 'none', color: CN.bg, fontWeight: 700, fontSize: 12, cursor: 'pointer',
          opacity: saving ? 0.6 : 1,
        }}>
          {saving ? 'Saving...' : 'Save to My Rig'}
        </button>
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
  const [hitchLoading, setHitchLoading] = useState(false);
  const [hitchSpecs, setHitchSpecs] = useState<Record<string, any> | null>(null);
  const maint = data.maintenance;
  const od = localDetails;

  const saveField = useCallback(async (key: string, val: string | number | null) => {
    try {
      await api.patch('/basecamp/v2/rig-details', { [key]: val, _source: 'user' });
      setLocalDetails((prev: any) => ({ ...prev, [key]: val }));
      if (key === 'rigClass') setLocalClass(val as string | null);
    } catch (err) {
      console.error('[RigPulse] save failed:', err);
      throw err;
    }
  }, []);

  const triggerHitch = useCallback(async () => {
    const year = od?.year || data.ownerDetails?.year;
    const make = od?.make || data.ownerDetails?.make;
    const model = od?.model || data.ownerDetails?.model;
    if (!year || !make || !model) return;
    setHitchLoading(true);
    try {
      const res = await api.post('/hitch/autofill', { year, make, model });
      setHitchSpecs(res.data?.specs || null);
    } catch (err) {
      console.error('[Hitch] autofill failed:', err);
    }
    setHitchLoading(false);
  }, [od, data.ownerDetails]);

  const confirmHitchSpecs = useCallback(async (confirmed: Record<string, any>) => {
    const confidence: Record<string, string> = {};
    if (hitchSpecs) {
      for (const [k, v] of Object.entries(hitchSpecs)) {
        if (confirmed[k] !== undefined) confidence[k] = (v as any).confidence;
      }
    }
    await api.patch('/basecamp/v2/rig-details', { ...confirmed, _source: 'hitch', _confidence: confidence });
    setLocalDetails((prev: any) => ({ ...prev, ...confirmed }));
    setHitchSpecs(null);
  }, [hitchSpecs]);
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
      <div style={{ background: 'linear-gradient(160deg, #1B2B4B 0%, #0F1C35 60%, #1A2A3E 100%)', borderRadius: 16, overflow: 'hidden', borderTop: '3px solid #E8622A' }}>

        {/* ── Hero photo with overlay ── */}
        <div style={{ position: 'relative', height: 200 }}
          className="group"
        >
          {coverImg ? (
            <>
              <div style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(135deg, #0F1C35 0%, #1B2B4B 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img
                  src={coverImg}
                  alt={displayTitle}
                  style={{
                    maxWidth: '100%', maxHeight: '100%',
                    objectFit: 'contain', objectPosition: 'center',
                  }}
                  onError={(e) => {
                    // Fall back to cover mode if contain looks wrong
                    const img = e.target as HTMLImageElement;
                    img.style.objectFit = 'cover';
                    img.style.width = '100%';
                    img.style.height = '100%';
                    img.style.maxWidth = 'none';
                    img.style.maxHeight = 'none';
                    (img as any).style.objectPosition = 'left center';
                  }}
                />
              </div>
              {/* Vignette gradient */}
              <div style={{
                position: 'absolute', bottom: 0, left: 0, right: 0, height: 80,
                background: 'linear-gradient(to bottom, transparent, rgba(15,28,53,0.95))',
                pointerEvents: 'none',
              }} />
            </>
          ) : (
            <div style={{
              width: '100%', height: '100%',
              background: 'linear-gradient(135deg, #1A2A45 0%, #0F1C35 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center' }}>
                <span style={{ fontSize: 48, opacity: 0.3 }}>{data.rigEmoji || '\u{1F690}'}</span>
                <p style={{ fontSize: 11, color: CN.muted, marginTop: 6 }}>
                  {'\u{1F4F8}'}{' '}
                  <Link to={editUrl} style={{ color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>
                    Add a cover photo
                  </Link>
                </p>
              </div>
            </div>
          )}

          {/* View button — top right */}
          {!hasNoRig && (
            <Link
              to={rigPageUrl}
              style={{
                position: 'absolute', top: 10, right: 12,
                fontSize: 10, fontWeight: 700, color: CN.gold,
                textDecoration: 'none',
                background: 'rgba(15,28,53,0.7)', backdropFilter: 'blur(4px)',
                padding: '4px 10px', borderRadius: 99,
              }}
            >
              View &rarr;
            </Link>
          )}

          {/* Edit button — bottom right, hover-visible on desktop */}
          {!hasNoRig && (
            <Link
              to={editUrl}
              className="md:opacity-0 md:group-hover:opacity-100"
              style={{
                position: 'absolute', bottom: 36, right: 12,
                fontSize: 10, fontWeight: 600, color: '#fff',
                textDecoration: 'none',
                background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                padding: '4px 10px', borderRadius: 99,
                transition: 'opacity 0.2s',
              }}
            >
              {'\u{270F}\uFE0F'} Edit Rig
            </Link>
          )}

          {/* Rig name + spec overlaid on photo bottom */}
          {!hasNoRig && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 16px 12px',
              display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            }}>
              <Link to={rigPageUrl} style={{ textDecoration: 'none', minWidth: 0 }}>
                <p style={{
                  fontSize: 18, fontWeight: 800, color: '#fff', margin: 0,
                  textShadow: '0 1px 8px rgba(0,0,0,0.5)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>
                  {displayTitle}
                </p>
                {data.rigName && data.rigSpec && (
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', margin: 0 }}>{data.rigSpec}</p>
                )}
              </Link>
              {data.rigClass && (
                <span style={{
                  fontSize: 9, fontWeight: 700, color: CN.gold,
                  background: 'rgba(232,163,56,0.15)',
                  border: '1px solid rgba(232,163,56,0.3)',
                  padding: '2px 8px', borderRadius: 99,
                  textTransform: 'uppercase', letterSpacing: 0.5,
                  flexShrink: 0, marginLeft: 8,
                }}>
                  {humanizeClass(data.rigClass)}
                </span>
              )}
            </div>
          )}

          {hasNoRig && (
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '0 16px 12px',
            }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: CN.cream, margin: 0 }}>Set Up Your Rig</p>
            </div>
          )}
        </div>

        <div style={{ padding: 16 }}>
          {/* Recent photos strip */}
          {!hasNoRig && (
            <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
              {data.recentPhotos && data.recentPhotos.length > 0 ? (
                <>
                  {data.recentPhotos.slice(0, 4).map((url, i) => (
                    <Link key={i} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                        <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
                      </div>
                    </Link>
                  ))}
                  {data.recentPhotos.length < 4 && (
                    <Link to={`${rigPageUrl}?tab=photos`} style={{
                      textDecoration: 'none', flexShrink: 0,
                      width: 60, height: 60, borderRadius: 10,
                      background: CN.cardAlt, border: `1px dashed ${CN.border}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18, color: CN.muted,
                    }}>
                      +
                    </Link>
                  )}
                  <div style={{ flex: 1 }} />
                  {(data.followerCount ?? 0) > 0 && (
                    <Link to={rigPageUrl} style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>
                      {data.followerCount} follower{data.followerCount !== 1 ? 's' : ''}
                    </Link>
                  )}
                </>
              ) : data.pinnedMemories && data.pinnedMemories.length > 0 ? (
                <>
                  {data.pinnedMemories.slice(0, 4).map(m => (
                    <Link key={m.id} to={rigPageUrl} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <div style={{ width: 60, height: 60, borderRadius: 10, overflow: 'hidden', background: CN.cardAlt, border: `1px solid ${CN.border}` }}>
                        {m.photoUrl ? <img src={m.photoUrl} alt={m.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{'\u{1F4F8}'}</div>}
                      </div>
                    </Link>
                  ))}
                </>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                  <span style={{ fontSize: 10, color: CN.muted }}>No photos yet</span>
                  <Link to={`${rigPageUrl}?tab=photos`} style={{ fontSize: 10, color: CN.gold, textDecoration: 'none', fontWeight: 600 }}>Add Photos</Link>
                </div>
              )}
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

          {/* ═══ Rig Page Social Stats ═══ */}
          {data.socialStats && data.rigSlug && (() => {
            const ss = data.socialStats;
            const statusDot = ss.activityStatus === 'ACTIVE' ? '#22c55e' : ss.activityStatus === 'QUIET' ? '#eab308' : '#6b7280';
            const statusLabel = ss.activityStatus === 'ACTIVE' ? 'Active' : ss.activityStatus === 'QUIET' ? 'Quiet' : 'Inactive';
            const viewsTrend = ss.viewsLastWeek > 0 ? Math.round(((ss.viewsThisWeek - ss.viewsLastWeek) / ss.viewsLastWeek) * 100) : 0;

            return (
              <div style={{ marginBottom: 12 }}>
                {/* Divider + header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: CN.gold, textTransform: 'uppercase', letterSpacing: 0.8 }}>Rig Page</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot }} />
                    <span style={{ fontSize: 9, color: CN.muted }}>{statusLabel}</span>
                  </div>
                </div>

                {/* Social stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                  {/* Followers */}
                  <Link to={`/rig/${data.rigSlug}?tab=followers`} style={{ textDecoration: 'none', textAlign: 'center', padding: '8px 4px', background: CN.cardAlt, borderRadius: 8, position: 'relative' }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: CN.gold }}>{ss.followerCount}</p>
                    <p style={{ fontSize: 8, color: CN.muted, textTransform: 'uppercase', marginTop: 1 }}>Followers</p>
                    {ss.followerCountChange30d > 0 && (
                      <p style={{ fontSize: 8, color: '#22c55e', marginTop: 2 }}>+{ss.followerCountChange30d} mo</p>
                    )}
                    {/* Notification badge for new followers */}
                    {ss.followerCountChange30d > 0 && (
                      <div style={{
                        position: 'absolute', top: -3, right: -3,
                        width: 16, height: 16, borderRadius: '50%',
                        background: CN.orange, color: '#fff',
                        fontSize: 8, fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        border: `2px solid ${CN.card}`,
                      }}>
                        +{ss.followerCountChange30d}
                      </div>
                    )}
                  </Link>

                  {/* Views */}
                  <Link to={`/rig/${data.rigSlug}`} style={{ textDecoration: 'none', textAlign: 'center', padding: '8px 4px', background: CN.cardAlt, borderRadius: 8 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: CN.gold }}>{ss.viewsThisWeek}</p>
                    <p style={{ fontSize: 8, color: CN.muted, textTransform: 'uppercase', marginTop: 1 }}>Views/wk</p>
                    {viewsTrend !== 0 && (
                      <p style={{ fontSize: 8, color: viewsTrend > 0 ? '#22c55e' : '#ef4444', marginTop: 2 }}>
                        {viewsTrend > 0 ? '+' : ''}{viewsTrend}%
                      </p>
                    )}
                  </Link>

                  {/* Avg Engagement */}
                  <Link to={`/rig/${data.rigSlug}?tab=photos`} style={{ textDecoration: 'none', textAlign: 'center', padding: '8px 4px', background: CN.cardAlt, borderRadius: 8 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: CN.gold }}>{ss.avgEngagementPerPost}</p>
                    <p style={{ fontSize: 8, color: CN.muted, textTransform: 'uppercase', marginTop: 1 }}>Avg Engage</p>
                    <p style={{ fontSize: 8, color: CN.muted, marginTop: 2 }}>per post</p>
                  </Link>

                  {/* Posts */}
                  <Link to={`/rig/${data.rigSlug}?tab=photos`} style={{ textDecoration: 'none', textAlign: 'center', padding: '8px 4px', background: CN.cardAlt, borderRadius: 8 }}>
                    <p style={{ fontSize: 15, fontWeight: 700, color: CN.gold }}>{ss.totalPosts}</p>
                    <p style={{ fontSize: 8, color: CN.muted, textTransform: 'uppercase', marginTop: 1 }}>Posts</p>
                    {ss.lastPostDaysAgo <= 7 && (
                      <p style={{ fontSize: 8, color: '#22c55e', marginTop: 2 }}>recent</p>
                    )}
                  </Link>
                </div>

                {/* Top post highlight */}
                {ss.topPostThisMonth && (ss.topPostThisMonth.likeCount + ss.topPostThisMonth.commentCount) > 2 && (
                  <Link
                    to={`/rig/${data.rigSlug}?tab=photos`}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      marginTop: 6, padding: '6px 10px',
                      background: CN.cardAlt, borderRadius: 8,
                      textDecoration: 'none',
                    }}
                  >
                    {ss.topPostThisMonth.preview && (
                      <img src={ss.topPostThisMonth.preview} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                    )}
                    <span style={{ fontSize: 11, color: CN.muted }}>
                      {'\u{1F3C6}'} Top post: {ss.topPostThisMonth.likeCount + ss.topPostThisMonth.commentCount} reactions
                    </span>
                  </Link>
                )}
              </div>
            );
          })()}

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
          HITCH REVIEW SCREEN (appears when autofill results are ready)
          ════════════════════════════════════════════════════════════════ */}
      {hitchSpecs && (
        <HitchReviewScreen
          specs={hitchSpecs}
          onConfirm={confirmHitchSpecs}
          onCancel={() => setHitchSpecs(null)}
        />
      )}

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

          {/* Build with Hitch CTA — only when year/make/model are set */}
          {od?.year && od?.make && od?.model && !hitchSpecs && (
            <button onClick={triggerHitch} disabled={hitchLoading}
              style={{
                width: '100%', padding: '10px 0', borderRadius: 8, marginBottom: 14,
                background: `linear-gradient(135deg, ${CN.gold}, ${CN.orange})`,
                border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                opacity: hitchLoading ? 0.7 : 1,
              }}>
              {hitchLoading ? (
                <Loader2 style={{ width: 14, height: 14, color: CN.bg, animation: 'spin 1s linear infinite' }} />
              ) : (
                <Sparkles style={{ width: 14, height: 14, color: CN.bg }} />
              )}
              <span style={{ fontSize: 12, fontWeight: 700, color: CN.bg }}>
                {hitchLoading ? 'Looking up specs...' : 'Build with Hitch'}
              </span>
              <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
            </button>
          )}

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
