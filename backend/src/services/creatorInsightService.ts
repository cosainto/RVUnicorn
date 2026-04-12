import { prisma } from '../prisma';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateCreatorInsights(creatorId: string): Promise<void> {
  const now = new Date();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const rawInsights: { type: string; rawHeadline: string; rawDetail: string; actionLabel?: string; actionUrl?: string }[] = [];

  // 1. POST RECAP — recent trips with no content about that campground
  try {
    const recentCheckIns = await prisma.checkIn.findMany({
      where: { userId: creatorId, createdAt: { gte: fourteenDaysAgo } },
      include: { campground: { select: { id: true, name: true, state: true } } },
      orderBy: { createdAt: 'desc' },
    });

    for (const ci of recentCheckIns) {
      if (!ci.campground) continue;
      const contentAboutIt = await (prisma as any).creatorContent.count({
        where: { creatorId, campgroundId: ci.campground.id, status: 'PUBLISHED' },
      });
      if (contentAboutIt === 0) {
        rawInsights.push({
          type: 'POST_SUGGESTION',
          rawHeadline: `You stayed at ${ci.campground.name} but haven't posted about it yet`,
          rawDetail: `Your followers would love a recap of ${ci.campground.name}, ${ci.campground.state}`,
          actionLabel: 'Create Recap',
          actionUrl: `/creator/new?campgroundId=${ci.campground.id}`,
        });
        break; // Only one recap suggestion
      }
    }
  } catch {}

  // 2. AUDIENCE DESTINATION — where followers are going
  try {
    const followerIds = (await (prisma as any).creatorFollow.findMany({
      where: { creatorId },
      select: { followerId: true },
      take: 200,
    })).map((f: any) => f.followerId);

    if (followerIds.length > 10) {
      const followerTrips = await prisma.event.findMany({
        where: {
          organizerId: { in: followerIds },
          startDate: { gte: now, lte: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
          campground: { isNot: null },
        },
        select: { campground: { select: { state: true } } },
      });

      const stateCounts: Record<string, number> = {};
      for (const t of followerTrips) {
        const state = (t.campground as any)?.state;
        if (state) stateCounts[state] = (stateCounts[state] || 0) + 1;
      }

      const topState = Object.entries(stateCounts).sort((a, b) => b[1] - a[1])[0];
      if (topState && topState[1] >= 3) {
        rawInsights.push({
          type: 'AUDIENCE_INSIGHT',
          rawHeadline: `${topState[1]} of your followers are heading to ${topState[0]} this month`,
          rawDetail: `Content about ${topState[0]} campgrounds would be highly relevant right now`,
          actionLabel: 'Create Post',
          actionUrl: '/creator/new',
        });
      }
    }
  } catch {}

  // 3. TIMING SUGGESTION — best posting time
  try {
    const recentPosts = await (prisma as any).creatorContent.findMany({
      where: { creatorId, status: 'PUBLISHED' },
      orderBy: { publishedAt: 'desc' },
      take: 10,
      select: { publishedAt: true, viewCount: true, likeCount: true },
    });

    if (recentPosts.length >= 5) {
      let bestHour = 18; // default
      let bestEngagement = 0;
      const hourBuckets: Record<number, { total: number; count: number }> = {};

      for (const p of recentPosts) {
        if (!p.publishedAt) continue;
        const hour = new Date(p.publishedAt).getHours();
        if (!hourBuckets[hour]) hourBuckets[hour] = { total: 0, count: 0 };
        hourBuckets[hour].total += (p.viewCount || 0) + (p.likeCount || 0) * 5;
        hourBuckets[hour].count += 1;
      }

      for (const [h, data] of Object.entries(hourBuckets)) {
        const avg = data.total / data.count;
        if (avg > bestEngagement) {
          bestEngagement = avg;
          bestHour = parseInt(h);
        }
      }

      const timeLabel = bestHour === 0 ? '12am' : bestHour < 12 ? `${bestHour}am` : bestHour === 12 ? '12pm' : `${bestHour - 12}pm`;
      rawInsights.push({
        type: 'TIMING_SUGGESTION',
        rawHeadline: `Your content performs best when posted around ${timeLabel}`,
        rawDetail: `Based on your last 10 posts, engagement peaks at this time`,
        actionLabel: 'Schedule a Post',
        actionUrl: '/creator/new',
      });
    }
  } catch {}

  // 4. CONTENT TYPE INSIGHT — highest engagement category
  try {
    const allContent = await (prisma as any).creatorContent.findMany({
      where: { creatorId, status: 'PUBLISHED' },
      select: { category: true, viewCount: true, likeCount: true, saveCount: true },
    });

    if (allContent.length >= 5) {
      const catStats: Record<string, { total: number; count: number }> = {};
      for (const c of allContent) {
        const cat = c.category || 'uncategorized';
        if (!catStats[cat]) catStats[cat] = { total: 0, count: 0 };
        catStats[cat].total += (c.saveCount || 0);
        catStats[cat].count += 1;
      }

      const sorted = Object.entries(catStats).filter(([, d]) => d.count >= 2).sort((a, b) => (b[1].total / b[1].count) - (a[1].total / a[1].count));
      if (sorted.length >= 2) {
        const best = sorted[0][0].replace(/_/g, ' ').toLowerCase();
        const ratio = ((sorted[0][1].total / sorted[0][1].count) / Math.max(1, sorted[1][1].total / sorted[1][1].count)).toFixed(1);
        rawInsights.push({
          type: 'CONTENT_RECAP',
          rawHeadline: `Your ${best} content gets ${ratio}x more saves`,
          rawDetail: `Double down on what works — your audience responds to ${best}`,
        });
      }
    }
  } catch {}

  // 5. TRIP KIT SUGGESTION — content cluster without a kit
  try {
    const campgroundContent = await (prisma as any).creatorContent.findMany({
      where: { creatorId, status: 'PUBLISHED', campgroundId: { not: null } },
      select: { campgroundId: true },
    });

    const cgCounts: Record<string, number> = {};
    for (const c of campgroundContent) {
      cgCounts[c.campgroundId] = (cgCounts[c.campgroundId] || 0) + 1;
    }

    const clusters = Object.entries(cgCounts).filter(([, count]) => count >= 3);
    if (clusters.length > 0) {
      // Check if kit already exists for these campgrounds
      const existingKits = await (prisma as any).tripKit.count({
        where: { creatorId, campgrounds: { some: { campgroundId: { in: clusters.map(([id]) => id) } } } },
      });

      if (existingKits === 0) {
        const topCg = clusters.sort((a, b) => b[1] - a[1])[0];
        const cg = await prisma.campground.findUnique({ where: { id: topCg[0] }, select: { name: true } });
        rawInsights.push({
          type: 'TRIP_KIT_SUGGESTION',
          rawHeadline: `You have ${topCg[1]} posts about ${cg?.name || 'a campground'} — turn it into a Trip Kit`,
          rawDetail: `Trip Kits let followers instantly plan their trip using your route`,
          actionLabel: 'Create Trip Kit',
          actionUrl: '/creator/trip-kits/new',
        });
      }
    }
  } catch {}

  if (rawInsights.length === 0) return;

  // Use Claude to polish the headlines in Hitch's voice
  try {
    const prompt = rawInsights.map((ins, i) => `${i + 1}. Type: ${ins.type}\nHeadline: ${ins.rawHeadline}\nDetail: ${ins.rawDetail}`).join('\n\n');

    const aiRes = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1000,
      system: 'You are Hitch, a knowledgeable RV mentor on RVUnicorn. Rewrite each creator insight to be direct, actionable, and specific. Use their data. Sound like a smart colleague, not a bot. Max 2 sentences per insight. Return as JSON array: [{"headline":"...","detail":"..."}]',
      messages: [{ role: 'user', content: `Polish these creator insights:\n\n${prompt}` }],
    });

    const text = aiRes.content[0].type === 'text' ? aiRes.content[0].text : '';
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    const polished = jsonMatch ? JSON.parse(jsonMatch[0]) : null;

    for (let i = 0; i < rawInsights.length; i++) {
      const ins = rawInsights[i];
      const pol = polished?.[i];
      await (prisma as any).creatorInsightAction.create({
        data: {
          creatorId,
          type: ins.type,
          headline: pol?.headline || ins.rawHeadline,
          detail: pol?.detail || ins.rawDetail,
          actionLabel: ins.actionLabel || null,
          actionUrl: ins.actionUrl || null,
          expiresAt: sevenDaysFromNow,
        },
      });
    }
  } catch (e) {
    // Fallback: save without AI polish
    for (const ins of rawInsights) {
      await (prisma as any).creatorInsightAction.create({
        data: {
          creatorId,
          type: ins.type,
          headline: ins.rawHeadline,
          detail: ins.rawDetail,
          actionLabel: ins.actionLabel || null,
          actionUrl: ins.actionUrl || null,
          expiresAt: sevenDaysFromNow,
        },
      });
    }
  }

  console.log(`[CreatorInsights] Generated ${rawInsights.length} insights for creator ${creatorId}`);
}
