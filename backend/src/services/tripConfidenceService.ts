import { prisma } from '../prisma';

export interface RiskFlag {
  id: string;
  type: 'blocker' | 'warning' | 'info';
  severity: 'critical' | 'high' | 'medium' | 'low';
  label: string;
  detail: string;
  action: string;
  actionUrl?: string;
  deduction: number;
}

export interface BreakStop {
  mile: number;
  name: string;
  reason: string; // FUEL | FATIGUE | FOOD | RIG_CHECK
  estimatedTime: string;
  chargeBefore: number;
  chargeAfter: number;
}

export interface ConfidenceReport {
  score: number;
  status: 'GO' | 'CAUTION' | 'NO_GO';
  headline: string;
  subheadline: string;
  flags: RiskFlag[];
  passedChecks: string[];
  metrics: {
    daysOut: number;
    driveMiles: number | null;
    driveHours: number | null;
    fuelEstimate: number | null;
    fuelGallons: number | null;
    fuelPricePerGallon: number | null;
    weatherTemp: number | null;
    weatherCondition: string | null;
    windSpeed: number | null;
    windDirection: string | null;
    departureWeather: string | null;
    rvMpg: number | null;
    rvLength: number | null;
    rvHeight: number | null;
    rvFuelType: string | null;
  };
  breakPlan: BreakStop[];
  householdStatus: {
    userId: string;
    displayName: string;
    avatarUrl: string | null;
    hasReviewed: boolean;
  }[];
}

const DIESEL_FALLBACK_PRICE = 3.95;
const GAS_FALLBACK_PRICE = 3.45;

