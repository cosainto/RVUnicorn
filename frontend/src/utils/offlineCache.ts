const CACHE_PREFIX = 'rv_offline_';

interface CachedEvent {
  event: any;
  cachedAt: string;
}

export function cacheEvent(eventId: string, eventData: any): void {
  try {
    const entry: CachedEvent = {
      event: {
        id: eventData.id,
        title: eventData.title,
        description: eventData.description,
        startDate: eventData.startDate,
        endDate: eventData.endDate,
        location: eventData.location,
        locationName: eventData.locationName,
        bannerImage: eventData.bannerImage,
        campground: eventData.campground,
        organizer: eventData.organizer,
        scheduleItems: eventData.scheduleItems || [],
        meals: eventData.meals || [],
        attendees: (eventData.attendees || []).map((a: any) => ({
          userId: a.userId,
          status: a.status,
          participationMode: a.participationMode,
          user: a.user,
        })),
        announcements: eventData.announcements || [],
        planBDescription: eventData.planBDescription,
        planBLocation: eventData.planBLocation,
        planBActivated: eventData.planBActivated,
      },
      cachedAt: new Date().toISOString(),
    };
    localStorage.setItem(`${CACHE_PREFIX}${eventId}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

export function getCachedEvent(eventId: string): CachedEvent | null {
  try {
    const raw = localStorage.getItem(`${CACHE_PREFIX}${eventId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearCachedEvent(eventId: string): void {
  localStorage.removeItem(`${CACHE_PREFIX}${eventId}`);
}

export function isOnline(): boolean {
  return navigator.onLine;
}

export function formatCacheAge(cachedAt: string): string {
  const ms = Date.now() - new Date(cachedAt).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

// Auto-cache on RSVP — call this when user confirms GOING
export function autoCacheOnRSVP(eventData: any): void {
  if (eventData?.id) {
    cacheEvent(eventData.id, eventData);
  }
}
