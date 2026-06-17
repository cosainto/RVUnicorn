/**
 * Campfire Banter — Grounded Fact Picker
 *
 * Returns ONE fact source for a banter beat. Facts must be REAL — campground
 * facts come strictly from stored fields, never invented. RVUnicorn facts
 * come from a curated code-owned tip bank.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient() as any;

export type FactSource = 'CAMPGROUND' | 'RVUNICORN' | 'NONE';

export interface BanterFact {
  source: FactSource;
  /** Category hint for biasing character selection */
  category?: string;
  /** The actual fact text to pass into generation (never invented) */
  text: string;
}

// ── Curated RVUnicorn tips/facts (safe to author) ─────────────────────
const RVUNICORN_FACTS: { text: string; category: string }[] = [
  { text: 'RVUnicorn lets you check in to a campground and join its live campfire chat with other campers on-site.', category: 'VALUE' },
  { text: 'You can earn the "First Flame" badge by being the first person to check in and light up a campground\'s campfire.', category: 'ADVENTURE' },
  { text: 'RVUnicorn tracks your total nights camped across all campgrounds on your profile.', category: 'WISDOM' },
  { text: 'You can @mention any of the six campfire characters for instant advice — Hitch, Wallet, Walter, Scout, Holden, or Hannah.', category: 'VALUE' },
  { text: 'The campfire pulse feed shows real-time check-ins, photos, and wildlife sightings from fellow campers.', category: 'ADVENTURE' },
  { text: 'Walter can tell you the Bortle scale rating for stargazing at your current campground if you ask him.', category: 'STARGAZING' },
  { text: 'Wallet will roast your campground spending if you let her. She means well... mostly.', category: 'DEALS' },
  { text: 'Scout knows the best dispersed BLM camping spots that most apps don\'t list.', category: 'OFFGRID' },
  { text: 'Hannah and Holden are the Junior Rangers — they\'re here to help families and kids have the best trip.', category: 'WISDOM' },
  { text: 'You can log wildlife sightings at any campground and other campers will see them in the pulse feed.', category: 'NATURE' },
  { text: 'RVUnicorn shows cell signal strength ratings so you know if you can stream or need to unplug.', category: 'VALUE' },
  { text: 'The campfire chat has quiet hours set by each campground — the characters respect them too.', category: 'WISDOM' },
];

// ── Campground fact extraction ────────────────────────────────────────

interface CampgroundRow {
  name: string;
  state?: string | null;
  city?: string | null;
  description?: string | null;
  amenities?: string[];
  averageRating?: number | null;
  ratingCount?: number;
  pricePerNight?: number | null;
  isPetFriendly?: boolean | null;
  isWaterfront?: boolean | null;
  isBigRigFriendly?: boolean | null;
  maxRvLength?: number | null;
  cellSignalStrength?: number | null;
  thingsToDo?: { thingToDo: { name: string; category?: string | null }; distanceMiles?: number | null }[];
}

const CAMPGROUND_SELECT = {
  name: true,
  state: true,
  city: true,
  description: true,
  amenities: true,
  averageRating: true,
  ratingCount: true,
  pricePerNight: true,
  isPetFriendly: true,
  isWaterfront: true,
  isBigRigFriendly: true,
  maxRvLength: true,
  cellSignalStrength: true,
  thingsToDo: {
    take: 5,
    orderBy: { relevanceScore: 'desc' as const },
    include: { thingToDo: { select: { name: true, category: true } } },
  },
};

/** Build a grounded fact string from real campground data. Returns null if no interesting fact found. */
function extractCampgroundFact(cg: CampgroundRow): BanterFact | null {
  const facts: BanterFact[] = [];

  if (cg.pricePerNight && cg.pricePerNight > 0) {
    facts.push({
      source: 'CAMPGROUND',
      category: 'VALUE',
      text: `${cg.name} costs $${cg.pricePerNight}/night.`,
    });
  }

  if (cg.averageRating && cg.ratingCount && cg.ratingCount >= 3) {
    facts.push({
      source: 'CAMPGROUND',
      category: 'WISDOM',
      text: `${cg.name} has a ${cg.averageRating.toFixed(1)} average rating from ${cg.ratingCount} reviews.`,
    });
  }

  if (cg.isPetFriendly) {
    facts.push({
      source: 'CAMPGROUND',
      category: 'WISDOM',
      text: `${cg.name} is pet-friendly.`,
    });
  }

  if (cg.isWaterfront) {
    facts.push({
      source: 'CAMPGROUND',
      category: 'NATURE',
      text: `${cg.name} is a waterfront campground.`,
    });
  }

  if (cg.isBigRigFriendly && cg.maxRvLength) {
    facts.push({
      source: 'CAMPGROUND',
      category: 'DESTINATION',
      text: `${cg.name} is big-rig friendly and can handle rigs up to ${cg.maxRvLength} ft.`,
    });
  }

  if (cg.cellSignalStrength != null) {
    const label = cg.cellSignalStrength >= 4 ? 'strong' : cg.cellSignalStrength >= 2 ? 'moderate' : 'weak';
    facts.push({
      source: 'CAMPGROUND',
      category: 'VALUE',
      text: `${cg.name} has ${label} cell signal (${cg.cellSignalStrength}/5).`,
    });
  }

  if (cg.amenities && cg.amenities.length > 0) {
    const sample = cg.amenities.slice(0, 4).join(', ');
    facts.push({
      source: 'CAMPGROUND',
      category: 'DESTINATION',
      text: `${cg.name} amenities include ${sample}.`,
    });
  }

  if (cg.thingsToDo && cg.thingsToDo.length > 0) {
    const thing = cg.thingsToDo[0];
    const dist = thing.distanceMiles ? ` (${thing.distanceMiles} mi away)` : '';
    facts.push({
      source: 'CAMPGROUND',
      category: 'ADVENTURE',
      text: `Near ${cg.name}: ${thing.thingToDo.name}${dist}.`,
    });
  }

  if (facts.length === 0) return null;
  return facts[Math.floor(Math.random() * facts.length)];
}

// ── Public API ─────────────────────────────────────────────────────────

/**
 * Pick a fact for a banter beat at the given campground.
 * Distribution: ~40% campground, ~30% RVUnicorn, ~30% none (pure banter).
 */
export async function pickFact(campgroundId: string): Promise<BanterFact> {
  const roll = Math.random();

  if (roll < 0.4) {
    // Try campground fact
    try {
      const cg = await prisma.campground.findUnique({
        where: { id: campgroundId },
        select: CAMPGROUND_SELECT,
      });
      if (cg) {
        const fact = extractCampgroundFact(cg);
        if (fact) return fact;
      }
    } catch (e) {
      console.error('[Banter factPicker] campground query error:', e);
    }
    // Fall through to RVUnicorn if campground had nothing interesting
  }

  if (roll < 0.7) {
    // RVUnicorn fact
    const pick = RVUNICORN_FACTS[Math.floor(Math.random() * RVUNICORN_FACTS.length)];
    return { source: 'RVUNICORN', category: pick.category, text: pick.text };
  }

  // Pure banter, no fact
  return { source: 'NONE', text: '' };
}
