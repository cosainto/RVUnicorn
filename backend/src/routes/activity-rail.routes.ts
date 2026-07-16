import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// ── Types ──────────────────────────────────────────────────────────────────────

interface ActivityRailItem {
  id: string;
  type: 'PHOTO' | 'CHECKIN' | 'REVIEW' | 'MILESTONE' | 'ALBUM';
  actorId: string;
  actorName: string;
  actorAvatarUrl: string;
  actorRigName: string | null;
  previewImageUrl: string;
  campgroundId: string | null;
  campgroundName: string | null;
  campgroundLat: number | null;
  campgroundLng: number | null;
  campgroundState: string | null;
  description: string;
  occurredAt: string;
  timeAgo: string;
  ringColor: string;
  navigateTo: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds} sec ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} day ago`;
}

const RING_COLORS: Record<ActivityRailItem['type'], string> = {
  PHOTO: '#C9A84C',
  CHECKIN: '#1D9E75',
  REVIEW: '#378ADD',
  MILESTONE: '#E8622A',
  ALBUM: '#8B5CF6',
};

// ── In-memory cache (userId -> { items, expiry }) ──────────────────────────────

const cache = new Map<string, { items: ActivityRailItem[]; expiry: number }>();
const CACHE_TTL_MS = 3 * 60 * 1000; // 3 minutes

// ── SSE clients ────────────────────────────────────────────────────────────────

const sseClients = new Map<string, Set<any>>();

// ── GET / — recent network activity ────────────────────────────────────────────

router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const userId: string = req.userId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const before = req.query.before as string | undefined;

    // Check cache
    const cached = cache.get(userId);
    if (cached && cached.expiry > Date.now()) {
      let items = cached.items;
      if (before) {
        items = items.filter(i => i.occurredAt < before);
      }
      const sliced = items.slice(0, limit);
      return res.json({ items: sliced, hasMore: items.length > limit });
    }

    // Step 1: Get the user's network (parallel)
    const [friendships, campgroundFollows] = await Promise.all([
      prisma.friendship.findMany({
        where: {
          OR: [
            { initiatorId: userId, status: 'ACCEPTED' },
            { receiverId: userId, status: 'ACCEPTED' },
          ],
        },
        select: { initiatorId: true, receiverId: true },
      }),
      prisma.campgroundFollow.findMany({
        where: { userId },
        select: { campgroundId: true },
      }),
    ]);

    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );
    const followedCampgroundIds = campgroundFollows.map((f: any) => f.campgroundId);

    if (friendIds.length === 0 && followedCampgroundIds.length === 0) {
      return res.json({ items: [], hasMore: false, hasNetwork: false });
    }

    // Step 2: Query activity sources (all in parallel)
    const now = Date.now();
    const results = await Promise.allSettled([
      // a) PHOTOS — RigPost from friends, last 72h
      friendIds.length > 0
        ? prisma.rigPost.findMany({
            where: {
              userId: { in: friendIds },
              createdAt: { gte: new Date(now - 72 * 60 * 60 * 1000) },
              photos: { isEmpty: false },
              visibility: { in: ['PUBLIC', 'FRIENDS_ONLY', 'BOTH'] },
            },
            include: {
              author: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
              rig: { select: { id: true, nickname: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),

      // b) CHECKINS — last 48h
      friendIds.length > 0
        ? prisma.checkIn.findMany({
            where: {
              userId: { in: friendIds },
              createdAt: { gte: new Date(now - 48 * 60 * 60 * 1000) },
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
              campground: { select: { id: true, name: true, slug: true, state: true, latitude: true, longitude: true, imageUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 20,
          })
        : Promise.resolve([]),

      // c) REVIEWS — last 7 days
      friendIds.length > 0
        ? prisma.campgroundReview.findMany({
            where: {
              userId: { in: friendIds },
              createdAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
              campground: { select: { id: true, name: true, slug: true, state: true, latitude: true, longitude: true, imageUrl: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),

      // d) MILESTONES — UserBadge, last 30 days
      friendIds.length > 0
        ? prisma.userBadge.findMany({
            where: {
              userId: { in: friendIds },
              earnedAt: { gte: new Date(now - 30 * 24 * 60 * 60 * 1000) },
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
              badge: { select: { name: true, description: true, imageUrl: true } },
            },
            orderBy: { earnedAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),

      // e) ALBUMS — PhotoAlbum with 3+ photos, last 7 days
      friendIds.length > 0
        ? prisma.photoAlbum.findMany({
            where: {
              userId: { in: friendIds },
              createdAt: { gte: new Date(now - 7 * 24 * 60 * 60 * 1000) },
              privacy: 'PUBLIC',
            },
            include: {
              user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
              photos: { select: { imageUrl: true }, take: 1 },
              _count: { select: { photos: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
          })
        : Promise.resolve([]),
    ]);

    // Extract settled values (ignore rejected)
    const extract = (r: PromiseSettledResult<any[]>) =>
      r.status === 'fulfilled' ? r.value : [];

    const photos: any[] = extract(results[0]);
    const checkins: any[] = extract(results[1]);
    const reviews: any[] = extract(results[2]);
    const milestones: any[] = extract(results[3]);
    const albums: any[] = extract(results[4]).filter((a: any) => a._count.photos >= 3);

    // Step 3: Transform into unified shape
    const items: ActivityRailItem[] = [];

    for (const p of photos) {
      const photoCount = Array.isArray(p.photos) ? p.photos.length : 0;
      items.push({
        id: p.id,
        type: 'PHOTO',
        actorId: p.author?.id || p.userId,
        actorName: `${p.author?.firstName || ''} ${p.author?.lastName || ''}`.trim(),
        actorAvatarUrl: p.author?.profilePicture || '',
        actorRigName: p.rig?.nickname || null,
        previewImageUrl: Array.isArray(p.photos) && p.photos.length > 0 ? p.photos[0] : '',
        campgroundId: null,
        campgroundName: null,
        campgroundLat: null,
        campgroundLng: null,
        campgroundState: null,
        description: `\ud83d\udcf8 uploaded ${photoCount} photo${photoCount !== 1 ? 's' : ''}`,
        occurredAt: new Date(p.createdAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(p.createdAt)),
        ringColor: RING_COLORS.PHOTO,
        navigateTo: `/rig/${p.rig?.id || ''}`,
      });
    }

    for (const c of checkins) {
      items.push({
        id: c.id,
        type: 'CHECKIN',
        actorId: c.user?.id || c.userId,
        actorName: `${c.user?.firstName || ''} ${c.user?.lastName || ''}`.trim(),
        actorAvatarUrl: c.user?.profilePicture || '',
        actorRigName: null,
        previewImageUrl: c.campground?.imageUrl || '',
        campgroundId: c.campground?.id || null,
        campgroundName: c.campground?.name || null,
        campgroundLat: c.campground?.latitude || null,
        campgroundLng: c.campground?.longitude || null,
        campgroundState: c.campground?.state || null,
        description: `\ud83c\udfd5 checked in at ${c.campground?.name || 'a campground'}`,
        occurredAt: new Date(c.createdAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(c.createdAt)),
        ringColor: RING_COLORS.CHECKIN,
        navigateTo: `/campgrounds/${c.campground?.slug || c.campgroundId || ''}`,
      });
    }

    for (const r of reviews) {
      items.push({
        id: r.id,
        type: 'REVIEW',
        actorId: r.user?.id || r.userId,
        actorName: `${r.user?.firstName || ''} ${r.user?.lastName || ''}`.trim(),
        actorAvatarUrl: r.user?.profilePicture || '',
        actorRigName: null,
        previewImageUrl: r.campground?.imageUrl || '',
        campgroundId: r.campground?.id || null,
        campgroundName: r.campground?.name || null,
        campgroundLat: r.campground?.latitude || null,
        campgroundLng: r.campground?.longitude || null,
        campgroundState: r.campground?.state || null,
        description: `\u2b50 reviewed ${r.campground?.name || 'a campground'}`,
        occurredAt: new Date(r.createdAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(r.createdAt)),
        ringColor: RING_COLORS.REVIEW,
        navigateTo: `/campgrounds/${r.campground?.slug || ''}`,
      });
    }

    for (const m of milestones) {
      items.push({
        id: m.id,
        type: 'MILESTONE',
        actorId: m.user?.id || m.userId,
        actorName: `${m.user?.firstName || ''} ${m.user?.lastName || ''}`.trim(),
        actorAvatarUrl: m.user?.profilePicture || '',
        actorRigName: null,
        previewImageUrl: m.badge?.imageUrl || '',
        campgroundId: null,
        campgroundName: null,
        campgroundLat: null,
        campgroundLng: null,
        campgroundState: null,
        description: `\ud83c\udfaf earned ${m.badge?.name || 'a badge'}`,
        occurredAt: new Date(m.earnedAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(m.earnedAt)),
        ringColor: RING_COLORS.MILESTONE,
        navigateTo: `/profile/${m.user?.username || ''}`,
      });
    }

    for (const a of albums) {
      items.push({
        id: a.id,
        type: 'ALBUM',
        actorId: a.user?.id || a.userId,
        actorName: `${a.user?.firstName || ''} ${a.user?.lastName || ''}`.trim(),
        actorAvatarUrl: a.user?.profilePicture || '',
        actorRigName: null,
        previewImageUrl: a.photos?.[0]?.imageUrl || '',
        campgroundId: null,
        campgroundName: null,
        campgroundLat: null,
        campgroundLng: null,
        campgroundState: null,
        description: `\ud83d\udcf7 created album '${a.title || 'Untitled'}'`,
        occurredAt: new Date(a.createdAt).toISOString(),
        timeAgo: formatTimeAgo(new Date(a.createdAt)),
        ringColor: RING_COLORS.ALBUM,
        navigateTo: `/albums/${a.id}`,
      });
    }

    // Step 4: Dedup — group by actorId+type within 2-hour windows, keep newest
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const dedupMap = new Map<string, ActivityRailItem>();
    const photoCounts = new Map<string, number>();

    // Sort newest first so the first item per key is the one we keep
    items.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    for (const item of items) {
      const key = `${item.actorId}-${item.type}`;
      const existing = dedupMap.get(key);
      if (existing) {
        const diff = Math.abs(
          new Date(existing.occurredAt).getTime() - new Date(item.occurredAt).getTime()
        );
        if (diff <= TWO_HOURS_MS) {
          // Merge: increment photo count for PHOTO type
          if (item.type === 'PHOTO') {
            const currentCount = photoCounts.get(key) || 1;
            const incomingCount = 1;
            const total = currentCount + incomingCount;
            photoCounts.set(key, total);
            existing.description = `\ud83d\udcf8 uploaded ${total} photos`;
          }
          continue; // skip duplicate
        }
      }
      dedupMap.set(key, item);
      if (item.type === 'PHOTO') {
        photoCounts.set(key, 1);
      }
    }

    let deduped = Array.from(dedupMap.values());

    // Step 5: Sort, cursor filter, limit
    deduped.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));

    // Cache the full result set
    cache.set(userId, { items: deduped, expiry: Date.now() + CACHE_TTL_MS });

    if (before) {
      deduped = deduped.filter(i => i.occurredAt < before);
    }

    const sliced = deduped.slice(0, limit);
    res.json({ items: sliced, hasMore: deduped.length > limit, hasNetwork: true });
  } catch (error: any) {
    console.error('Activity rail error:', error);
    res.status(500).json({ error: 'Failed to fetch activity rail' });
  }
});

// ── GET /stream — SSE for live activity updates ────────────────────────────────

router.get('/stream', (req: any, res) => {
  // SSE connections can't set Authorization headers — accept token as query param
  if (!req.headers.authorization && (req.query as any).token) {
    req.headers.authorization = `Bearer ${(req.query as any).token}`;
  }
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) { res.status(401).end(); return; }
  try {
    const jwt = require('jsonwebtoken');
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    req.userId = decoded.userId;
  } catch { res.status(401).end(); return; }

  const userId = req.userId;
  const allowedOrigins = ['https://www.rvunicorn.com', 'https://rvunicorn.com', 'http://localhost:5173'];
  const origin = req.headers.origin || '';
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    'Access-Control-Allow-Credentials': 'true',
  });

  const heartbeat = setInterval(() => res.write('event: ping\ndata: {}\n\n'), 30000);
  if (!sseClients.has(userId)) sseClients.set(userId, new Set());
  sseClients.get(userId)!.add(res);

  req.on('close', () => {
    clearInterval(heartbeat);
    sseClients.get(userId)?.delete(res);
    if (sseClients.get(userId)?.size === 0) sseClients.delete(userId);
  });

  res.write('event: connected\ndata: {"status":"connected"}\n\n');
});

export function pushActivityRailUpdate(userId: string, item: any) {
  const userClients = sseClients.get(userId);
  if (userClients) {
    const data = JSON.stringify(item);
    userClients.forEach((client) => client.write(`event: activity\ndata: ${data}\n\n`));
  }
}

// ── GET /social-pins — map overlay pin data ──────────────────────────────────

router.get('/social-pins', authenticateToken, async (req: any, res) => {
  try {
    const userId = req.userId;

    // Get mutual friends
    const friendships = await prisma.friendship.findMany({
      where: {
        OR: [
          { initiatorId: userId, status: 'ACCEPTED' },
          { receiverId: userId, status: 'ACCEPTED' },
        ],
      },
      select: { initiatorId: true, receiverId: true },
    });
    const friendIds = friendships.map((f: any) =>
      f.initiatorId === userId ? f.receiverId : f.initiatorId
    );

    if (friendIds.length === 0) {
      return res.json({ pins: [], cards: [] });
    }

    // Get friend user info + their locationSharing setting
    const friends = await prisma.user.findMany({
      where: { id: { in: friendIds } },
      select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true, locationSharing: true, showCampingStatus: true },
    });
    const friendMap = new Map(friends.map((f: any) => [f.id, f]));

    // Fetch recent friend activity (last 7 days) with location data
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [checkIns, photos, rigPosts] = await Promise.all([
      // Friend check-ins with campground location
      prisma.checkIn.findMany({
        where: {
          userId: { in: friendIds },
          checkInDate: { gte: sevenDaysAgo },
          campgroundId: { not: null },
        },
        include: {
          campground: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true, imageUrl: true } },
          user: { select: { id: true, firstName: true, profilePicture: true } },
        },
        orderBy: { checkInDate: 'desc' },
        take: 30,
      }),

      // Friend photos with location (via place or event->campground)
      prisma.photo.findMany({
        where: {
          userId: { in: friendIds },
          createdAt: { gte: sevenDaysAgo },
          visibility: { not: 'PRIVATE' },
          OR: [
            { placeId: { not: null } },
            { campgroundId: { not: null } },
            { latitude: { not: null } },
          ],
        },
        select: {
          id: true, userId: true, imageUrl: true, caption: true, createdAt: true,
          latitude: true, longitude: true, locationSharing: true,
          placeId: true, campgroundId: true,
          place: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true } },
          campgroundRef: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true } },
          user: { select: { id: true, firstName: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),

      // Rig posts from followed rigs
      prisma.rigPost.findMany({
        where: {
          userId: { in: friendIds },
          createdAt: { gte: sevenDaysAgo },
          isPublic: true,
          placeId: { not: null },
        },
        select: {
          id: true, userId: true, photos: true, title: true, body: true, createdAt: true,
          latitude: true, longitude: true,
          placeId: true,
          place: { select: { id: true, name: true, city: true, state: true, latitude: true, longitude: true } },
          author: { select: { id: true, firstName: true, profilePicture: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);

    // Build pins and cards, respecting locationSharing
    const pins: any[] = [];
    const cards: any[] = [];

    for (const ci of checkIns) {
      const friend = friendMap.get(ci.userId);
      if (!friend?.showCampingStatus) continue;
      const isFuzzy = friend?.locationSharing === 'fuzzy';

      const pin = {
        id: `checkin-${ci.id}`,
        type: 'checkin',
        lat: isFuzzy ? null : ci.campground?.latitude,
        lng: isFuzzy ? null : ci.campground?.longitude,
        state: ci.campground?.state,
        isFuzzy,
        actor: { id: friend.id, name: friend.firstName, avatar: friend.profilePicture },
        placeName: ci.campground?.name,
        placeId: ci.campgroundId,
      };
      pins.push(pin);

      cards.push({
        id: pin.id,
        type: 'friend_upload',
        actor: pin.actor,
        placeName: ci.campground?.name,
        placeCity: ci.campground?.city,
        placeState: ci.campground?.state,
        imageUrl: ci.campground?.imageUrl,
        description: `checked in at ${ci.campground?.name}`,
        occurredAt: ci.checkInDate,
        isFuzzy,
        lat: pin.lat,
        lng: pin.lng,
      });
    }

    for (const photo of photos) {
      const friend = friendMap.get(photo.userId);
      if (!friend) continue;
      const postSharing = photo.locationSharing === 'inherit' ? friend.locationSharing : photo.locationSharing;
      if (postSharing === 'hidden') continue;
      const isFuzzy = postSharing === 'fuzzy';

      const target = photo.campgroundRef || photo.place;
      const lat = isFuzzy ? null : (photo.latitude || target?.latitude);
      const lng = isFuzzy ? null : (photo.longitude || target?.longitude);

      pins.push({
        id: `photo-${photo.id}`,
        type: 'photo',
        lat, lng,
        state: target?.state,
        isFuzzy,
        actor: { id: friend.id, name: friend.firstName, avatar: friend.profilePicture },
        placeName: target?.name,
        imageUrl: photo.imageUrl,
      });

      cards.push({
        id: `photo-${photo.id}`,
        type: 'friend_upload',
        actor: { id: friend.id, name: friend.firstName, avatar: friend.profilePicture },
        placeName: target?.name,
        placeCity: target?.city,
        placeState: target?.state,
        imageUrl: photo.imageUrl,
        description: `shared a photo${target?.name ? ' at ' + target.name : ''}`,
        occurredAt: photo.createdAt,
        isFuzzy,
        lat, lng,
      });
    }

    // Cap at 50 items
    res.json({
      pins: pins.slice(0, 50),
      cards: cards.slice(0, 50),
    });
  } catch (e: any) {
    console.error('[SocialPins] error:', e.message);
    res.status(500).json({ error: 'Failed to fetch social pins' });
  }
});

export default router;
