import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';

const router = Router();
import { prisma } from '../lib/prisma';

// GET /api/overnight-stops?lat=&lng=&radius=&type=&search=
router.get('/', optionalAuth, async (req: any, res) => {
  try {
    const { lat, lng, radius = 25, type, state, search } = req.query;
    let stops: any[] = [];

    if (search && (search as string).length >= 2) {
      // Text search by name or chain
      const q = search as string;
      const where: any = {
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { chain: { contains: q.toUpperCase().replace(/['\s]/g, '_'), mode: 'insensitive' } },
          { city: { contains: q, mode: 'insensitive' } },
        ],
        ...(type ? { stopType: type as string } : {}),
      };
      // If lat/lng provided with search, add proximity filter
      if (lat && lng) {
        const latN = parseFloat(lat as string);
        const lngN = parseFloat(lng as string);
        const r = parseFloat(radius as string) / 69;
        where.latitude = { gte: latN - r, lte: latN + r };
        where.longitude = { gte: lngN - r, lte: lngN + r };
      }
      stops = await prisma.overnightStop.findMany({
        where,
        include: {
          reviews: { select: { rating: true, safetyRating: true } },
          _count: { select: { reviews: true, visits: true } },
        },
        take: 20,
        orderBy: { visitCount: 'desc' },
      });
    } else if (lat && lng) {
      const latN = parseFloat(lat as string);
      const lngN = parseFloat(lng as string);
      const r = parseFloat(radius as string) / 69; // degrees approx
      stops = await prisma.overnightStop.findMany({
        where: {
          latitude: { gte: latN - r, lte: latN + r },
          longitude: { gte: lngN - r, lte: lngN + r },
          ...(type ? { stopType: type as string } : {}),
        },
        include: {
          reviews: { select: { rating: true, safetyRating: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 3, include: { user: { select: { firstName: true, username: true } } } },
          _count: { select: { reviews: true } },
        },
        take: 30,
      });
    } else if (state) {
      stops = await prisma.overnightStop.findMany({
        where: { state: state as string, ...(type ? { stopType: type as string } : {}) },
        include: {
          reviews: { select: { rating: true, safetyRating: true } },
          updates: { orderBy: { createdAt: 'desc' }, take: 3, include: { user: { select: { firstName: true, username: true } } } },
          _count: { select: { reviews: true } },
        },
        take: 50,
      });
    }

    // Compute average ratings
    const enriched = stops.map(s => ({
      ...s,
      avgRating: s.reviews.length ? s.reviews.reduce((a: number, r: any) => a + r.rating, 0) / s.reviews.length : null,
      avgSafetyRating: s.reviews.length ? s.reviews.reduce((a: number, r: any) => a + r.safetyRating, 0) / s.reviews.length : null,
    }));

    res.json(enriched);
  } catch (error: any) {
    console.error('Overnight stops error:', error);
    res.status(500).json({ error: 'Failed to fetch overnight stops' });
  }
});

// GET /api/overnight-stops/me/visits — current user's visit history
router.get('/me/visits', authenticateToken, async (req: any, res) => {
  try {
    const visits = await prisma.overnightStopVisit.findMany({
      where: { userId: req.userId },
      include: { overnightStop: { select: { id: true, name: true, city: true, state: true, chain: true, stopType: true } } },
      orderBy: { date: 'desc' },
      take: 50,
    });
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch your visits' });
  }
});

// POST /api/overnight-stops/admin/:id/verify
router.post('/admin/:id/verify', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.userId }, select: { email: true } });
    const ADMIN_EMAILS = ['wroberts82@yahoo.com', 'deanna@rvunicorn.com'];
    if (!user || !ADMIN_EMAILS.includes(user.email?.toLowerCase())) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const stop = await prisma.overnightStop.update({
      where: { id: req.params.id },
      data: { isVerified: true },
    });
    res.json(stop);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to verify stop' });
  }
});

