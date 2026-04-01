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


// ── Wallet random chaos posts (2% chance per active user daily) ──
export async function runWalletChaosCron() {
  console.log('[Wallet] Running chaos check...');
  try {
    const WALLET_IMG = 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1773978382/rvunicorn/guides/wallet.png';
    const APOLOGIZER_IMG = '/hitch.png';

    const chaosLines = [
      "WAIT— did you know campgrounds have been hiding something from us?! I can't say what but LOOK AROUND YOU 🪨💥",
      "BREAKING NEWS: Squirrels at campgrounds are DEFINITELY spies. The acorns are ANTENNAS. Stay woke. 🐿️",
      "I just calculated that if everyone at your campground jumped at the same time, A LOT OF THINGS WOULD HAPPEN. PROBABLY. 🪨",
      "Nobody talks about this but s'mores were invented by someone who couldn't decide between THREE SNACKS. GENIUS. 🍫",
      "Fun fact nobody asked for: the word 'campfire' has 'camp' in it. Which means camping INVENTED FIRE. Think about THAT. 🔥",
      "WAIT WAIT WAIT— what if stars are just campfires from really really really tall campers?! HAS ANYONE CHECKED?! 🌟",
      "I just realized tents and houses are the SAME THING but one is outside. We've been living in outdoor tents this whole time!!! 🏕️",
    ];

    const apologies = [
      "Sorry about that post. Wallet got into the camp WiFi again. Please disregard. Everything is fine. — Hitch 🦄",
      "I apologize on behalf of Wallet. She meant well. Probably. — Walter 🎭",
      "Ha! Sorry campers — Wallet escaped again. She's harmless! — Scout 🌲",
    ];

    // Get active users — 2% chance each
    const users = await prisma.user.findMany({
      where: { stargazingEnabled: true },
      select: { id: true },
      take: 200,
    });

    for (const user of users) {
      if (Math.random() > 0.02) continue;

      const chaos = chaosLines[Math.floor(Math.random() * chaosLines.length)];
      const apology = apologies[Math.floor(Math.random() * apologies.length)];

      // Post chaos
      await prisma.activity.create({
        data: {
          userId: user.id,
          type: 'WALLET_CHAOS',
          content: `🪨 ${chaos}`,
          metadata: JSON.stringify({ imageUrl: WALLET_IMG, character: 'wallet' }),
          isPublic: false,
        },
      }).catch(() => {});

      // Post apology 2 minutes later (we just create it now with a slight offset)
      await prisma.activity.create({
        data: {
          userId: user.id,
          type: 'WALLET_APOLOGY',
          content: apology,
          metadata: JSON.stringify({ imageUrl: APOLOGIZER_IMG, character: 'hitch' }),
          isPublic: false,
          createdAt: new Date(Date.now() + 2 * 60 * 1000),
        },
      }).catch(() => {});
    }

    console.log('[Wallet] Chaos deployed!');
  } catch (e) {
    console.error('[Wallet] Error:', e);
  }
}

export async function runStargazingCron() {
  console.log('[Stargazing] Running nightly sky update...');

  try {
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];

    // ── Only active check-ins (not calendar trips) ───────────────────────
    // Calendar trip users are NOT checked in — they don't get the feed post.
    const activeCheckIns = await prisma.checkIn.findMany({
      where: { isActive: true },
      include: {
        user: { select: { id: true, firstName: true, stargazingEnabled: true } },
        campground: { select: { id: true, name: true, latitude: true, longitude: true } },
      },
    });

    if (activeCheckIns.length === 0) {
      console.log('[Stargazing] No active check-ins. Skipping.');
      return;
    }

    // ── Group check-ins by campground ────────────────────────────────────
    const byCampground = new Map<string, { campground: any; users: { userId: string; firstName: string; stargazingEnabled: boolean }[] }>();
    for (const c of activeCheckIns) {
      if (!c.campground?.latitude || !c.campground?.longitude) continue;
      const cgId = c.campground.id;
      if (!byCampground.has(cgId)) {
        byCampground.set(cgId, { campground: c.campground, users: [] });
      }
      byCampground.get(cgId)!.users.push({
        userId: c.user.id,
        firstName: c.user.firstName,
        stargazingEnabled: c.user.stargazingEnabled ?? true,
      });
    }

    console.log(`[Stargazing] ${byCampground.size} campground(s) with active check-ins`);

    // ── One sky report generated per campground (shared) ─────────────────
    for (const [cgId, { campground, users }] of byCampground) {
      try {
        const enabledUsers = users.filter(u => u.stargazingEnabled);
        if (enabledUsers.length === 0) continue;

        // Generate ONE sky report for this campground
        const skyReport = await generateSkyReport(
          campground.latitude,
          campground.longitude,
          campground.name,
          today
        );
        if (!skyReport) continue;

        const moonPhase = getMoonPhase(today);
        const content = `🌟 Tonight's Sky at \${campground.name}\n\n\${skyReport}\n\n✨ Step outside and look up — the universe is putting on a show just for you!`;
        const metadata = JSON.stringify({
          imageUrl: STARGAZING_IMAGE,
          walterImage: WALTER_IMAGE,
          campgroundId: campground.id,
          campgroundName: campground.name,
          moonPhase,
          date: todayStr,
          lat: campground.latitude,
          lng: campground.longitude,
        });

        // ── Post activity to each checked-in user's feed (1/day dedup) ──
        for (const u of enabledUsers) {
          const existing = await prisma.activity.findFirst({
            where: {
              userId: u.userId,
              type: 'STARGAZING',
              createdAt: { gte: new Date(todayStr) },
            },
          }).catch(() => null);

          if (existing) {
            console.log(`[Stargazing] Already posted today for \${u.firstName}`);
            continue;
          }

          await prisma.activity.create({
            data: {
              userId: u.userId,
              type: 'STARGAZING',
              content,
              metadata,
              isPublic: false,
            },
          });
          console.log(`[Stargazing] ✅ Feed post created for \${u.firstName} at \${campground.name}`);
        }

        // ── Campfire Chat drop — only when 2+ users checked in here ─────
        if (users.length >= 2) {
          const room = await (prisma as any).campfireRoom.findFirst({
            where: { campgroundId: cgId, isActive: true },
          }).catch(() => null);

          if (room) {
            // Dedup: don't re-post Walter to chat if already done today
            const existingChatPost = await (prisma as any).campfireMessage.findFirst({
              where: {
                roomId: room.id,
                isSystem: true,
                createdAt: { gte: new Date(todayStr) },
                content: { contains: 'Tonight\'s Sky' },
              },
            }).catch(() => null);

            if (!existingChatPost) {
              const chatContent = `🔭 **Walter here.** \${skyReport}\n\n✨ Step outside and look up — the universe is putting on a show just for you!`;
              await (prisma as any).campfireMessage.create({
                data: {
                  roomId: room.id,
                  isSystem: true,
                  isHitch: false,
                  content: chatContent,
                  userId: null,
                },
              });
              console.log(`[Stargazing] 💬 Walter dropped into campfire chat at \${campground.name} (\${users.length} campers)`);
            }
          }
        }

        // Small delay between campgrounds to avoid API rate limits
        await new Promise(r => setTimeout(r, 1500));
      } catch (e) {
        console.error(`[Stargazing] Failed for campground \${cgId}:`, e);
      }
    }
  } catch (e) {
    console.error('[Stargazing] Cron error:', e);
  }
}