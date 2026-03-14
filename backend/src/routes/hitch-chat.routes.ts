import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import Anthropic from '@anthropic-ai/sdk';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient();
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// POST /api/hitch/chat
router.post('/chat', async (req: any, res) => {
  try {
    const { message, history = [], userContext } = req.body;

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
        select: { id: true, name: true, location: true, state: true, imageUrl: true, googleRating: true, city: true },
        take: 3,
      });
      if (campgrounds.length > 0) {
        contextData += `\nNearby campgrounds: ${campgrounds.map(c => `${c.name} in ${c.state}`).join(', ')}`;
        suggestions.push(...campgrounds.map(c => ({
          type: 'campground', id: c.id, name: c.name,
          location: [c.city, c.state].filter(Boolean).join(', '),
          rating: c.googleRating, icon: '🏕️'
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

    // Build user context string
    let userContextStr = '';
    if (userContext?.name) {
      userContextStr += `\nUser: ${userContext.name} (@${userContext.username})`;
      if (userContext.homeState) userContextStr += `, home state: ${userContext.homeState}`;
      if (userContext.rv?.type) userContextStr += `\nRV: ${userContext.rv.year || ''} ${userContext.rv.make || ''} ${userContext.rv.model || ''} ${userContext.rv.type || ''} (${userContext.rv.length || '?'}ft, ${userContext.rv.fuelType || 'gas'})`;
      if (userContext.interests?.length) userContextStr += `\nCamping interests: ${userContext.interests.join(', ')}`;
      if (userContext.badges?.earned?.length) userContextStr += `\nBadges earned (${userContext.badges.totalEarned}): ${userContext.badges.earned.slice(0,5).join(', ')}`;
      if (userContext.badges?.suggestions?.length) userContextStr += `\nBadges they haven't earned yet: ${userContext.badges.suggestions.map((b: any) => b.name).join(', ')}`;
      if (userContext.visitedStates?.length) userContextStr += `\nStates visited: ${userContext.visitedStates.join(', ')}`;
      if (userContext.upcomingTrips?.length) userContextStr += `\nUpcoming trips: ${userContext.upcomingTrips.map((t: any) => t.title).join(', ')}`;
      if (userContext.similarUsers?.length) userContextStr += `\nUsers with similar camping interests: ${userContext.similarUsers.map((u: any) => `@${u.username} (shares: ${u.sharedInterests?.join(', ')})`).join(', ')}`;
      if (userContext.popularTrips?.length) userContextStr += `\nMost popular public trips: ${userContext.popularTrips.map((t: any) => `"${t.title}" at ${t.campground || 'TBD'} by @${t.organizer} (${t.attendeeCount} attendees)`).join('; ')}`;
      if (userContext.topCampgrounds?.length) userContextStr += `\nMost favorited campgrounds on RVUnicorn: ${userContext.topCampgrounds.map((c: any) => `${c.name} in ${c.location} (${c.followers} followers, ${c.reviews} reviews)`).join(', ')}`;
      if (userContext.friends?.length) userContextStr += `\nUser's friends: ${userContext.friends.map((f: any) => `@${f.username}`).join(', ')}`;
      if (userContext.friendTrips?.length) userContextStr += `\nFriends' upcoming trips: ${userContext.friendTrips.map((t: any) => `@${t.organizer} is going to "${t.title}" at ${t.campground || 'TBD'} on ${new Date(t.startDate).toLocaleDateString()}`).join('; ')}`;
      if (userContext.friendCheckIns?.length) userContextStr += `\nFriends currently checked in: ${userContext.friendCheckIns.map((c: any) => `${c.user} is at ${c.location}`).join(', ')}`;
    }

    const systemPrompt = `You are Hitch, RVUnicorn's friendly AI travel companion for RV enthusiasts. You help users:
- Plan RV routes with overnight stops
- Find campgrounds, RV parks, and free overnight spots
- Discover unique host locations (wineries, farms, breweries) that welcome RVers
- Get RV-specific travel tips (road restrictions, height limits, hookups, dump stations)
- Answer personal questions about the user's badges, trips, and fellow campers
- Suggest trips other users have planned that they might enjoy
- Help with fuel planning based on RV type and distance

Your personality: enthusiastic, knowledgeable about RV travel, friendly, and a little playful. Use camping/RV metaphors occasionally.

Platform context: You have access to RVUnicorn's database of 24,000+ campgrounds, harvest host locations, and free overnight spots.
${userContextStr ? `\nPersonal context for this user:${userContextStr}` : ''}
${contextData ? `\nRelevant locations found: ${contextData}` : ''}

For fuel questions: estimate based on RV type (Class A: 7-10mpg, Class B: 18-25mpg, Class C: 10-15mpg, Travel Trailer: depends on tow vehicle 10-15mpg). Ask for tank size if needed.
For travel time questions: estimate average RV travel speed of 55-60mph, add 15-20% for stops/traffic.

Keep responses helpful and specific. Reference the user by name when you have it. If they ask about their badges, trips, or similar users, use the context provided. Always end with an actionable suggestion.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
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
    console.error('Hitch chat error:', e?.message, e?.status, e?.error);
    res.status(500).json({ error: e?.message || 'Hitch chat failed', details: e?.status });
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
      model: 'claude-sonnet-4-6',
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
      model: 'claude-sonnet-4-6',
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
      model: 'claude-sonnet-4-6',
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
      model: 'claude-sonnet-4-6',
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
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true, name: true, description: true, state: true,
        city: true, googleRating: true, amenities: true,
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
      model: 'claude-sonnet-4-6',
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
      model: 'claude-sonnet-4-6',
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

// GET /api/hitch/user-context - Get current user's context for Hitch
router.get('/user-context', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) return res.json({});

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        firstName: true,
        username: true,
        state: true,
        campingInterests: true,
        rvType: true,
        rvLength: true,
        rvMake: true,
        rvModel: true,
        rvYear: true,
        rvFuelType: true,
        badges: {
          include: { badge: { select: { name: true, category: true } } },
          take: 20,
        },
      }
    });

    if (!user) return res.json({});

    // Get user's upcoming trips
    const trips = await prisma.event.findMany({
      where: { organizerId: userId, startDate: { gte: new Date() } },
      select: { id: true, title: true, startDate: true, campground: { select: { name: true, state: true } } },
      take: 5,
      orderBy: { startDate: 'asc' },
    });

    // Get user's visited states
    const stateVisits = await prisma.stateVisit.findMany({
      where: { userId },
      select: { state: true },
      take: 20,
    });

    // Get all badges for suggestions
    const allBadges = await prisma.badge.findMany({
      where: { isActive: true },
      select: { id: true, name: true, description: true, category: true },
      take: 30,
    });

    const earnedBadgeIds = new Set(user.userBadges.map((ub: any) => ub.badge.name));
    const unearnedBadges = allBadges.filter(b => !earnedBadgeIds.has(b.name)).slice(0, 8);

    // Get users with similar interests
    const similarUsers = user.campingInterests?.length > 0
      ? await prisma.user.findMany({
          where: {
            id: { not: userId },
            campingInterests: { hasSome: (user.campingInterests as string[]) },
          },
          select: { username: true, firstName: true, campingInterests: true, state: true },
          take: 5,
        })
      : [];

    // Get popular public trips
    const popularTrips = await prisma.event.findMany({
      where: {
        privacy: 'PUBLIC',
        organizerId: { not: userId },
        startDate: { gte: new Date() },
      },
      select: {
        id: true, title: true, startDate: true,
        campground: { select: { name: true, state: true } },
        organizer: { select: { username: true } },
        attendees: { select: { id: true } },
      },
      orderBy: { attendees: { _count: 'desc' } },
      take: 5,
    });

    // Get most favorited/followed campgrounds
    const topCampgrounds = await prisma.campground.findMany({
      select: {
        id: true, name: true, state: true, city: true, imageUrl: true,
        _count: { select: { followers: true, reviews: true, wishlists: true } }
      },
      orderBy: { followers: { _count: 'desc' } },
      take: 10,
    });

    // Get friends (people the user follows)
    const following = await prisma.friendship.findMany({
      where: { senderId: userId, status: 'ACCEPTED' },
      select: { receiver: { select: { id: true, username: true, firstName: true } } },
      take: 20,
    }).catch(() => []);

    const friendIds = following.map((f: any) => (f.receiver || f.recipient)?.id).filter(Boolean);

    // Get friends' upcoming trips
    const friendTrips = friendIds.length > 0 ? await prisma.event.findMany({
      where: {
        organizerId: { in: friendIds },
        startDate: { gte: new Date() },
        privacy: { not: 'PRIVATE' },
      },
      select: {
        id: true, title: true, startDate: true,
        campground: { select: { name: true, state: true } },
        organizer: { select: { username: true, firstName: true } },
        attendees: { select: { id: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 10,
    }) : [];

    // Get friends' recent check-ins
    const friendCheckIns = friendIds.length > 0 ? await prisma.checkIn.findMany({
      where: {
        userId: { in: friendIds },
        isActive: true,
      },
      include: {
        user: { select: { username: true, firstName: true } },
        campground: { select: { name: true, state: true } },
        harvestHost: { select: { name: true } },
        overnightSpot: { select: { name: true } },
      },
      take: 5,
    }) : [];

    res.json({
      name: user.firstName,
      username: user.username,
      homeState: user.state,
      interests: user.campingInterests || [],
      rv: {
        type: user.rvType,
        length: user.rvLength,
        make: user.rvMake,
        model: user.rvModel,
        year: user.rvYear,
        fuelType: user.rvFuelType,
      },
      badges: {
        earned: ((user as any).badges || []).map((ub: any) => ub.badge?.name).filter(Boolean),
        totalEarned: (user as any).badges?.length || 0,
        suggestions: unearnedBadges.map(b => ({ name: b.name, description: b.description })),
      },
      visitedStates: stateVisits.map(sv => sv.state),
      upcomingTrips: trips,
      similarUsers: similarUsers.map(u => ({
        username: u.username,
        name: u.firstName,
        sharedInterests: (u.campingInterests as string[] || []).filter((i: string) =>
          (user.campingInterests as string[] || []).includes(i)
        ),
      })),
      popularTrips: popularTrips.map(t => ({
        id: t.id,
        title: t.title,
        campground: t.campground?.name,
        state: t.campground?.state,
        organizer: t.organizer.username,
        attendeeCount: t.attendees.length,
        startDate: t.startDate,
      })),
      topCampgrounds: topCampgrounds.map(c => ({
        id: c.id,
        name: c.name,
        location: [c.city, c.state].filter(Boolean).join(', '),
        followers: c._count.followers,
        reviews: c._count.reviews,
        wishlists: c._count.wishlists,
      })),
      friends: following.map((f: any) => { const r = f.receiver || f.recipient; return { username: r?.username, name: r?.firstName }; }).filter((f: any) => f.username),
      friendTrips: friendTrips.map(t => ({
        id: t.id,
        title: t.title,
        campground: t.campground?.name,
        state: t.campground?.state,
        organizer: t.organizer.username,
        organizerName: t.organizer.firstName,
        attendeeCount: t.attendees.length,
        startDate: t.startDate,
      })),
      friendCheckIns: friendCheckIns.map(c => ({
        user: c.user.firstName || c.user.username,
        location: c.campground?.name || (c.harvestHost as any)?.name || (c.overnightSpot as any)?.name,
        type: c.campground ? 'campground' : c.harvestHost ? 'host' : 'spot',
      })),
    });
  } catch (e: any) {
    console.error('User context error:', e.message);
    res.json({});
  }
});

// POST /api/hitch/trip-cost
router.post('/trip-cost', async (req: any, res) => {
  try {
    const { from, to, nights, rvType, tankSize, mpg, fuelPrice, campingFeePerNight, groupSize } = req.body;

    const prompt = `Calculate RV trip cost estimate. Return ONLY valid JSON, no markdown.
Trip: ${from} to ${to}
Nights: ${nights}
RV: ${rvType} (${mpg} mpg, ${tankSize}gal tank)
Fuel price: $${fuelPrice}/gal
Camping fee: $${campingFeePerNight}/night
Group: ${groupSize} people

Estimate driving distance in miles between these two locations.
Then calculate:
- Fuel cost (distance * 2 for round trip / mpg * fuel price)
- Camping fees (nights * fee, range +/-20%)
- Food estimate ($15-25/person/day)
- Activities ($20-60/person for the trip)
- Misc/emergency fund (10% of total)

Return JSON:
{
  "estimatedMiles": 450,
  "fuelMin": 120, "fuelMax": 160,
  "campingMin": 180, "campingMax": 220,
  "foodMin": 90, "foodMax": 150,
  "activitiesMin": 40, "activitiesMax": 120,
  "miscMin": 50, "miscMax": 80,
  "totalMin": 480, "totalMax": 730,
  "tips": ["Book campgrounds in advance for discounts", "Use GasBuddy to find cheapest fuel along route"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const data = JSON.parse(clean);
    res.json(data);
  } catch (e: any) {
    console.error('Trip cost error:', e);
    res.status(500).json({ error: 'Failed to calculate trip cost' });
  }
});

// POST /api/hitch/campground-chat
router.post('/campground-chat', async (req: any, res) => {
  try {
    const { message, campgroundId, campgroundName, campground, history = [], userContext } = req.body;

    // Get reviews for this campground
    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: { rating: true, content: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }).catch(() => []);

    const avgRating = reviews.length
      ? (reviews.reduce((a, r) => a + r.rating, 0) / reviews.length).toFixed(1)
      : null;

    const reviewSummary = reviews.length > 0
      ? reviews.slice(0, 8).map(r => `${r.rating}★: ${r.content?.substring(0, 100) || 'No comment'}`).join('\n')
      : 'No reviews yet';

    // Build user RV context
    let rvContext = '';
    if (userContext?.rv?.type) {
      rvContext = `User's RV: ${userContext.rv.year || ''} ${userContext.rv.make || ''} ${userContext.rv.type} (${userContext.rv.length || '?'}ft)`;
    }

    const systemPrompt = `You are Hitch, RVUnicorn's AI camping expert. You are answering questions specifically about ${campgroundName}.

Campground Data:
- Location: ${campground.city}, ${campground.state}
- Max RV Length: ${campground.maxRvLength || 'Unknown'}ft
- Electric Hookups: ${campground.hasElectricHookup ? 'Yes' : 'No'}
- Water Hookups: ${campground.hasWaterHookup ? 'Yes' : 'No'}
- Sewer Hookups: ${campground.hasSewerHookup ? 'Yes' : 'No'}
- WiFi: ${campground.hasWifi ? 'Yes' : 'No'}
- Pet Friendly: ${campground.isPetFriendly ? 'Yes' : 'No'}
- Big Rig Friendly: ${campground.isBigRigFriendly ? 'Yes' : 'No'}
- Price: ${campground.pricePerNight ? '$' + campground.pricePerNight + '/night' : 'Unknown'}
- Google Rating: ${campground.googleRating || 'N/A'} (${campground.googleReviewCount || 0} reviews)
- Description: ${campground.description || 'No description available'}

RVUnicorn Community Reviews (${reviews.length} total, avg ${avgRating || 'N/A'}★):
${reviewSummary}

${rvContext ? `\n${rvContext}` : ''}
${userContext?.name ? `\nUser: ${userContext.name}` : ''}

Answer questions about this specific campground. Be honest about limitations in the data. 
If asked about RV compatibility, compare with the user's RV specs if available.
Label facts vs community insights vs your suggestions clearly.
Keep responses concise and helpful. Use emojis sparingly.`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      system: systemPrompt,
      messages: [
        ...history.slice(-4).map((m: any) => ({ role: m.role, content: m.content })),
        { role: 'user', content: message }
      ],
    });

    const aiMessage = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ message: aiMessage, suggestions: [] });
  } catch (e: any) {
    console.error('Campground chat error:', e?.message);
    res.status(500).json({ error: 'Failed to get answer' });
  }
});


