import { prisma } from '../prisma';

/**
 * Sync a single item to the RigTimelineItem table.
 */
export async function syncTimelineItem(itemType: string, refId: string, rigId: string, opts: {
  title?: string; previewImageUrl?: string; previewText?: string; tripId?: string; stopId?: string; occurredAt: Date;
}) {
  await prisma.rigTimelineItem.upsert({
    where: { rigId_refId_refType: { rigId, refId, refType: itemType } },
    create: { rigId, itemType, refId, refType: itemType, ...opts, occurredAt: opts.occurredAt },
    update: { title: opts.title, previewImageUrl: opts.previewImageUrl, previewText: opts.previewText, occurredAt: opts.occurredAt },
  }).catch(() => {});
}

/**
 * Build the unified timeline by scanning all content types.
 */
export async function buildTimeline(rigId: string) {
  // Posts (exclude rig showcase photos and friends-only from timeline)
  const posts = await (prisma as any).rigPost.findMany({ where: { rigId, isRigPhoto: false, OR: [{ visibility: 'PUBLIC' }, { visibility: 'BOTH' }, { visibility: null }] }, select: { id: true, title: true, body: true, photos: true, tripId: true, stopId: true, createdAt: true }, take: 200 });
  for (const p of posts) {
    await syncTimelineItem('PHOTO_ALBUM', p.id, rigId, {
      title: p.title || 'Photos', previewImageUrl: p.photos?.[0], previewText: p.body?.slice(0, 100),
      tripId: p.tripId, stopId: p.stopId, occurredAt: p.createdAt,
    });
  }

  // Videos
  const videos = await prisma.rigVideo.findMany({ where: { rigId }, select: { id: true, title: true, thumbnailUrl: true, videoType: true, tripId: true, stopId: true, createdAt: true }, take: 100 }).catch(() => []);
  for (const v of videos) {
    await syncTimelineItem('VIDEO', v.id, rigId, {
      title: v.title, previewImageUrl: v.thumbnailUrl, previewText: v.videoType,
      tripId: v.tripId, stopId: v.stopId, occurredAt: v.createdAt,
    });
  }

  // Stories
  const stories = await prisma.rigStory.findMany({ where: { rigId, isPublished: true }, select: { id: true, title: true, coverImageUrl: true, body: true, tripId: true, stopId: true, createdAt: true }, take: 100 }).catch(() => []);
  for (const s of stories) {
    await syncTimelineItem('STORY', s.id, rigId, {
      title: s.title, previewImageUrl: s.coverImageUrl, previewText: s.body?.slice(0, 100),
      tripId: s.tripId, stopId: s.stopId, occurredAt: s.createdAt,
    });
  }

  // Recipes
  const recipes = await prisma.rigRecipe.findMany({ where: { rigId }, select: { id: true, title: true, photoUrls: true, description: true, cookingMethod: true, tripId: true, createdAt: true }, take: 100 }).catch(() => []);
  for (const r of recipes) {
    await syncTimelineItem('RECIPE', r.id, rigId, {
      title: r.title, previewImageUrl: r.photoUrls?.[0], previewText: r.description?.slice(0, 100),
      tripId: r.tripId, occurredAt: r.createdAt,
    });
  }

  // Mods
  const mods = await prisma.rigMod.findMany({ where: { rigId }, select: { id: true, title: true, afterPhotoUrls: true, description: true, createdAt: true }, take: 100 }).catch(() => []);
  for (const m of mods) {
    await syncTimelineItem('MOD', m.id, rigId, {
      title: m.title, previewImageUrl: m.afterPhotoUrls?.[0], previewText: m.description?.slice(0, 100),
      occurredAt: m.createdAt,
    });
  }

  // Maintenance
  const maintenance = await prisma.rigMaintenanceLog.findMany({ where: { rigId, visibility: 'PUBLIC' }, select: { id: true, title: true, category: true, serviceDate: true }, take: 100 }).catch(() => []);
  for (const l of maintenance) {
    await syncTimelineItem('MAINTENANCE', l.id, rigId, {
      title: l.title, previewText: l.category, occurredAt: l.serviceDate,
    });
  }

  // Check-ins — DEDUPED into one timeline item per stay (not per row)
  // Collects all crew check-ins, groups by campground, merges overlapping/adjacent dates
  const rig = await prisma.rig.findUnique({ where: { id: rigId }, select: { ownerId: true } });
  if (rig) {
    const pilots = await prisma.rigPilot.findMany({ where: { rigId, shareActivityWithRig: true }, select: { userId: true } }).catch(() => []);
    const crewIds = [...new Set([rig.ownerId, ...pilots.map((p: any) => p.userId)])];
    const checkIns = await prisma.checkIn.findMany({
      where: { userId: { in: crewIds }, campgroundId: { not: null }, checkOutDate: { not: null } },
      select: { id: true, campgroundId: true, checkInDate: true, checkOutDate: true, tripId: true, campground: { select: { id: true, name: true, imageUrl: true, city: true, state: true } } },
      orderBy: { checkInDate: 'asc' },
      take: 500,
    }).catch(() => []);

    // Group by campground and merge overlapping/adjacent stays
    const byCampground = new Map<string, any[]>();
    for (const ci of checkIns) {
      if (!ci.campgroundId || !ci.campground) continue;
      const list = byCampground.get(ci.campgroundId) || [];
      list.push(ci);
      byCampground.set(ci.campgroundId, list);
    }

    const dedupedStays: any[] = [];
    for (const [cgId, group] of byCampground) {
      group.sort((a: any, b: any) => new Date(a.checkInDate).getTime() - new Date(b.checkInDate).getTime());
      let cur = { ...group[0], checkInDate: new Date(group[0].checkInDate), checkOutDate: new Date(group[0].checkOutDate) };
      for (let i = 1; i < group.length; i++) {
        const next = group[i];
        const nextIn = new Date(next.checkInDate).getTime();
        const curOut = cur.checkOutDate.getTime();
        if (nextIn <= curOut + 86400000) {
          // Overlapping/adjacent — merge
          const nextOut = new Date(next.checkOutDate).getTime();
          if (nextOut > curOut) cur.checkOutDate = new Date(nextOut);
          if (!cur.tripId && next.tripId) cur.tripId = next.tripId;
        } else {
          dedupedStays.push(cur);
          cur = { ...next, checkInDate: new Date(next.checkInDate), checkOutDate: new Date(next.checkOutDate) };
        }
      }
      dedupedStays.push(cur);
    }

    // Delete old per-row CHECKIN timeline items and replace with deduped stays
    await prisma.rigTimelineItem.deleteMany({ where: { rigId, itemType: 'CHECKIN' } }).catch(() => {});

    for (const stay of dedupedStays) {
      const cg = stay.campground;
      const nights = Math.max(1, Math.round((stay.checkOutDate.getTime() - stay.checkInDate.getTime()) / 86400000));
      const startStr = stay.checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const endStr = stay.checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      const dateRange = nights > 1 ? `${startStr}–${endStr}` : startStr;

      await syncTimelineItem('CHECKIN', `stay-${cg.id}-${stay.checkInDate.toISOString().slice(0, 10)}`, rigId, {
        title: `Checked into ${cg.name}`,
        previewImageUrl: cg.imageUrl || undefined,
        previewText: JSON.stringify({
          state: cg.state, city: cg.city,
          location: cg.city ? `${cg.city}, ${cg.state}` : cg.state,
          campgroundId: cg.id, campgroundName: cg.name,
          nights, dateRange,
          checkOutDate: stay.checkOutDate.toISOString(),
        }),
        tripId: stay.tripId || undefined,
        occurredAt: stay.checkInDate,
      });
    }
  }

  // Also sync RigTripStop check-ins (if any exist and aren't duplicates of CheckIn-based stays)
  const stops = await prisma.rigTripStop.findMany({ where: { rigId }, select: { id: true, name: true, coverImageUrl: true, state: true, city: true, hitchOneLiner: true, campgroundId: true, tripId: true, arrivedAt: true }, take: 200 }).catch(() => []);
  for (const s of stops) {
    // Only sync if not already covered by a CheckIn-based stay
    const existing = await prisma.rigTimelineItem.findFirst({ where: { rigId, itemType: 'CHECKIN', previewText: { contains: s.campgroundId || 'none' } } }).catch(() => null);
    if (!existing) {
      await syncTimelineItem('CHECKIN', s.id, rigId, {
        title: `Checked into ${s.name}`, previewImageUrl: s.coverImageUrl,
        previewText: JSON.stringify({ state: s.state, city: s.city, location: s.city ? `${s.city}, ${s.state}` : s.state, hitchLine: s.hitchOneLiner, campgroundId: s.campgroundId }),
        tripId: s.tripId, stopId: s.id, occurredAt: s.arrivedAt,
      });
    }
  }

  // Trip milestones
  const milestones = await prisma.rigTripMilestone.findMany({ where: { rigId }, select: { id: true, title: true, description: true, tripId: true, stopId: true, occurredAt: true }, take: 100 }).catch(() => []);
  for (const m of milestones) {
    await syncTimelineItem('MILESTONE', m.id, rigId, {
      title: m.title, previewText: m.description, tripId: m.tripId, stopId: m.stopId, occurredAt: m.occurredAt,
    });
  }

  // Journal entries
  const journal = await prisma.rigJournalEntry.findMany({ where: { rigId, isPublic: true }, select: { id: true, title: true, coverImageUrl: true, body: true, tripId: true, stopId: true, createdAt: true }, take: 100 }).catch(() => []);
  for (const j of journal) {
    await syncTimelineItem('JOURNAL', j.id, rigId, {
      title: j.title, previewImageUrl: j.coverImageUrl, previewText: j.body?.slice(0, 100),
      tripId: j.tripId, stopId: j.stopId, occurredAt: j.createdAt,
    });
  }

  const count = await prisma.rigTimelineItem.count({ where: { rigId } });
  return { synced: count };
}
