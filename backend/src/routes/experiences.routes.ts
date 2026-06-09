import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

// Haversine distance in miles
function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── GET /api/experiences/feed/popular ──
router.get('/feed/popular', async (req: any, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 30;

    const experiences = await prisma.nearbyExperience.findMany({
      where: { isModerationPending: false },
      include: {
        reviews: { select: { starRating: true, recommendation: true } },
        visits: { select: { id: true } },
      },
    });

    const withStats = experiences
      .filter((e: any) => {
        if (!lat || !lng || !e.latitude || !e.longitude) return true;
        return haversine(lat, lng, e.latitude, e.longitude) <= radius;
      })
      .map((e: any) => {
        const avgRating = e.reviews.length > 0
          ? e.reviews.reduce((s: number, r: any) => s + r.starRating, 0) / e.reviews.length
          : 0;
        const distance = lat && lng && e.latitude && e.longitude
          ? haversine(lat, lng, e.latitude, e.longitude) : null;
        return {
          id: e.id, placeId: e.placeId, name: e.name, address: e.address, category: e.category,
          photoUrls: e.photoUrls, latitude: e.latitude, longitude: e.longitude,
          avgRating: Math.round(avgRating * 10) / 10,
          reviewCount: e.reviews.length,
          visitCount: e.visits.length,
          distance,
          lovedItPct: e.reviews.length > 0
            ? Math.round(e.reviews.filter((r: any) => r.recommendation === 'LOVED_IT').length / e.reviews.length * 100)
            : 0,
        };
      });

    // Build feeds
    const trending = [...withStats].sort((a, b) => b.visitCount - a.visitCount).slice(0, 10);
    const highestRated = [...withStats].filter(e => e.reviewCount >= 1).sort((a, b) => b.avgRating - a.avgRating).slice(0, 10);
    const hiddenGems = [...withStats].filter(e => e.avgRating >= 4 && e.reviewCount <= 3 && e.reviewCount >= 1).slice(0, 10);
    const newest = [...withStats].sort((a, b) => 0).slice(0, 10); // already sorted by default

    res.json({ trending, highestRated, hiddenGems, newest: withStats.slice(0, 10) });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/experiences/nearby ──
router.get('/nearby', async (req: any, res: Response) => {
  try {
    const lat = parseFloat(req.query.lat);
    const lng = parseFloat(req.query.lng);
    const radius = parseFloat(req.query.radius) || 20;

    const experiences = await prisma.nearbyExperience.findMany({
      where: { isModerationPending: false },
      include: {
        reviews: { select: { starRating: true } },
        _count: { select: { reviews: true, visits: true } },
      },
    });

    const nearby = experiences
      .map((e: any) => {
        const distance = lat && lng && e.latitude && e.longitude
          ? haversine(lat, lng, e.latitude, e.longitude) : null;
        const avgRating = e.reviews.length > 0
          ? Math.round(e.reviews.reduce((s: number, r: any) => s + r.starRating, 0) / e.reviews.length * 10) / 10
          : 0;
        return {
          id: e.id, placeId: e.placeId, name: e.name, address: e.address, category: e.category,
          description: e.description, website: e.website, photoUrls: e.photoUrls,
          latitude: e.latitude, longitude: e.longitude, isVerified: e.isVerified,
          avgRating, reviewCount: e._count.reviews, visitCount: e._count.visits,
          distance,
        };
      })
      .filter((e: any) => !distance || !lat || !lng || e.distance === null || e.distance <= radius)
      .sort((a: any, b: any) => (a.distance ?? 999) - (b.distance ?? 999));

    res.json(nearby);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/experiences/:id ──
router.get('/:id', async (req: any, res: Response) => {
  try {
    const experience = await prisma.nearbyExperience.findUnique({
      where: { id: req.params.id },
      include: {
        addedBy: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
        reviews: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePicture: true, username: true } },
            _count: { select: { votes: true } },
          },
          orderBy: { helpfulCount: 'desc' },
        },
        questions: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
            answers: {
              include: {
                user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } },
              },
              orderBy: { helpfulCount: 'desc' },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: { select: { visits: true, reviews: true } },
      },
    });

    if (!experience) return res.status(404).json({ error: 'Experience not found' });

    // Compute aggregate stats
    const reviews = experience.reviews || [];
    const avgRating = reviews.length > 0
      ? Math.round(reviews.reduce((s: number, r: any) => s + r.starRating, 0) / reviews.length * 10) / 10
      : 0;
    const recommendations: Record<string, number> = { LOVED_IT: 0, WORTH_VISITING: 0, JUST_OKAY: 0, WOULD_SKIP: 0 };
    reviews.forEach((r: any) => { if (recommendations[r.recommendation] !== undefined) recommendations[r.recommendation]++; });

    // Related nearby experiences (same category within ~10mi)
    let related: any[] = [];
    if (experience.latitude && experience.longitude) {
      const allSameCategory = await prisma.nearbyExperience.findMany({
        where: { category: experience.category, id: { not: experience.id }, isModerationPending: false },
        include: { reviews: { select: { starRating: true } }, _count: { select: { reviews: true } } },
        take: 50,
      });
      related = allSameCategory
        .map((e: any) => ({
          id: e.id, name: e.name, category: e.category, photoUrls: e.photoUrls,
          avgRating: e.reviews.length > 0 ? Math.round(e.reviews.reduce((s: number, r: any) => s + r.starRating, 0) / e.reviews.length * 10) / 10 : 0,
          reviewCount: e._count.reviews,
          distance: e.latitude && e.longitude ? haversine(experience.latitude, experience.longitude, e.latitude, e.longitude) : null,
        }))
        .filter((e: any) => e.distance !== null && e.distance <= 10)
        .sort((a: any, b: any) => b.avgRating - a.avgRating)
        .slice(0, 6);
    }

    // Community tips (review bodies)
    const tips = reviews.filter((r: any) => r.body && r.body.length > 20).map((r: any) => ({
      tip: r.body, user: r.user, starRating: r.starRating, bestTimeToVisit: r.bestTimeToVisit,
    })).slice(0, 5);

    res.json({ ...experience, avgRating, recommendations, related, tips });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences — Submit a new place (upserts by placeId) ──
router.post('/', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { name, address, category, description, website, latitude, longitude, photoUrls, placeId } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // If placeId provided, return existing record if found
    if (placeId) {
      const existing = await prisma.nearbyExperience.findUnique({ where: { placeId } });
      if (existing) return res.json(existing);
    }

    const experience = await prisma.nearbyExperience.create({
      data: {
        name, address, category: category || 'OTHER', description, website,
        latitude: latitude ? parseFloat(latitude) : null,
        longitude: longitude ? parseFloat(longitude) : null,
        photoUrls: photoUrls || [],
        placeId: placeId || null,
        addedByUserId: userId,
        isModerationPending: false, // Auto-approved when created from Google Places data
        isVerified: false,
      },
    });
    res.status(201).json(experience);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/visit — Mark 'I've Been Here' ──
router.post('/:id/visit', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const visit = await prisma.experienceVisit.upsert({
      where: { experienceId_userId: { experienceId: req.params.id, userId } },
      create: { experienceId: req.params.id, userId },
      update: {},
    });
    res.json(visit);

    // Holden/Hannah follow-up nudge for kid/family places (non-blocking)
    setImmediate(async () => {
      try {
        const exp = await prisma.nearbyExperience.findUnique({ where: { id: req.params.id }, select: { name: true, category: true } });
        if (!exp) return;
        const kidCategories = ['PLAYGROUND', 'ATTRACTION', 'FISHING_SPOT'];
        const familyCategories = ['MUSEUM', 'RESTAURANT', 'ATTRACTION', 'MARKET'];
        const isKid = kidCategories.includes(exp.category);
        const isFamily = familyCategories.includes(exp.category);
        if (!isKid && !isFamily) return;

        const character = isKid ? 'Holden' : 'Hannah';
        const emoji = isKid ? '🏕️' : '📚';
        const message = isKid
          ? `${emoji} Hope the kids had a blast at ${exp.name}! How many stars would you give it?`
          : `${emoji} How was ${exp.name} for the family? A quick review helps other families!`;

        await prisma.notification.create({
          data: {
            userId,
            type: 'CHARACTER_REVIEW_NUDGE',
            content: message,
            link: `/experiences/${req.params.id}`,
            actorName: character,
            actorAvatar: isKid
              ? 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/holden.jpg'
              : 'https://res.cloudinary.com/dy6eetmh7/image/upload/v1781042437/rvunicorn/characters/hannah.jpg',
            metadata: { experienceId: req.params.id, character },
          },
        });
      } catch {}
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/reviews — Submit review ──
router.post('/:id/reviews', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { starRating, recommendation, body, photoUrls, bestTimeToVisit, familyFriendlyRating, petFriendlyRating, accessibilityNotes } = req.body;
    if (!starRating || !recommendation) return res.status(400).json({ error: 'Rating and recommendation required' });

    // Auto-create visit if not exists
    await prisma.experienceVisit.upsert({
      where: { experienceId_userId: { experienceId: req.params.id, userId } },
      create: { experienceId: req.params.id, userId },
      update: {},
    });

    const review = await prisma.experienceReview.create({
      data: {
        experienceId: req.params.id, userId, starRating: parseInt(starRating),
        recommendation, body, photoUrls: photoUrls || [],
        bestTimeToVisit, familyFriendlyRating: familyFriendlyRating ? parseInt(familyFriendlyRating) : null,
        petFriendlyRating: petFriendlyRating ? parseInt(petFriendlyRating) : null,
        accessibilityNotes,
      },
      include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });

    // Badge checks (non-blocking)
    setImmediate(async () => {
      try {
        // Road Trip Reviewer — first review
        const reviewCount = await prisma.experienceReview.count({ where: { userId } });
        if (reviewCount === 1) {
          const badge = await prisma.badge.findUnique({ where: { slug: 'road-trip-reviewer' } }).catch(() => null);
          if (badge) await prisma.userBadge.upsert({ where: { userId_badgeId: { userId, badgeId: badge.id } }, create: { userId, badgeId: badge.id }, update: {} }).catch(() => {});
        }
        // Hidden Gem Finder — first to review a place
        const placeReviewCount = await prisma.experienceReview.count({ where: { experienceId: req.params.id } });
        if (placeReviewCount === 1) {
          const badge = await prisma.badge.findUnique({ where: { slug: 'hidden-gem-finder' } }).catch(() => null);
          if (badge) await prisma.userBadge.upsert({ where: { userId_badgeId: { userId, badgeId: badge.id } }, create: { userId, badgeId: badge.id }, update: {} }).catch(() => {});
        }
        // Trail Scout — 5 trail reviews
        const exp = await prisma.nearbyExperience.findUnique({ where: { id: req.params.id }, select: { category: true } });
        if (exp?.category === 'TRAIL') {
          const trailReviews = await prisma.experienceReview.count({
            where: { userId, experience: { category: 'TRAIL' } },
          });
          if (trailReviews >= 5) {
            const badge = await prisma.badge.findUnique({ where: { slug: 'trail-scout' } }).catch(() => null);
            if (badge) await prisma.userBadge.upsert({ where: { userId_badgeId: { userId, badgeId: badge.id } }, create: { userId, badgeId: badge.id }, update: {} }).catch(() => {});
          }
        }
        // Family Travel Expert — 5 family-friendly ratings
        if (familyFriendlyRating) {
          const ffCount = await prisma.experienceReview.count({ where: { userId, familyFriendlyRating: { not: null } } });
          if (ffCount >= 5) {
            const badge = await prisma.badge.findUnique({ where: { slug: 'family-travel-expert' } }).catch(() => null);
            if (badge) await prisma.userBadge.upsert({ where: { userId_badgeId: { userId, badgeId: badge.id } }, create: { userId, badgeId: badge.id }, update: {} }).catch(() => {});
          }
        }
        // Attraction Explorer — visited 10 different categories
        const visitedCategories = await prisma.experienceVisit.findMany({
          where: { userId },
          include: { experience: { select: { category: true } } },
        });
        const uniqueCategories = new Set(visitedCategories.map((v: any) => v.experience.category));
        if (uniqueCategories.size >= 10) {
          const badge = await prisma.badge.findUnique({ where: { slug: 'attraction-explorer' } }).catch(() => null);
          if (badge) await prisma.userBadge.upsert({ where: { userId_badgeId: { userId, badgeId: badge.id } }, create: { userId, badgeId: badge.id }, update: {} }).catch(() => {});
        }
      } catch (badgeErr) {
        console.error('[Experience Badges] error:', badgeErr);
      }
    });

    res.status(201).json(review);
  } catch (e: any) {
    if (e.code === 'P2002') return res.status(400).json({ error: 'You already reviewed this place' });
    res.status(500).json({ error: e.message });
  }
});

// ── PUT /api/experiences/:id/reviews/:reviewId — Edit own review ──
router.put('/:id/reviews/:reviewId', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const existing = await prisma.experienceReview.findUnique({ where: { id: req.params.reviewId } });
    if (!existing || existing.userId !== userId) return res.status(403).json({ error: 'Not your review' });

    const { starRating, recommendation, body, photoUrls, bestTimeToVisit, familyFriendlyRating, petFriendlyRating, accessibilityNotes } = req.body;
    const updated = await prisma.experienceReview.update({
      where: { id: req.params.reviewId },
      data: {
        ...(starRating && { starRating: parseInt(starRating) }),
        ...(recommendation && { recommendation }),
        ...(body !== undefined && { body }),
        ...(photoUrls && { photoUrls }),
        ...(bestTimeToVisit !== undefined && { bestTimeToVisit }),
        ...(familyFriendlyRating !== undefined && { familyFriendlyRating: familyFriendlyRating ? parseInt(familyFriendlyRating) : null }),
        ...(petFriendlyRating !== undefined && { petFriendlyRating: petFriendlyRating ? parseInt(petFriendlyRating) : null }),
        ...(accessibilityNotes !== undefined && { accessibilityNotes }),
      },
    });
    res.json(updated);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/reviews/:reviewId/vote — Helpful/Not Helpful toggle ──
router.post('/:id/reviews/:reviewId/vote', authenticateToken, async (req: any, res: Response) => {
  try {
    const userId = req.userId;
    const { vote } = req.body; // HELPFUL or NOT_HELPFUL
    if (!['HELPFUL', 'NOT_HELPFUL'].includes(vote)) return res.status(400).json({ error: 'Invalid vote' });

    const existing = await prisma.experienceReviewVote.findUnique({
      where: { reviewId_userId: { reviewId: req.params.reviewId, userId } },
    });

    if (existing && existing.vote === vote) {
      // Toggle off — remove vote
      await prisma.experienceReviewVote.delete({ where: { id: existing.id } });
      await prisma.experienceReview.update({
        where: { id: req.params.reviewId },
        data: { [vote === 'HELPFUL' ? 'helpfulCount' : 'notHelpfulCount']: { decrement: 1 } },
      });
      return res.json({ removed: true });
    }

    if (existing) {
      // Switch vote
      const oldField = existing.vote === 'HELPFUL' ? 'helpfulCount' : 'notHelpfulCount';
      const newField = vote === 'HELPFUL' ? 'helpfulCount' : 'notHelpfulCount';
      await prisma.experienceReviewVote.update({ where: { id: existing.id }, data: { vote } });
      await prisma.experienceReview.update({
        where: { id: req.params.reviewId },
        data: { [oldField]: { decrement: 1 }, [newField]: { increment: 1 } },
      });
      return res.json({ switched: true, vote });
    }

    // New vote
    await prisma.experienceReviewVote.create({ data: { reviewId: req.params.reviewId, userId, vote } });
    await prisma.experienceReview.update({
      where: { id: req.params.reviewId },
      data: { [vote === 'HELPFUL' ? 'helpfulCount' : 'notHelpfulCount']: { increment: 1 } },
    });
    res.json({ voted: true, vote });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/questions ──
router.post('/:id/questions', authenticateToken, async (req: any, res: Response) => {
  try {
    const question = await prisma.experienceQuestion.create({
      data: { experienceId: req.params.id, userId: req.userId, question: req.body.question },
      include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.status(201).json(question);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/questions/:questionId/answers ──
router.post('/:id/questions/:questionId/answers', authenticateToken, async (req: any, res: Response) => {
  try {
    const answer = await prisma.experienceAnswer.create({
      data: { questionId: req.params.questionId, userId: req.userId, answer: req.body.answer },
      include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } },
    });
    res.status(201).json(answer);
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── POST /api/experiences/:id/questions/:questionId/answers/:answerId/helpful ──
router.post('/:id/questions/:questionId/answers/:answerId/helpful', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.experienceAnswer.update({
      where: { id: req.params.answerId },
      data: { helpfulCount: { increment: 1 } },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

// ── Admin: approve pending experience ──
router.post('/:id/approve', authenticateToken, async (req: any, res: Response) => {
  try {
    await prisma.nearbyExperience.update({
      where: { id: req.params.id },
      data: { isModerationPending: false, isVerified: true },
    });
    res.json({ success: true });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
