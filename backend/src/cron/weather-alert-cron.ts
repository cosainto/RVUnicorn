import { prisma } from '../prisma';
import { sendSMS } from '../services/email-sms.service';

// NWS alert severity levels that warrant an SMS
const ALERT_SEVERITIES = ['Extreme', 'Severe'];
const ALERT_URGENCIES  = ['Immediate', 'Expected'];

// Track which alert IDs we've already sent so we don't double-text
const sentAlerts = new Set<string>();

async function fetchNWSAlerts(lat: number, lng: number): Promise<any[]> {
  try {
    const url = `https://api.weather.gov/alerts/active?point=${lat.toFixed(4)},${lng.toFixed(4)}&limit=5`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'RVUnicorn (contact@rvunicorn.com)' },
    });
    if (!res.ok) return [];
    const data: any = await res.json();
    return data.features || [];
  } catch {
    return [];
  }
}

function formatAlertSMS(alert: any, campgroundName: string): string {
  const props = alert.properties;
  const event = props.event || 'Weather Alert';
  const headline = props.headline || props.description?.slice(0, 120) || '';
  const expires = props.expires
    ? new Date(props.expires).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/Chicago' })
    : '';

  return [
    `⚠️ RVUnicorn Weather Alert`,
    `📍 ${campgroundName}`,
    `🌩️ ${event}`,
    headline ? headline.slice(0, 140) : '',
    expires ? `Until ${expires} CT` : '',
    `Stay safe out there. — Hitch 🦄`,
  ].filter(Boolean).join('\n');
}

export async function runWeatherAlertCron() {
  console.log('[WeatherAlert] Checking NWS alerts for checked-in campers...');

  try {
    // Get all active check-ins with campground coordinates + user phone + SMS opt-in
    const checkIns = await prisma.checkIn.findMany({
      where: { isActive: true },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            phoneNumber: true,
            smsWeatherAlerts: true,
          },
        },
        campground: {
          select: {
            id: true,
            name: true,
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (checkIns.length === 0) {
      console.log('[WeatherAlert] No active check-ins. Skipping.');
      return;
    }

    // Group by campground — one NWS call per campground
    const byCampground = new Map<string, { campground: any; users: any[] }>();
    for (const c of checkIns) {
      if (!c.campground?.latitude || !c.campground?.longitude) continue;
      if (!c.user.smsWeatherAlerts || !c.user.phoneNumber) continue;
      const cgId = c.campground.id;
      if (!byCampground.has(cgId)) {
        byCampground.set(cgId, { campground: c.campground, users: [] });
      }
      byCampground.get(cgId)!.users.push(c.user);
    }

    if (byCampground.size === 0) {
      console.log('[WeatherAlert] No opted-in users with phone numbers checked in.');
      return;
    }

    for (const [, { campground, users }] of byCampground) {
      const alerts = await fetchNWSAlerts(campground.latitude, campground.longitude);

      // Filter to only severe/extreme alerts we haven't sent yet
      const newAlerts = alerts.filter(a => {
        const props = a.properties;
        const isSevere = ALERT_SEVERITIES.includes(props.severity) || ALERT_URGENCIES.includes(props.urgency);
        const isNew = !sentAlerts.has(a.id);
        return isSevere && isNew;
      });

      if (newAlerts.length === 0) {
        console.log(`[WeatherAlert] No new severe alerts at ${campground.name}`);
        continue;
      }

      for (const alert of newAlerts) {
        sentAlerts.add(alert.id);
        const smsBody = formatAlertSMS(alert, campground.name);

        for (const user of users) {
          await sendSMS({ to: user.phoneNumber, message: smsBody });
          console.log(`[WeatherAlert] 📱 SMS sent to ${user.firstName} — ${alert.properties.event} at ${campground.name}`);
        }
      }

      // Small delay between campgrounds
      await new Promise(r => setTimeout(r, 500));
    }

    console.log('[WeatherAlert] Done.');
  } catch (e: any) {
    console.error('[WeatherAlert] Cron error:', e);
  }
}