export async function generateConfidenceReport(
  eventId: string,
  userId: string,
  startOverride?: { lat: number; lon: number; label?: string },
): Promise<ConfidenceReport> {
  const flags: RiskFlag[] = [];
  const passedChecks: string[] = [];
  let score = 100;

  // Fetch event with campground
  const event = await (prisma as any).event.findUnique({
    where: { id: eventId },
    include: {
      campground: {
        select: {
          id: true, name: true, state: true, city: true,
          latitude: true, longitude: true,
          maxRvLength: true, isBigRigFriendly: true,
          amenities: true,
        },
      },
      attendees: {
        include: { user: { select: { id: true, firstName: true, profilePicture: true } } },
      },
    },
  });
  if (!event) throw new Error('Event not found');

  // Fetch user
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, firstName: true, lastName: true, profilePicture: true,
      rvMpg: true, rvLength: true, rvHeight: true, rvWeight: true,
      rvFuelType: true,
      homeLatitude: true, homeLongitude: true,
      householdId: true,
    },
  });
  if (!user) throw new Error('User not found');

  const campground = event.campground;
  const daysOut = event.startDate
    ? Math.max(0, Math.ceil((new Date(event.startDate).getTime() - Date.now()) / 86400000))
    : 0;

  // ── DISTANCE CALCULATION ─────────────────────────────────
  let driveMiles: number | null = null;
  let driveHours: number | null = null;

  // Try TripPlan first
  const tripPlan = await (prisma as any).tripPlan.findFirst({
    where: { eventId, userId },
    select: { distanceMiles: true, durationMinutes: true },
  });

  // Use custom start override if provided, otherwise fall back to home location
  const originLat = startOverride?.lat ?? user.homeLatitude;
  const originLon = startOverride?.lon ?? user.homeLongitude;

  if (!startOverride && tripPlan?.distanceMiles) {
    driveMiles = tripPlan.distanceMiles;
    driveHours = tripPlan.durationMinutes ? tripPlan.durationMinutes / 60 : driveMiles! / 50;
  } else if (originLat && originLon && campground?.latitude && campground?.longitude) {
    // Haversine fallback
    const R = 3958.8;
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLat = toRad(campground.latitude - originLat);
    const dLon = toRad(campground.longitude - originLon);
    const a = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(originLat)) * Math.cos(toRad(campground.latitude)) * Math.sin(dLon / 2) ** 2;
    const crowMiles = 2 * R * Math.asin(Math.sqrt(a));
    driveMiles = Math.round(crowMiles * 1.3);
    driveHours = driveMiles / 50;
  }

  // ── RIG SIZE CHECK ───────────────────────────────────────
  if (campground?.maxRvLength && user.rvLength) {
    if (user.rvLength > campground.maxRvLength) {
      const flag: RiskFlag = {
        id: 'rig_size',
        type: 'blocker',
        severity: 'critical',
        label: `Your ${user.rvLength}ft rig exceeds this campground's ${campground.maxRvLength}ft limit`,
        detail: `${campground.name} has a maximum RV length of ${campground.maxRvLength}ft`,
        action: 'Review campground requirements',
        actionUrl: `/campgrounds/${campground.id}`,
        deduction: 40,
      };
      flags.push(flag);
      score -= 40;
    } else {
      passedChecks.push(`Rig fits (max ${campground.maxRvLength}ft · yours is ${user.rvLength}ft)`);
    }
  } else if (user.rvLength) {
    passedChecks.push(`Rig length ${user.rvLength}ft (no campground limit listed)`);
  }

  // ── WEATHER CHECK ────────────────────────────────────────
  let weatherTemp: number | null = null;
  let weatherCondition: string | null = null;
  let windSpeed: number | null = null;
  let windDirection: string | null = null;
  let departureWeather: string | null = null;

  if (campground?.latitude && campground?.longitude) {
    try {
      const weatherUrl = `https://api.weather.gov/points/${campground.latitude},${campground.longitude}`;
      const pointRes = await fetch(weatherUrl, { headers: { 'User-Agent': 'rvunicorn.com' } });
      if (pointRes.ok) {
        const pointData: any = await pointRes.json();
        const forecastUrl = pointData.properties?.forecast;
        if (forecastUrl) {
          const fcRes = await fetch(forecastUrl, { headers: { 'User-Agent': 'rvunicorn.com' } });
          if (fcRes.ok) {
            const fcData: any = await fcRes.json();
            const periods = fcData.properties?.periods || [];
            if (periods.length > 0) {
              const current = periods[0];
              weatherTemp = current.temperature;
              weatherCondition = current.shortForecast;
              const windStr = current.windSpeed || '';
              const windMatch = windStr.match(/(\d+)/);
              windSpeed = windMatch ? parseInt(windMatch[1]) : null;
              windDirection = current.windDirection || null;
              departureWeather = periods.length > 1 ? periods[1].shortForecast : null;
            }
          }
        }
      }
    } catch (e: any) {
      console.error('[TripConfidence] Weather fetch failed:', e);
    }
  }

  // Wind risk
  if (windSpeed && windSpeed > 30) {
    flags.push({
      id: 'wind_high',
      type: 'warning',
      severity: 'high',
      label: `Wind gusts ${windSpeed}mph near ${campground?.city || 'destination'}`,
      detail: 'Class A and trailer rigs are high-risk above 30mph crosswinds',
      action: 'Check hourly forecast',
      deduction: 25,
    });
    score -= 25;
  } else if (windSpeed && windSpeed > 20) {
    flags.push({
      id: 'wind_moderate',
      type: 'warning',
      severity: 'medium',
      label: `Wind ${windSpeed}mph near ${campground?.city || 'destination'}`,
      detail: 'Drive with extra caution — crosswinds may affect handling',
      action: 'Monitor conditions',
      deduction: 10,
    });
    score -= 10;
  } else {
    passedChecks.push('No high-wind advisories on route');
  }

  // Destination weather severity
  if (weatherCondition) {
    const cond = weatherCondition.toLowerCase();
    if (weatherTemp !== null && weatherTemp < 28) {
      flags.push({
        id: 'freeze',
        type: 'warning',
        severity: 'medium',
        label: `Below-freezing temps (${weatherTemp}°F) at camp on arrival`,
        detail: 'Protect water lines and disconnect hoses',
        action: 'Check winterizing tips',
        deduction: 15,
      });
      score -= 15;
    } else if (cond.includes('tornado') || cond.includes('severe')) {
      flags.push({
        id: 'severe_weather',
        type: 'warning',
        severity: 'high',
        label: 'Severe weather warning at destination',
        detail: weatherCondition,
        action: 'Check radar',
        deduction: 15,
      });
      score -= 15;
    } else if (cond.includes('thunder')) {
      flags.push({
        id: 'thunderstorm',
        type: 'warning',
        severity: 'medium',
        label: 'Thunderstorms expected at destination',
        detail: weatherCondition,
        action: 'Plan indoor activities',
        deduction: 8,
      });
      score -= 8;
    }
  }

  // ── DRIVE FATIGUE CHECK ──────────────────────────────────
  // Use historical drive data to estimate battery limit
  const recentDrives = await (prisma as any).driveSession.findMany({
    where: { userId },
    orderBy: { startTime: 'desc' },
    take: 5,
    select: { totalDriveSeconds: true, fatigueScoreAtEnd: true },
  });

  // Average comfortable drive time from history, default 5 hours
  const avgDriveHours = recentDrives.length > 0
    ? recentDrives.reduce((sum: number, d: any) => sum + d.totalDriveSeconds / 3600, 0) / recentDrives.length
    : 5;
  const batteryLimit = Math.max(3, Math.min(8, Math.round(avgDriveHours)));

  if (driveHours !== null) {
    if (driveHours > batteryLimit) {
      // Check if break plan exists (we'll generate it below)
      flags.push({
        id: 'fatigue',
        type: 'warning',
        severity: 'high',
        label: `${driveHours.toFixed(1)}hr drive exceeds your ${batteryLimit}hr comfort limit`,
        detail: 'Consider adding rest stops to break up the drive',
        action: 'Add a break stop',
        actionUrl: `/events/${eventId}`,
        deduction: 20,
      });
      score -= 20;
    } else {
      passedChecks.push(`Drive time ${driveHours.toFixed(1)}hrs (within your ${batteryLimit}hr limit)`);
    }

    if (driveHours > 3) {
      const existingStops = await (prisma as any).pitStop.count({ where: { tripPlan: { eventId } } });
      if (existingStops === 0) {
        flags.push({
          id: 'no_breaks',
          type: 'warning',
          severity: 'medium',
          label: `No stops planned for a ${driveHours.toFixed(1)}hr drive`,
          detail: 'Breaks every 2-3 hours reduce fatigue risk',
          action: 'Generate break plan',
          deduction: 10,
        });
        score -= 10;
      }
    }
  }

  // ── MISSING DATA CHECKS ──────────────────────────────────
  if (!originLat || !originLon) {
    flags.push({
      id: 'no_home',
      type: 'info',
      severity: 'low',
      label: 'Add your home address or set a starting location for a personalized break plan',
      detail: 'Distance, fuel, and departure time require a starting location',
      action: 'Set home location',
      actionUrl: '/my-rv',
      deduction: 8,
    });
    score -= 8;
  }

  if (!user.rvMpg) {
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
    score -= 5;
  }

  // ── FUEL ESTIMATE ────────────────────────────────────────
  let fuelEstimate: number | null = null;
  let fuelGallons: number | null = null;
  let fuelPricePerGallon: number | null = null;

  if (driveMiles && user.rvMpg) {
    fuelGallons = Math.round((driveMiles / user.rvMpg) * 10) / 10;
    fuelPricePerGallon = user.rvFuelType === 'diesel' ? DIESEL_FALLBACK_PRICE : GAS_FALLBACK_PRICE;

    // Try EIA API for live price
    if (process.env.EIA_API_KEY) {
      try {
        const eiaUrl = `https://api.eia.gov/v2/petroleum/pri/gnd/data/?api_key=${process.env.EIA_API_KEY}&frequency=weekly&data[0]=value&facets[product][]=${user.rvFuelType === 'diesel' ? 'EPD2D' : 'EMM_EPMR_PTE_NUS_DPG'}&sort[0][column]=period&sort[0][direction]=desc&length=1`;
        const eiaRes = await fetch(eiaUrl);
        if (eiaRes.ok) {
          const eiaData: any = await eiaRes.json();
          const price = eiaData?.response?.data?.[0]?.value;
          if (price) fuelPricePerGallon = parseFloat(price);
        }
      } catch {}
    }

    fuelEstimate = Math.round(fuelGallons * fuelPricePerGallon);
  }

  // ── BREAK PLAN ───────────────────────────────────────────
  const breakPlan: BreakStop[] = [];
  if (driveHours && driveHours > 2 && driveMiles) {
    const breakIntervalHours = Math.min(batteryLimit, 3);
    const milesPerHour = driveMiles / driveHours;
    let charge = 100;
    const drainPerHour = 10;
    let elapsed = 0;

    while (elapsed + breakIntervalHours < driveHours - 0.5) {
      elapsed += breakIntervalHours;
      const chargeBefore = Math.max(0, Math.round(charge - drainPerHour * breakIntervalHours));
      const chargeAfter = Math.min(100, chargeBefore + 12);
      charge = chargeAfter;

      const mile = Math.round(elapsed * milesPerHour);
      const needsFuel = fuelGallons && fuelGallons > 10 && breakPlan.length === 0;

      breakPlan.push({
        mile,
        name: needsFuel ? `Fuel + Rest Stop (mile ${mile})` : `Rest Stop (mile ${mile})`,
        reason: needsFuel ? 'FUEL' : 'FATIGUE',
        estimatedTime: `After ${elapsed.toFixed(1)}hrs`,
        chargeBefore,
        chargeAfter,
      });
    }
  }

  // If fatigue flag exists but we have a break plan, reduce the deduction
  const fatigueFlag = flags.find(f => f.id === 'fatigue');
  if (fatigueFlag && breakPlan.length > 0) {
    score += 15; // restore 15 of the 20 deducted (managed risk)
    fatigueFlag.deduction = 5;
    fatigueFlag.detail = `Break plan with ${breakPlan.length} stop${breakPlan.length > 1 ? 's' : ''} helps manage this`;
    fatigueFlag.severity = 'medium';
  }

  // Remove no_breaks flag if we generated a plan
  if (breakPlan.length > 0) {
    const idx = flags.findIndex(f => f.id === 'no_breaks');
    if (idx >= 0) {
      score += flags[idx].deduction;
      flags.splice(idx, 1);
    }
  }

  // ── HOUSEHOLD STATUS ─────────────────────────────────────
  const householdStatus: ConfidenceReport['householdStatus'] = [];
  if (user.householdId) {
    const members = await prisma.user.findMany({
      where: { householdId: user.householdId, NOT: { id: userId } },
      select: { id: true, firstName: true, profilePicture: true },
    });
    for (const m of members) {
      householdStatus.push({
        userId: m.id,
        displayName: m.firstName,
        avatarUrl: m.profilePicture,
        hasReviewed: false, // updated via household-review endpoint
      });
    }
  }

  // ── FINALIZE SCORE ───────────────────────────────────────
  score = Math.max(0, Math.min(100, score));

  let status: 'GO' | 'CAUTION' | 'NO_GO';
  let headline: string;
  let subheadline: string;

  if (flags.some(f => f.type === 'blocker')) {
    status = 'NO_GO';
    headline = 'Resolve these before departing';
    subheadline = `${flags.filter(f => f.type === 'blocker').length} blocker${flags.filter(f => f.type === 'blocker').length > 1 ? 's' : ''} found`;
  } else if (score >= 80) {
    status = 'GO';
    headline = "You're ready — hit the road";
    subheadline = flags.length > 0 ? `${flags.length} minor note${flags.length > 1 ? 's' : ''}` : 'All checks passed';
  } else if (score >= 50) {
    status = 'CAUTION';
    headline = 'Check these before you leave';
    subheadline = `${flags.length} item${flags.length > 1 ? 's' : ''} to review`;
  } else {
    status = 'NO_GO';
    headline = 'Resolve these before departing';
    subheadline = `${flags.filter(f => f.severity === 'high' || f.severity === 'critical').length} serious issue${flags.length > 1 ? 's' : ''}`;
  }

  // Add remaining passed checks
  if (!flags.find(f => f.id === 'rig_size') && !user.rvLength) {
    // No rig data — don't show as passed
  }
  if (!flags.find(f => f.id.startsWith('wind'))) {
    // Already added above
  }

  return {
    score,
    status,
    headline,
    subheadline,
    flags,
    passedChecks,
    metrics: {
      daysOut,
      driveMiles,
      driveHours: driveHours ? Math.round(driveHours * 10) / 10 : null,
      fuelEstimate,
      fuelGallons,
      fuelPricePerGallon,
      weatherTemp,
      weatherCondition,
      windSpeed,
      windDirection,
      departureWeather,
      rvMpg: user.rvMpg,
      rvLength: user.rvLength,
      rvHeight: user.rvHeight,
      rvFuelType: user.rvFuelType,
    },
    breakPlan,
    householdStatus,
  };
}

export async function saveConfidenceSnapshot(
  eventId: string,
  userId: string,
  report: ConfidenceReport,
  tripId?: string
) {
  const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000);

  return (prisma as any).tripConfidenceSnapshot.create({
    data: {
      tripId: tripId || null,
      eventId,
      userId,
      score: report.score,
      status: report.status,
      headline: report.headline,
      subheadline: report.subheadline,
      fuelEstimate: report.metrics.fuelEstimate,
      fuelGallons: report.metrics.fuelGallons,
      driveMiles: report.metrics.driveMiles,
      driveHours: report.metrics.driveHours,
      weatherSummary: report.metrics.weatherCondition,
      weatherTemp: report.metrics.weatherTemp,
      weatherCondition: report.metrics.weatherCondition,
      windSpeed: report.metrics.windSpeed,
      flags: report.flags,
      passedChecks: report.passedChecks,
      breakPlan: report.breakPlan,
      metrics: report.metrics,
      householdStatus: report.householdStatus,
      generatedAt: new Date(),
      expiresAt,
    },
  });
}
