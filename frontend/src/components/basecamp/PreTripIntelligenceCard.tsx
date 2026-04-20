import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, RefreshCw, Shield, Fuel, Clock, Thermometer, Wind, AlertTriangle, CheckCircle2, Users, MapPin } from 'lucide-react';
import api from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

interface PreTripIntelligenceCardProps {
  eventId: string;
  tripTitle: string;
  departureDate: string;
  destination?: string;
  startLat?: number | null;
  startLon?: number | null;
  startLabel?: string;
}

const STATUS_COLORS = {
  GO: { bg: 'bg-green-500', text: 'text-green-400', dot: '#22c55e', bar: 'from-green-500 to-emerald-400' },
  CAUTION: { bg: 'bg-amber-500', text: 'text-amber-400', dot: '#E8A838', bar: 'from-amber-500 to-yellow-400' },
  NO_GO: { bg: 'bg-red-500', text: 'text-red-400', dot: '#ef4444', bar: 'from-red-500 to-orange-400' },
};

const SEVERITY_BORDERS: Record<string, string> = {
  critical: 'border-l-red-500',
  high: 'border-l-orange-500',
  medium: 'border-l-amber-500',
  low: 'border-l-gray-400',
};

const SEVERITY_BADGES: Record<string, { bg: string; text: string; label: string }> = {
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', label: 'BLOCKER' },
  high: { bg: 'bg-orange-500/20', text: 'text-orange-400', label: 'HIGH' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', label: 'MED' },
  low: { bg: 'bg-gray-500/20', text: 'text-gray-400', label: 'LOW' },
};

export default function PreTripIntelligenceCard({ eventId, tripTitle, departureDate, destination, startLat, startLon, startLabel }: PreTripIntelligenceCardProps) {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const daysOut = Math.max(0, Math.ceil((new Date(departureDate).getTime() - Date.now()) / 86400000));

  useEffect(() => {
    loadReport();
  }, [eventId, startLat, startLon]);

  // Auto-expand when close to departure or NO_GO
  useEffect(() => {
    if (report) {
      if (daysOut <= 3 || report.status === 'NO_GO') {
        setExpanded(true);
      }
    }
  }, [report, daysOut]);

  function buildStartParams() {
    const params = new URLSearchParams();
    if (startLat != null && startLon != null) {
      params.set('startLat', String(startLat));
      params.set('startLon', String(startLon));
      if (startLabel) params.set('startLabel', startLabel);
    }
    const qs = params.toString();
    return qs ? `?${qs}` : '';
  }

  async function loadReport() {
    setLoading(true);
    try {
      const { data } = await api.get(`/trip-confidence/${eventId}${buildStartParams()}`);
      setReport(data);
    } catch (e) {
      console.error('Failed to load trip confidence:', e);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setRefreshing(true);
    try {
      const body: any = {};
      if (startLat != null && startLon != null) {
        body.startLat = startLat;
        body.startLon = startLon;
        if (startLabel) body.startLabel = startLabel;
      }
      const { data } = await api.post(`/trip-confidence/${eventId}/refresh`, body);
      setReport(data);
    } catch {} finally {
      setRefreshing(false);
    }
  }

  async function handleHouseholdReview() {
    try {
      await api.post(`/trip-confidence/${eventId}/household-review`);
      loadReport();
    } catch {}
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-5 h-5 rounded-full bg-white/10 animate-pulse" />
            <div className="h-4 w-48 bg-white/10 rounded animate-pulse" />
          </div>
          <div className="h-2 w-full bg-white/10 rounded-full animate-pulse mb-3" />
          <div className="grid grid-cols-4 gap-2">
            {[1,2,3,4].map(i => <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />)}
          </div>
          <p className="text-xs text-blue-300/60 mt-3 text-center">Hitch is checking your route...</p>
        </div>
      </div>
    );
  }

  if (!report) return null;

  const colors = STATUS_COLORS[report.status as keyof typeof STATUS_COLORS] || STATUS_COLORS.CAUTION;
  const m = report.metrics || {};

  // Collapsed state
  if (!expanded) {
    return (
      <button onClick={() => setExpanded(true)}
        className="w-full rounded-2xl overflow-hidden text-left transition hover:shadow-lg"
        style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="px-4 py-3 flex items-center gap-3">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: colors.dot }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{report.headline}</p>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full rounded-full bg-gradient-to-r ${colors.bar} transition-all duration-1000`}
                  style={{ width: `${report.score}%` }} />
              </div>
              <span className="text-xs font-bold text-white/80">{report.score}/100</span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
              {daysOut === 0 ? 'Today!' : `${daysOut}d`}
            </span>
            <ChevronDown className="w-4 h-4 text-white/40" />
          </div>
        </div>
      </button>
    );
  }

  // Expanded state
  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0F1C35', border: '1px solid rgba(255,255,255,0.08)' }}>
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: colors.dot }} />
            <p className={`text-xs font-bold uppercase tracking-wider ${colors.text}`}>
              {report.status === 'GO' ? "You're Ready — Hit the Road" :
               report.status === 'CAUTION' ? 'Check These Before You Leave' :
               'Resolve These Before Departing'}
            </p>
          </div>
          <button onClick={() => setExpanded(false)} className="text-white/40 hover:text-white/70 transition">
            <ChevronUp className="w-4 h-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-xs text-white/50">
            Trip Confidence: <span className="font-bold text-white/80">{report.score}/100</span>
            {destination && <> · {destination}</>}
            {' · '}{daysOut === 0 ? 'Today' : `${daysOut} days out`}
          </p>
        </div>
        {/* Score bar */}
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div className={`h-full rounded-full bg-gradient-to-r ${colors.bar}`}
            style={{ width: `${report.score}%`, transition: 'width 0.8s ease-out' }} />
        </div>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-4 gap-2 px-4 pb-3">
        <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
          <Fuel className="w-4 h-4 text-amber-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{m.fuelEstimate ? `$${m.fuelEstimate}` : '—'}</p>
          <p className="text-[10px] text-white/40">{m.fuelGallons ? `${m.fuelGallons}gal` : 'Set MPG'}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
          <Clock className="w-4 h-4 text-blue-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{m.driveHours ? `${m.driveHours}h` : '—'}</p>
          <p className="text-[10px] text-white/40">{m.driveMiles ? `${m.driveMiles}mi` : 'Set home'}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
          <Thermometer className="w-4 h-4 text-orange-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{m.weatherTemp != null ? `${m.weatherTemp}°F` : '—'}</p>
          <p className="text-[10px] text-white/40 truncate">{m.weatherCondition || 'Loading...'}</p>
        </div>
        <div className="bg-white/5 rounded-xl p-2.5 text-center border border-white/5">
          <Wind className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
          <p className="text-sm font-bold text-white">{m.windSpeed != null ? `${m.windSpeed}mph` : '—'}</p>
          <p className="text-[10px] text-white/40">{m.windDirection || 'Wind'}</p>
        </div>
      </div>

      {/* Weather detail rows */}
      {(m.weatherCondition || m.departureWeather) && (
        <div className="px-4 pb-3 space-y-1">
          {m.departureWeather && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">Drive day:</span>
              <span className="text-white/70">{m.departureWeather}</span>
              {m.windSpeed && m.windSpeed < 20 && <span className="text-green-400">✓</span>}
            </div>
          )}
          {m.weatherCondition && (
            <div className="flex items-center gap-2 text-xs">
              <span className="text-white/40">At camp:</span>
              <span className="text-white/70">{m.weatherTemp != null ? `${m.weatherTemp}°F · ` : ''}{m.weatherCondition}</span>
              {m.weatherTemp != null && m.weatherTemp > 28 && !m.weatherCondition?.toLowerCase().includes('thunder') && <span className="text-green-400">✓</span>}
            </div>
          )}
        </div>
      )}

      {/* Flags */}
      {report.flags?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-amber-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> CHECK THESE
          </p>
          <div className="space-y-2">
            {report.flags.map((flag: any) => {
              const sev = SEVERITY_BADGES[flag.severity] || SEVERITY_BADGES.medium;
              return (
                <div key={flag.id} className={`bg-white/5 rounded-xl p-3 border-l-4 ${SEVERITY_BORDERS[flag.severity] || 'border-l-gray-500'}`}>
                  <div className="flex items-start gap-2">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>{sev.label}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white">{flag.label}</p>
                      {flag.detail && <p className="text-[10px] text-white/50 mt-0.5">{flag.detail}</p>}
                    </div>
                  </div>
                  {flag.action && (
                    <div className="mt-2">
                      {flag.actionUrl ? (
                        <Link to={flag.actionUrl} className="text-[10px] font-semibold text-amber-400 hover:text-amber-300 transition">
                          {flag.action} →
                        </Link>
                      ) : (
                        <span className="text-[10px] font-semibold text-amber-400">{flag.action}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Passed checks */}
      {report.passedChecks?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" /> PASSED CHECKS
          </p>
          <div className="space-y-1">
            {report.passedChecks.map((check: string, i: number) => (
              <p key={i} className="text-xs text-green-300/80 flex items-center gap-1.5">
                <span className="text-green-400">✓</span> {check}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Break Plan */}
      {report.breakPlan?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> BREAK PLAN
          </p>
          <div className="relative pl-4">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-2 w-px bg-blue-500/30" />

            <div className="space-y-3">
              {/* Depart */}
              <div className="flex items-center gap-3 relative">
                <div className="absolute left-[-13px] w-3 h-3 rounded-full bg-green-500 border-2 border-[#0F1C35] z-10" />
                <p className="text-xs text-white/50">Depart{startLabel ? ` from ${startLabel}` : ' from home'}</p>
              </div>

              {report.breakPlan.map((stop: any, i: number) => (
                <div key={i} className="flex items-start gap-3 relative">
                  <div className="absolute left-[-13px] w-3 h-3 rounded-full bg-amber-500 border-2 border-[#0F1C35] z-10" />
                  <div className="flex-1 bg-white/5 rounded-lg p-2.5 border border-white/5">
                    <p className="text-xs font-semibold text-white">{stop.name}</p>
                    <p className="text-[10px] text-white/40">
                      Mile {stop.mile} · {stop.estimatedTime}
                      {' · '}{stop.chargeBefore}% → {stop.chargeAfter}%
                    </p>
                    {stop.reason === 'FUEL' && m.fuelPricePerGallon && (
                      <p className="text-[10px] text-amber-400 mt-0.5">
                        ⛽ {m.rvFuelType === 'diesel' ? 'Diesel' : 'Gas'} ~${m.fuelPricePerGallon}/gal
                      </p>
                    )}
                  </div>
                </div>
              ))}

              {/* Arrive */}
              <div className="flex items-center gap-3 relative">
                <div className="absolute left-[-13px] w-3 h-3 rounded-full bg-blue-500 border-2 border-[#0F1C35] z-10" />
                <p className="text-xs text-white/50">Arrive at camp</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Household Sync */}
      {report.householdStatus?.length > 0 && (
        <div className="px-4 pb-3">
          <p className="text-xs font-bold text-purple-400 mb-2 flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" /> CO-PILOT SYNC
          </p>
          <div className="space-y-1.5">
            {report.householdStatus.map((member: any) => (
              <div key={member.userId} className="flex items-center gap-2">
                {member.avatarUrl ? (
                  <img src={member.avatarUrl} className="w-5 h-5 rounded-full object-cover" alt="" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-purple-500/30 flex items-center justify-center text-[9px] font-bold text-purple-300">
                    {member.displayName[0]}
                  </div>
                )}
                {member.hasReviewed ? (
                  <p className="text-xs text-green-400">✓ {member.displayName} reviewed the plan</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-white/50">{member.displayName} hasn't reviewed yet</p>
                    <button onClick={handleHouseholdReview}
                      className="text-[10px] font-semibold text-purple-400 hover:text-purple-300 transition">
                      Nudge →
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="px-4 pb-4 flex items-center justify-between">
        <p className="text-[10px] text-white/30">
          {report.generatedAt ? `Updated ${formatDistanceToNow(new Date(report.generatedAt), { addSuffix: true })}` : ''}
          {report.cached ? ' · cached' : ''}
        </p>
        <button onClick={handleRefresh} disabled={refreshing}
          className="flex items-center gap-1 text-[10px] font-semibold text-blue-400 hover:text-blue-300 transition disabled:opacity-50">
          <RefreshCw className={`w-3 h-3 ${refreshing ? 'animate-spin' : ''}`} />
          {refreshing ? 'Refreshing...' : 'Refresh Intel'}
        </button>
      </div>
    </div>
  );
}
