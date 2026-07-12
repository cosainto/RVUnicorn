import { Router, Request, Response } from 'express';

const router = Router();
import { prisma } from '../lib/prisma';

const authenticateToken = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  const jwt = require('jsonwebtoken');
  jwt.verify(token, process.env.JWT_SECRET, (err: any, decoded: any) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    (req as any).userId = decoded.userId;
    next();
  });
};

function daysUntil(d: Date) { return Math.ceil((d.getTime() - Date.now()) / 86400000); }
function daysFromNow(d: number) { return new Date(Date.now() + d * 86400000); }
function getTripRemindTime(tripStart: Date) { return daysUntil(tripStart) <= 7 ? daysFromNow(1) : daysFromNow(2); }

async function hasRecent(userId: string, type: string, minDays: number) {
  const cutoff = new Date(Date.now() - minDays * 86400000);
  return !!(await prisma.hitchReminder.findFirst({ where: { userId, type, createdAt: { gte: cutoff } } }));
}

async function isIgnored(userId: string, type: string) {
  return !!(await prisma.hitchReminder.findFirst({ where: { userId, type, status: 'IGNORED_FOREVER' } }));
}

// SCAN - create reminders for incomplete items
router.post('/scan', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const now = new Date();
    const created: string[] = [];


    // 1. Site numbers check removed (siteNumber not in Stay model)

    // 2. Missing trip descriptions
    if (!(await isIgnored(userId, 'MISSING_TRIP_DESCRIPTION'))) {
      const trips = await prisma.trip.findMany({ where: { userId, startDate: { gt: now }, description: null } });
      for (const trip of trips) {
        if (!(await prisma.hitchReminder.findFirst({ where: { userId, entityId: trip.id, type: 'MISSING_TRIP_DESCRIPTION', status: 'PENDING' } }))) {
          await prisma.hitchReminder.create({ data: {
            userId, type: 'MISSING_TRIP_DESCRIPTION', entityType: 'TRIP', entityId: trip.id,
            message: `Your trip "${trip.name}" needs a description. Want to add details?`,
            priority: 'LOW', nextRemindAt: getTripRemindTime(trip.startDate),
            metadata: { tripName: trip.name, startDate: trip.startDate.toISOString(), field: 'description' },
          }});
          created.push(`Desc for ${trip.name}`);
        }
      }
    }

    // 3. Events missing location
    if (!(await isIgnored(userId, 'MISSING_EVENT_LOCATION'))) {
      const events = await prisma.event.findMany({ where: { organizerId: userId, startDate: { gt: now }, location: null, campgroundId: null } });
      for (const ev of events) {
        if (!(await prisma.hitchReminder.findFirst({ where: { userId, entityId: ev.id, type: 'MISSING_EVENT_LOCATION', status: 'PENDING' } }))) {
          await prisma.hitchReminder.create({ data: {
            userId, type: 'MISSING_EVENT_LOCATION', entityType: 'EVENT', entityId: ev.id,
            message: `Your event "${ev.title}" needs a location. Where will it be?`,
            priority: daysUntil(ev.startDate) <= 7 ? 'HIGH' : 'NORMAL',
            nextRemindAt: getTripRemindTime(ev.startDate),
            metadata: { eventTitle: ev.title, startDate: ev.startDate.toISOString(), field: 'location' },
          }});
          created.push(`Location for ${ev.title}`);
        }
      }
    }

    // 4. Wishlist suggestions (every 2 weeks)
    if (!(await isIgnored(userId, 'WISHLIST_SUGGESTION')) && !(await hasRecent(userId, 'WISHLIST_SUGGESTION', 14))) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
      const wlIds = (await prisma.campgroundWishlist.findMany({ where: { userId }, select: { campgroundId: true } }).catch(() => [])).map((w: any) => w.campgroundId).filter(Boolean);
      const suggestions = await prisma.campground.findMany({ where: { id: { notIn: wlIds }, googleRating: { gte: 4.0 } }, select: { id:true,name:true,location:true,state:true,googleRating:true }, take: 3, orderBy: { googleRating: 'desc' } });
      if (suggestions.length > 0) {
        await prisma.hitchReminder.create({ data: {
          userId, type: 'WISHLIST_SUGGESTION', entityType: 'CAMPGROUND', entityId: suggestions[0].id,
          message: `Hey ${user?.firstName || 'there'}! \u{1f5fa}\ufe0f Check out these campgrounds for your wishlist: ${suggestions.map((s: any) => s.name).join(', ')}. Want me to add any?`,
          priority: 'LOW', nextRemindAt: daysFromNow(1),
          metadata: { suggestions: suggestions.map((s: any) => ({ id:s.id, name:s.name, location:s.location, rating:s.googleRating })), field: 'wishlist' },
        }});
        created.push('Wishlist suggestions');
      }
    }

    // 5. Maintenance logs (2 weeks if none, 60 days if active)
    if (!(await isIgnored(userId, 'MAINTENANCE_LOG_PROMPT'))) {
      const logCount = await prisma.maintenanceRecord.count({ where: { userId } }).catch(() => 0);
      const interval = logCount > 0 ? 60 : 14;
      if (!(await hasRecent(userId, 'MAINTENANCE_LOG_PROMPT', interval))) {
        const lastLog = await prisma.maintenanceRecord.findFirst({ where: { userId }, orderBy: { serviceDate: 'desc' }, select: { serviceDate: true, title: true } }).catch(() => null);
        const msg = logCount === 0
          ? "\u{1f527} Tracking RV maintenance helps catch issues early. Want to log your last oil change or service?"
          : `\u{1f527} It's been ${lastLog ? Math.floor((Date.now() - lastLog.serviceDate.getTime()) / 86400000) : '?'} days since your last log${lastLog?.title ? ` (${lastLog.title})` : ''}. Any recent service to record?`;
        await prisma.hitchReminder.create({ data: {
          userId, type: 'MAINTENANCE_LOG_PROMPT', entityType: 'USER', entityId: userId,
          message: msg, priority: 'LOW', nextRemindAt: daysFromNow(1),
          metadata: { logCount, field: 'maintenance' },
        }});
        created.push('Maintenance prompt');
      }
    }

    // 6. Creator encouragement (10+ albums or 15+ videos)
    if (!(await isIgnored(userId, 'CREATOR_ENCOURAGEMENT'))) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { isCreator: true, firstName: true } });
      if (u && !u.isCreator && !(await hasRecent(userId, 'CREATOR_ENCOURAGEMENT', 30))) {
        const albums = await prisma.photoAlbum.count({ where: { userId } }).catch(() => 0);
        const videos = await prisma.video.count({ where: { userId } }).catch(() => 0);
        if (albums >= 10 || videos >= 15) {
          const ct = albums >= 10 ? `${albums} photo albums` : `${videos} videos`;
          await prisma.hitchReminder.create({ data: {
            userId, type: 'CREATOR_ENCOURAGEMENT', entityType: 'USER', entityId: userId,
            message: `\u{1f31f} ${u.firstName}, you've shared ${ct}! Your content is what fellow campers love. Become an RVUnicorn Creator for a verified badge and featured content. Want me to set it up?`,
            priority: 'NORMAL', nextRemindAt: daysFromNow(1),
            metadata: { albumCount: albums, videoCount: videos, field: 'isCreator' },
          }});
          created.push('Creator encouragement');
        }
      }
    }

    // 7. Social URLs (monthly)
    if (!(await isIgnored(userId, 'SOCIAL_URLS_PROMPT')) && !(await hasRecent(userId, 'SOCIAL_URLS_PROMPT', 30))) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName:true, facebookUrl:true, instagramUrl:true, youtubeUrl:true, tiktokUrl:true, twitterUrl:true } });
      if (u) {
        const missing: string[] = [];
        if (!u.instagramUrl) missing.push('Instagram');
        if (!u.youtubeUrl) missing.push('YouTube');
        if (!u.tiktokUrl) missing.push('TikTok');
        if (!u.facebookUrl) missing.push('Facebook');
        if (missing.length > 0) {
          await prisma.hitchReminder.create({ data: {
            userId, type: 'SOCIAL_URLS_PROMPT', entityType: 'USER', entityId: userId,
            message: `\u{1f4f1} Linking socials helps campers find you! You haven't added ${missing.slice(0,3).join(', ')} yet. Paste your links and I'll update your profile!`,
            priority: 'LOW', nextRemindAt: daysFromNow(1),
            metadata: { missingSocials: missing, field: 'socialUrls' },
          }});
          created.push('Social URLs');
        }
      }
    }

    // 8. Incomplete RV profile
    if (!(await isIgnored(userId, 'INCOMPLETE_RV_PROFILE')) && !(await hasRecent(userId, 'INCOMPLETE_RV_PROFILE', 14))) {
      const u = await prisma.user.findUnique({ where: { id: userId }, select: { rvMake:true, rvModel:true, bio:true } });
      if (u && !u.rvMake && !u.rvModel) {
        await prisma.hitchReminder.create({ data: {
          userId, type: 'INCOMPLETE_RV_PROFILE', entityType: 'USER', entityId: userId,
          message: "\u{1f699} Add your RV details (make, model, length) so I can find perfect-fit campgrounds! Just tell me about your rig.",
          priority: 'LOW', nextRemindAt: daysFromNow(2),
          metadata: { field: 'rvProfile' },
        }});
        created.push('RV profile');
      }
      if (u && !u.bio && !(await hasRecent(userId, 'MISSING_BIO', 14))) {
        await prisma.hitchReminder.create({ data: {
          userId, type: 'MISSING_BIO', entityType: 'USER', entityId: userId,
          message: "\u270d\ufe0f Your profile needs a bio! Tell the community about your adventures. Just type it and I'll add it.",
          priority: 'LOW', nextRemindAt: daysFromNow(3),
          metadata: { field: 'bio' },
        }});
        created.push('Bio');
      }
    }

    // Social handle nudge after sharing
    if (!(await isIgnored(userId, 'SOCIAL_SHARE_NUDGE'))) {
      const shareUser = await prisma.user.findUnique({ where: { id: userId }, select: { facebookUrl: true, instagramUrl: true, twitterUrl: true, redditUrl: true, tiktokUrl: true, youtubeUrl: true, blueskyUrl: true } });
      if (shareUser) {
        const missing: string[] = [];
        if (!shareUser.instagramUrl) missing.push('Instagram');
        if (!shareUser.facebookUrl) missing.push('Facebook');
        if (!shareUser.twitterUrl) missing.push('X/Twitter');
        if (!shareUser.redditUrl) missing.push('Reddit');
        if (!shareUser.tiktokUrl) missing.push('TikTok');
        if (!shareUser.youtubeUrl) missing.push('YouTube');
        if (missing.length > 0 && missing.length < 7) {
          const existing = await prisma.hitchReminder.findFirst({ where: { userId, type: 'SOCIAL_SHARE_NUDGE', status: 'PENDING' } });
          if (!existing) {
            const top3 = missing.slice(0, 3).join(', ');
            await prisma.hitchReminder.create({ data: {
              userId, type: 'SOCIAL_SHARE_NUDGE', entityType: 'USER', entityId: userId,
              message: `I noticed you\'re sharing content but haven\'t linked your ${top3} yet. Add your social handles so friends can find you!`,
              priority: 'LOW',
              nextRemindAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
              metadata: { missingSocials: missing },
            }});
            created.push('Social share nudge');
          }
        }
      }
    }

    res.json({ created, count: created.length });
  } catch (error: any) { console.error('Scan error:', error); res.status(500).json({ error: 'Scan failed' }); }
});

