/**
 * Campfire Banter — Generation Service
 *
 * One Haiku call per beat produces the full exchange (2 lines + optional
 * reaction) for coherence and cost efficiency.
 */

import { CAMPFIRE_CHARACTERS } from '../../lib/campfireCharacters';
import { getCharacterForCategory } from '../../lib/campfireCharacters';
import {
  CharacterKey,
  pickPairing,
  pickReactor,
  pickReactionTag,
  BANTER_PAIRINGS,
} from './relationships';
import { BanterFact } from './factPicker';

// ── Types ──────────────────────────────────────────────────────────────

export interface BanterLine {
  character: CharacterKey;
  text: string;
}

export interface BanterBeat {
  lines: BanterLine[];
  reaction: { character: CharacterKey; text: string } | null;
}

// ── Character voice snippets (short, for the system prompt) ───────────

const VOICE_SNIPPET: Record<CharacterKey, string> = {
  HITCH:  'Steady, dry-witted older sibling. RV expert. Keeps order with warmth.',
  WALLET: 'Chaos gremlin. Deal-obsessed. Frames everything in dollars. Funny, unhinged about money.',
  WALTER: 'Stargazing philosopher. Reflective, occasionally poetic, dry humor. Goes too deep on nature.',
  SCOUT:  'Adventure-first trail hound. High energy, competitive, action-oriented. Direct.',
  HOLDEN: 'Excited 10-year-old. Loves outdoors, sports, electronics. Enthusiastic kid energy.',
  HANNAH: 'Cheerful encouraging 9-year-old. Loves art and nature. Tattle-tale for good reasons.',
};

// ── Main generator ─────────────────────────────────────────────────────

interface GenerateBanterInput {
  campgroundName: string;
  fact: BanterFact;
}

export async function generateBanter(input: GenerateBanterInput): Promise<BanterBeat | null> {
  const { campgroundName, fact } = input;

  // Pick characters: bias by fact category if available
  let biasChar: CharacterKey | undefined;
  if (fact.category) {
    const mapped = getCharacterForCategory(fact.category);
    // Only bias toward characters that have banter pairings
    if (BANTER_PAIRINGS.some(p => p.a === mapped || p.b === mapped)) {
      biasChar = mapped as CharacterKey;
    }
  }

  const pairing = pickPairing(biasChar);
  const reactor = pickReactor(pairing.a, pairing.b);

  // Build the system prompt
  const factInstruction = fact.source !== 'NONE'
    ? `\nGROUNDED FACT (work this into the exchange naturally): "${fact.text}"\nDo NOT invent any campground details beyond what's in this fact.`
    : '\nNo fact this time — pure sibling banter.';

  const reactorInstruction = reactor
    ? `\nThird character ${reactor} may add a 1–3 word reaction tag. ${reactor}'s voice: ${VOICE_SNIPPET[reactor]}. Example tags: ${pickReactionTag(reactor)}, ${pickReactionTag(reactor)}.`
    : '\nNo third character reaction this time — set "reaction" to null.';

  const systemPrompt = `You generate ambient campfire banter between RVUnicorn AI characters at ${campgroundName}. This is friendly sibling teasing — never mean, always in-character.

CHARACTER A: ${pairing.a}
Voice: ${VOICE_SNIPPET[pairing.a]}

CHARACTER B: ${pairing.b}
Voice: ${VOICE_SNIPPET[pairing.b]}

RELATIONSHIP: ${pairing.dynamic}
${factInstruction}
${reactorInstruction}

OUTPUT CONTRACT — respond ONLY with valid JSON, no prose, no markdown fences:
{
  "lines": [
    { "character": "${pairing.a}", "text": "..." },
    { "character": "${pairing.b}", "text": "..." }
  ],
  "reaction": ${reactor ? `{ "character": "${reactor}", "text": "..." }` : 'null'}
}

HARD RULES:
- Each line MUST be ≤ 12 words.
- Reaction text MUST be 1–3 words (or null).
- Do NOT @mention real users.
- Do NOT invent campground facts beyond what's provided.
- Stay fully in each character's established voice.
- Keep it family-friendly and fun.`;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 160,
        temperature: 0.9,
        messages: [{ role: 'user', content: 'Generate one banter beat.' }],
        system: systemPrompt,
      }),
    });

    const aiData: any = await res.json();
    const raw = aiData?.content?.[0]?.text?.trim();
    if (!raw) return null;

    // Strip any stray markdown fences
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const parsed: BanterBeat = JSON.parse(cleaned);

    // Validate structure
    if (!Array.isArray(parsed.lines) || parsed.lines.length < 2) return null;
    if (!parsed.lines[0].character || !parsed.lines[0].text) return null;
    if (!parsed.lines[1].character || !parsed.lines[1].text) return null;

    return parsed;
  } catch (e: any) {
    console.error('[Banter generateBanter] error:', e?.message || e);
    return null;
  }
}