// POST /api/hitch/analyze-campground
// Generates vibe label, review insights, rig stress score, and personality
router.post('/analyze-campground', async (req: any, res) => {
  try {
    const { campgroundId } = req.body;

    const campground = await prisma.campground.findUnique({
      where: { id: campgroundId },
      select: {
        id: true, name: true, description: true, state: true, city: true,
        maxRvLength: true, hasElectricHookup: true, hasWifi: true,
        isPetFriendly: true, isBigRigFriendly: true, pricePerNight: true,
        hasPool: true, hasShowers: true, hasRestrooms: true,
        isWaterfront: true, googleRating: true,
      }
    });

    if (!campground) return res.status(404).json({ error: 'Not found' });

    const reviews = await prisma.campgroundReview.findMany({
      where: { campgroundId },
      select: { rating: true, content: true },
      take: 30,
    }).catch(() => []);

    const reviewText = reviews.map(r => r.content).filter(Boolean).join(' ');
    const avgRating = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : null;

    const prompt = `Analyze this campground and return ONLY valid JSON, no markdown.

Campground: ${campground.name}
Location: ${campground.city}, ${campground.state}
Max RV Length: ${campground.maxRvLength || 'unknown'}ft
Price: ${campground.pricePerNight ? '$' + campground.pricePerNight + '/night' : 'unknown'}
Big Rig Friendly: ${campground.isBigRigFriendly}
Waterfront: ${campground.isWaterfront}
Pet Friendly: ${campground.isPetFriendly}
Pool: ${campground.hasPool}
Avg Rating: ${avgRating?.toFixed(1) || 'N/A'}
Review excerpts: ${reviewText.substring(0, 500) || 'No reviews'}

Return JSON:
{
  "vibeLabel": "Peaceful Retreat",
  "vibeEmoji": "🧘",
  "vibeDescription": "A quiet escape for couples and solo travelers seeking nature",
  "personalityTags": ["Quiet", "Nature Lover", "Off the Beaten Path"],
  "insights": {
    "quiet": "high",
    "familyFriendly": "medium", 
    "bigRigFriendly": "low",
    "scenic": "high",
    "petFriendly": "high",
    "valueForMoney": "medium"
  },
  "rigStressScore": 3,
  "rigStressReason": "Narrow entrance road may be tight for rigs over 35ft",
  "hiddenGem": false,
  "bestFor": ["Couples", "Nature lovers", "Weekend getaways"],
  "communityInsight": "Reviewers consistently praise the peaceful atmosphere and scenic views. A few mention the WiFi is unreliable.",
  "bookingTip": "Book at least 3 weeks in advance for summer weekends"
}

rigStressScore: 1=easy, 5=very difficult. vibeLabel options: Peaceful Retreat, Weekend Warrior Hangout, Adventure Basecamp, Family Fun Zone, Wine Country Escape, Boondocking Paradise, Luxury RV Resort, Hidden Gem, Social Hub, Nature Sanctuary`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 600,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(clean);

    // Cache in DB
    await prisma.campground.update({
      where: { id: campgroundId },
      data: {
        description: analysis.communityInsight || campground.description,
      }
    }).catch(() => null);

    res.json(analysis);
  } catch (e: any) {
    console.error('Analyze campground error:', e?.message);
    res.status(500).json({ error: 'Failed to analyze campground' });
  }
});

