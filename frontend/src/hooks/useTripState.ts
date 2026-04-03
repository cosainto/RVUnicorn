import { useState, useEffect, useRef } from 'react';

export type TripState = 'blueprint' | 'load-out' | 'in-motion' | 'on-site' | 'echo';

interface TripStateInput {
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  campgroundLat?: number | null;
  campgroundLng?: number | null;
  isCheckedIn?: boolean;
}

interface TripStateResult {
  tripState: TripState;
  daysUntilTrip: number;
  hoursUntilTrip: number;
  distanceMiles: number | null;
  isWithinGeofence: boolean;
  stateLabel: string;
  stateEmoji: string;
  stateColor: string;
}

const GEOFENCE_MILES = 2;
const MS_PER_DAY = 86400000;

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const STATE_META: Record<TripState, { label: string; emoji: string; color: string }> = {
  'blueprint': { label: 'Planning', emoji: '🗺️', color: 'from-green-600 to-emerald-700' },
  'load-out': { label: 'Prep Mode', emoji: '🎒', color: 'from-amber-500 to-orange-600' },
  'in-motion': { label: 'On the Road', emoji: '🚐', color: 'from-blue-600 to-indigo-700' },
  'on-site': { label: 'At Camp', emoji: '🔥', color: 'from-emerald-600 to-green-700' },
  'echo': { label: 'Trip Memory', emoji: '📸', color: 'from-purple-600 to-pink-700' },
};

export function computeTripState(
  startDate: Date | null,
  endDate: Date | null,
  isCheckedIn: boolean,
  isWithinGeofence: boolean,
): TripState {
  if (!startDate || !endDate) return 'blueprint';

  const now = new Date();
  const start = new Date(startDate);
  const end = new Date(endDate);
  const msToStart = start.getTime() - now.getTime();
  const daysToStart = msToStart / MS_PER_DAY;

  // Echo: >24h after trip end
  if (now.getTime() > end.getTime() + MS_PER_DAY) return 'echo';

  // On-Site: checked in or within geofence during trip window
  if ((isCheckedIn || isWithinGeofence) && now >= start && now <= end) return 'on-site';

  // In-Motion: within trip date range (traveling)
  if (now >= start && now <= end) return 'in-motion';

  // Load-Out: 2-7 days before
  if (daysToStart > 0 && daysToStart <= 7) return 'load-out';

  // Blueprint: >7 days out or trip hasn't started
  return 'blueprint';
}

export function useTripState({
  startDate,
  endDate,
  campgroundLat,
  campgroundLng,
  isCheckedIn = false,
}: TripStateInput): TripStateResult {
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [tripState, setTripState] = useState<TripState>('blueprint');
  const watchId = useRef<number | null>(null);

  // Geolocation watcher
  useEffect(() => {
    if (!navigator.geolocation) return;
    if (!campgroundLat || !campgroundLng) return;

    watchId.current = navigator.geolocation.watchPosition(
      (pos) => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
      },
      () => {}, // silent fail
      { enableHighAccuracy: false, maximumAge: 60000, timeout: 10000 }
    );

    return () => {
      if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current);
    };
  }, [campgroundLat, campgroundLng]);

  // Distance calculation
  const distanceMiles = (userLat && userLng && campgroundLat && campgroundLng)
    ? haversine(userLat, userLng, campgroundLat, campgroundLng)
    : null;
  const isWithinGeofence = distanceMiles !== null && distanceMiles <= GEOFENCE_MILES;

  // State computation — re-evaluate every 30s
  useEffect(() => {
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;

    const evaluate = () => {
      setTripState(computeTripState(start, end, isCheckedIn, isWithinGeofence));
    };

    evaluate();
    const interval = setInterval(evaluate, 30000);
    return () => clearInterval(interval);
  }, [startDate, endDate, isCheckedIn, isWithinGeofence]);

  // Derived values
  const start = startDate ? new Date(startDate) : null;
  const now = new Date();
  const msToStart = start ? start.getTime() - now.getTime() : 0;
  const daysUntilTrip = Math.max(0, Math.ceil(msToStart / MS_PER_DAY));
  const hoursUntilTrip = Math.max(0, Math.ceil(msToStart / 3600000));

  const meta = STATE_META[tripState];

  return {
    tripState,
    daysUntilTrip,
    hoursUntilTrip,
    distanceMiles,
    isWithinGeofence,
    stateLabel: meta.label,
    stateEmoji: meta.emoji,
    stateColor: meta.color,
  };
}
