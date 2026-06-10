import { prisma } from '../prisma';
import crypto from 'crypto';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function md5(str: string): string {
  return crypto.createHash('md5').update(str).digest('hex');
}

/**
 * Bundle moments: group posts by campground, GPS cluster, or time window.
 */
export async function bundleMoments(rigId: string, timeWindowMinutes = 60) {
  const posts = await prisma.rigPost.findMany({
    where: { rigId, bundleId: null },
    orderBy: { createdAt: 'asc' },
  });

  if (posts.length === 0) return { bundleCount: 0 };

  // Set mediaHash on posts that have photos
  for (const post of posts) {
    if (!post.mediaHash && post.photos.length > 0) {
      const hash = md5(post.photos[0]);
      await prisma.rigPost.update({ where: { id: post.id }, data: { mediaHash: hash } });
      (post as any).mediaHash = hash;
    }
  }

  // Group into clusters
  const clusters: typeof posts[] = [];
  const assigned = new Set<string>();

  for (const post of posts) {
    if (assigned.has(post.id)) continue;
    const cluster = [post];
    assigned.add(post.id);

    for (const other of posts) {
      if (assigned.has(other.id)) continue;
      const timeDiff = Math.abs(new Date(post.createdAt).getTime() - new Date(other.createdAt).getTime()) / 60000;
      const sameLocation = post.tripId && post.tripId === other.tripId;
      if (timeDiff <= timeWindowMinutes || sameLocation) {
        cluster.push(other);
        assigned.add(other.id);
      }
    }

    if (cluster.length >= 1) clusters.push(cluster);
  }

  let bundleCount = 0;
  for (const cluster of clusters) {
    if (cluster.length < 2) continue; // Only bundle 2+ posts

    const allPhotos = cluster.flatMap(p => p.photos);
    const allStories = cluster.filter(p => p.body).map(p => p.body!);
    const contributors = [...new Set(cluster.map(p => p.userId))];
    const types = [...new Set(cluster.map(p => p.activityType || p.postType))];

    const bundle = await prisma.rigMomentBundle.create({
      data: {
        rigId,
        stopId: cluster[0].stopId,
        title: cluster[0].title || null,
        photoUrls: allPhotos,
        videoUrls: [],
        stories: allStories,
        featuredMediaUrl: allPhotos[0] || null,
        momentTypes: types,
        contributorIds: contributors,
        location: null,
        mediaHash: allPhotos[0] ? md5(allPhotos[0]) : null,
      },
    });

    for (const post of cluster) {
      await prisma.rigPost.update({ where: { id: post.id }, data: { bundleId: bundle.id } });
    }
    bundleCount++;
  }

  return { bundleCount, postCount: posts.length };
}

/**
 * Auto-assign posts to nearest stops by location + time overlap.
 */
export async function autoAssignToStops(rigId: string) {
  const posts = await prisma.rigPost.findMany({
    where: { rigId, stopId: null },
    orderBy: { createdAt: 'asc' },
  });

  const stops = await prisma.rigStop.findMany({
    where: { rigId },
    orderBy: { arrivedAt: 'asc' },
  });

  if (stops.length === 0 || posts.length === 0) return { assigned: 0 };

  let assigned = 0;
  for (const post of posts) {
    const postTime = new Date(post.createdAt).getTime();

    // Find best matching stop (time overlap or nearest)
    let bestStop: any = null;
    let bestScore = Infinity;

    for (const stop of stops) {
      const arrived = new Date(stop.arrivedAt).getTime();
      const departed = stop.departedAt ? new Date(stop.departedAt).getTime() : Date.now();

      if (postTime >= arrived && postTime <= departed) {
        // Post falls within this stop's time range — best match
        bestStop = stop;
        break;
      }

      const timeDist = Math.min(Math.abs(postTime - arrived), Math.abs(postTime - departed));
      if (timeDist < bestScore) {
        bestScore = timeDist;
        bestStop = stop;
      }
    }

    if (bestStop && bestScore < 24 * 60 * 60 * 1000) { // Within 24 hours
      await prisma.rigPost.update({ where: { id: post.id }, data: { stopId: bestStop.id } });

      // Update stop photo/contributor counts
      const contributor = post.userId;
      const currentContributors = bestStop.contributorIds || [];
      if (!currentContributors.includes(contributor)) {
        await prisma.rigStop.update({
          where: { id: bestStop.id },
          data: { contributorIds: [...currentContributors, contributor] },
        });
      }
      assigned++;
    }
  }

  return { assigned };
}

/**
 * Generate insight cards for a rig's trip.
 */
export async function generateInsightCards(rigId: string, tripId?: string) {
  const routes = await prisma.rigRouteSegment.findMany({
    where: { rigId, ...(tripId ? { tripId } : {}) },
  });
  const stops = await prisma.rigStop.findMany({
    where: { rigId, ...(tripId ? { tripId } : {}) },
    orderBy: { order: 'asc' },
  });

  if (stops.length === 0) return { cardCount: 0 };

  const totalMiles = routes.reduce((s: number, r: any) => s + (r.distanceMiles || 0), 0);
  const longestDay = routes.reduce((max: any, r: any) => (!max || r.distanceMiles > max.distanceMiles) ? r : max, null);
  const longestStay = stops.reduce((max: any, s: any) => (!max || (s.durationHours || 0) > (max.durationHours || 0)) ? s : max, null);

  const cards: any[] = [];

  // Overall trip stats card after 3rd stop
  if (stops.length >= 3) {
    cards.push({
      rigId, tripId, cardType: 'STATS',
      content: { totalMiles: Math.round(totalMiles), stopCount: stops.length, longestDrive: longestDay ? `${Math.round(longestDay.distanceMiles)} mi (${longestDay.fromLabel} → ${longestDay.toLabel})` : null, longestStay: longestStay ? `${longestStay.name} (${Math.round(longestStay.durationHours || 0)}h)` : null },
      displayAfterStopId: stops[2]?.id,
    });
  }

  // Mileage milestone cards
  const milestones = [100, 500, 1000, 2500, 5000];
  let runningMiles = 0;
  for (let i = 0; i < routes.length; i++) {
    const prevMiles = runningMiles;
    runningMiles += routes[i].distanceMiles || 0;
    for (const m of milestones) {
      if (prevMiles < m && runningMiles >= m) {
        cards.push({
          rigId, tripId, cardType: 'MILEAGE',
          content: { miles: m, message: `${m.toLocaleString()} miles on this trip!` },
          displayAfterStopId: routes[i].toStopId,
        });
      }
    }
  }

  // Create cards in DB
  for (const card of cards) {
    await prisma.rigInsightCard.create({ data: { ...card, content: card.content } }).catch(() => {});
  }

  return { cardCount: cards.length };
}
