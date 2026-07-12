import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { FRONTEND_URL } from '../utils/frontendUrl';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/trip-story/:eventId/public - Full public story page data
router.get('/:eventId/public', async (req, res) => {
  try {
    const { eventId } = req.params;
    const [story, event] = await Promise.all([
      prisma.tripStory.findUnique({ where: { eventId } }),
      prisma.event.findUnique({
        where: { id: eventId },
        select: {
          id: true,
          title: true,
          startDate: true,
          endDate: true,
          campground: { select: { name: true, state: true, location: true } },
          organizer: { select: { firstName: true, lastName: true, username: true, profilePicture: true } },
          attendees: {
            where: { status: { in: ['ATTENDING', 'going', 'GOING'] } },
            select: { user: { select: { firstName: true, profilePicture: true } } },
            take: 8,
          },
          scrapbookPins: {
            include: { photo: { select: { imageUrl: true, caption: true } } },
            orderBy: { position: 'asc' },
            take: 12,
          },
        },
      }),
    ]);
    if (!story || !event) return res.status(404).json({ error: 'Story not found' });
    if (!story.isPublic) return res.status(403).json({ error: 'This story is private' });
    res.json({ story, event });
  } catch (error: any) {
    console.error('Get public story error:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// GET /api/trip-story/:eventId
router.get('/:eventId', async (req, res) => {
  try {
    const story = await prisma.tripStory.findUnique({
      where: { eventId: req.params.eventId },
    });
    res.json(story || null);
  } catch (error: any) {
    console.error('Get trip story error:', error);
    res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// POST /api/trip-story/:eventId/generate
router.post('/:eventId/generate', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const { style = 'narrative' } = req.body;

    // Verify user is organizer or attendee
    const event = await prisma.event.findUnique({
      where: { id: eventId },
      include: {
        campground: { select: { name: true, state: true, location: true } },
        organizer: { select: { firstName: true, lastName: true } },
        attendees: {
          where: { status: { in: ['ATTENDING', 'going', 'GOING'] } },
          include: { user: { select: { firstName: true, lastName: true } } },
        },
        meals: {
          include: { recipe: { select: { title: true } } },
          orderBy: { scheduledAt: 'asc' },
        },
        eventActivities: {
          select: { title: true, description: true },
          take: 20,
        },
        scrapbookPins: {
          include: {
            photo: { select: { caption: true } },
            pinnedBy: { select: { firstName: true } },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!event) return res.status(404).json({ error: 'Trip not found' });

    // Allow organizer, any attendee (regardless of filtered status), or past trips
    const isOrganizer = event.organizerId === userId;
    const isAttendee = event.attendees.some((a: any) => a.userId === userId);
    if (!isOrganizer && !isAttendee) {
      // Check if user has ANY attendee record (status might not match filter)
      const anyAttendee = await prisma.eventAttendee.findFirst({ where: { eventId, userId } });
      const isPast = event.endDate ? new Date(event.endDate) < new Date() : event.startDate ? new Date(event.startDate) < new Date() : false;
      if (!anyAttendee && !isPast) return res.status(403).json({ error: 'Must be a trip attendee' });
    }

    // Fetch wildlife sightings if campground exists
    let wildlife: any[] = [];
    if (event.campgroundId) {
      wildlife = await prisma.wildlifeSighting.findMany({
        where: { campgroundId: event.campgroundId },
        select: { animal: true, emoji: true, description: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    }

    // Build context for Claude
    const startDate = new Date(event.startDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const endDate = event.endDate ? new Date(event.endDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
    const duration = event.endDate
      ? Math.ceil((new Date(event.endDate).getTime() - new Date(event.startDate).getTime()) / (1000 * 60 * 60 * 24))
      : 1;

    const attendeeNames = event.attendees.map((a: any) => a.user.firstName).join(', ');
    const mealHighlights = event.meals
      .filter((m: any) => m.recipe)
      .map((m: any) => m.recipe!.title)
      .slice(0, 5)
      .join(', ');
    const activities = event.eventActivities
      .map((a: any) => a.title || a.description)
      .filter(Boolean)
      .slice(0, 8)
      .join(', ');
    const wildlifeList = wildlife.map(w => `${w.emoji} ${w.animal}`).join(', ');
    const scrapbookCaptions = event.scrapbookPins
      .filter((p: any) => p.caption)
      .map((p: any) => `"${p.caption}" — ${p.pinnedBy.firstName}`)
      .join('\n');
    const pinCount = event.scrapbookPins.length;

    const styleInstructions: Record<string, string> = {
      narrative: 'Write in warm, first-person plural narrative style ("We woke up to...", "The campfire crackled as..."). Make it feel like a personal travel journal entry.',
      postcard: 'Write as a series of short, vivid postcard-style paragraphs. Each one captures a single moment. Keep it punchy and evocative.',
      funny: 'Write with humor and lightness. Include jokes about RV life, campsite mishaps, and the quirks of road tripping. Keep it affectionate, not mean.',
    };

    const prompt = `You are writing a trip story for a group of RV campers. Here is the trip data:

TRIP: ${event.title}
DATES: ${startDate}${endDate ? ` to ${endDate}` : ''} (${duration} day${duration !== 1 ? 's' : ''})
LOCATION: ${event.campground ? `${event.campground.name}, ${event.campground.state || event.campground.location}` : event.location || 'Unknown'}
ORGANIZER: ${event.organizer.firstName} ${event.organizer.lastName}
TRAVELERS: ${attendeeNames || 'Solo trip'}
${mealHighlights ? `MEALS ENJOYED: ${mealHighlights}` : ''}
${activities ? `ACTIVITIES: ${activities}` : ''}
${wildlifeList ? `WILDLIFE SPOTTED: ${wildlifeList}` : ''}
${pinCount > 0 ? `SCRAPBOOK: ${pinCount} photos were pinned as favorites` : ''}
${scrapbookCaptions ? `PHOTO CAPTIONS FROM THE TRIP:\n${scrapbookCaptions}` : ''}

WRITING STYLE: ${styleInstructions[style] || styleInstructions.narrative}

Write a 3-5 paragraph trip story (250-400 words). Do not use headers or bullet points. Just flowing prose. End with a memorable closing line.`;

    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY || '',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) throw new Error(`Claude API error: ${response.status}`);
    const aiData: any = await response.json() as any;
    const content = aiData.content?.[0]?.text || '';
    if (!content) throw new Error('No content returned from Claude');

    // Upsert story
    const story = await prisma.tripStory.upsert({
      where: { eventId },
      create: { eventId, content, style },
      update: { content, style, generatedAt: new Date() },
    });

    res.json(story);
  } catch (error: any) {
    console.error('Generate trip story error:', error);
    res.status(500).json({ error: 'Failed to generate story' });
  }
});

// DELETE /api/trip-story/:eventId
router.delete('/:eventId', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;
    const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
    if (event?.organizerId !== userId) return res.status(403).json({ error: 'Only the organizer can delete the story' });
    await prisma.tripStory.delete({ where: { eventId } });
    res.json({ message: 'Story deleted' });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to delete story' });
  }
});

// POST /api/trip-story/:eventId/share-to-feed
router.post('/:eventId/share-to-feed', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { eventId } = req.params;

    const [story, event] = await Promise.all([
      prisma.tripStory.findUnique({ where: { eventId } }),
      prisma.event.findUnique({
        where: { id: eventId },
        select: { title: true, campground: { select: { name: true, state: true } }, organizerId: true },
      }),
    ]);

    if (!story || !event) return res.status(404).json({ error: 'Story not found' });
    if (event.organizerId !== userId) return res.status(403).json({ error: 'Only the organizer can share' });

    // Find trip-reports board
    const board = await (prisma as any).board.findUnique({ where: { slug: 'trip-reports' } });
    if (!board) return res.status(404).json({ error: 'Trip Reports board not found' });

    const location = event.campground
      ? `${event.campground.name}${event.campground.state ? ', ' + event.campground.state : ''}`
      : 'the open road';

    // Create a teaser (first 300 chars of story)
    const teaser = story.content.slice(0, 300).trim() + (story.content.length > 300 ? '...' : '');
    const storyUrl = `${FRONTEND_URL}/trips/${eventId}/story`;

    const post = await (prisma as any).boardPost.create({
      data: {
        boardId: board.id,
        authorId: userId,
        title: `Trip Report: ${event.title}`,
        body: `${teaser}

[Read the full story →](${storyUrl})`,
        postType: 'TRIP_REPORT',
        tags: ['trip-story', location.toLowerCase().replace(/[^a-z0-9]+/g, '-')],
      },
      include: {
        author: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
        board: { select: { id: true, name: true, slug: true } },
      },
    });

    await (prisma as any).board.update({ where: { id: board.id }, data: { postCount: { increment: 1 } } });

    res.json({ post, boardSlug: 'trip-reports' });
  } catch (error: any) {
    console.error('Share to feed error:', error);
    res.status(500).json({ error: 'Failed to share story' });
  }
});


export default router;