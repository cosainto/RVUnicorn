import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/hitch/chat
router.post('/chat', async (req: any, res) => {
  try {
    const { message, history = [] } = req.body;

    // Search for relevant locations to include as context
    const searchTerms = message.toLowerCase();
    let contextData = '';
    let suggestions: any[] = [];

    // Search campgrounds if relevant
    if (searchTerms.includes('campground') || searchTerms.includes('camp') || searchTerms.includes('rv park')) {
      const campgrounds = await prisma.campground.findMany({
        where: {
          OR: [
            { name: { contains: message.split(' ').find(w => w.length > 4) || '', mode: 'insensitive' } },
            { state: { contains: message.match(/\b[A-Z]{2}\b/)?.[0] || '', mode: 'insensitive' } },
          ]
        },
        select: { id: true, name: true, location: true, state: true, rating: true, imageUrl: true },
        take: 3,
      });
      if (campgrounds.length > 0) {
        contextData += `\nNearby campgrounds: ${campgrounds.map(c => `${c.name} in ${c.state}`).join(', ')}`;
        suggestions.push(...campgrounds.map(c => ({
          type: 'campground', id: c.id, name: c.name,
          location: [c.location, c.state].filter(Boolean).join(', '),
          rating: c.rating, icon: '🏕️'
        })));
      }
    }

    // Search harvest hosts if relevant
    if (searchTerms.includes('winer') || searchTerms.includes('brew') || searchTerms.includes('farm') || searchTerms.includes('host')) {
      const hosts = await (prisma as any).harvestHost.findMany({
        where: {
          status: 'ACTIVE',
          OR: [
            { hostType: searchTerms.includes('winer') ? 'WINERY' : searchTerms.includes('brew') ? 'BREWERY' : 'FARM' },
            { state: { contains: message.match(/\b[A-Z]{2}\b/)?.[0] || '', mode: 'insensitive' } },
          ]
        },
        select: { id: true, name: true, hostType: true, city: true, state: true },
        take: 3,
      });
      if (hosts.length > 0) {
        const typeIcons: Record<string, string> = { WINERY: '🍷', BREWERY: '🍺', FARM: '🌾', RANCH: '🐄', OTHER: '🌿' };
        contextData += `\nNearby host locations: ${hosts.map((h: any) => `${h.name} (${h.hostType}) in ${h.state}`).join(', ')}`;
        suggestions.push(...hosts.map((h: any) => ({
          type: 'host', id: h.id, name: h.name,
          location: [h.city, h.state].filter(Boolean).join(', '),
          icon: typeIcons[h.hostType] || '🌿'
        })));
      }
    }

    // Search overnight spots if relevant
    if (searchTerms.includes('free') || searchTerms.includes('walmart') || searchTerms.includes('overnight') || searchTerms.includes('boondock')) {
      const spots = await prisma.freeOvernightSpot.findMany({
        where: {
          allowsRvs: true,
          OR: [
            { chain: { contains: 'Walmart', mode: 'insensitive' } },
            { category: 'BLM' },
            { state: { contains: message.match(/\b[A-Z]{2}\b/)?.[0] || '', mode: 'insensitive' } },
          ]
        },
        select: { id: true, name: true, category: true, city: true, state: true, rating: true },
        take: 3,
      });
      if (spots.length > 0) {
        contextData += `\nFree overnight spots: ${spots.map(s => `${s.name} in ${s.state}`).join(', ')}`;
        suggestions.push(...spots.map(s => ({
          type: 'overnight_spot', id: s.id, name: s.name,
          location: [s.city, s.state].filter(Boolean).join(', '),
          rating: s.rating, icon: '🅿️'
        })));
      }
    }

    const systemPrompt = `You are Hitch, RVUnicorn's friendly AI travel companion for RV enthusiasts. You help users:
- Plan RV routes with overnight stops
- Find campgrounds, RV parks, and free overnight spots
- Discover unique host locations (wineries, farms, breweries) that welcome RVers
- Get RV-specific travel tips (road restrictions, height limits, hookups, dump stations)
- Plan meals, activities, and adventures along their route

Your personality: enthusiastic, knowledgeable about RV travel, friendly, and a little playful. Use camping/RV metaphors occasionally.

Platform context: You have access to RVUnicorn's database of 24,000+ campgrounds, harvest host locations, and free overnight spots.
${contextData ? `\nRelevant locations found: ${contextData}` : ''}

Keep responses concise (2-4 paragraphs max). If you found relevant locations above, reference them naturally in your response. Always end with an actionable suggestion.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        ...history.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ],
    });

    const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';

    res.json({
      message: aiMessage,
      suggestions: suggestions.slice(0, 4),
    });
  } catch (e: any) {
    console.error('Hitch chat error:', e);
    res.status(500).json({ error: 'Hitch is taking a nap. Try again in a moment! 🦄' });
  }
});

export default router;

// POST /api/hitch/packing-suggestions
router.post('/packing-suggestions', async (req: any, res) => {
  try {
    const { destination, startDate, endDate, groupSize, rvType, interests = [] } = req.body;
    const nights = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 3;

    const prompt = `You are an expert RV packer. Generate a practical packing list for an RV trip.
Trip details:
- Destination: ${destination || 'unknown'}
- Duration: ${nights} nights
- Group size: ${groupSize || 2} people
- RV type: ${rvType || 'Class C motorhome'}
- Interests: ${interests.join(', ') || 'general camping'}

Return ONLY valid JSON in this exact format, no markdown, no extra text:
{
  "categories": [
    {
      "name": "Kitchen & Food",
      "icon": "🍳",
      "items": ["Cast iron skillet", "Propane stove backup", "S'mores kit"]
    }
  ]
}

Include 6-8 categories like: Kitchen & Food, Bedding & Comfort, Clothing, Safety & Tools, Entertainment, Hygiene, Documents & Tech, Kids/Pets (if relevant).
Each category should have 4-8 specific, practical items. Be specific to RV travel, not generic camping.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    res.json(data);
  } catch (e: any) {
    console.error('Packing suggestions error:', e);
    res.status(500).json({ error: 'Failed to generate packing list' });
  }
});