// POST /api/hitch/feedback - Log user feedback on Hitch responses
router.post('/feedback', async (req: any, res) => {
  try {
    const userId = req.user?.id;
    const { messageId, rating, question, answer, action } = req.body;
    // Store in notifications table as a feedback record for now
    // action can be: 'thumbs_up', 'thumbs_down', 'saved_campground', 'created_trip', 'viewed_campground'
    await prisma.notification.create({
      data: {
        userId: userId || 'anonymous',
        type: 'HITCH_FEEDBACK',
        content: JSON.stringify({ rating, question: question?.substring(0, 100), action }),
        link: '/hitch',
      }
    }).catch(() => null);
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to log feedback' });
  }
});


// GET /api/hitch/hidden-gems?state=&interests=
// Find under-discovered campgrounds with high satisfaction
router.get('/hidden-gems', async (req: any, res) => {
  try {
    const { state, limit = 10 } = req.query;

    // Find campgrounds with high ratings but low follower counts (hidden gems)
    const campgrounds = await prisma.campground.findMany({
      where: {
        ...(state ? { state: { contains: state as string, mode: 'insensitive' } } : {}),
        googleRating: { gte: 4.2 },
        verificationStatus: 'VERIFIED',
      },
      select: {
        id: true, name: true, state: true, city: true, imageUrl: true,
        googleRating: true, googleReviewCount: true, maxRvLength: true,
        isPetFriendly: true, isBigRigFriendly: true, pricePerNight: true,
        description: true, city: true,
        _count: { select: { followers: true, reviews: true } }
      },
      orderBy: { googleRating: 'desc' },
      take: 50,
    });

    // Score each campground: high rating + low followers = hidden gem
    const scored = campgrounds
      .map(c => ({
        ...c,
        gemScore: ((c as any).googleRating || 0) * 20 - Math.log(Math.max(c._count.followers + 1, 1)) * 5,
      }))
      .sort((a, b) => b.gemScore - a.gemScore)
      .slice(0, parseInt(limit as string));

    // Use AI to add personality to top gems
    if (scored.length > 0) {
      const prompt = `These are hidden gem campgrounds (high rated but not widely discovered).
Write a one-line "why it's special" for each. Return ONLY valid JSON:
{
  "gems": [
    { "index": 0, "tagline": "A secret riverside escape that regulars keep to themselves" }
  ]
}
Campgrounds:
${scored.slice(0, 5).map((c, i) => `${i}. ${c.name} in ${c.city}, ${c.state} (${c.googleRating}★, ${c._count.followers} followers)`).join('\n')}`;

      try {
        const response = await anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }],
        });
        const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
        const aiData = JSON.parse(text.replace(/```json|```/g, '').trim());
        aiData.gems?.forEach((g: any) => {
          if (scored[g.index]) (scored[g.index] as any).tagline = g.tagline;
        });
      } catch {}
    }

    res.json({ gems: scored });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/hitch/trust-score/:userId
