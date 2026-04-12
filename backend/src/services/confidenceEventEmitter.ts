import { prisma } from '../prisma';
import { ConfidenceReport } from './tripConfidenceService';
import { emitOrganizerActivity } from '../campfire/organizer.socket';

export async function emitConfidenceEvents(
  report: ConfidenceReport,
  eventId: string,
  campgroundId: string | null,
  userId: string
): Promise<void> {
  for (const flag of report.flags) {
    if (flag.severity !== 'high' && flag.severity !== 'critical') continue;

    const typeMap: Record<string, string> = {
      rig_size: 'RIG_MISMATCH',
      wind_high: 'WIND_RISK',
      wind_moderate: 'WIND_RISK',
      fatigue: 'FATIGUE',
      severe_weather: 'WEATHER_CHANGE',
      thunderstorm: 'WEATHER_CHANGE',
      freeze: 'WEATHER_CHANGE',
    };

    const etaMap: Record<string, number> = {
      WIND_RISK: 60,
      FATIGUE: 30,
      WEATHER_CHANGE: 45,
      RIG_MISMATCH: 0,
    };

    const eventType = typeMap[flag.id] || 'DELAY';

    await (prisma as any).tripConfidenceEvent.create({
      data: {
        eventId,
        campgroundId,
        userId,
        type: eventType,
        severity: flag.severity === 'critical' ? 'HIGH' : flag.severity.toUpperCase(),
        message: flag.label,
        etaImpact: etaMap[eventType] || 0,
      },
    });

    // Also push to organizer dashboard pulse feed
    if (campgroundId) {
      emitOrganizerActivity(campgroundId, {
        type: 'CHECKIN',
        title: `Guest flagged: ${flag.label}`,
        subtitle: `${report.status} · Score ${report.score}/100`,
        actionLabel: 'View',
        actionType: 'VIEW_GUEST',
      });
    }
  }
}