// GET /api/overnight-stops/admin/pending — unverified user-submitted stops
router.get('/admin/pending', authenticateToken, async (req: any, res) => {
  try {
    const stops = await prisma.overnightStop.findMany({
      where: { isVerified: false, submittedByUserId: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(stops);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch pending stops' });
  }
});

// GET /api/overnight-stops/:id
router.get('/:id', optionalAuth, async (req: any, res) => {
  try {
    const stop = await prisma.overnightStop.findUnique({
      where: { id: req.params.id },
      include: {
        reviews: {
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } },
        },
        updates: {
          orderBy: { createdAt: 'desc' },
          take: 10,
          include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
        },
        visits: {
          where: { isPublic: true },
          orderBy: { date: 'desc' },
          take: 20,
        },
        _count: { select: { reviews: true, visits: true } },
      },
    });
    if (!stop) return res.status(404).json({ error: 'Not found' });

    const avgRating = stop.reviews.length ? stop.reviews.reduce((a: any, r: any) => a + r.rating, 0) / stop.reviews.length : null;
    const avgSafetyRating = stop.reviews.length ? stop.reviews.reduce((a: any, r: any) => a + r.safetyRating, 0) / stop.reviews.length : null;

    // Compute flag percentages from visits
    const allVisits = await prisma.overnightStopVisit.findMany({
      where: { overnightStopId: req.params.id },
      select: {
        flagRVFriendly: true, flagFeltSafe: true, flagBigRigOK: true,
        flagTightLot: true, flagPolicyUnclear: true, flagHasShowers: true,
        flagHasElectric: true, flagHasDump: true, flagWellLit: true,
        flagPetFriendly: true, flagQuietNight: true, flagGoodSignal: true,
        flagAteInside: true,
      },
    });

    function pct(field: string): { yes: number; total: number; pct: number } | null {
      const votes = allVisits.filter((v: any) => v[field] !== null);
      if (votes.length === 0) return null;
      const yes = votes.filter((v: any) => v[field] === true).length;
      return { yes, total: votes.length, pct: Math.round((yes / votes.length) * 100) };
    }

    const flagBreakdown = {
      rvFriendly: pct('flagRVFriendly'),
      feltSafe: pct('flagFeltSafe'),
      bigRigOK: pct('flagBigRigOK'),
      tightLot: pct('flagTightLot'),
      policyUnclear: pct('flagPolicyUnclear'),
      hasShowers: pct('flagHasShowers'),
      hasElectric: pct('flagHasElectric'),
      hasDump: pct('flagHasDump'),
      wellLit: pct('flagWellLit'),
      petFriendly: pct('flagPetFriendly'),
      quietNight: pct('flagQuietNight'),
      goodSignal: pct('flagGoodSignal'),
      ateInside: pct('flagAteInside'),
    };

    // Tips sorted by length (longer = more helpful)
    const tips = allVisits.length > 0
      ? (await prisma.overnightStopVisit.findMany({
          where: { overnightStopId: req.params.id, tip: { not: null }, isPublic: true },
          orderBy: { createdAt: 'desc' },
          select: { tip: true, date: true, userId: true, createdAt: true },
        })).sort((a: any, b: any) => (b.tip?.length || 0) - (a.tip?.length || 0))
      : [];

    res.json({ ...stop, avgRating, avgSafetyRating, flagBreakdown, tips });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch stop' });
  }
});

// GET /api/overnight-stops/search — alias with distance sorting
router.get('/search', optionalAuth, async (req: any, res) => {
  try {
    const { lat, lng, radius = 50, type, chain } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: 'lat and lng required' });
    const latN = parseFloat(lat as string);
    const lngN = parseFloat(lng as string);
    const r = parseFloat(radius as string) / 69;
    const where: any = {
      latitude: { gte: latN - r, lte: latN + r },
      longitude: { gte: lngN - r, lte: lngN + r },
    };
    if (type) where.stopType = type as string;
    if (chain) where.chain = chain as string;

    const stops = await prisma.overnightStop.findMany({
      where,
      include: {
        reviews: { select: { rating: true, safetyRating: true } },
        _count: { select: { reviews: true, visits: true } },
      },
      take: 50,
    });

    // Sort by distance
    const withDistance = stops.map((s: any) => {
      const dLat = s.latitude - latN;
      const dLng = s.longitude - lngN;
      const distMiles = Math.sqrt(dLat * dLat + dLng * dLng) * 69;
      return {
        ...s,
        distanceMiles: Math.round(distMiles * 10) / 10,
        avgRating: s.reviews.length ? s.reviews.reduce((a: number, r: any) => a + r.rating, 0) / s.reviews.length : null,
      };
    }).sort((a: any, b: any) => a.distanceMiles - b.distanceMiles);

    res.json(withDistance);
  } catch (error: any) {
    console.error('Search overnight stops error:', error);
    res.status(500).json({ error: 'Failed to search' });
  }
});

