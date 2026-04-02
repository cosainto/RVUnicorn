import { useState, useEffect } from 'react';

export type EventLifecycle = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

export function computeEventLifecycle(
  startDate: string | Date,
  endDate: string | Date,
  eventStatus?: string | null,
): EventLifecycle {
  if (eventStatus === 'CANCELLED') return 'CANCELLED';
  const now = new Date();
  if (now < new Date(startDate)) return 'UPCOMING';
  if (now > new Date(endDate)) return 'ENDED';
  return 'LIVE';
}

export function useEventLifecycle(
  startDate: string | Date,
  endDate: string | Date,
  eventStatus?: string | null,
): EventLifecycle {
  const [lifecycle, setLifecycle] = useState(() =>
    computeEventLifecycle(startDate, endDate, eventStatus)
  );

  useEffect(() => {
    setLifecycle(computeEventLifecycle(startDate, endDate, eventStatus));
    const interval = setInterval(() => {
      setLifecycle(computeEventLifecycle(startDate, endDate, eventStatus));
    }, 30_000);
    return () => clearInterval(interval);
  }, [startDate, endDate, eventStatus]);

  return lifecycle;
}