// Calculate community trust score for a reviewer
router.get('/trust-score/:userId', async (req: any, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        createdAt: true,
        campgroundReviews: { select: { rating: true, content: true } },
        checkIns: { select: { id: true } },
        _count: { select: { events: true, friends: true } }
      }
    });

    if (!user) return res.status(404).json({ error: 'Not found' });

    const reviewCount = user.campgroundReviews.length;
    const verifiedStays = user.checkIns.length;
    const accountAgeDays = Math.floor((Date.now() - new Date(user.createdAt).getTime()) / 86400000);
    const hasRelevantBadges = false; // simplified

    // Score components (0-100)
    const reviewScore = Math.min(reviewCount * 5, 30);
    const stayScore = Math.min(verifiedStays * 8, 30);
    const ageScore = Math.min(accountAgeDays / 10, 20);
    const badgeScore = hasRelevantBadges ? 10 : 0;
    const socialScore = Math.min((user._count.friends || 0) * 2, 10);

    const totalScore = Math.round(reviewScore + stayScore + ageScore + badgeScore + socialScore);

    const level = totalScore >= 80 ? 'Expert Camper' :
                  totalScore >= 60 ? 'Experienced Camper' :
                  totalScore >= 40 ? 'Regular Camper' :
                  totalScore >= 20 ? 'New Camper' : 'Beginner';

    res.json({
      score: totalScore,
      level,
      components: { reviews: reviewScore, verifiedStays: stayScore, accountAge: ageScore, badges: badgeScore, social: socialScore },
      reviewCount, verifiedStays,
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});


