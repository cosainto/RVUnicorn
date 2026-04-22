import { CorridorAnalysis, RouteSegment } from './routeCorridorService';
import { RiskFlag } from './tripConfidenceService';

// ── Types ──────────────────────────────────────────────────────

export interface SubScores {
  safety: number;     // 0-100
  comfort: number;    // 0-100
  convenience: number; // 0-100
  flexibility: number; // 0-100
}

export interface ScoringResult {
  overall: number;
  subScores: SubScores;
  status: 'GO' | 'CAUTION' | 'NO_GO';
  headline: string;
  subheadline: string;
  flags: RiskFlag[];
  passedChecks: string[];
}

// Weights for composite score
const WEIGHTS = {
  safety: 0.40,
  comfort: 0.25,
  convenience: 0.20,
  flexibility: 0.15,
};

// ── Safety Score ───────────────────────────────────────────────
// Evaluates: wind, severe weather, rig fit, freezing temps

function computeSafetyScore(
  corridor: CorridorAnalysis,
  rigFit: { fits: boolean; maxLength: number | null; userLength: number | null } | null,
  flags: RiskFlag[],
  passedChecks: string[],
): number {
  let score = 100;

  // Per-segment wind analysis (worst wind across corridor)
  let worstWind = 0;
  let worstWindSegment: RouteSegment | null = null;
  let severeWeatherSegment: RouteSegment | null = null;
  let freezingSegment: RouteSegment | null = null;

  for (const seg of corridor.segments) {
    if (seg.weather?.windSpeed && seg.weather.windSpeed > worstWind) {
      worstWind = seg.weather.windSpeed;
      worstWindSegment = seg;
    }
    if (seg.weather?.condition) {
      const cond = seg.weather.condition.toLowerCase();
      if (cond.includes('tornado') || cond.includes('severe')) {
        severeWeatherSegment = seg;
      }
    }
    if (seg.weather?.temp !== null && seg.weather?.temp !== undefined && seg.weather.temp < 28) {
      freezingSegment = seg;
    }
  }

  // Wind deductions
  if (worstWind > 30 && worstWindSegment) {
    score -= 25;
    flags.push({
      id: 'wind_high',
      type: 'warning',
      severity: 'high',
      label: `High wind ${worstWind}mph near mile ${worstWindSegment.startMile}-${worstWindSegment.endMile}`,
      detail: 'Class A and trailer rigs are high-risk above 30mph crosswinds',
      action: 'Check hourly forecast',
      deduction: 25,
    });
  } else if (worstWind > 20 && worstWindSegment) {
    score -= 10;
    flags.push({
      id: 'wind_moderate',
      type: 'warning',
      severity: 'medium',
      label: `Wind ${worstWind}mph near mile ${worstWindSegment.startMile}-${worstWindSegment.endMile}`,
      detail: 'Drive with extra caution — crosswinds may affect handling',
      action: 'Monitor conditions',
      deduction: 10,
    });
  } else {
    passedChecks.push('No high-wind advisories on route');
  }

  // Severe weather
  if (severeWeatherSegment) {
    score -= 15;
    flags.push({
      id: 'severe_weather',
      type: 'warning',
      severity: 'high',
      label: `Severe weather near mile ${severeWeatherSegment.startMile}-${severeWeatherSegment.endMile}`,
      detail: severeWeatherSegment.weather?.condition || 'Severe weather warning',
      action: 'Check radar before departing',
      deduction: 15,
    });
  }

  // Freezing temps
  if (freezingSegment) {
    score -= 15;
    flags.push({
      id: 'freeze',
      type: 'warning',
      severity: 'medium',
      label: `Below-freezing temps (${freezingSegment.weather?.temp}°F) near mile ${freezingSegment.startMile}`,
      detail: 'Protect water lines and watch for ice on road',
      action: 'Check winterizing tips',
      deduction: 15,
    });
  }

  // Rig fit (BLOCKER)
  if (rigFit && !rigFit.fits && rigFit.maxLength && rigFit.userLength) {
    score -= 40;
    flags.push({
      id: 'rig_size',
      type: 'blocker',
      severity: 'critical',
      label: `Your ${rigFit.userLength}ft rig exceeds the ${rigFit.maxLength}ft limit`,
      detail: 'This campground cannot accommodate your rig',
      action: 'Review campground requirements',
      deduction: 40,
    });
  } else if (rigFit?.fits && rigFit.maxLength && rigFit.userLength) {
    passedChecks.push(`Rig fits (max ${rigFit.maxLength}ft · yours is ${rigFit.userLength}ft)`);
  }

  // Risk zones bonus info
  if (corridor.riskZones.length > 0) {
    const highZones = corridor.riskZones.filter(z => z.level === 'HIGH');
    if (highZones.length > 0 && !flags.some(f => f.id === 'severe_weather')) {
      // Already captured via individual checks above
    }
  } else {
    passedChecks.push('No high-risk zones on route');
  }

  return Math.max(0, Math.min(100, score));
}

