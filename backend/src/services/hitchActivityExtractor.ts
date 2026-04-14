import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../prisma';
import { notificationService } from './notification.service';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

interface ExtractedActivity {
  activityType: string;
  title: string;
  description: string;
  durationMinutes: number | null;
  difficulty: string;
  whatToBring: string[];
  bestTimeOfDay: string;
  bestSeason: string[];
  kidsOk: boolean;
  dogsOk: boolean;
  confidence: number;
}

const VALID_ACTIVITY_TYPES = [
  'HIKE', 'KAYAK', 'SWIM', 'FISH', 'BIKE', 'STARGAZING',
  'CAMPFIRE', 'PHOTOGRAPHY', 'WILDLIFE', 'OFFROAD', 'SOCIAL', 'FOOD', 'OTHER',
];

export async function extractActivityFromContent(
  contentId: string
): Promise<ExtractedActivity | null> {
  const content = await prisma.creatorContent.findUnique({
    where: { id: contentId },
    select: {
      id: true,
      title: true,
      description: true,
      body: true,
      tags: true,
      contentType: true,
      campgroundId: true,
      creatorId: true,
    },
  });

  if (!content || !content.campgroundId) return null;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: `You are an activity extraction engine for RVUnicorn, an RV travel platform. Extract structured activity data from camping/RV content. Return ONLY valid JSON or the word "null" if no clear activity is described.

Activity types: HIKE, KAYAK, SWIM, FISH, BIKE, STARGAZING, CAMPFIRE, PHOTOGRAPHY, WILDLIFE, OFFROAD, SOCIAL, FOOD, OTHER
Difficulty: EASY, MODERATE, HARD, ANY
Time of day: MORNING, AFTERNOON, EVENING, NIGHT, ANY
Seasons: SPRING, SUMMER, FALL, WINTER (array)`,
      messages: [
        {
          role: 'user',
          content: `Extract activity data from this content:
Title: ${content.title || ''}
Description: ${content.description || ''}
Body: ${(content.body || '').slice(0, 800)}
Tags: ${(content.tags || []).join(', ')}

Return JSON:
{
  "activityType": "string",
  "title": "string (short action title e.g. 'Sunrise hike to Mesa Arch')",
  "description": "string (1-2 sentences)",
  "durationMinutes": "number | null",
  "difficulty": "string",
  "whatToBring": ["string (max 6 items)"],
  "bestTimeOfDay": "string",
  "bestSeason": ["string"],
  "kidsOk": true,
  "dogsOk": true,
  "confidence": 0.0
}

Return null if the content is not about a specific activity (e.g. gear reviews, general tips, rig talk).`,
        },
      ],
    });

    const text = (response.content[0] as any).text?.trim();
    if (!text || text === 'null') return null;

    // Extract JSON from potential markdown code fences
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const extracted: ExtractedActivity = JSON.parse(jsonMatch[0]);

    // Validate
    if (!extracted.confidence || extracted.confidence < 0.6) return null;
    if (!VALID_ACTIVITY_TYPES.includes(extracted.activityType)) {
      extracted.activityType = 'OTHER';
    }
    if (extracted.whatToBring?.length > 6) {
      extracted.whatToBring = extracted.whatToBring.slice(0, 6);
    }

    // Create ActionableContent
    const actionable = await prisma.actionableContent.create({
      data: {
        contentId: content.id,
        campgroundId: content.campgroundId,
        creatorId: content.creatorId,
        activityType: extracted.activityType,
        title: extracted.title,
        description: extracted.description,
        durationMinutes: extracted.durationMinutes,
        difficulty: extracted.difficulty || 'ANY',
        whatToBring: extracted.whatToBring || [],
        bestTimeOfDay: extracted.bestTimeOfDay || 'ANY',
        bestSeason: extracted.bestSeason || [],
        kidsOk: extracted.kidsOk ?? true,
        dogsOk: extracted.dogsOk ?? true,
        sourceType: 'HITCH_EXTRACTED',
        hitchConfidence: extracted.confidence,
        creatorConfirmed: false,
      },
    });

    // Notify creator
    if (content.creatorId) {
      await notificationService.create({
        userId: content.creatorId,
        type: 'ACTIVITY_EXTRACTED',
        title: 'Hitch found an activity in your post',
        content: `"${extracted.title}" — confirm or edit it on your dashboard.`,
        link: '/creator/dashboard?tab=activities',
      });
    }

    return extracted;
  } catch (err: any) {
    console.error('[HitchActivityExtractor] extraction failed:', err);
    return null;
  }
}
