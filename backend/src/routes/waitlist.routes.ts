import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

const router = Router();
const WAITLIST_FILE = path.join(process.cwd(), 'waitlist-emails.json');

// POST /api/waitlist — capture email for newsletter/updates
router.post('/', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    // Load existing emails
    let emails: { email: string; date: string }[] = [];
    try {
      if (fs.existsSync(WAITLIST_FILE)) {
        emails = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf-8'));
      }
    } catch {}

    // Check for duplicate
    if (emails.some(e => e.email.toLowerCase() === email.toLowerCase())) {
      return res.json({ success: true, message: 'Already on the list!' });
    }

    // Add new email
    emails.push({ email: email.toLowerCase().trim(), date: new Date().toISOString() });
    fs.writeFileSync(WAITLIST_FILE, JSON.stringify(emails, null, 2));

    console.log(`[Waitlist] New signup: ${email} (total: ${emails.length})`);
    res.json({ success: true, message: 'Welcome to the list!' });
  } catch (e: any) {
    console.error('[Waitlist] Error:', e);
    res.status(500).json({ error: 'Failed to save email' });
  }
});

// GET /api/waitlist/count — public count for social proof
router.get('/count', async (_req: Request, res: Response) => {
  try {
    let count = 0;
    if (fs.existsSync(WAITLIST_FILE)) {
      const emails = JSON.parse(fs.readFileSync(WAITLIST_FILE, 'utf-8'));
      count = emails.length;
    }
    res.json({ count });
  } catch {
    res.json({ count: 0 });
  }
});

// GET /api/waitlist/upcoming-events — public upcoming events across all campgrounds
router.get('/upcoming-events', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    const events = await prisma.campgroundEvent.findMany({
      where: {
        startDate: { gte: now, lte: nextWeek },
      },
      include: {
        campground: { select: { id: true, name: true, location: true, state: true, imageUrl: true, customSlug: true } },
      },
      orderBy: { startDate: 'asc' },
      take: 50,
    });

    // Deduplicate — one event per campground for variety
    const seen = new Set<string>();
    const unique = events.filter(e => {
      const key = e.campground?.id || e.id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 12);

    res.json({ events: unique });
  } catch {
    res.json({ events: [] });
  }
});

export default router;
