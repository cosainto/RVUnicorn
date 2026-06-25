export enum TripConflict {
  DEPARTURE_AFTER_FIRST_STOP = 'DEPARTURE_AFTER_FIRST_STOP',
  STOP_AFTER_ARRIVAL = 'STOP_AFTER_ARRIVAL',
  STOPS_OVERLAP = 'STOPS_OVERLAP',
  INSUFFICIENT_DRIVE_TIME = 'INSUFFICIENT_DRIVE_TIME',
  ENVELOPE_TOO_SHORT = 'ENVELOPE_TOO_SHORT',
  STOP_BEFORE_DEPARTURE = 'STOP_BEFORE_DEPARTURE',
  RETURN_BEFORE_ARRIVAL = 'RETURN_BEFORE_ARRIVAL',
  LAST_STOP_OVERRUNS_ARRIVAL = 'LAST_STOP_OVERRUNS_ARRIVAL',
}

interface SuggestedFix {
  label: string;
  action: 'MOVE_ARRIVAL' | 'MOVE_DEPARTURE' | 'ADJUST_STOP' | 'REMOVE_STOP';
  newDate?: string;
  stopId?: string;
}

interface Conflict {
  type: TripConflict;
  severity: 'ERROR' | 'WARNING';
  message: string;
  affectedStopIds: string[];
  suggestedFix: SuggestedFix[];
}

export interface ConflictResult {
  hasConflicts: boolean;
  conflicts: Conflict[];
  suggestedArrivalDate: string | null;
  totalDaysNeeded: number;
  totalDaysAvailable: number;
  isScheduleFeasible: boolean;
}

interface TripDates {
  departureDate: string | Date | null;
  arrivalDate: string | Date | null;
  returnDepartureDate?: string | Date | null;
  direction?: string;
}

interface StopDates {
  id: string;
  name: string;
  arrivalDate: string | Date | null;
  departureDate: string | Date | null;
  distanceFromPrevMiles?: number;
  distanceToNextMiles?: number;
}

interface LegInfo {
  fromName: string;
  toName: string;
  distanceMiles: number;
  daysAvailable: number;
}