// GET /api/overnight-stops/chain/:chain — all stops for a specific chain
router.get('/chain/:chain', optionalAuth, async (req: any, res) => {
  try {
    const stops = await prisma.overnightStop.findMany({
      where: { chain: req.params.chain },
      include: { _count: { select: { reviews: true, visits: true } } },
      orderBy: { visitCount: 'desc' },
      take: 100,
    });
    res.json(stops);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch chain stops' });
  }
});

// POST /api/overnight-stops — create a new stop (any logged in user)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { name, address, city, state, latitude, longitude, stopType, chain, website, phone, notes, maxNights, requiresPermission } = req.body;
    if (!name || !address || !latitude || !longitude || !stopType) {
      return res.status(400).json({ error: 'name, address, lat, lng, stopType required' });
    }
    const stop = await prisma.overnightStop.create({
      data: {
        name, address, city, state,
        latitude: parseFloat(latitude), longitude: parseFloat(longitude),
        stopType, chain, website, phone, notes,
        maxNights: maxNights ? parseInt(maxNights) : null,
        requiresPermission: requiresPermission ?? false,
        submittedByUserId: req.userId,
      },
    });
    res.status(201).json(stop);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to create stop' });
  }
});

// POST /api/overnight-stops/:id/reviews
router.post('/:id/reviews', authenticateToken, async (req: any, res) => {
  try {
    const { rating, safetyRating, noiseLevel, content, visitDate, wouldReturn } = req.body;
    if (!rating || !safetyRating) return res.status(400).json({ error: 'rating and safetyRating required' });
    const review = await prisma.overnightStopReview.upsert({
      where: { stopId_userId: { stopId: req.params.id, userId: req.userId } },
      update: { rating: parseInt(rating), safetyRating: parseInt(safetyRating), noiseLevel, content, visitDate: visitDate ? new Date(visitDate) : null, wouldReturn: wouldReturn ?? true },
      create: { stopId: req.params.id, userId: req.userId, rating: parseInt(rating), safetyRating: parseInt(safetyRating), noiseLevel, content, visitDate: visitDate ? new Date(visitDate) : null, wouldReturn: wouldReturn ?? true },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json(review);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// POST /api/overnight-stops/:id/updates
router.post('/:id/updates', authenticateToken, async (req: any, res) => {
  try {
    const { content, updateType } = req.body;
    if (!content || !updateType) return res.status(400).json({ error: 'content and updateType required' });
    const update = await prisma.overnightStopUpdate.create({
      data: { stopId: req.params.id, userId: req.userId, content, updateType },
      include: { user: { select: { id: true, firstName: true, username: true, profilePicture: true } } },
    });
    res.json(update);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to post update' });
  }
});


// GET /api/overnight-stops/:id/travelers — who else is stopping here
router.get('/:id/travelers', optionalAuth, async (req: any, res) => {
  try {
    const { id } = req.params;
    const stop = await prisma.overnightStop.findUnique({
      where: { id },
      select: { latitude: true, longitude: true }
    });
    if (!stop) return res.status(404).json({ error: 'Not found' });

    // Find pit stops linked directly OR by proximity (within ~0.3 miles)
    const latDelta = 0.005; // ~0.3 miles
    const lngDelta = 0.005;
    const pitStops = await prisma.pitStop.findMany({
      where: {
        stopType: 'OVERNIGHT',
        OR: [
          { overnightStopId: id },
          {
            latitude: { gte: stop.latitude - latDelta, lte: stop.latitude + latDelta },
            longitude: { gte: stop.longitude - lngDelta, lte: stop.longitude + lngDelta },
          }
        ]
      },
      include: {
        tripPlan: {
          include: {
            user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } },
            event: { select: { id: true, title: true, startDate: true, endDate: true } }
          }
        }
      },
      orderBy: { estimatedArrival: 'asc' }
    });

    // Deduplicate by userId
    const seen = new Set<string>();
    const travelers = pitStops
      .filter((ps: any) => {
        const uid = ps.tripPlan?.user?.id;
        if (!uid || seen.has(uid)) return false;
        seen.add(uid);
        return true;
      })
      .map((ps: any) => ({
        user: ps.tripPlan.user,
        estimatedArrival: ps.estimatedArrival,
        tripTitle: ps.tripPlan.event?.title,
      }));

    res.json({ count: travelers.length, travelers });
  } catch (error: any) {
    console.error('Travelers error:', error);
    res.status(500).json({ error: 'Failed to fetch travelers' });
  }
});

// ─── Visits ─────────────────────────────────────────────────

// POST /api/overnight-stops/:id/visits — log a visit with community flags
router.post('/:id/visits', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    const stop = await prisma.overnightStop.findUnique({ where: { id } });
    if (!stop) return res.status(404).json({ error: 'Stop not found' });

    const visit = await prisma.overnightStopVisit.create({
      data: {
        overnightStopId: id,
        userId: req.userId,
        rigId: req.body.rigId || null,
        tripId: req.body.tripId || null,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        nights: req.body.nights || 1,
        note: req.body.note || null,
        tip: req.body.tip || null,
        photoUrls: req.body.photoUrls || [],
        isPublic: req.body.isPublic ?? true,
        flagRVFriendly: req.body.flagRVFriendly ?? null,
        flagFeltSafe: req.body.flagFeltSafe ?? null,
        flagBigRigOK: req.body.flagBigRigOK ?? null,
        flagTightLot: req.body.flagTightLot ?? null,
        flagPolicyUnclear: req.body.flagPolicyUnclear ?? null,
        flagHasShowers: req.body.flagHasShowers ?? null,
        flagHasElectric: req.body.flagHasElectric ?? null,
        flagHasDump: req.body.flagHasDump ?? null,
        flagWellLit: req.body.flagWellLit ?? null,
        flagPetFriendly: req.body.flagPetFriendly ?? null,
        flagQuietNight: req.body.flagQuietNight ?? null,
        flagGoodSignal: req.body.flagGoodSignal ?? null,
        flagAteInside: req.body.flagAteInside ?? null,
        maxRigLengthReported: req.body.maxRigLengthReported ? parseInt(req.body.maxRigLengthReported) : null,
      },
    });

    // Increment visit count
    await prisma.overnightStop.update({
      where: { id },
      data: { visitCount: { increment: 1 } },
    });

    // Recalculate aggregated flags
    await recalcFlags(id);

    res.status(201).json(visit);
  } catch (error: any) {
    console.error('Create visit error:', error);
    res.status(500).json({ error: 'Failed to log visit' });
  }
});

// GET /api/overnight-stops/:id/visits — public visits
router.get('/:id/visits', optionalAuth, async (req: any, res) => {
  try {
    const visits = await prisma.overnightStopVisit.findMany({
      where: { overnightStopId: req.params.id, isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(visits);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch visits' });
  }
});

// (me/visits and admin routes moved above /:id to avoid param conflicts)

// ─── Flag aggregation helper ────────────────────────────────

async function recalcFlags(stopId: string) {
  const visits = await prisma.overnightStopVisit.findMany({
    where: { overnightStopId: stopId },
    select: {
      flagRVFriendly: true, flagFeltSafe: true, flagBigRigOK: true,
      flagTightLot: true, flagPolicyUnclear: true, flagHasShowers: true,
      flagHasElectric: true, flagHasDump: true, flagWellLit: true,
      flagPetFriendly: true, maxRigLengthReported: true,
    },
  });

  if (visits.length < 1) return;

  function majorityVote(field: string): boolean | null {
    const votes = visits.filter((v: any) => v[field] !== null);
    if (votes.length < 3) return null;
    const trueCount = votes.filter((v: any) => v[field] === true).length;
    const pct = trueCount / votes.length;
    if (pct >= 0.7) return true;
    if (pct <= 0.3) return false;
    return null;
  }

  // Median rig length
  const rigLengths = visits.map((v: any) => v.maxRigLengthReported).filter(Boolean).sort((a: number, b: number) => a - b);
  const medianRigLength = rigLengths.length > 0 ? rigLengths[Math.floor(rigLengths.length / 2)] : null;

  await prisma.overnightStop.update({
    where: { id: stopId },
    data: {
      isRVFriendly: majorityVote('flagRVFriendly'),
      hasShowers: majorityVote('flagHasShowers'),
      hasElectric: majorityVote('flagHasElectric'),
      hasDump: majorityVote('flagHasDump'),
      isWellLit: majorityVote('flagWellLit'),
      isPetFriendly: majorityVote('flagPetFriendly'),
      isTightLot: majorityVote('flagTightLot'),
      policyUnclear: majorityVote('flagPolicyUnclear'),
      maxRigLength: medianRigLength,
    },
  });
}

export default router;