// ── Comfort Score ──────────────────────────────────────────────
// Evaluates: drive duration vs battery limit, temperature extremes

function computeComfortScore(
  corridor: CorridorAnalysis,
  batteryLimitHours: number,
  flags: RiskFlag[],
  passedChecks: string[],
): number {
  let score = 100;

  // Fatigue check
  if (corridor.totalHours > batteryLimitHours) {
    score -= 20;
    flags.push({
      id: 'fatigue',
      type: 'warning',
      severity: 'high',
      label: `${corridor.totalHours}hr drive exceeds your ${batteryLimitHours}hr comfort limit`,
      detail: 'Consider adding rest stops to break up the drive',
      action: 'View break plan',
      deduction: 20,
    });
  } else {
    passedChecks.push(`Drive time ${corridor.totalHours}hrs (within your ${batteryLimitHours}hr limit)`);
  }

  // Long drive with no breaks (3+ hours)
  if (corridor.totalHours > 3) {
    const restAvailable = corridor.segments.some(s => s.restStops.length > 0);
    if (!restAvailable) {
      score -= 10;
      flags.push({
        id: 'no_rest_stops',
        type: 'warning',
        severity: 'medium',
        label: 'No rest stops found along route corridor',
        detail: 'Breaks every 2-3 hours reduce fatigue risk',
        action: 'Plan rest stops',
        deduction: 10,
      });
    }
  }

  // Temperature extremes (any segment > 105°F or < 20°F)
  const extremeHeat = corridor.segments.find(s => s.weather?.temp && s.weather.temp > 105);
  const extremeCold = corridor.segments.find(s => s.weather?.temp !== null && s.weather?.temp !== undefined && s.weather!.temp < 20);
  if (extremeHeat) {
    score -= 10;
    flags.push({
      id: 'extreme_heat',
      type: 'warning',
      severity: 'medium',
      label: `Extreme heat (${extremeHeat.weather!.temp}°F) near mile ${extremeHeat.startMile}`,
      detail: 'Watch engine temps, stay hydrated, check tire pressure',
      action: 'Check heat advisory',
      deduction: 10,
    });
  }
  if (extremeCold && !flags.find(f => f.id === 'freeze')) {
    score -= 10;
    flags.push({
      id: 'extreme_cold',
      type: 'warning',
      severity: 'medium',
      label: `Extreme cold (${extremeCold.weather!.temp}°F) near mile ${extremeCold.startMile}`,
      detail: 'Watch for ice, protect water systems',
      action: 'Check winter advisory',
      deduction: 10,
    });
  }

  return Math.max(0, Math.min(100, score));
}

// ── Convenience Score ──────────────────────────────────────────
// Evaluates: fuel gaps, food/rest stop density, stop spacing

function computeConvenienceScore(
  corridor: CorridorAnalysis,
  flags: RiskFlag[],
  passedChecks: string[],
): number {
  let score = 100;

  // Fuel gaps > 60 miles
  if (corridor.fuelGaps.length > 0) {
    const worstGap = corridor.fuelGaps.reduce((a, b) => a.gapMiles > b.gapMiles ? a : b);
    score -= 10;
    flags.push({
      id: 'fuel_gap',
      type: 'warning',
      severity: 'medium',
      label: `${Math.round(worstGap.gapMiles)}mi fuel gap between mile ${worstGap.startMile}-${worstGap.endMile}`,
      detail: 'Fill up before entering this stretch',
      action: 'Find fuel stops',
      deduction: 10,
    });
  } else if (corridor.totalMiles > 50) {
    passedChecks.push('Fuel stops available throughout route');
  }

  // Rest/food stop density — check if > 50% of segments lack rest stops
  const segmentsWithoutRest = corridor.segments.filter(s => s.restStops.length === 0 && s.fuelStops.length === 0);
  if (corridor.segments.length > 2 && segmentsWithoutRest.length > corridor.segments.length * 0.5) {
    score -= 5;
    flags.push({
      id: 'sparse_stops',
      type: 'info',
      severity: 'low',
      label: 'Limited stop options on some sections of route',
      detail: 'Plan stops in advance for longer stretches',
      action: 'View stop clusters',
      deduction: 5,
    });
  }

  // Poor stop spacing — any 80+ mile gap between stop clusters
  if (corridor.stopClusters.length >= 2) {
    for (let i = 1; i < corridor.stopClusters.length; i++) {
      const gap = corridor.stopClusters[i].mile - corridor.stopClusters[i - 1].mile;
      if (gap > 80) {
        score -= 5;
        flags.push({
          id: 'stop_spacing',
          type: 'info',
          severity: 'low',
          label: `${gap}mi gap between stop clusters (mile ${corridor.stopClusters[i - 1].mile}-${corridor.stopClusters[i].mile})`,
          detail: 'Plan ahead for this stretch',
          action: 'View route',
          deduction: 5,
        });
        break; // Only flag the worst one
      }
    }
  }

  return Math.max(0, Math.min(100, score));
}