function toDate(d: string | Date | null | undefined): Date | null {
  if (!d) return null;
  const date = new Date(d);
  if (isNaN(date.getTime())) return null;
  // Normalize to midnight UTC to avoid time-of-day comparison issues
  return new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function addDays(d: Date, n: number): Date {
  const result = new Date(d);
  result.setDate(result.getDate() + n);
  return result;
}

function fmt(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isoDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

export function validateTripDates(
  trip: TripDates,
  stops: StopDates[],
  legs?: LegInfo[],
  dailyDriveHours = 8,
): ConflictResult {
  const conflicts: Conflict[] = [];
  const dep = toDate(trip.departureDate);
  const arr = toDate(trip.arrivalDate);

  if (!dep || !arr) {
    return { hasConflicts: false, conflicts: [], suggestedArrivalDate: null, totalDaysNeeded: 0, totalDaysAvailable: 0, isScheduleFeasible: true };
  }

  const daysAvailable = daysBetween(dep, arr);

  // CHECK 1 — DEPARTURE AFTER FIRST STOP
  if (stops.length > 0) {
    const firstArr = toDate(stops[0].arrivalDate);
    if (firstArr && dep > firstArr) {
      conflicts.push({
        type: TripConflict.DEPARTURE_AFTER_FIRST_STOP,
        severity: 'ERROR',
        message: `Your departure date (${fmt(dep)}) is after your first stop at ${stops[0].name} (${fmt(firstArr)})`,
        affectedStopIds: [stops[0].id],
        suggestedFix: [
          { label: `Move departure to ${fmt(addDays(firstArr, -1))}`, action: 'MOVE_DEPARTURE', newDate: isoDate(addDays(firstArr, -1)) },
          { label: `Move ${stops[0].name} arrival to after departure`, action: 'ADJUST_STOP', stopId: stops[0].id, newDate: isoDate(addDays(dep, 1)) },
        ],
      });
    }
  }

  // CHECK 6 — STOP BEFORE DEPARTURE
  // Same-day arrival at a stop on departure day is valid (depart morning, arrive at stop evening)
  for (const stop of stops) {
    const sArr = toDate(stop.arrivalDate);
    if (sArr && sArr.getTime() < dep.getTime()) {
      conflicts.push({
        type: TripConflict.STOP_BEFORE_DEPARTURE,
        severity: 'ERROR',
        message: `${stop.name} is scheduled for ${fmt(sArr)}, before your departure on ${fmt(dep)}`,
        affectedStopIds: [stop.id],
        suggestedFix: [
          { label: `Move departure to ${fmt(sArr)}`, action: 'MOVE_DEPARTURE', newDate: isoDate(sArr) },
          { label: `Move stop after departure`, action: 'ADJUST_STOP', stopId: stop.id, newDate: isoDate(addDays(dep, 1)) },
        ],
      });
    }
  }

  // CHECK 2 — STOPS OVERLAP
  for (let i = 0; i < stops.length - 1; i++) {
    const currDep = toDate(stops[i].departureDate);
    const nextArr = toDate(stops[i + 1].arrivalDate);
    if (currDep && nextArr && currDep > nextArr) {
      conflicts.push({
        type: TripConflict.STOPS_OVERLAP,
        severity: 'ERROR',
        message: `You leave ${stops[i].name} on ${fmt(currDep)} but arrive at ${stops[i + 1].name} on ${fmt(nextArr)} — these overlap`,
        affectedStopIds: [stops[i].id, stops[i + 1].id],
        suggestedFix: [
          { label: `Move ${stops[i + 1].name} arrival to ${fmt(addDays(currDep, 1))}`, action: 'ADJUST_STOP', stopId: stops[i + 1].id, newDate: isoDate(addDays(currDep, 1)) },
        ],
      });
    }
  }

  // CHECK 3 — STOP AFTER ARRIVAL
  // A stop's departure on the same day as arrival is valid (leave morning, arrive afternoon)
  // Only conflict if stop departure is strictly AFTER trip arrival
  for (const stop of stops) {
    const sArr = toDate(stop.arrivalDate);
    const sDep = toDate(stop.departureDate);
    if (sArr && sArr >= arr) {
      // Stop ARRIVAL is on or after trip arrival — this is a real conflict
      const relevant = sArr;
      const driveHoursToEnd = (stop.distanceToNextMiles || 200) / 55;
      const daysNeeded = Math.ceil(driveHoursToEnd / dailyDriveHours);
      const suggestedArr = addDays(relevant, daysNeeded);
      conflicts.push({
        type: TripConflict.STOP_AFTER_ARRIVAL,
        severity: 'ERROR',
        message: `${stop.name} (${sArr ? fmt(sArr) : '?'}${sDep ? ' - ' + fmt(sDep) : ''}) extends past your arrival date of ${fmt(arr)}`,
        affectedStopIds: [stop.id],
        suggestedFix: [
          { label: `Move arrival to ${fmt(suggestedArr)}`, action: 'MOVE_ARRIVAL', newDate: isoDate(suggestedArr) },
          { label: `Remove ${stop.name}`, action: 'REMOVE_STOP', stopId: stop.id },
        ],
      });
    }
  }

  // CHECK 4 — INSUFFICIENT DRIVE TIME (using legs if provided)
  if (legs) {
    for (const leg of legs) {
      const driveHours = leg.distanceMiles / 55;
      if (leg.daysAvailable > 0 && driveHours > leg.daysAvailable * dailyDriveHours) {
        const hoursPerDay = Math.round((driveHours / leg.daysAvailable) * 10) / 10;
        conflicts.push({
          type: TripConflict.INSUFFICIENT_DRIVE_TIME,
          severity: 'WARNING',
          message: `The drive from ${leg.fromName} to ${leg.toName} takes ~${Math.round(driveHours)}h but you only have ${leg.daysAvailable} day(s) — that's ${hoursPerDay}h of driving per day`,
          affectedStopIds: [],
          suggestedFix: [
            { label: 'Auto-reschedule stops', action: 'MOVE_ARRIVAL' },
          ],
        });
      }
    }
  }

  // CHECK 5 — ENVELOPE TOO SHORT
  let totalDaysNeeded = 0;
  for (const stop of stops) {
    const sArr = toDate(stop.arrivalDate);
    const sDep = toDate(stop.departureDate);
    if (sArr && sDep) {
      totalDaysNeeded += Math.max(1, daysBetween(sArr, sDep));
    } else {
      totalDaysNeeded += 1; // assume 1 day minimum per stop
    }
  }
  // Add drive days between stops
  if (legs) {
    for (const leg of legs) {
      totalDaysNeeded += Math.max(0, Math.ceil((leg.distanceMiles / 55) / dailyDriveHours) - 1);
    }
  }

  if (totalDaysNeeded > daysAvailable && daysAvailable > 0) {
    const suggestedArr = addDays(dep, totalDaysNeeded);
    conflicts.push({
      type: TripConflict.ENVELOPE_TOO_SHORT,
      severity: 'ERROR',
      message: `Your trip needs at least ${totalDaysNeeded} days but your schedule only has ${daysAvailable} days`,
      affectedStopIds: [],
      suggestedFix: [
        { label: `Move arrival to ${fmt(suggestedArr)}`, action: 'MOVE_ARRIVAL', newDate: isoDate(suggestedArr) },
      ],
    });
  }

  // CHECK 7 — RETURN BEFORE ARRIVAL (round trips)
  if (trip.direction === 'ROUND_TRIP') {
    const ret = toDate(trip.returnDepartureDate);
    if (ret && ret <= arr) {
      conflicts.push({
        type: TripConflict.RETURN_BEFORE_ARRIVAL,
        severity: 'ERROR',
        message: `Your return departure (${fmt(ret)}) is before or on your arrival date (${fmt(arr)}) — you need time at your destination`,
        affectedStopIds: [],
        suggestedFix: [
          { label: `Move return to ${fmt(addDays(arr, 1))}`, action: 'MOVE_ARRIVAL', newDate: isoDate(addDays(arr, 1)) },
        ],
      });
    }
  }

  // CHECK 8 — LAST STOP OVERRUNS ARRIVAL
  if (stops.length > 0) {
    const lastStop = stops[stops.length - 1];
    const lastDep = toDate(lastStop.departureDate);
    if (lastDep) {
      const driveHoursToEnd = (lastStop.distanceToNextMiles || 200) / 55;
      const driveDays = Math.ceil(driveHoursToEnd / dailyDriveHours);
      const arriveBy = addDays(lastDep, driveDays);
      if (arriveBy > arr) {
        conflicts.push({
          type: TripConflict.LAST_STOP_OVERRUNS_ARRIVAL,
          severity: 'ERROR',
          message: `After leaving ${lastStop.name} on ${fmt(lastDep)}, the drive to your destination takes ~${Math.round(driveHoursToEnd)}h — you won't arrive by ${fmt(arr)}`,
          affectedStopIds: [lastStop.id],
          suggestedFix: [
            { label: `Move arrival to ${fmt(arriveBy)}`, action: 'MOVE_ARRIVAL', newDate: isoDate(arriveBy) },
            { label: `Leave ${lastStop.name} earlier`, action: 'ADJUST_STOP', stopId: lastStop.id },
          ],
        });
      }
    }
  }

  // Deduplicate: remove conflicts that reference the same stop with the same type
  const seen = new Set<string>();
  const deduped = conflicts.filter(c => {
    const key = `${c.type}:${c.affectedStopIds.sort().join(',')}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const suggestedArrivalDate = totalDaysNeeded > daysAvailable
    ? isoDate(addDays(dep, totalDaysNeeded))
    : null;

  return {
    hasConflicts: deduped.length > 0,
    conflicts: deduped,
    suggestedArrivalDate,
    totalDaysNeeded,
    totalDaysAvailable: daysAvailable,
    isScheduleFeasible: totalDaysNeeded <= daysAvailable,
  };
}

export function autoRescheduleStops(
  departureDate: Date,
  arrivalDate: Date,
  stops: StopDates[],
  legDistances: number[],
  dailyDriveHours = 8,
): Array<{ id: string; name: string; oldArrival: string | null; oldDeparture: string | null; newArrival: string; newDeparture: string }> {
  const totalDays = daysBetween(departureDate, arrivalDate);
  if (totalDays <= 0 || stops.length === 0) return [];

  // Calculate total drive days and total stop nights
  let totalDriveDays = 0;
  for (const dist of legDistances) {
    totalDriveDays += Math.max(1, Math.ceil((dist / 55) / dailyDriveHours));
  }

  // Calculate each stop's duration (nights)
  const stopNights = stops.map(s => {
    const a = toDate(s.arrivalDate);
    const d = toDate(s.departureDate);
    return a && d ? Math.max(1, daysBetween(a, d)) : 1;
  });

  const totalStopNights = stopNights.reduce((sum, n) => sum + n, 0);
  const totalNeeded = totalDriveDays + totalStopNights;

  // Scale factor: if we need more days than available, compress stop nights proportionally
  const scale = totalNeeded > totalDays ? totalDays / totalNeeded : 1;

  const result: Array<{ id: string; name: string; oldArrival: string | null; oldDeparture: string | null; newArrival: string; newDeparture: string }> = [];
  let cursor = new Date(departureDate);

  for (let i = 0; i < stops.length; i++) {
    // Drive days to this stop
    const driveDist = legDistances[i] || 100;
    const driveDays = Math.max(1, Math.ceil(((driveDist / 55) / dailyDriveHours) * scale));
    cursor = addDays(cursor, driveDays);

    const nights = Math.max(1, Math.round(stopNights[i] * scale));
    const newArrival = new Date(cursor);
    const newDeparture = addDays(cursor, nights);

    result.push({
      id: stops[i].id,
      name: stops[i].name,
      oldArrival: stops[i].arrivalDate ? isoDate(toDate(stops[i].arrivalDate)!) : null,
      oldDeparture: stops[i].departureDate ? isoDate(toDate(stops[i].departureDate)!) : null,
      newArrival: isoDate(newArrival),
      newDeparture: isoDate(newDeparture),
    });

    cursor = newDeparture;
  }

  return result;
}