router.get('/active', authenticateToken, async (req: Request, res: Response) => {
  try {
    const reminders = await prisma.hitchReminder.findMany({
      where: { userId: (req as any).userId, status: 'PENDING', nextRemindAt: { lte: new Date() } },
      orderBy: [{ priority: 'desc' }, { nextRemindAt: 'asc' }], take: 5,
    });
    res.json({ reminders });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/snooze', authenticateToken, async (req: Request, res: Response) => {
  try {
    const r = await prisma.hitchReminder.findFirst({ where: { id: req.params.id, userId: (req as any).userId } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    const meta = r.metadata as any;
    const tripDate = meta?.startDate ? new Date(meta.startDate) : daysFromNow(14);
    await prisma.hitchReminder.update({ where: { id: r.id }, data: { snoozeCount: { increment: 1 }, lastRemindAt: new Date(), nextRemindAt: getTripRemindTime(tripDate) } });
    res.json({ success: true });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/remind-at', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { remindAt } = req.body;
    let next: Date;
    if (typeof remindAt === 'string' && remindAt.endsWith('d')) next = daysFromNow(parseInt(remindAt));
    else if (typeof remindAt === 'string' && remindAt.endsWith('w')) next = daysFromNow(parseInt(remindAt) * 7);
    else if (typeof remindAt === 'string' && remindAt.endsWith('m')) next = daysFromNow(parseInt(remindAt) * 30);
    else next = daysFromNow(7);
    await prisma.hitchReminder.update({ where: { id: req.params.id }, data: { nextRemindAt: next, lastRemindAt: new Date() } });
    res.json({ success: true, nextRemindAt: next });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/resolve', authenticateToken, async (req: Request, res: Response) => {
  try { await prisma.hitchReminder.updateMany({ where: { id: req.params.id, userId: (req as any).userId }, data: { status: 'RESOLVED', resolvedAt: new Date() } }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/dismiss', authenticateToken, async (req: Request, res: Response) => {
  try { await prisma.hitchReminder.updateMany({ where: { id: req.params.id, userId: (req as any).userId }, data: { status: 'DISMISSED' } }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/:id/ignore-forever', authenticateToken, async (req: Request, res: Response) => {
  try {
    const r = await prisma.hitchReminder.findFirst({ where: { id: req.params.id, userId: (req as any).userId } });
    if (!r) return res.status(404).json({ error: 'Not found' });
    await prisma.hitchReminder.update({ where: { id: r.id }, data: { status: 'IGNORED_FOREVER' } });
    await prisma.hitchReminder.updateMany({ where: { userId: (req as any).userId, type: r.type, status: 'PENDING' }, data: { status: 'DISMISSED' } });
    res.json({ success: true, type: r.type });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.get('/ignored', authenticateToken, async (req: Request, res: Response) => {
  try {
    const ignored = await prisma.hitchReminder.findMany({ where: { userId: (req as any).userId, status: 'IGNORED_FOREVER' }, select: { type: true }, distinct: ['type'] });
    res.json({ ignoredTypes: ignored.map((i: any) => i.type) });
  } catch { res.status(500).json({ error: 'Failed' }); }
});

router.post('/unignore/:type', authenticateToken, async (req: Request, res: Response) => {
  try { await prisma.hitchReminder.deleteMany({ where: { userId: (req as any).userId, type: req.params.type, status: 'IGNORED_FOREVER' } }); res.json({ success: true }); }
  catch { res.status(500).json({ error: 'Failed' }); }
});

// UPDATE entity data from Hitch chat
router.post('/update', authenticateToken, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId;
    const { entityType, entityId, field, value, reminderId } = req.body;
    if (!entityType || !field || value === undefined) return res.status(400).json({ error: 'Missing fields' });
    let updated = false;
    const eid = entityId === 'CURRENT_USER' ? userId : entityId;

    switch (entityType) {
      case 'STAY': {
        const s = await prisma.stay.findFirst({ where: { id: eid, userId } });
        if (!s) return res.status(404).json({ error: 'Not found' });
        const d: any = {};
        if (field === 'siteNumber') d.siteNumber = String(value);
        if (field === 'notes') d.notes = String(value);
        if (Object.keys(d).length) { await prisma.stay.update({ where: { id: eid }, data: d }); updated = true; }
        break;
      }
      case 'TRIP': {
        const t = await prisma.trip.findFirst({ where: { id: eid, userId } });
        if (!t) return res.status(404).json({ error: 'Not found' });
        if (field === 'description') { await prisma.trip.update({ where: { id: eid }, data: { description: String(value) } }); updated = true; }
        break;
      }
      case 'EVENT': {
        const e = await prisma.event.findFirst({ where: { id: eid, organizerId: userId } });
        if (!e) return res.status(404).json({ error: 'Not found' });
        const d: any = {};
        if (field === 'location') d.location = String(value);
        if (field === 'description') d.description = String(value);
        if (Object.keys(d).length) { await prisma.event.update({ where: { id: eid }, data: d }); updated = true; }
        break;
      }
      case 'USER': {
        const d: any = {};
        if (field === 'bio') d.bio = String(value);
        if (field === 'rvMake') d.rvMake = String(value);
        if (field === 'rvModel') d.rvModel = String(value);
        if (field === 'rvType') d.rvType = String(value);
        if (field === 'rvLength') d.rvLength = parseInt(value) || null;
        if (field === 'rvYear') d.rvYear = parseInt(value) || null;
        if (field === 'rvHeight') d.rvHeight = parseInt(value) || null;
        if (field === 'rvWeight') d.rvWeight = parseInt(value) || null;
        if (field === 'rvSleeps') d.rvSleeps = parseInt(value) || null;
        if (field === 'rvSlideouts') d.rvSlideouts = parseInt(value) || null;
        if (field === 'rvMpg') d.rvMpg = parseFloat(value) || null;
        if (field === 'rvTankGallons') d.rvTankGallons = parseFloat(value) || null;
        if (field === 'rvDescription') d.rvDescription = String(value);
        if (field === 'facebookUrl') d.facebookUrl = String(value);
        if (field === 'instagramUrl') d.instagramUrl = String(value);
        if (field === 'youtubeUrl') d.youtubeUrl = String(value);
        if (field === 'tiktokUrl') d.tiktokUrl = String(value);
        if (field === 'twitterUrl') d.twitterUrl = String(value);
        if (field === 'blueskyUrl') d.blueskyUrl = String(value);
        if (field === 'redditUrl') d.redditUrl = String(value);
        if (field === 'website') d.website = String(value);
        if (field === 'isCreator') { d.isCreator = value === true || value === 'true' || value === 'yes'; if (d.isCreator) d.creatorEnabledAt = new Date(); }
        if (Object.keys(d).length) { await prisma.user.update({ where: { id: userId }, data: d }); updated = true; }
        break;
      }
      case 'MAINTENANCE': {
        if (field === 'newRecord') {
          const r = typeof value === 'string' ? JSON.parse(value) : value;
          await prisma.maintenanceRecord.create({ data: {
            userId, title: r.title || 'Maintenance', category: r.category || 'General',
            description: r.description || null, cost: r.cost ? parseFloat(r.cost) : null,
            mileage: r.mileage ? parseInt(r.mileage) : null,
            serviceDate: r.serviceDate ? new Date(r.serviceDate) : new Date(),
            status: 'COMPLETED', notes: r.notes || null, providerName: r.providerName || null,
          }});
          updated = true;
        }
        break;
      }
      case 'CAMPGROUND': {
        if (field === 'wishlist') {
          const existing = await prisma.campgroundWishlist.findFirst({ where: { userId, campgroundId: eid } }).catch(() => null);
          if (!existing) { await prisma.campgroundWishlist.create({ data: { userId, campgroundId: eid } }).catch(() => {}); updated = true; }
        }
        break;
      }
    }

    if (updated && reminderId) {
      await prisma.hitchReminder.updateMany({ where: { id: reminderId, userId }, data: { status: 'RESOLVED', resolvedAt: new Date() } });
    }
    res.json({ success: updated });
  } catch (error: any) { console.error('Update error:', error); res.status(500).json({ error: 'Update failed' }); }
});

export default router;
// Updated scan