// POST /api/hitch/meal-suggestions
router.post('/meal-suggestions', async (req: any, res) => {
  try {
    const { destination, nights, groupSize, dietaryPreferences = [], interests = [] } = req.body;

    const prompt = `You are a campfire cooking expert for RV travelers. Generate a meal plan.
Trip details:
- Destination: ${destination || 'campground'}
- Duration: ${nights || 3} nights
- Group size: ${groupSize || 2} people
- Dietary preferences: ${dietaryPreferences.join(', ') || 'none'}

Return ONLY valid JSON in this exact format, no markdown:
{
  "meals": [
    {
      "day": 1,
      "breakfast": { "name": "Campfire Pancakes", "description": "Fluffy pancakes on the griddle", "prepTime": "15 min", "difficulty": "Easy" },
      "lunch": { "name": "Trail Mix Wraps", "description": "Quick wraps with deli meat", "prepTime": "5 min", "difficulty": "Easy" },
      "dinner": { "name": "Foil Packet Chicken", "description": "Chicken with veggies in foil over fire", "prepTime": "30 min", "difficulty": "Medium" },
      "snacks": ["S'mores", "Campfire popcorn"]
    }
  ],
  "shoppingTips": ["Buy pre-cut veggies to save prep time", "Bring a cooler organizer"],
  "cookingTips": ["Pre-marinate meats at home", "Use foil packets for easy cleanup"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    res.json(data);
  } catch (e: any) {
    console.error('Meal suggestions error:', e);
    res.status(500).json({ error: 'Failed to generate meal plan' });
  }
});

// POST /api/hitch/trip-summary
router.post('/trip-summary', async (req: any, res) => {
  try {
    const { eventTitle, campgroundName, startDate, endDate, attendeeCount, activities = [], meals = [], photos = 0 } = req.body;
    const nights = startDate && endDate
      ? Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 1;

    const prompt = `Write a fun, enthusiastic trip recap for an RV camping trip. Make it shareable and exciting.
Trip details:
- Title: ${eventTitle}
- Location: ${campgroundName || 'a great campground'}
- Duration: ${nights} nights
- People: ${attendeeCount} people
- Activities: ${activities.join(', ') || 'camping, relaxing'}
- Meals: ${meals.join(', ') || 'campfire cooking'}
- Photos taken: ${photos}

Write a 3-4 paragraph recap in first person plural ("We..."). Be warm, fun, and capture the spirit of RV camping. Include specific details from the trip info. End with a teaser for the next adventure. Keep it under 250 words.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const summary = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ summary });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate trip summary' });
  }
});

