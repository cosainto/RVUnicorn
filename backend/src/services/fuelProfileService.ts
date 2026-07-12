
import { prisma } from '../lib/prisma';

export async function detectManufacturerSpecs(make?: string | null, model?: string | null, year?: number | null) {
  if (!make) return null;

  // Exact match
  if (model && year) {
    const exact = await prisma.rigManufacturerSpecs.findFirst({
      where: {
        make: { equals: make, mode: 'insensitive' },
        model: { equals: model, mode: 'insensitive' },
        year,
      },
    });
    if (exact) return { ...exact, confidence: 'MANUFACTURER' as const };
  }

  // Fuzzy: same make + year, any model
  if (year) {
    const fuzzy = await prisma.rigManufacturerSpecs.findFirst({
      where: {
        make: { equals: make, mode: 'insensitive' },
        year,
      },
    });
    if (fuzzy) return { ...fuzzy, confidence: 'ESTIMATED' as const };
  }

  // Fuzzy: same make, closest year
  const anyYear = await prisma.rigManufacturerSpecs.findFirst({
    where: { make: { equals: make, mode: 'insensitive' } },
    orderBy: { year: 'desc' },
  });
  if (anyYear) return { ...anyYear, confidence: 'ESTIMATED' as const };

  return null;
}

export async function autoPopulateFuelProfile(rigId: string) {
  const rig = await prisma.rig.findUnique({
    where: { id: rigId },
    select: { id: true, make: true, model: true, year: true, fuelProfileConfirmed: true, tankCapacityGallons: true, avgMPG: true },
  });
  if (!rig) return { detected: false };

  const specs = await detectManufacturerSpecs(rig.make, rig.model, rig.year);
  if (!specs) return { detected: false };

  if (!rig.fuelProfileConfirmed) {
    await prisma.rig.update({
      where: { id: rigId },
      data: {
        tankCapacityGallons: rig.tankCapacityGallons || specs.tankCapacityGallons,
        avgMPG: rig.avgMPG || specs.avgMpgEstimate,
        fuelType: specs.fuelType,
      },
    });
  }

  return { detected: true, specs, requiresConfirmation: !rig.fuelProfileConfirmed };
}

interface FuelStatus {
  currentPct: number;
  currentGallons: number;
  estimatedRangeMiles: number;
  effectiveMpg: number;
  gallonsUsed: number;
  gallonsAdded: number;
  totalFuelCost: number;
}