// ── Flexibility Score ──────────────────────────────────────────
// Evaluates: backup stops, overnight options, bail-out points

function computeFlexibilityScore(
  corridor: CorridorAnalysis,
  flags: RiskFlag[],
  passedChecks: string[],
): number {
  let score = 100;

  // Count total overnight options along route
  const totalOvernight = corridor.segments.reduce(
    (sum, s) => sum + s.overnightStops.length + s.campgrounds.length, 0
  );

  if (totalOvernight === 0 && corridor.totalHours > 3) {
    score -= 10;
    flags.push({
      id: 'no_overnight',
      type: 'warning',
      severity: 'medium',
      label: 'No overnight options found along route',
      detail: 'If plans change, you may need to backtrack for lodging',
      action: 'Search overnight stops',
      deduction: 10,
    });
  } else if (totalOvernight > 0) {
    passedChecks.push(`${totalOvernight} overnight option${totalOvernight > 1 ? 's' : ''} along route`);
  }

  // Backup stops — if fewer than 2 stop clusters on a 100+ mile route
  if (corridor.totalMiles > 100 && corridor.stopClusters.length < 2) {
    score -= 10;
    flags.push({
      id: 'few_backups',
      type: 'info',
      severity: 'low',
      label: 'Limited backup stop options along this route',
      detail: 'Few alternatives if your planned stops don\'t work out',
      action: 'Explore alternatives',
      deduction: 10,
    });
  }

  // Campground density for bail-out
  const segmentsWithCampgrounds = corridor.segments.filter(s => s.campgrounds.length > 0);
  if (corridor.totalMiles > 150 && segmentsWithCampgrounds.length < 2) {
    score -= 5;
    flags.push({
      id: 'low_campground_density',
      type: 'info',
      severity: 'low',
      label: 'Few campgrounds near route for emergency stops',
      detail: 'Consider identifying backup campgrounds before departure',
      action: 'Search campgrounds',
      deduction: 5,
    });
  }

  return Math.max(0, Math.min(100, score));
}

// ── Main: Compute All Scores ───────────────────────────────────

export function computeEnhancedScores(
  corridor: CorridorAnalysis,
  opts: {
    rigFit?: { fits: boolean; maxLength: number | null; userLength: number | null } | null;
    batteryLimitHours?: number;
    userMpg?: number | null;
    userRvLength?: number | null;
    userRvFuelType?: string | null;
  } = {},
): ScoringResult {
  const flags: RiskFlag[] = [];
  const passedChecks: string[] = [];
  const batteryLimit = opts.batteryLimitHours ?? 5;

  const safety = computeSafetyScore(corridor, opts.rigFit ?? null, flags, passedChecks);
  const comfort = computeComfortScore(corridor, batteryLimit, flags, passedChecks);
  const convenience = computeConvenienceScore(corridor, flags, passedChecks);
  const flexibility = computeFlexibilityScore(corridor, flags, passedChecks);

  // Missing data flags
  if (!opts.userMpg) {
    flags.push({
      id: 'no_mpg',
      type: 'info',
      severity: 'low',
      label: 'Add your MPG for fuel cost estimates',
      detail: 'Your RV\'s fuel efficiency helps calculate trip cost',
      action: 'Update RV profile',
      actionUrl: '/my-rv',
      deduction: 5,
    });
  }

  const subScores: SubScores = { safety, comfort, convenience, flexibility };

  // Weighted composite
  let overall = Math.round(
    safety * WEIGHTS.safety +
    comfort * WEIGHTS.comfort +
    convenience * WEIGHTS.convenience +
    flexibility * WEIGHTS.flexibility
  );
  overall = Math.max(0, Math.min(100, overall));

  // Status determination
  const hasBlocker = flags.some(f => f.type === 'blocker');
  let status: 'GO' | 'CAUTION' | 'NO_GO';
  if (hasBlocker || overall < 50) {
    status = 'NO_GO';
  } else if (overall >= 80) {
    status = 'GO';
  } else {
    status = 'CAUTION';
  }

  // Headline
  let headline: string;
  let subheadline: string;
  if (hasBlocker) {
    headline = 'Resolve these before departing';
    subheadline = `${flags.filter(f => f.type === 'blocker').length} blocker found`;
  } else if (status === 'GO') {
    headline = "You're ready — hit the road";
    subheadline = flags.length > 0 ? `${flags.length} minor note${flags.length > 1 ? 's' : ''}` : 'All checks passed';
  } else if (status === 'CAUTION') {
    headline = 'Check these before you leave';
    subheadline = `${flags.length} item${flags.length > 1 ? 's' : ''} to review`;
  } else {
    headline = 'Resolve these before departing';
    subheadline = `${flags.filter(f => f.severity === 'high' || f.severity === 'critical').length} serious issue${flags.length > 1 ? 's' : ''}`;
  }

  return {
    overall,
    subScores,
    status,
    headline,
    subheadline,
    flags,
    passedChecks,
  };
}
