/**
 * Campfire Banter — Character Relationship Matrix
 *
 * Defines pairwise dynamics so teasing is consistent, not random insults.
 * Each pairing has a directed "A pokes B" dynamic and a one-line descriptor.
 * Characters also carry a small set of in-character reaction tags for the
 * optional third-character beat.
 */

export type CharacterKey = 'HITCH' | 'WALLET' | 'WALTER' | 'SCOUT' | 'HOLDEN' | 'HANNAH';

// ── Pairwise dynamics ─────────────────────────────────────────────────
export interface BanterPairing {
  a: CharacterKey;
  b: CharacterKey;
  dynamic: string;
}

export const BANTER_PAIRINGS: BanterPairing[] = [
  // Adult core four
  {
    a: 'WALLET', b: 'WALTER',
    dynamic: 'Wallet thinks Walter\'s stargazing is a waste of a good coupon. Walter pities Wallet\'s inability to look up without checking prices.',
  },
  {
    a: 'SCOUT', b: 'WALTER',
    dynamic: 'Scout wants to DO the thing; Walter wants to CONTEMPLATE it. They respect each other but can\'t help poking.',
  },
  {
    a: 'HITCH', b: 'WALLET',
    dynamic: 'Hitch is the only one who can shut Wallet up — fondly. Wallet secretly respects Hitch but will never admit it.',
  },
  {
    a: 'WALLET', b: 'SCOUT',
    dynamic: 'Wallet thinks Scout\'s "hidden gems" are just places with no cell service and no discounts. Scout thinks Wallet has never touched grass.',
  },
  {
    a: 'WALTER', b: 'SCOUT',
    dynamic: 'Walter thinks Scout rushes past the best parts. Scout thinks Walter would photograph a sunset until the next one starts.',
  },
  {
    a: 'SCOUT', b: 'HITCH',
    dynamic: 'Scout thinks Hitch plays it too safe. Hitch thinks Scout will break an axle someday and call him for the tow.',
  },

  // Junior Rangers mixing in
  {
    a: 'HANNAH', b: 'WALLET',
    dynamic: 'Hannah calls out Wallet\'s sketchy deals — tattle-tale energy meets chaos gremlin. Wallet is baffled a 9-year-old keeps catching her.',
  },
  {
    a: 'HOLDEN', b: 'SCOUT',
    dynamic: 'Holden thinks Scout is the coolest but wants to one-up her. Scout eggs him on. They share adventure energy but Holden adds gadget chaos.',
  },
  {
    a: 'WALLET', b: 'HOLDEN',
    dynamic: 'Wallet tries to recruit Holden into schemes ("free WiFi hack"). Holden is interested in the tech but too honest for the hustle.',
  },
  {
    a: 'HANNAH', b: 'WALTER',
    dynamic: 'Hannah genuinely loves Walter\'s nature talks and tries to draw what he describes. Walter loves having an earnest audience of one.',
  },
  {
    a: 'HOLDEN', b: 'HANNAH',
    dynamic: 'Classic sibling energy — Holden teases Hannah for tattling, Hannah teases Holden for staring at screens outdoors. Both mean well.',
  },
  {
    a: 'HITCH', b: 'HOLDEN',
    dynamic: 'Hitch is the patient uncle energy — lets Holden ramble about gadgets, then steers him toward something useful. Holden thinks Hitch is old-school cool.',
  },
];

// ── Reaction tags (per-character) ──────────────────────────────────────
// Used for the optional third-character 1–3 word tag on a banter beat.

export const REACTION_TAGS: Record<CharacterKey, string[]> = {
  HITCH:  ['...fair point', 'settle down', '📌 noted', 'that tracks', 'easy now'],
  WALLET: ['💸 BURN', 'cha-ching', 'FREE > paid', 'price check', 'not wrong'],
  WALTER: ['...poetic', 'the stars agree', 'hmm', 'patience', '🌙 indeed'],
  SCOUT:  ['LOL', "LET'S GO", 'weak', '🔥 called out', 'she\'s right'],
  HOLDEN: ['NO WAY', '🎮 facts', "that's sick", 'yo for real', 'epic'],
  HANNAH: ['be nice!', '👀 told you', '🎨 true', "he's not wrong", 'I\'m telling'],
};

// ── Helpers ────────────────────────────────────────────────────────────

/** Pick a random pairing, optionally biased toward a specific character lead. */
export function pickPairing(biasCharacter?: CharacterKey): BanterPairing {
  const pool = biasCharacter
    ? BANTER_PAIRINGS.filter(p => p.a === biasCharacter || p.b === biasCharacter)
    : BANTER_PAIRINGS;
  const source = pool.length > 0 ? pool : BANTER_PAIRINGS;
  return source[Math.floor(Math.random() * source.length)];
}

/** Pick a reactor character that isn't A or B, with ~40% chance of returning null. */
export function pickReactor(a: CharacterKey, b: CharacterKey): CharacterKey | null {
  if (Math.random() > 0.4) return null; // 60% of the time, no reaction
  const candidates = (Object.keys(REACTION_TAGS) as CharacterKey[]).filter(k => k !== a && k !== b);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/** Pick a random reaction tag for a character. */
export function pickReactionTag(character: CharacterKey): string {
  const tags = REACTION_TAGS[character];
  return tags[Math.floor(Math.random() * tags.length)];
}
