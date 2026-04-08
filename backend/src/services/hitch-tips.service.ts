import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const HITCH_AVATAR =
  'https://res.cloudinary.com/dy6eetmh7/image/upload/v1775261116/rvunicorn/characters/hitch.png';

export type HitchTipPhase = 'INITIAL' | 'PRETRIP';

// Marker categories — used to detect already-generated batches and skip
// duplicate runs in the cron.
const PHASE_CATEGORY: Record<HitchTipPhase, string> = {
  INITIAL: 'HITCH_INITIAL',
  PRETRIP: 'HITCH_PRETRIP',
};

// ─────────────────────────────────────────────────────────────────
// System Hitch user — upserted on first use, reused thereafter.
// Uses the same convention as scripts/import-scraped-events.ts.
// ─────────────────────────────────────────────────────────────────
let cachedHitchUserId: string | null = null;

export async function getOrCreateHitchUser(): Promise<string> {
  if (cachedHitchUserId) return cachedHitchUserId;

  let hitch = await prisma.user.findFirst({ where: { username: 'hitch' } });
  if (!hitch) {
    hitch = await prisma.user.create({
      data: {
        email: 'hitch@rvunicorn.com',
        username: 'hitch',
        firstName: 'Hitch',
        lastName: '',
        profilePicture: HITCH_AVATAR,
        password: 'SYSTEM_NO_LOGIN_' + Date.now(),
        bio: "Your RVUnicorn trail guide. I drop tips before every trip.",
      },
    });
  } else if (!hitch.profilePicture) {
    // Make sure existing Hitch user has the avatar
    hitch = await prisma.user.update({
      where: { id: hitch.id },
      data: { profilePicture: HITCH_AVATAR },
    });
  }

  cachedHitchUserId = hitch.id;
  return hitch.id;
}

// ─────────────────────────────────────────────────────────────────
// Generate 3 specific tips for a trip via Claude Haiku.
// Idempotent per (eventId, phase) — checks for an existing batch
// before doing any work.
// ─────────────────────────────────────────────────────────────────
export async function generateHitchTipsForEvent(
  eventId: string,
  phase: HitchTipPhase,
): Promise<{ created: number; skipped?: string }> {
  try {
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        title: true,
        startDate: true,
        endDate: true,
        campgroundId: true,
        campground: {
          select: {
            id: true,
            name: true,
            location: true,
            state: true,
            description: true,
            siteType: true,
            isBigRigFriendly: true,
            isPetFriendly: true,
            isWaterfront: true,
            hasWifi: true,
            hasFullHookups: true,
            hasShowers: true,
            hasLaundry: true,
            hasPool: true,
            seasonStart: true,
            seasonEnd: true,
          },
        },
      },
    });

    if (!event || !event.campground || !event.campgroundId) {
      return { created: 0, skipped: 'no campground' };
    }

    // Idempotency — already generated this phase for this trip?
    const hitchUserId = await getOrCreateHitchUser();
    const existing = await prisma.campfireTip.count({
      where: {
        tripId: eventId,
        authorId: hitchUserId,
        category: PHASE_CATEGORY[phase],
      },
    });
    if (existing > 0) {
      return { created: 0, skipped: 'already generated' };
    }

    // Build amenities snippet for the prompt
    const cg = event.campground;
    const amenities: string[] = [];
    if (cg.isBigRigFriendly) amenities.push('big-rig friendly');
    if (cg.isPetFriendly) amenities.push('pet friendly');
    if (cg.isWaterfront) amenities.push('waterfront');
    if (cg.hasFullHookups) amenities.push('full hookups');
    if (cg.hasWifi) amenities.push('wifi');
    if (cg.hasShowers) amenities.push('showers');
    if (cg.hasLaundry) amenities.push('laundry');
    if (cg.hasPool) amenities.push('pool');

    const startDate = new Date(event.startDate);
    const month = startDate.toLocaleDateString('en-US', { month: 'long' });
    const dateLabel = startDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'short',
      day: 'numeric',
    });
    const locationLine = [cg.name, cg.location, cg.state].filter(Boolean).join(', ');

    const phaseInstruction =
      phase === 'INITIAL'
        ? `This trip was just planned. Give 3 helpful tips to help them prepare and look forward to it.`
        : `The trip is in 2 days. Give 3 timely, practical tips for what to do or pack right now.`;

    const userPrompt = `${phaseInstruction}

Trip: "${event.title}"
Campground: ${locationLine}
Arriving: ${dateLabel} (${month})
${amenities.length ? `Amenities: ${amenities.join(', ')}` : ''}
${cg.description ? `About the campground: ${cg.description.slice(0, 400)}` : ''}

Return exactly 3 tips as a JSON array of objects, each with "title" (max 60 chars) and "content" (1-2 sentences, conversational, specific to this campground or this time of year — not generic camping advice). No preamble, no markdown, just the JSON array. Example shape:
[
  {"title": "...", "content": "..."},
  {"title": "...", "content": "..."},
  {"title": "...", "content": "..."}
]`;

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 600,
      system:
        "You are Hitch, RVUnicorn's friendly, knowledgeable trail guide. You drop short, specific, useful tips for fellow campers — never generic advice. Family-friendly tone, warm but practical.",
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '';
    if (!text) return { created: 0, skipped: 'empty response' };

    // Extract JSON array even if the model wraps it in markdown
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return { created: 0, skipped: 'no JSON in response' };

    let tips: { title?: string; content?: string }[];
    try {
      tips = JSON.parse(jsonMatch[0]);
    } catch {
      return { created: 0, skipped: 'JSON parse failed' };
    }

    if (!Array.isArray(tips) || tips.length === 0) {
      return { created: 0, skipped: 'no tips parsed' };
    }

    let created = 0;
    for (const tip of tips.slice(0, 3)) {
      if (!tip.content || typeof tip.content !== 'string') continue;
      try {
        await prisma.campfireTip.create({
          data: {
            campgroundId: event.campgroundId,
            authorId: hitchUserId,
            tripId: eventId,
            title: (tip.title || '').slice(0, 100) || null,
            content: tip.content.slice(0, 500),
            category: PHASE_CATEGORY[phase],
            isReusable: false,
          },
        });
        created += 1;
      } catch (e) {
        console.error('[hitch-tips] Failed to insert tip:', e);
      }
    }

    return { created };
  } catch (e: any) {
    console.error('[hitch-tips] generateHitchTipsForEvent failed:', e?.message || e);
    return { created: 0, skipped: 'exception' };
  }
}

// ─────────────────────────────────────────────────────────────────
// Daily cron pass — find events starting in 1-2 days that haven't
// gotten their pretrip tip batch yet, and generate them.
// ─────────────────────────────────────────────────────────────────
export async function runHitchPretripTips(): Promise<void> {
  console.log('[hitch-tips] Running pretrip tip pass...');

  // Window: events starting in 1-3 days from now (so the cron has a few
  // days of slack to catch any event in case of a missed run).
  const now = new Date();
  const windowStart = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const windowEnd = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  try {
    const events = await prisma.event.findMany({
      where: {
        campgroundId: { not: null },
        startDate: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true, title: true, startDate: true },
    });

    console.log(`[hitch-tips] Found ${events.length} events in the 1-3 day window`);

    for (const event of events) {
      const result = await generateHitchTipsForEvent(event.id, 'PRETRIP');
      if (result.created > 0) {
        console.log(`[hitch-tips] Generated ${result.created} pretrip tips for "${event.title}"`);
      }
    }
  } catch (e: any) {
    console.error('[hitch-tips] runHitchPretripTips failed:', e?.message || e);
  }
}