// POST /api/hitch/photo-caption
router.post('/photo-caption', async (req: any, res) => {
  try {
    const { campgroundName, location, tripTitle, context } = req.body;

    const prompt = `Generate 3 fun, creative photo captions for an RV camping trip photo.
Context:
- Campground: ${campgroundName || 'a beautiful campground'}
- Location: ${location || 'somewhere amazing'}
- Trip: ${tripTitle || 'camping adventure'}
- Additional context: ${context || 'general camping photo'}

Return ONLY valid JSON, no markdown:
{
  "captions": [
    "Life is better around a campfire 🔥",
    "Found our happy place 🏕️",
    "Home is wherever we park it 🚐"
  ]
}

Make captions fun, shareable, and RV/camping themed. Mix emojis naturally. Vary the tone - one heartfelt, one funny, one adventurous.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    res.json(data);
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to generate captions' });
  }
});

// POST /api/hitch/find-similar-campground
router.post('/find-similar-campground', async (req: any, res) => {
  try {
    const { campgroundName, targetState, preferences = [] } = req.body;

    // Search for campgrounds in target state
    const campgrounds = await prisma.campground.findMany({
      where: {
        state: { contains: targetState, mode: 'insensitive' },
        isApproved: true,
      },
      select: {
        id: true, name: true, description: true, state: true,
        city: true, rating: true, amenities: true,
      },
      take: 20,
      orderBy: { rating: 'desc' },
    });

    if (campgrounds.length === 0) {
      return res.json({ matches: [], message: `No campgrounds found in ${targetState} yet.` });
    }

    const campgroundList = campgrounds.map((c, i) =>
      `${i + 1}. ${c.name} in ${c.city}, ${c.state} (rating: ${c.rating || 'unrated'})`
    ).join('\n');

    const prompt = `A user loves "${campgroundName}" and wants similar campgrounds in ${targetState}.
User preferences: ${preferences.join(', ') || 'similar vibe and amenities'}

Available campgrounds in ${targetState}:
${campgroundList}

Return ONLY valid JSON, no markdown:
{
  "matches": [
    { "index": 1, "reason": "Similar wooded setting with full hookups" },
    { "index": 3, "reason": "Great for families with similar amenities" }
  ],
  "tip": "Pro tip about camping in this state"
}

Pick the top 3 best matches and explain why each is similar. Be specific.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 400,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const aiData = JSON.parse(clean);

    const matches = (aiData.matches || []).map((m: any) => ({
      campground: campgrounds[m.index - 1],
      reason: m.reason,
    })).filter((m: any) => m.campground);

    res.json({ matches, tip: aiData.tip });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to find similar campgrounds' });
  }
});

// POST /api/hitch/enrich-campground
router.post('/enrich-campground', async (req: any, res) => {
  try {
    const { campgroundId } = req.body;
    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: { id: true, name: true, description: true, state: true, city: true, amenities: true }
    });
    if (!campground) return res.status(404).json({ error: 'Not found' });

    const prompt = `Write a compelling, accurate campground description for RV travelers.
Campground: ${campground.name}
Location: ${campground.city}, ${campground.state}
Known amenities: ${JSON.stringify(campground.amenities || {})}
Existing description: ${campground.description || 'none'}

Write a 2-3 sentence description that highlights what makes this campground special for RV travelers.
Focus on: location highlights, best features, ideal visitor type.
Be specific to the location. Do not make up specific details not implied by the name/location.
Return only the description text, no quotes, no markdown.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 200,
      messages: [{ role: 'user', content: prompt }],
    });

    const description = response.content[0].type === 'text' ? response.content[0].text.trim() : '';

    // Save to DB
    await prisma.campground.update({
      where: { id: campgroundId },
      data: { description }
    });

    res.json({ description });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to enrich campground' });
  }
});
