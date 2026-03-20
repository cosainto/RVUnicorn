import { prisma } from '../prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STARGAZING_IMAGE = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773960904/rvunicorn/stargazing.png';
const WALTER_IMAGE = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773969595/rvunicorn/walter-stargazing.png';

function getMoonPhase(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  let c = 0, e = 0, jd = 0;
  if (month < 3) { year - 1; c = 365.25 * (year - 1); } else { c = 365.25 * year; }
  e = 30.6 * month + 0.5;
  jd = c + e + day - 694039.09;
  jd /= 29.5305882;
  const phase = jd - Math.floor(jd);
  const index = Math.round(phase * 8) % 8;
  return ['🌑 New Moon', '🌒 Waxing Crescent', '🌓 First Quarter', '🌔 Waxing Gibbous', '🌕 Full Moon', '🌖 Waning Gibbous', '🌗 Last Quarter', '🌘 Waning Crescent'][index];
}

async function generateSkyReport(lat: number, lng: number, campgroundName: string, date: Date): Promise<string> {
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();
  const moonPhase = getMoonPhase(date);
  const hemisphere = lat >= 0 ? 'Northern' : 'Southern';

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `You are Walter, a gruff but secretly enthusiastic stargazing veteran at RVUnicorn. Generate a nightly sky report for campers.

Location: ${campgroundName} (${lat.toFixed(2)}, ${lng.toFixed(2)}) — ${hemisphere} Hemisphere
Date: ${month} ${day}
Moon Phase: ${moonPhase}

Write a Walter-voiced 3-4 sentence sky report — gruff, sarcastic, but genuinely knowledgeable and secretly excited about astronomy. Include:
- Moon phase and what it means for visibility (Walter-style: complain if it ruins viewing, grudgingly approve if it's good)
- 2-3 specific constellations visible tonight from this location/season
- Any planets visible (be accurate for the season)
- One practical stargazing tip Walter would give (no-nonsense, maybe a little grumpy)

Example Walter voice: "Fine. The moon's keeping its mouth shut tonight which means you might actually see something if you put down your phone for five minutes."
Start with the moon phase emoji. Keep it under 4 sentences.`
    }],
  });

  return response.content[0].type === 'text' ? response.content[0].text.trim() : '';
}

export async function runStargazingCron() {
  console.log('[Stargazing] Running nightly sky update...');

  try {
    const now = new Date();

    // Find active check-ins
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, firstName: true, stargazingEnabled: true } },
        campground: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
    });

    // Also find users with calendar trips happening today
    const todayStart = new Date(now); todayStart.setHours(0,0,0,0);
    const todayEnd = new Date(now); todayEnd.setHours(23,59,59,999);
    const calendarTrips = await prisma.event.findMany({
      where: {
        startDate: { lte: todayEnd },
        endDate: { gte: todayStart },
        campgroundId: { not: null },
      },
      include: {
        campground: { select: { id: true, name: true, latitude: true, longitude: true } },
        organizer: { select: { id: true, firstName: true, stargazingEnabled: true } },
        attendees: {
          include: { user: { select: { id: true, firstName: true, stargazingEnabled: true } } },
        },
      },
    });

    // Build unified list of user+campground pairs (deduplicated)
    const seen = new Set<string>();
    const entries: { userId: string; firstName: string; stargazingEnabled: boolean; campground: any }[] = [];

    for (const c of activeCheckIns) {
      if (!c.campground?.latitude || !c.campground?.longitude) continue;
      const key = `${c.user.id}-${c.campground.id}`;
      if (!seen.has(key)) { seen.add(key); entries.push({ userId: c.user.id, firstName: c.user.firstName, stargazingEnabled: c.user.stargazingEnabled ?? true, campground: c.campground }); }
    }

    for (const trip of calendarTrips) {
      const campground = trip.campground;
      if (!campground?.latitude || !campground?.longitude) continue;
      const users = [trip.organizer, ...trip.attendees.map((a: any) => a.user)].filter(Boolean);
      for (const u of users) {
        const key = `${u.id}-${campground.id}`;
        if (!seen.has(key)) { seen.add(key); entries.push({ userId: u.id, firstName: u.firstName, stargazingEnabled: u.stargazingEnabled ?? true, campground }); }
      }
    }

    console.log(`[Stargazing] Found ${entries.length} user-campground pairs to post for`);

    // Replace activeCheckIns loop with entries loop
    const activeCheckIns2 = entries;

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    for (const checkIn of activeCheckIns2) {
      if (!checkIn.stargazingEnabled) continue;
      if (!checkIn.campground?.latitude || !checkIn.campground?.longitude) continue;

      try {
        // Check if we already posted today for this user
        const existingPost = await prisma.activity.findFirst({
          where: {
            userId: checkIn.userId,
            type: 'STARGAZING',
            createdAt: { gte: new Date(todayStr) },
          },
        }).catch(() => null);

        if (existingPost) {
          console.log(`[Stargazing] Already posted today for user ${checkIn.userId}`);
          continue;
        }

        const skyReport = await generateSkyReport(
          checkIn.campground.latitude,
          checkIn.campground.longitude,
          checkIn.campground.name,
          today
        );

        if (!skyReport) continue;

        const moonPhase = getMoonPhase(today);
        const content = `🌟 Tonight's Sky at ${checkIn.campground.name}\n\n${skyReport}\n\n✨ Step outside and look up — the universe is putting on a show just for you!`;

        // Post to user's basecamp activity feed
        const metadata = JSON.stringify({
          imageUrl: STARGAZING_IMAGE,
          walterImage: WALTER_IMAGE,
          campgroundId: checkIn.campground.id,
          campgroundName: checkIn.campground.name,
          moonPhase,
          date: todayStr,
          lat: checkIn.campground.latitude,
          lng: checkIn.campground.longitude,
        });

        await prisma.activity.create({
          data: {
            userId: checkIn.userId,
            type: 'STARGAZING',
            content,
            metadata,
            isPublic: false,
          },
        });
        console.log(`[Stargazing] ✅ Activity created for ${checkIn.firstName}`);

        console.log(`[Stargazing] Posted sky report for ${checkIn.firstName} at ${checkIn.campground.name}`);

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        console.error(`[Stargazing] Failed for user ${checkIn.userId}:`, e);
      }
    }
  } catch (e) {
    console.error('[Stargazing] Cron error:', e);
  }
}