export async function estimateCurrentFuelPct(tripPlanId: string): Promise<FuelStatus | null> {
  const tripPlan = await prisma.tripPlan.findUnique({
    where: { id: tripPlanId },
    include: {
      event: {
        include: {
          roadTrip: true,
        },
      },
      pitStops: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!tripPlan) return null;

  // Get the user's rig
  const rig = await prisma.rig.findFirst({
    where: { ownerId: tripPlan.userId },
    select: { id: true, tankCapacityGallons: true, avgMPG: true, towingMpg: true, fillUpPreferencePct: true, reserveWarningPct: true, rangeAnxiety: true },
  });
  if (!rig || !rig.tankCapacityGallons || !rig.avgMPG) return null;

  const isTowing = tripPlan.event?.roadTrip?.isTowing || false;
  const startingFuelPct = tripPlan.event?.roadTrip?.startingFuelPct || 100;

  const effectiveMpg = isTowing ? (rig.towingMpg || rig.avgMPG * 0.85) : rig.avgMPG;

  // Get fuel stops for this trip
  const fuelStops = await prisma.rigFuelStop.findMany({
    where: { rigId: rig.id, tripId: tripPlanId },
    orderBy: { loggedAt: 'asc' },
  });

  // Estimate total miles from the trip summary
  let totalMiles = 0;
  try {
    const summary = await prisma.tripPlanSummary.findFirst({
      where: { tripPlanId },
    });
    totalMiles = summary?.totalMiles || 0;
  } catch {
    // Summary may not exist
  }

  const gallonsAdded = fuelStops.reduce((sum: number, s: any) => sum + (s.gallonsAdded || 0), 0);
  const totalFuelCost = fuelStops.reduce((sum: number, s: any) => sum + (s.totalCost || 0), 0);
  const gallonsUsed = totalMiles / effectiveMpg;
  const startingGallons = (startingFuelPct / 100) * rig.tankCapacityGallons;
  const currentGallons = Math.max(0, startingGallons - gallonsUsed + gallonsAdded);
  const currentPct = Math.max(0, Math.min(100, (currentGallons / rig.tankCapacityGallons) * 100));

  const reserveGallons = (rig.reserveWarningPct / 100) * rig.tankCapacityGallons;
  const estimatedRangeMiles = Math.max(0, (currentGallons - reserveGallons) * effectiveMpg);

  return {
    currentPct: Math.round(currentPct * 10) / 10,
    currentGallons: Math.round(currentGallons * 10) / 10,
    estimatedRangeMiles: Math.round(estimatedRangeMiles),
    effectiveMpg: Math.round(effectiveMpg * 10) / 10,
    gallonsUsed: Math.round(gallonsUsed * 10) / 10,
    gallonsAdded: Math.round(gallonsAdded * 10) / 10,
    totalFuelCost: Math.round(totalFuelCost * 100) / 100,
  };
}

interface FuelRecommendation {
  type: 'FILLUP_PREFERRED' | 'RESERVE_WARNING' | 'URGENT' | 'REMOTE_STRETCH';
  mileMarker: number;
  estimatedFuelPct: number;
  legIndex: number;
  message: string;
  nearbyStation?: {
    id: string;
    name: string;
    address: string;
    city: string;
    state: string;
    lat: number;
    lng: number;
    distanceFromRoute: number;
    chain?: string;
  };
}

export async function calculateFuelStopPositions(tripPlanId: string): Promise<FuelRecommendation[]> {
  const tripPlan = await prisma.tripPlan.findUnique({
    where: { id: tripPlanId },
    include: {
      event: { include: { roadTrip: true } },
      pitStops: { orderBy: { orderIndex: 'asc' } },
    },
  });
  if (!tripPlan) return [];

  const rig = await prisma.rig.findFirst({
    where: { ownerId: tripPlan.userId },
    select: { id: true, tankCapacityGallons: true, avgMPG: true, towingMpg: true, fillUpPreferencePct: true, reserveWarningPct: true, rangeAnxiety: true },
  });
  if (!rig || !rig.tankCapacityGallons || !rig.avgMPG) return [];

  const isTowing = tripPlan.event?.roadTrip?.isTowing || false;
  const startingFuelPct = tripPlan.event?.roadTrip?.startingFuelPct || 100;
  const effectiveMpg = isTowing ? (rig.towingMpg || rig.avgMPG * 0.85) : rig.avgMPG;

  // Apply range anxiety adjustments
  let fillUpPct = rig.fillUpPreferencePct;
  let reservePct = rig.reserveWarningPct;
  if (rig.rangeAnxiety === 'CONSERVATIVE') {
    fillUpPct += 10;
    reservePct += 5;
  } else if (rig.rangeAnxiety === 'STRETCH') {
    fillUpPct -= 10;
    reservePct -= 5;
  }
  fillUpPct = Math.max(15, Math.min(70, fillUpPct));
  reservePct = Math.max(5, Math.min(35, reservePct));

  // Get trip summary for leg distances
  let legs: any[] = [];
  try {
    const summary = await prisma.tripPlanSummary.findFirst({ where: { tripPlanId } });
    legs = summary?.legs || [];
  } catch {}

  if (legs.length === 0) return [];

  const recommendations: FuelRecommendation[] = [];
  let cumulativeMiles = 0;
  let currentFuelPct = startingFuelPct;

  for (let i = 0; i < legs.length; i++) {
    const leg = legs[i];
    const legMiles = leg.distanceMiles || 0;
    const gallonsForLeg = legMiles / effectiveMpg;
    const pctUsedInLeg = (gallonsForLeg / rig.tankCapacityGallons) * 100;
    const fuelPctAtEndOfLeg = currentFuelPct - pctUsedInLeg;

    // Check for remote stretch: find fuel stations along this leg
    if (legMiles > 100) {
      const legMidLat = leg.startLat && leg.endLat ? (leg.startLat + leg.endLat) / 2 : null;
      const legMidLng = leg.startLng && leg.endLng ? (leg.startLng + leg.endLng) / 2 : null;
      if (legMidLat && legMidLng) {
        const deg = 0.4; // ~30 miles
        const stationsNearby = await prisma.overnightStop.count({
          where: {
            latitude: { gte: legMidLat - deg, lte: legMidLat + deg },
            longitude: { gte: legMidLng - deg, lte: legMidLng + deg },
            stopType: { in: ['FUEL_CENTER', 'GAS_STATION', 'TRUCK_STOP'] },
          },
        });
        if (stationsNearby === 0 && legMiles > 150) {
          recommendations.push({
            type: 'REMOTE_STRETCH',
            mileMarker: cumulativeMiles,
            estimatedFuelPct: currentFuelPct,
            legIndex: i,
            message: `Remote stretch ahead — fuel options are limited for the next ${Math.round(legMiles)} miles`,
          });
        }
      }
    }

    // Check if fuel hits thresholds during this leg
    if (fuelPctAtEndOfLeg <= reservePct && currentFuelPct > reservePct) {
      // Calculate exact mile where it crosses reserve
      const milesToReserve = ((currentFuelPct - reservePct) / 100) * rig.tankCapacityGallons * effectiveMpg;
      const station = await findNearestFuelStation(leg, milesToReserve / legMiles);
      recommendations.push({
        type: currentFuelPct <= reservePct + 5 ? 'URGENT' : 'RESERVE_WARNING',
        mileMarker: Math.round(cumulativeMiles + milesToReserve),
        estimatedFuelPct: reservePct,
        legIndex: i,
        message: fuelPctAtEndOfLeg <= 5 ? 'Fuel critically low — find fuel immediately' : 'Low fuel — fill up soon',
        nearbyStation: station || undefined,
      });
    } else if (fuelPctAtEndOfLeg <= fillUpPct && currentFuelPct > fillUpPct) {
      const milesToFillUp = ((currentFuelPct - fillUpPct) / 100) * rig.tankCapacityGallons * effectiveMpg;
      const station = await findNearestFuelStation(leg, milesToFillUp / legMiles);
      recommendations.push({
        type: 'FILLUP_PREFERRED',
        mileMarker: Math.round(cumulativeMiles + milesToFillUp),
        estimatedFuelPct: fillUpPct,
        legIndex: i,
        message: `Tank approaching your ${fillUpPct}% fill-up preference`,
        nearbyStation: station || undefined,
      });
    }

    cumulativeMiles += legMiles;
    currentFuelPct = fuelPctAtEndOfLeg;
  }

  return recommendations;
}

async function findNearestFuelStation(leg: any, positionRatio: number) {
  const lat = leg.startLat && leg.endLat
    ? leg.startLat + (leg.endLat - leg.startLat) * positionRatio
    : null;
  const lng = leg.startLng && leg.endLng
    ? leg.startLng + (leg.endLng - leg.startLng) * positionRatio
    : null;

  if (!lat || !lng) return null;

  const deg = 0.3; // ~20 miles
  const station = await prisma.overnightStop.findFirst({
    where: {
      latitude: { gte: lat - deg, lte: lat + deg },
      longitude: { gte: lng - deg, lte: lng + deg },
      stopType: { in: ['FUEL_CENTER', 'GAS_STATION', 'TRUCK_STOP'] },
    },
    orderBy: { visitCount: 'desc' },
    select: { id: true, name: true, address: true, city: true, state: true, latitude: true, longitude: true, chain: true },
  });

  if (!station) return null;

  const dlat = station.latitude - lat;
  const dlng = station.longitude - lng;
  const distanceMiles = Math.round(Math.sqrt(dlat * dlat + dlng * dlng) * 69); // rough conversion

  return {
    id: station.id,
    name: station.name,
    address: station.address,
    city: station.city || '',
    state: station.state || '',
    lat: station.latitude,
    lng: station.longitude,
    distanceFromRoute: distanceMiles,
    chain: station.chain || undefined,
  };
}
