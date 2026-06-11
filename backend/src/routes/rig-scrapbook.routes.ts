import { Router, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { syncTimelineItem, buildTimeline } from '../services/rigTimeline';

const router = Router();
const prisma = new PrismaClient() as any;

async function getRig(slug: string) {
  return prisma.rig.findUnique({ where: { slug }, select: { id: true, ownerId: true } });
}

// ═══ TIMELINE ═══
router.get('/:slug/timeline', async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const limit = parseInt(req.query.limit) || 30;
    const where: any = { rigId: rig.id };
    if (req.query.cursor) where.occurredAt = { lt: new Date(req.query.cursor) };
    const items = await prisma.rigTimelineItem.findMany({ where, orderBy: { occurredAt: 'desc' }, take: limit });
    res.json({ items, nextCursor: items.length === limit ? items[items.length - 1].occurredAt.toISOString() : null });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/:slug/timeline/sync', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug);
    if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const result = await buildTimeline(rig.id);
    res.json(result);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ STORIES ═══
router.get('/:slug/stories', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const stories = await prisma.rigStory.findMany({ where: { rigId: rig.id, isPublished: true }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, lastName: true, profilePicture: true } } } }); res.json(stories); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/stories', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const story = await prisma.rigStory.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('STORY', story.id, rig.id, { title: story.title, previewImageUrl: story.coverImageUrl, previewText: story.body?.slice(0, 100), occurredAt: story.createdAt });
    res.status(201).json(story);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/stories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigStory.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/stories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigStory.delete({ where: { id: req.params.id } }); await prisma.rigTimelineItem.deleteMany({ where: { rigId: rig.id, refId: req.params.id } }).catch(() => {}); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/stories/:id/like', authenticateToken, async (req: any, res) => { try { await prisma.rigStory.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ RECIPES ═══