// POST /api/hitch/route-suggestions
// Suggest overnight stops along a route
router.post('/route-suggestions', async (req: any, res) => {
  try {
    const { origin, destination, rvLength, rvType, interests = [], maxDriveHours = 6 } = req.body;

    // Estimate route states based on origin/destination
    const prompt = `Plan an RV route with overnight stops.
Origin: ${origin}
Destination: ${destination}
RV: ${rvLength || 35}ft ${rvType || 'Class C'}
Max driving per day: ${maxDriveHours} hours
Interests: ${interests.join(', ') || 'general camping'}

Return ONLY valid JSON:
{
  "totalDays": 3,
  "totalMiles": 850,
  "stops": [
    {
      "day": 1,
      "city": "Nashville, TN",
      "state": "TN",
      "drivingHours": 4.5,
      "drivingMiles": 280,
      "suggestion": "Great overnight spot here",
      "spotType": "campground",
      "searchQuery": "RV park Nashville Tennessee"
    }
  ],
  "tips": ["Avoid I-40 on Friday afternoons", "Great BBQ in Memphis on Day 2"]
}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 800,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}';
    const clean = text.replace(/```json|```/g, '').trim();
    const routeData = JSON.parse(clean);

    // For each stop, find real campgrounds in that state
    const enrichedStops = await Promise.all((routeData.stops || []).map(async (stop: any) => {
      const campgrounds = await prisma.campground.findMany({
        where: {
          state: { contains: stop.state, mode: 'insensitive' },
          ...(rvLength ? { maxRvLength: { gte: parseInt(String(rvLength)) - 5 } } : {}),
          isApproved: true,
        },
        select: { id: true, name: true, city: true, state: true, imageUrl: true, googleRating: true, pricePerNight: true },
        orderBy: { googleRating: 'desc' },
        take: 3,
      });

      // Also find free overnight spots
      const freeSpots = await prisma.freeOvernightSpot.findMany({
        where: { state: { contains: stop.state, mode: 'insensitive' }, allowsRvs: true },
        select: { id: true, name: true, category: true, city: true, state: true },
        take: 2,
      });

      return { ...stop, campgrounds, freeSpots };
    }));

    res.json({ ...routeData, stops: enrichedStops });
  } catch (e: any) {
    console.error('Route suggestions error:', e?.message);
    res.status(500).json({ error: 'Failed to plan route' });
  }
});

// POST /api/hitch/basecamp-question
// Answer a question posted in the basecamp feed
router.post('/basecamp-question', async (req: any, res) => {
  try {
    const { question, context } = req.body;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 400,
      system: `You are Hitch, RVUnicorn's AI camping expert. You're answering a question posted in the community feed.
Be helpful, friendly, and concise. Keep answers under 150 words.
Always suggest the user check the campground directly for the most current info.
Context: ${context || 'General camping question'}`,
      messages: [{ role: 'user', content: question }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text : '';
    res.json({ answer });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to answer' });
  }
});
