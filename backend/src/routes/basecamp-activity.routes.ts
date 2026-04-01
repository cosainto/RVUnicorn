import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';
const router = Router();
const prisma = new PrismaClient();

// GET /api/basecamp-activity
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { limit = 20, offset = 0, unreadOnly = 'false' } = req.query;

    const whereClause: any = { userId };
    if (unreadOnly === 'true') whereClause.isRead = false;

    const activities = await prisma.basecampActivity.findMany({
      where: whereClause,
      include: {
        actor: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    const unreadCount = await prisma.basecampActivity.count({ where: { userId, isRead: false } });

    const formatted = activities.map(a => ({
      ...a,
      message: formatMessage(a),
      icon: getIcon(a.type),
      link: getLink(a)
    }));

    res.json({ activities: formatted, unreadCount, hasMore: activities.length === parseInt(limit as string) });
  } catch (error) {
    console.error('Get activity error:', error);
    res.status(500).json({ error: 'Failed to fetch activity' });
  }
});

// GET /api/basecamp-activity/unread-count
router.get('/unread-count', authenticateToken, async (req: any, res) => {
  try {
    const count = await prisma.basecampActivity.count({ where: { userId: req.user.id, isRead: false } });
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// PUT /api/basecamp-activity/:id/read
router.put('/:id/read', authenticateToken, async (req: any, res) => {
  try {
    await prisma.basecampActivity.updateMany({ where: { id: req.params.id, userId: req.user.id }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// PUT /api/basecamp-activity/read-all
router.put('/read-all', authenticateToken, async (req: any, res) => {
  try {
    await prisma.basecampActivity.updateMany({ where: { userId: req.user.id, isRead: false }, data: { isRead: true } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// DELETE /api/basecamp-activity/:id
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    await prisma.basecampActivity.deleteMany({ where: { id: req.params.id, userId: req.user.id } });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// POST /api/basecamp-activity/shoutout
router.post('/shoutout', authenticateToken, async (req: any, res) => {
  try {
    const actorId = req.user.id;
    const { targetUserId, campgroundId, message } = req.body;
    if (!targetUserId || !message?.trim()) return res.status(400).json({ error: 'targetUserId and message required' });
    if (targetUserId === actorId) return res.status(400).json({ error: 'Cannot shoutout yourself' });

    const [target, campground] = await Promise.all([
      prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true, firstName: true } }),
      campgroundId ? prisma.campground.findUnique({ where: { id: campgroundId }, select: { id: true, name: true } }) : null,
    ]);
    if (!target) return res.status(404).json({ error: 'User not found' });

    const activity = await prisma.basecampActivity.create({
      data: {
        userId: targetUserId,
        actorId,
        type: 'MAP_SHOUTOUT',
        entityType: 'USER',
        entityId: actorId,
        entityName: campground?.name || 'the map',
        metadata: { message: message.trim(), campgroundId: campground?.id, campgroundName: campground?.name },
      },
      include: { actor: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
    });

    res.json({ success: true, activity });
  } catch (error) {
    console.error('Shoutout error:', error);
    res.status(500).json({ error: 'Failed to send shoutout' });
  }
});

function formatMessage(activity: any): string {
  const actor = activity.actor?.firstName || 'Someone';
  const meta = (activity.metadata as any) || {};
  const item = meta.itemName || 'an item';
  const entity = activity.entityName || 'the trip';

  switch (activity.type) {
    case 'PACK_ITEM_ASSIGNED': return `You were assigned "${item}" for ${entity}`;
    case 'PACK_ITEM_ACCEPTED': return `${actor} accepted "${item}"`;
    case 'PACK_ITEM_DECLINED': return `${actor} declined "${item}"${meta.reason ? ` (${meta.reason})` : ''}`;
    case 'PACK_ITEM_PACKED': return `${actor} marked "${item}" as packed`;
    case 'PACK_ITEM_UNPACKED': return `${actor} marked "${item}" as unpacked`;
    case 'PACK_ITEM_ADDED': return `${actor} added "${item}" to the packing list`;
    case 'PACK_LIST_COMPLETE': return `🎉 ${entity} is fully packed!`;
    case 'CREATOR_VIDEO_UPLOAD': return `${actor} uploaded a new video: "${entity}" - Go check it out! 🎬`;
    case 'MAP_SHOUTOUT': return `${actor} left you a shoutout from the map! 📍 "${meta.message || ''}"`;
    case 'CAMP_MARKET_FEEDBACK_REQUEST': return `Your trade "${entity}" is complete! Leave feedback for ${meta.buyerName || meta.sellerName || 'the other party'}.`;
    case 'CAMP_MARKET_FEEDBACK_REMINDER': return meta.message || `How did your trade for "${entity}" go? Leave feedback!`;
    default: return `Activity in ${entity}`;
  }
}

function getIcon(type: string): string {
  const icons: Record<string, string> = {
    'PACK_ITEM_ASSIGNED': '📋',
    'PACK_ITEM_ACCEPTED': '✅',
    'PACK_ITEM_DECLINED': '❌',
    'PACK_ITEM_PACKED': '✓',
    'PACK_ITEM_UNPACKED': '↩️',
    'PACK_ITEM_ADDED': '➕',
    'PACK_LIST_COMPLETE': '🎉',
    'CREATOR_VIDEO_UPLOAD': '🎬',
    'MAP_SHOUTOUT': '📍',
    'CAMP_MARKET_FEEDBACK_REQUEST': '🛒',
    'CAMP_MARKET_FEEDBACK_REMINDER': '⏰'
  };
  return icons[type] || '📦';
}

function getLink(activity: any): string {
  if (activity.entityType === 'EVENT') {
    if (activity.type?.includes('PACK')) return `/events/${activity.entityId}?tab=packup`;
    return `/events/${activity.entityId}`;
  }
  if (activity.entityType === 'TRIP') return `/travel?trip=${activity.entityId}`;
  if (activity.entityType === 'CREATOR_CONTENT') return `/creators/${(activity.metadata as any)?.creatorUsername || 'unknown'}/content/${activity.entityId}`;
  if (activity.type === 'MAP_SHOUTOUT') return `/profile/${activity.entityId}`;
  return '/basecamp';
}

export default router;
