export type EventLifecycle = 'UPCOMING' | 'LIVE' | 'ENDED' | 'CANCELLED';

export type PresenceStatus = 'HERE_NOW' | 'GOING' | 'MAYBE' | 'NOT_GOING';

export function computeEventLifecycle(event: {
  startDate: Date | string;
  endDate: Date | string;
  eventStatus?: string | null;
}): EventLifecycle {
  if (event.eventStatus === 'CANCELLED') return 'CANCELLED';
  const now = new Date();
  if (now < new Date(event.startDate)) return 'UPCOMING';
  if (now > new Date(event.endDate)) return 'ENDED';
  return 'LIVE';
}

export function computePresenceStatus(
  attendee: { status: string },
  lifecycle: EventLifecycle,
  isCheckedInAtVenue: boolean,
): PresenceStatus {
  if (attendee.status === 'DECLINED' || attendee.status === 'NOT_GOING') return 'NOT_GOING';
  if (attendee.status === 'MAYBE') return 'MAYBE';
  if (lifecycle === 'LIVE' && isCheckedInAtVenue) return 'HERE_NOW';
  return 'GOING';
}