router.get('/:slug/recipes', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id }; if (req.query.method) where.cookingMethod = req.query.method; if (req.query.difficulty) where.difficulty = req.query.difficulty; const recipes = await prisma.rigRecipe.findMany({ where, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(recipes); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/recipes', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const recipe = await prisma.rigRecipe.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('RECIPE', recipe.id, rig.id, { title: recipe.title, previewImageUrl: recipe.photoUrls?.[0], previewText: recipe.description?.slice(0, 100), occurredAt: recipe.createdAt });
    res.status(201).json(recipe);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/recipes/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigRecipe.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/recipes/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigRecipe.delete({ where: { id: req.params.id } }); await prisma.rigTimelineItem.deleteMany({ where: { rigId: rig.id, refId: req.params.id } }).catch(() => {}); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/recipes/:id/like', authenticateToken, async (req: any, res) => { try { await prisma.rigRecipe.update({ where: { id: req.params.id }, data: { likes: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/recipes/:id/save', authenticateToken, async (req: any, res) => { try { await prisma.rigRecipe.update({ where: { id: req.params.id }, data: { saves: { increment: 1 } } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ MEMORIES ═══
router.get('/:slug/memories', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const where: any = { rigId: rig.id }; if (req.query.pinned === 'true') where.isPinned = true; const memories = await prisma.rigMemory.findMany({ where, orderBy: [{ isPinned: 'desc' }, { order: 'asc' }, { createdAt: 'desc' }] }); res.json(memories); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/memories', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const memory = await prisma.rigMemory.create({ data: { rigId: rig.id, userId: req.userId, ...req.body, date: req.body.date ? new Date(req.body.date) : null } });
    syncTimelineItem('MEMORY', memory.id, rig.id, { title: memory.title, previewImageUrl: memory.photoUrls?.[0], previewText: memory.description?.slice(0, 100), occurredAt: memory.date || memory.createdAt });
    res.status(201).json(memory);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/memories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigMemory.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/memories/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigMemory.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.post('/:slug/memories/:id/pin', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const m = await prisma.rigMemory.findUnique({ where: { id: req.params.id } }); res.json(await prisma.rigMemory.update({ where: { id: req.params.id }, data: { isPinned: !m?.isPinned, order: req.body.order || 0 } })); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ JOURNAL ═══
router.get('/:slug/journal', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const entries = await prisma.rigJournalEntry.findMany({ where: { rigId: rig.id, isPublic: true }, orderBy: { createdAt: 'desc' }, include: { user: { select: { id: true, firstName: true, profilePicture: true } } } }); res.json(entries); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/journal', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    const entry = await prisma.rigJournalEntry.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } });
    syncTimelineItem('JOURNAL', entry.id, rig.id, { title: entry.title, previewImageUrl: entry.coverImageUrl, previewText: entry.body?.slice(0, 100), occurredAt: entry.createdAt });
    res.status(201).json(entry);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/journal/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigJournalEntry.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/journal/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigJournalEntry.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ CHECKLISTS ═══
router.get('/:slug/checklists', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const lists = await prisma.rigChecklist.findMany({ where: { rigId: rig.id, isPublic: true }, orderBy: { createdAt: 'desc' } }); res.json(lists); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/checklists', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); const cl = await prisma.rigChecklist.create({ data: { rigId: rig.id, userId: req.userId, ...req.body } }); res.status(201).json(cl); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.put('/:slug/checklists/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigChecklist.update({ where: { id: req.params.id }, data: req.body })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/checklists/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigChecklist.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ CO-PILOTS ═══
router.get('/:slug/copilots', async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig) return res.status(404).json({ error: 'Rig not found' }); const copilots = await prisma.rigCoPilot.findMany({ where: { rigId: rig.id }, include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } }, orderBy: { joinedAt: 'asc' } }); res.json(copilots); } catch (e: any) { res.status(500).json({ error: e.message }); }
});
router.post('/:slug/copilots', authenticateToken, async (req: any, res) => {
  try {
    const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' });
    let targetId = req.body.userId;
    if (!targetId && req.body.username) { const u = await prisma.user.findUnique({ where: { username: req.body.username }, select: { id: true } }); targetId = u?.id; }
    if (!targetId) return res.status(400).json({ error: 'User not found' });
    const cp = await prisma.rigCoPilot.create({ data: { rigId: rig.id, userId: targetId, role: req.body.role || 'COPILOT' }, include: { user: { select: { id: true, firstName: true, lastName: true, username: true, profilePicture: true } } } });
    res.status(201).json(cp);
  } catch (e: any) { if (e.code === 'P2002') return res.status(400).json({ error: 'Already a co-pilot' }); res.status(500).json({ error: e.message }); }
});
router.put('/:slug/copilots/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rigCoPilot.update({ where: { id: req.params.id }, data: { role: req.body.role } })); } catch (e: any) { res.status(500).json({ error: e.message }); } });
router.delete('/:slug/copilots/:id', authenticateToken, async (req: any, res) => { try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); await prisma.rigCoPilot.delete({ where: { id: req.params.id } }); res.json({ success: true }); } catch (e: any) { res.status(500).json({ error: e.message }); } });

// ═══ RIG STORY BIO ═══
router.put('/:slug/story', authenticateToken, async (req: any, res) => {
  try { const rig = await getRig(req.params.slug); if (!rig || rig.ownerId !== req.userId) return res.status(403).json({ error: 'Not authorized' }); res.json(await prisma.rig.update({ where: { id: rig.id }, data: { story: req.body.story, storyUpdatedAt: new Date() } })); } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ ROUTE MAP DATA ═══
router.get('/:slug/routemap', async (req: any, res) => {
  try {
    const rig = await prisma.rig.findUnique({ where: { slug: req.params.slug }, select: { id: true, totalStatesVisited: true, totalMilesAllTime: true, totalNightsAllTime: true, totalCampgroundsAllTime: true, totalMilesDriven: true, totalStatesCount: true, totalNightsCamped: true } });
    if (!rig) return res.status(404).json({ error: 'Rig not found' });
    const stops = await prisma.rigTripStop.findMany({ where: { rigId: rig.id, lat: { not: null } }, select: { lat: true, lng: true, name: true, campgroundId: true, state: true }, orderBy: { arrivedAt: 'asc' } });
    const routes = stops.slice(1).map((s: any, i: number) => ({ fromLat: stops[i].lat, fromLng: stops[i].lng, toLat: s.lat, toLng: s.lng }));
    const statesVisited = [...new Set(stops.map((s: any) => s.state).filter(Boolean))];
    res.json({
      statesVisited, routes,
      campgroundsVisited: stops.filter((s: any) => s.campgroundId).map((s: any) => ({ name: s.name, lat: s.lat, lng: s.lng })),
      stats: { totalMiles: rig.totalMilesAllTime || rig.totalMilesDriven || 0, totalNights: rig.totalNightsAllTime || rig.totalNightsCamped || 0, totalStates: statesVisited.length || rig.totalStatesCount || 0, totalCampgrounds: rig.totalCampgroundsAllTime || 0 },
    });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ═══ ADMIN: SYNC ALL TIMELINES ═══
router.post('/admin/sync-timelines', authenticateToken, async (req: any, res) => {
  try {
    const rigs = await prisma.rig.findMany({ select: { id: true } });
    for (const rig of rigs) await buildTimeline(rig.id).catch(() => {});
    res.json({ synced: rigs.length });
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
