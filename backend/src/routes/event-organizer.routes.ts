import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import multer from 'multer';
import crypto from 'crypto';

const router = Router();
import { prisma } from '../lib/prisma';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// ── Helpers ─────────────────────────────────────────────────────
async function isOrganizer(eventId: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { organizerId: true } });
  return event?.organizerId === userId;
}

// ── BLAST NOTIFICATIONS ─────────────────────────────────────────

router.post('/:id/blast', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    const { message, isEmergency } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'Message required' });

    const attendees = await prisma.eventAttendee.findMany({
      where: {
        eventId: req.params.id,
        ...(isEmergency ? {} : { participationMode: { in: ['FULL', 'CASUAL'] } }),
      },
      select: { userId: true },
    });

    const blast = await prisma.eventBlast.create({
      data: { eventId: req.params.id, authorId: req.userId, message: message.trim(), isEmergency: !!isEmergency, recipientCount: attendees.length },
    });

    for (const a of attendees) {
      await prisma.notification.create({
        data: {
          userId: a.userId,
          type: isEmergency ? 'EVENT_BLAST_EMERGENCY' : 'EVENT_BLAST',
          title: isEmergency ? '⚠️ Emergency Alert' : '📢 Event Update',
          content: message.trim(),
          link: `/events-v2/${req.params.id}`,
          category: isEmergency ? 'EMERGENCY' : 'SOCIAL',
          actorId: req.userId,
        },
      }).catch(() => {});
    }

    res.json({ blast, recipientCount: attendees.length });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/blasts', authenticateToken, async (req: any, res: Response) => {
  try {
    const blasts = await prisma.eventBlast.findMany({
      where: { eventId: req.params.id },
      include: { author: { select: { firstName: true, profilePicture: true } } },
      orderBy: { sentAt: 'desc' },
      take: 20,
    });
    res.json({ blasts });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── QR CHECK-IN ─────────────────────────────────────────────────

router.post('/:id/generate-qr', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    const qrToken = crypto.randomUUID();
    await prisma.event.update({ where: { id: req.params.id }, data: { qrToken } });
    res.json({ qrToken, qrUrl: `https://rvunicorn.com/checkin/${qrToken}` });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/checkin-scan/:qrToken', authenticateToken, async (req: any, res: Response) => {
  try {
    const event = await prisma.event.findUnique({ where: { qrToken: req.params.qrToken }, select: { id: true, title: true, startDate: true } });
    if (!event) return res.status(404).json({ error: 'Invalid QR code' });

    await prisma.eventAttendee.upsert({
      where: { eventId_userId: { eventId: event.id, userId: req.userId } },
      create: { eventId: event.id, userId: req.userId, status: 'ATTENDING', participationMode: 'FULL' },
      update: {},
    });

    await prisma.eventCheckIn.upsert({
      where: { eventId_userId: { eventId: event.id, userId: req.userId } },
      create: { eventId: event.id, userId: req.userId },
      update: { checkedInAt: new Date() },
    });

    res.json({ event, checkedIn: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/checkin-manual', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    const { userId, siteNumber } = req.body;

    await prisma.eventCheckIn.upsert({
      where: { eventId_userId: { eventId: req.params.id, userId } },
      create: { eventId: req.params.id, userId, checkedInBy: req.userId, siteNumber },
      update: { checkedInBy: req.userId, siteNumber, checkedInAt: new Date() },
    });

    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/checkins', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    const checkins = await prisma.eventCheckIn.findMany({
      where: { eventId: req.params.id },
      include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
      orderBy: { checkedInAt: 'desc' },
    });
    res.json({ checkins });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── LIVE POLLING ────────────────────────────────────────────────

router.post('/:id/polls', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    const { question, options, endsAt } = req.body;
    if (!question || !options?.length) return res.status(400).json({ error: 'Question and options required' });

    const poll = await prisma.eventPoll.create({
      data: { eventId: req.params.id, authorId: req.userId, question, options, endsAt: endsAt ? new Date(endsAt) : null },
    });

    // Notify attendees
    const attendees = await prisma.eventAttendee.findMany({
      where: { eventId: req.params.id, participationMode: { in: ['FULL', 'CASUAL'] } },
      select: { userId: true },
    });
    for (const a of attendees) {
      await prisma.notification.create({
        data: { userId: a.userId, type: 'EVENT_POLL', title: '📊 New Poll', content: question, link: `/events-v2/${req.params.id}`, category: 'SOCIAL', actorId: req.userId },
      }).catch(() => {});
    }

    res.json({ poll });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/polls', authenticateToken, async (req: any, res: Response) => {
  try {
    const polls = await prisma.eventPoll.findMany({
      where: { eventId: req.params.id },
      include: { responses: { select: { userId: true, optionIndex: true } }, _count: { select: { responses: true } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ polls });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/polls/:pollId/respond', authenticateToken, async (req: any, res: Response) => {
  try {
    const { optionIndex } = req.body;
    const poll = await prisma.eventPoll.findUnique({ where: { id: req.params.pollId } });
    if (!poll?.isActive) return res.status(400).json({ error: 'Poll is closed' });

    await prisma.eventPollResponse.upsert({
      where: { pollId_userId: { pollId: req.params.pollId, userId: req.userId } },
      create: { pollId: req.params.pollId, userId: req.userId, optionIndex },
      update: { optionIndex, respondedAt: new Date() },
    });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/:id/polls/:pollId/results', authenticateToken, async (req: any, res: Response) => {
  try {
    const poll = await prisma.eventPoll.findUnique({
      where: { id: req.params.pollId },
      include: { responses: true },
    });
    if (!poll) return res.status(404).json({ error: 'Poll not found' });

    const total = poll.responses.length;
    const options = poll.options.map((text: any, i: any) => {
      const votes = poll.responses.filter((r: any) => r.optionIndex === i).length;
      return { text, votes, percent: total > 0 ? Math.round((votes / total) * 100) : 0 };
    });
    const userResponse = poll.responses.find((r: any) => r.userId === req.userId)?.optionIndex;

    res.json({ question: poll.question, options, totalResponses: total, userResponse: userResponse ?? null, isActive: poll.isActive });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.put('/:id/polls/:pollId/close', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    await prisma.eventPoll.update({ where: { id: req.params.pollId }, data: { isActive: false } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── HITCH FAQ ───────────────────────────────────────────────────

router.post('/:id/hitch-faq', authenticateToken, upload.single('file'), async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    if (!req.file) return res.status(400).json({ error: 'PDF file required' });

    const pdfParse = require('pdf-parse');
    const data = await pdfParse(req.file.buffer);
    const rawText = data.text || '';

    await prisma.eventHitchFAQ.upsert({
      where: { eventId: req.params.id },
      create: { eventId: req.params.id, rawText, fileName: req.file.originalname, uploadedBy: req.userId },
      update: { rawText, fileName: req.file.originalname, uploadedBy: req.userId, uploadedAt: new Date() },
    });

    res.json({ success: true, characterCount: rawText.length, fileName: req.file.originalname });
  } catch { res.status(500).json({ error: 'Failed to process PDF' }); }
});

router.get('/:id/hitch-faq/ask', authenticateToken, async (req: any, res: Response) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Question required' });

    const faq = await prisma.eventHitchFAQ.findUnique({ where: { eventId: req.params.id } });
    if (!faq) return res.json({ answer: null, hasKnowledgeBase: false });

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: `You are Hitch, RVUnicorn's friendly AI campground guide. Answer the camper's question based ONLY on the provided document. If the answer is not in the document, say "I don't have that info in my notes — check with the organizer!" and suggest they look at the schedule or announcements. Keep answers short and friendly.\n\nRALLY FAQ DOCUMENT:\n${faq.rawText.slice(0, 8000)}`,
      messages: [{ role: 'user', content: String(q) }],
    });

    const answer = response.content[0].type === 'text' ? response.content[0].text.trim() : null;
    res.json({ answer, hasKnowledgeBase: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.delete('/:id/hitch-faq', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });
    await prisma.eventHitchFAQ.delete({ where: { eventId: req.params.id } }).catch(() => {});
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── EVENT TEMPLATES ─────────────────────────────────────────────

const SYSTEM_TEMPLATES = [
  { name: "Brand Rally", type: "BRAND_RALLY", description: "Workshops, factory tours, sponsored activities, and high-production events.", defaultFields: { type: "RALLY", suggestedScheduleItems: [{ title: "Welcome Reception", offsetDays: 0, hour: 18 }, { title: "Morning Workshop", offsetDays: 1, hour: 9 }, { title: "Factory Tour", offsetDays: 1, hour: 14 }, { title: "Awards Dinner", offsetDays: 2, hour: 18 }], suggestedAnnouncement: "Welcome! Check the schedule for today's activities. Questions? Ask Hitch!", features: ["announcements", "schedule", "meals", "hitch_faq"] } },
  { name: "Social Hangout", type: "SOCIAL_HANGOUT", description: "Community-led. Map, campfires, shared meals, and organic connections.", defaultFields: { type: "MEETUP", suggestedScheduleItems: [{ title: "Happy Hour at the Pavilion", offsetDays: 0, hour: 17 }, { title: "Potluck Breakfast", offsetDays: 1, hour: 8 }, { title: "Group Campfire", offsetDays: 1, hour: 20 }], suggestedAnnouncement: "The campfire is lit and the good times are starting!", features: ["meals", "campground_map", "campfire"] } },
  { name: "Caravan", type: "CARAVAN", description: "Multi-stop journey with daily destinations, check-in milestones, and route planning.", defaultFields: { type: "CAMPOUT", suggestedScheduleItems: [{ title: "Depart Stop 1", offsetDays: 0, hour: 8 }, { title: "Arrive Stop 2", offsetDays: 1, hour: 14 }, { title: "Group Dinner", offsetDays: 1, hour: 18 }, { title: "Final Destination", offsetDays: 3, hour: 13 }], suggestedAnnouncement: "Caravan day 1! Stay together and check in when you arrive.", features: ["schedule", "checkin", "map", "blast"] } },
];

router.get('/templates', async (_req, res) => {
  try {
    let templates = await prisma.eventTemplate.findMany({ where: { isSystem: true } });
    if (templates.length === 0) {
      await prisma.eventTemplate.createMany({ data: SYSTEM_TEMPLATES });
      templates = await prisma.eventTemplate.findMany({ where: { isSystem: true } });
    }
    res.json({ templates });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/templates', authenticateToken, async (req: any, res: Response) => {
  try {
    const { name, eventId } = req.body;
    const event = await prisma.event.findUnique({ where: { id: eventId }, include: { scheduleItems: true, announcements: true } });
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const template = await prisma.eventTemplate.create({
      data: {
        name, type: 'CUSTOM', description: `Custom template from ${event.title}`, isSystem: false,
        defaultFields: { type: event.eventType, scheduleItems: event.scheduleItems, title: event.title },
      },
    });
    res.json({ template });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

// ── ORGANIZER STATS ─────────────────────────────────────────────

router.get('/:id/organizer-stats', authenticateToken, async (req: any, res: Response) => {
  try {
    if (!await isOrganizer(req.params.id, req.userId)) return res.status(403).json({ error: 'Organizer only' });

    const [totalRSVPs, confirmed, checkedIn, full, casual, nearby, pollsCount, activePolls, blastsCount, faq] = await Promise.all([
      prisma.eventAttendee.count({ where: { eventId: req.params.id } }),
      prisma.eventAttendee.count({ where: { eventId: req.params.id, status: { in: ['ATTENDING', 'CONFIRMED'] } } }),
      prisma.eventCheckIn.count({ where: { eventId: req.params.id } }),
      prisma.eventAttendee.count({ where: { eventId: req.params.id, participationMode: 'FULL' } }),
      prisma.eventAttendee.count({ where: { eventId: req.params.id, participationMode: 'CASUAL' } }),
      prisma.eventAttendee.count({ where: { eventId: req.params.id, participationMode: 'NEARBY' } }),
      prisma.eventPoll.count({ where: { eventId: req.params.id } }),
      prisma.eventPoll.count({ where: { eventId: req.params.id, isActive: true } }),
      prisma.eventBlast.count({ where: { eventId: req.params.id } }),
      prisma.eventHitchFAQ.findUnique({ where: { eventId: req.params.id } }),
    ]);

    res.json({ totalRSVPs, confirmedAttendees: confirmed, checkedIn, participationBreakdown: { full, casual, nearby }, pollsCount, activePolls, blastsCount, hasHitchFAQ: !!faq });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

export default router;
