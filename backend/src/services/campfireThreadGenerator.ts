import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { CAMPFIRE_CHARACTERS, getCharacterForCategory, CharacterKey } from '../lib/campfireCharacters';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface GeneratedThread {
  character: CharacterKey;
  hookQuestion: string;
  hotTake: string;
  body: string;
  destinations: {
    name: string;
    campgroundId?: string;
    rigRestriction: string;
    amenitySummary: string;
    sentiment: 'POSITIVE' | 'MIXED' | 'AVOID';
    highlight: string;
  }[];
  seedReplies: string[];
}

export async function generateCampfireThread(input: {
  title: string;
  category: string;
  targetAudience: string;
  rigContext: string;
  weatherContext: string;
  destinationIds: string[];
}): Promise<GeneratedThread> {
  const character = getCharacterForCategory(input.category);
  const charDef = CAMPFIRE_CHARACTERS[character];

  // Fetch campground data for featured destinations
  const campgrounds = input.destinationIds.length > 0
    ? await prisma.campground.findMany({
        where: { id: { in: input.destinationIds } },
        select: {
          id: true,
          name: true,
          state: true,
          amenities: true,
          maxRvLength: true,
          isBigRigFriendly: true,
          hasFullHookups: true,
          hasWifi: true,
          hasPool: true,
          hasShowers: true,
          hasDumpStation: true,
          isPetFriendly: true,
          pricePerNight: true,
          siteType: true,
          googleRating: true,
          googleReviewCount: true,
          city: true,
        },
      })
    : [];

  const campgroundData = campgrounds.map((cg) => ({
    id: cg.id,
    name: cg.name,
    location: [cg.city, cg.state].filter(Boolean).join(', '),
    amenities: cg.amenities,
    maxRvLength: cg.maxRvLength,
    bigRigFriendly: cg.isBigRigFriendly,
    fullHookups: cg.hasFullHookups,
    wifi: cg.hasWifi,
    pool: cg.hasPool,
    showers: cg.hasShowers,
    dumpStation: cg.hasDumpStation,
    petFriendly: cg.isPetFriendly,
    pricePerNight: cg.pricePerNight,
    siteType: cg.siteType,
    rating: cg.googleRating,
    reviewCount: cg.googleReviewCount,
  }));

  const userPrompt = `Write a Weekly Campfire thread for RVUnicorn with these specs:

Topic: ${input.title}
Target Audience: ${input.targetAudience}
Rig Context: ${input.rigContext}
Season/Weather: ${input.weatherContext}

Destinations to feature (use this data):
${JSON.stringify(campgroundData, null, 2)}

Return ONLY valid JSON in this exact structure:
{
  "hookQuestion": "opening challenge to reader (1-2 sentences)",
  "hotTake": "controversial opinion, 2-3 sentences",
  "body": "main thread content in markdown, 400-600 words, written in character voice",
  "destinations": [
    {
      "name": "campground name",
      "campgroundId": "the id from the data above",
      "rigRestriction": "specific rig size/type warnings",
      "amenitySummary": "1 sentence",
      "sentiment": "POSITIVE or MIXED or AVOID",
      "highlight": "the one thing that makes this spot worth mentioning"
    }
  ],
  "seedReplies": ["question 1", "question 2", "question 3"]
}

Rules:
- Stay in character throughout
- Every destination must have a specific rig restriction note
- The hot take must be something a real RVer could disagree with
- seedReplies should force people to pick sides or share their experience`;

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: charDef.systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = response.content[0].type === 'text' ? response.content[0].text : '';

  // Extract JSON from response (handle potential markdown code fences)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Failed to parse AI response — no JSON found');
  }

  const parsed = JSON.parse(jsonMatch[0]);

  return {
    character,
    hookQuestion: parsed.hookQuestion,
    hotTake: parsed.hotTake,
    body: parsed.body,
    destinations: (parsed.destinations || []).map((d: any) => ({
      name: d.name,
      campgroundId: d.campgroundId,
      rigRestriction: d.rigRestriction || '',
      amenitySummary: d.amenitySummary || '',
      sentiment: d.sentiment || 'POSITIVE',
      highlight: d.highlight || '',
    })),
    seedReplies: parsed.seedReplies || [],
  };
}
