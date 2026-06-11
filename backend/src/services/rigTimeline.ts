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
  // Posts
  const posts = await prisma.rigPost.findMany({ where: { rigId }, select: { id: true, title: true, body: true, photos: true, tripId: true, stopId: true, createdAt: true }, take: 200 });
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

  // Trip stops (check-ins)
  const stops = await prisma.rigTripStop.findMany({ where: { rigId }, select: { id: true, name: true, coverImageUrl: true, state: true, tripId: true, arrivedAt: true }, take: 200 }).catch(() => []);
  for (const s of stops) {
    await syncTimelineItem('CHECKIN', s.id, rigId, {
      title: `Checked into ${s.name}`, previewImageUrl: s.coverImageUrl, previewText: s.state,
      tripId: s.tripId, stopId: s.id, occurredAt: s.arrivedAt,
    });
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
