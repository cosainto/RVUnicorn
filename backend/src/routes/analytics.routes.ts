import express from "express";
import { PrismaClient } from "@prisma/client";
import { authenticateToken } from "../middleware/auth.middleware";

const router = express.Router();
const prisma = new PrismaClient();

// ============================================
// VIDEO WATCH TRACKING
// ============================================

// Track video watch progress (called during playback)
router.post("/video/:videoId/watch", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user?.id;
    const { 
      sessionId, 
      watchedSeconds, 
      totalDuration, 
      dropOffSecond,
      rewatchCount = 0,
      source = "FEED",
      deviceType
    } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: "sessionId required" });
    }

    const video = await prisma.video.findUnique({ 
      where: { id: videoId },
      select: { userId: true }
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Check if viewer is a follower
    let isFollower = false;
    if (userId && video.userId !== userId) {
      const follow = await prisma.follow.findFirst({
        where: { followerId: userId, followingId: video.userId }
      });
      isFollower = !!follow;
    }

    const completionRate = totalDuration > 0 
      ? Math.min(100, (watchedSeconds / totalDuration) * 100) 
      : 0;

    // Upsert watch record for this session
    const watch = await prisma.videoWatch.upsert({
      where: {
        id: `${videoId}-${sessionId}` // Composite key workaround
      },
      create: {
        id: `${videoId}-${sessionId}`,
        videoId,
        userId,
        sessionId,
        watchedSeconds,
        totalDuration,
        completionRate,
        dropOffSecond,
        rewatchCount,
        source,
        deviceType,
        isFollower
      },
      update: {
        watchedSeconds: Math.max(watchedSeconds),
        completionRate,
        dropOffSecond,
        rewatchCount
      }
    });

    res.json({ recorded: true, completionRate: completionRate.toFixed(1) });
  } catch (error) {
    console.error("Error tracking video watch:", error);
    res.status(500).json({ error: "Failed to track watch" });
  }
});

// ============================================
// DASHBOARD OVERVIEW
// ============================================

// Get creator dashboard overview
router.get("/dashboard", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { period = "7d" } = req.query;

    const periodDays = period === "30d" ? 30 : period === "90d" ? 90 : 7;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const previousStartDate = new Date(startDate);
    previousStartDate.setDate(previousStartDate.getDate() - periodDays);

    // Follower growth
    const [currentFollowers, previousFollowers, totalFollowers] = await Promise.all([
      prisma.follow.count({
        where: { followingId: userId, createdAt: { gte: startDate } }
      }),
      prisma.follow.count({
        where: { 
          followingId: userId, 
          createdAt: { gte: previousStartDate, lt: startDate } 
        }
      }),
      prisma.follow.count({ where: { followingId: userId } })
    ]);

    // Content metrics
    const [videos, photos] = await Promise.all([
      prisma.video.findMany({
        where: { userId, publishedAt: { not: null } },
        select: { id: true, viewCount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100
      }),
      prisma.photo.findMany({
        where: { userId, publishedAt: { not: null } },
        select: { id: true, viewCount: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 100
      })
    ]);

    const totalViews = videos.reduce((sum, v) => sum + v.viewCount, 0) +
                       photos.reduce((sum, p) => sum + p.viewCount, 0);

    // Engagement metrics
    const [videoReactions, photoReactions, videoSaves, photoSaves] = await Promise.all([
      prisma.videoLike.count({
        where: { video: { userId }, createdAt: { gte: startDate } }
      }),
      prisma.photoReaction.count({
        where: { photo: { userId }, createdAt: { gte: startDate } }
      }),
      prisma.videoSave.count({
        where: { video: { userId }, createdAt: { gte: startDate } }
      }),
      prisma.photoSave.count({
        where: { photo: { userId }, createdAt: { gte: startDate } }
      })
    ]);

    const totalEngagement = videoReactions + photoReactions + videoSaves + photoSaves;

    // Video-specific metrics
    const videoWatches = await prisma.videoWatch.findMany({
      where: { 
        video: { userId },
        createdAt: { gte: startDate }
      },
      select: {
        watchedSeconds: true,
        completionRate: true,
        source: true,
        isFollower: true
      }
    });

    const avgCompletion = videoWatches.length > 0
      ? videoWatches.reduce((sum, w) => sum + w.completionRate, 0) / videoWatches.length
      : 0;

    const totalWatchTime = videoWatches.reduce((sum, w) => sum + w.watchedSeconds, 0);

    // Source breakdown
    const sourceBreakdown = videoWatches.reduce((acc: any, w) => {
      acc[w.source] = (acc[w.source] || 0) + 1;
      return acc;
    }, {});

    // Follower vs non-follower views
    const followerViews = videoWatches.filter(w => w.isFollower).length;
    const nonFollowerViews = videoWatches.filter(w => !w.isFollower).length;

    res.json({
      period: periodDays,
      followers: {
        total: totalFollowers,
        gained: currentFollowers,
        previousPeriod: previousFollowers,
        growthRate: previousFollowers > 0 
          ? ((currentFollowers - previousFollowers) / previousFollowers * 100).toFixed(1)
          : currentFollowers > 0 ? 100 : 0
      },
      content: {
        totalVideos: videos.length,
        totalPhotos: photos.length,
        totalViews,
        recentVideos: videos.filter(v => v.createdAt >= startDate).length,
        recentPhotos: photos.filter(p => p.createdAt >= startDate).length
      },
      engagement: {
        total: totalEngagement,
        reactions: videoReactions + photoReactions,
        saves: videoSaves + photoSaves,
        engagementRate: totalViews > 0 
          ? ((totalEngagement / totalViews) * 100).toFixed(2)
          : 0
      },
      videoInsights: {
        totalWatches: videoWatches.length,
        avgCompletionRate: avgCompletion.toFixed(1),
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        avgWatchTimeSeconds: videoWatches.length > 0 
          ? Math.round(totalWatchTime / videoWatches.length)
          : 0
      },
      audienceBreakdown: {
        followerViews,
        nonFollowerViews,
        followerRate: videoWatches.length > 0
          ? ((followerViews / videoWatches.length) * 100).toFixed(1)
          : 0
      },
      sourceBreakdown
    });
  } catch (error) {
    console.error("Error fetching dashboard:", error);
    res.status(500).json({ error: "Failed to fetch dashboard" });
  }
});

// ============================================
// VIDEO ANALYTICS (Deep Dive)
// ============================================

// Get detailed analytics for a specific video
router.get("/video/:videoId", authenticateToken, async (req: any, res) => {
  try {
    const { videoId } = req.params;
    const userId = req.user.id;

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        user: { select: { id: true } },
        likes: { select: { type: true, createdAt: true, userId: true } },
        saves: { select: { createdAt: true } },
        tags: {
          include: { user: { select: { id: true, username: true, firstName: true, lastName: true } } }
        }
      }
    });

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    if (video.user.id !== userId) {
      return res.status(403).json({ error: "You can only view analytics for your own videos" });
    }

    // Get all watch data
    const watches = await prisma.videoWatch.findMany({
      where: { videoId },
      orderBy: { createdAt: "desc" }
    });

    // Calculate metrics
    const totalViews = watches.length;
    const uniqueViewers = new Set(watches.map(w => w.userId || w.sessionId)).size;
    const avgCompletion = totalViews > 0
      ? watches.reduce((sum, w) => sum + w.completionRate, 0) / totalViews
      : 0;
    const totalWatchTime = watches.reduce((sum, w) => sum + w.watchedSeconds, 0);

    // Drop-off analysis (where people stop watching)
    const dropOffPoints: Record<number, number> = {};
    watches.forEach(w => {
      if (w.dropOffSecond && w.completionRate < 95) {
        // Group into 5-second buckets
        const bucket = Math.floor(w.dropOffSecond / 5) * 5;
        dropOffPoints[bucket] = (dropOffPoints[bucket] || 0) + 1;
      }
    });

    // Find the biggest drop-off point
    let maxDropOff = { second: 0, count: 0 };
    Object.entries(dropOffPoints).forEach(([second, count]) => {
      if (count > maxDropOff.count) {
        maxDropOff = { second: parseInt(second), count };
      }
    });

    // Completion rate distribution
    const completionBuckets = {
      '0-25%': 0,
      '25-50%': 0,
      '50-75%': 0,
      '75-100%': 0
    };
    watches.forEach(w => {
      if (w.completionRate < 25) completionBuckets['0-25%']++;
      else if (w.completionRate < 50) completionBuckets['25-50%']++;
      else if (w.completionRate < 75) completionBuckets['50-75%']++;
      else completionBuckets['75-100%']++;
    });

    // Source breakdown
    const sources = watches.reduce((acc: any, w) => {
      acc[w.source] = (acc[w.source] || 0) + 1;
      return acc;
    }, {});

    // Audience breakdown
    const followerViews = watches.filter(w => w.isFollower).length;
    const avgFollowerCompletion = watches.filter(w => w.isFollower).length > 0
      ? watches.filter(w => w.isFollower).reduce((sum, w) => sum + w.completionRate, 0) / followerViews
      : 0;
    const avgNonFollowerCompletion = watches.filter(w => !w.isFollower).length > 0
      ? watches.filter(w => !w.isFollower).reduce((sum, w) => sum + w.completionRate, 0) / (totalViews - followerViews)
      : 0;

    // Reaction breakdown
    const reactionCounts: Record<string, number> = {};
    video.likes.forEach(l => {
      const type = l.type || 'LIKE';
      reactionCounts[type] = (reactionCounts[type] || 0) + 1;
    });

    // Daily views trend (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const dailyViews: Record<string, number> = {};
    watches.filter(w => w.createdAt >= thirtyDaysAgo).forEach(w => {
      const date = w.createdAt.toISOString().split('T')[0];
      dailyViews[date] = (dailyViews[date] || 0) + 1;
    });

    // Device breakdown
    const devices = watches.reduce((acc: any, w) => {
      const device = w.deviceType || 'UNKNOWN';
      acc[device] = (acc[device] || 0) + 1;
      return acc;
    }, {});

    // Rewatch rate
    const rewatches = watches.filter(w => w.rewatchCount > 0).length;
    const rewatchRate = totalViews > 0 ? (rewatches / totalViews) * 100 : 0;

    res.json({
      video: {
        id: video.id,
        title: video.title,
        duration: video.duration,
        thumbnailUrl: video.thumbnailUrl,
        createdAt: video.createdAt,
        visibility: video.visibility
      },
      overview: {
        totalViews,
        uniqueViewers,
        totalWatchTimeMinutes: Math.round(totalWatchTime / 60),
        avgWatchTimeSeconds: totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0,
        avgCompletionRate: avgCompletion.toFixed(1),
        totalReactions: video.likes.length,
        totalSaves: video.saves.length
      },
      watchBehavior: {
        completionDistribution: completionBuckets,
        dropOffAnalysis: {
          points: dropOffPoints,
          biggestDropOff: maxDropOff,
          insight: maxDropOff.count > 0 
            ? `${maxDropOff.count} viewers stopped watching around ${maxDropOff.second} seconds`
            : null
        },
        rewatchRate: rewatchRate.toFixed(1)
      },
      audience: {
        followerViews,
        nonFollowerViews: totalViews - followerViews,
        followerCompletionRate: avgFollowerCompletion.toFixed(1),
        nonFollowerCompletionRate: avgNonFollowerCompletion.toFixed(1),
        insight: avgFollowerCompletion > avgNonFollowerCompletion
          ? "Your followers watch longer than non-followers"
          : avgNonFollowerCompletion > avgFollowerCompletion
            ? "Non-followers are highly engaged - great discovery potential!"
            : null
      },
      discovery: {
        sources,
        topSource: Object.entries(sources).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || 'FEED',
        devices
      },
      engagement: {
        reactions: reactionCounts,
        totalReactions: video.likes.length,
        saves: video.saves.length,
        taggedUsers: video.tags.length,
        engagementRate: totalViews > 0 
          ? ((video.likes.length + video.saves.length) / totalViews * 100).toFixed(2)
          : 0
      },
      trends: {
        dailyViews,
        peakDay: Object.entries(dailyViews).sort((a: any, b: any) => b[1] - a[1])[0]?.[0] || null
      }
    });
  } catch (error) {
    console.error("Error fetching video analytics:", error);
    res.status(500).json({ error: "Failed to fetch analytics" });
  }
});

// ============================================
// TOP CONTENT
// ============================================

// Get top performing content
router.get("/top-content", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { type = "all", metric = "views", limit = 10 } = req.query;

    // Get videos
    let videos: any[] = [];
    if (type === "all" || type === "video") {
      videos = await prisma.video.findMany({
        where: { userId, publishedAt: { not: null } },
        include: {
          likes: true,
          saves: true,
          watches: {
            select: { completionRate: true }
          }
        },
        orderBy: { viewCount: "desc" },
        take: parseInt(limit as string)
      });
    }

    // Get photos
    let photos: any[] = [];
    if (type === "all" || type === "photo") {
      photos = await prisma.photo.findMany({
        where: { userId, publishedAt: { not: null } },
        include: {
          reactions: true,
          saves: true
        },
        orderBy: { viewCount: "desc" },
        take: parseInt(limit as string)
      });
    }

    // Calculate scores
    const scoredContent = [
      ...videos.map(v => ({
        id: v.id,
        type: 'VIDEO',
        title: v.title,
        thumbnailUrl: v.thumbnailUrl,
        createdAt: v.createdAt,
        views: v.viewCount,
        reactions: v.likes.length,
        saves: v.saves.length,
        avgCompletion: v.watches.length > 0 
          ? v.watches.reduce((sum: number, w: any) => sum + w.completionRate, 0) / v.watches.length
          : 0,
        engagementRate: v.viewCount > 0 
          ? ((v.likes.length + v.saves.length) / v.viewCount * 100)
          : 0
      })),
      ...photos.map(p => ({
        id: p.id,
        type: 'PHOTO',
        title: p.caption?.slice(0, 50) || 'Untitled',
        thumbnailUrl: p.imageUrl,
        createdAt: p.createdAt,
        views: p.viewCount,
        reactions: p.reactions.length,
        saves: p.saves.length,
        avgCompletion: null,
        engagementRate: p.viewCount > 0 
          ? ((p.reactions.length + p.saves.length) / p.viewCount * 100)
          : 0
      }))
    ];

    // Sort by requested metric
    const sortedContent = scoredContent.sort((a, b) => {
      switch (metric) {
        case 'engagement':
          return b.engagementRate - a.engagementRate;
        case 'reactions':
          return b.reactions - a.reactions;
        case 'saves':
          return b.saves - a.saves;
        case 'completion':
          return (b.avgCompletion || 0) - (a.avgCompletion || 0);
        default:
          return b.views - a.views;
      }
    }).slice(0, parseInt(limit as string));

    res.json({
      content: sortedContent,
      metric,
      insights: generateContentInsights(sortedContent)
    });
  } catch (error) {
    console.error("Error fetching top content:", error);
    res.status(500).json({ error: "Failed to fetch top content" });
  }
});

function generateContentInsights(content: any[]) {
  const insights: string[] = [];

  if (content.length === 0) return insights;

  // Video vs photo performance
  const videos = content.filter(c => c.type === 'VIDEO');
  const photos = content.filter(c => c.type === 'PHOTO');
  
  if (videos.length > 0 && photos.length > 0) {
    const avgVideoEngagement = videos.reduce((sum, v) => sum + v.engagementRate, 0) / videos.length;
    const avgPhotoEngagement = photos.reduce((sum, p) => sum + p.engagementRate, 0) / photos.length;
    
    if (avgVideoEngagement > avgPhotoEngagement * 1.2) {
      insights.push("Your videos get 20%+ higher engagement than photos");
    } else if (avgPhotoEngagement > avgVideoEngagement * 1.2) {
      insights.push("Your photos get 20%+ higher engagement than videos");
    }
  }

  // High completion rate videos
  const highCompletionVideos = videos.filter(v => v.avgCompletion > 75);
  if (highCompletionVideos.length > 0) {
    insights.push(`${highCompletionVideos.length} videos have 75%+ completion rate - great retention!`);
  }

  // Save rate
  const highSaveContent = content.filter(c => c.saves > c.reactions * 0.5);
  if (highSaveContent.length > 0) {
    insights.push("Some content has high save rates - it's valuable reference material");
  }

  return insights;
}

// ============================================
// AUDIENCE INSIGHTS
// ============================================

// Get audience insights
router.get("/audience", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    // Get followers
    const followers = await prisma.follow.findMany({
      where: { followingId: userId },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            firstName: true,
            lastName: true,
            profilePicture: true,
            createdAt: true
          }
        }
      },
      orderBy: { createdAt: "desc" }
    });

    // Get most engaged followers (based on reactions)
    const engagedFollowers = await prisma.user.findMany({
      where: {
        following: { some: { followingId: userId } }
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        profilePicture: true,
        videoLikes: {
          where: { video: { userId } },
          select: { id: true }
        },
        photoReactions: {
          where: { photo: { userId } },
          select: { id: true }
        }
      }
    });

    const sortedEngaged = engagedFollowers
      .map(f => ({
        ...f,
        engagementCount: f.videoLikes.length + f.photoReactions.length
      }))
      .filter(f => f.engagementCount > 0)
      .sort((a, b) => b.engagementCount - a.engagementCount)
      .slice(0, 20);

    // Follower growth by week
    const twelveWeeksAgo = new Date();
    twelveWeeksAgo.setDate(twelveWeeksAgo.getDate() - 84);
    
    const weeklyGrowth: Record<string, number> = {};
    followers
      .filter(f => f.createdAt >= twelveWeeksAgo)
      .forEach(f => {
        const weekStart = getWeekStart(f.createdAt);
        weeklyGrowth[weekStart] = (weeklyGrowth[weekStart] || 0) + 1;
      });

    // New vs returning viewers (from video watches)
    const recentWatches = await prisma.videoWatch.findMany({
      where: { 
        video: { userId },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      select: { userId: true, isFollower: true }
    });

    const uniqueWatchers = new Set(recentWatches.map(w => w.userId).filter(Boolean));

    res.json({
      overview: {
        totalFollowers: followers.length,
        newFollowers7d: followers.filter(f => 
          f.createdAt >= new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ).length,
        newFollowers30d: followers.filter(f => 
          f.createdAt >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        ).length
      },
      recentFollowers: followers.slice(0, 10).map(f => ({
        ...f.follower,
        followedAt: f.createdAt
      })),
      topEngagedFollowers: sortedEngaged.slice(0, 10).map(f => ({
        id: f.id,
        username: f.username,
        firstName: f.firstName,
        lastName: f.lastName,
        profilePicture: f.profilePicture,
        engagementCount: f.engagementCount
      })),
      growth: {
        weekly: weeklyGrowth
      },
      viewerInsights: {
        uniqueViewers30d: uniqueWatchers.size,
        followerViewers: recentWatches.filter(w => w.isFollower).length,
        nonFollowerViewers: recentWatches.filter(w => !w.isFollower).length
      }
    });
  } catch (error) {
    console.error("Error fetching audience insights:", error);
    res.status(500).json({ error: "Failed to fetch audience insights" });
  }
});

function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

// ============================================
// RECOMMENDATIONS
// ============================================

// Get AI-powered recommendations
router.get("/recommendations", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;

    const recommendations: Array<{
      type: string;
      title: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      action?: string;
    }> = [];

    // Get recent content performance
    const recentVideos = await prisma.video.findMany({
      where: { 
        userId, 
        publishedAt: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      include: {
        watches: { select: { completionRate: true, source: true } },
        likes: true,
        saves: true
      }
    });

    const recentPhotos = await prisma.photo.findMany({
      where: { 
        userId, 
        publishedAt: { not: null },
        createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      },
      include: {
        reactions: true,
        saves: true
      }
    });

    // Check posting frequency
    if (recentVideos.length < 4 && recentPhotos.length < 8) {
      recommendations.push({
        type: 'POSTING_FREQUENCY',
        title: 'Post More Consistently',
        description: 'You\'ve posted less than usual this month. Consistent posting helps maintain engagement.',
        priority: 'HIGH',
        action: 'Try posting at least 2 videos or 4 photos per week'
      });
    }

    // Check video completion rates
    if (recentVideos.length > 0) {
      const avgCompletion = recentVideos.reduce((sum, v) => {
        const videoAvg = v.watches.length > 0
          ? v.watches.reduce((s, w) => s + w.completionRate, 0) / v.watches.length
          : 0;
        return sum + videoAvg;
      }, 0) / recentVideos.length;

      if (avgCompletion < 50) {
        recommendations.push({
          type: 'VIDEO_LENGTH',
          title: 'Consider Shorter Videos',
          description: `Your average completion rate is ${avgCompletion.toFixed(0)}%. Shorter videos often perform better.`,
          priority: 'HIGH',
          action: 'Try keeping videos under 60 seconds'
        });
      } else if (avgCompletion > 75) {
        recommendations.push({
          type: 'VIDEO_SUCCESS',
          title: 'Great Video Retention!',
          description: `Your ${avgCompletion.toFixed(0)}% completion rate is excellent. Your audience loves your content length.`,
          priority: 'LOW'
        });
      }
    }

    // Check save rates
    const totalSaves = recentVideos.reduce((sum, v) => sum + v.saves.length, 0) +
                       recentPhotos.reduce((sum, p) => sum + p.saves.length, 0);
    const totalViews = recentVideos.reduce((sum, v) => sum + v.viewCount, 0) +
                       recentPhotos.reduce((sum, p) => sum + p.viewCount, 0);
    
    if (totalViews > 100 && totalSaves / totalViews > 0.05) {
      recommendations.push({
        type: 'HIGH_SAVES',
        title: 'Your Content Gets Saved!',
        description: 'High save rate means your content is valuable. Consider creating more reference-worthy content.',
        priority: 'MEDIUM',
        action: 'Create tutorial or guide-style content'
      });
    }

    // Check discovery sources
    const allWatches = recentVideos.flatMap(v => v.watches);
    const discoveryViews = allWatches.filter(w => w.source === 'DISCOVERY').length;
    
    if (discoveryViews > allWatches.length * 0.1) {
      recommendations.push({
        type: 'DISCOVERY_SUCCESS',
        title: 'You\'re Being Discovered!',
        description: `${((discoveryViews / allWatches.length) * 100).toFixed(0)}% of views come from discovery. Your content is reaching new audiences.`,
        priority: 'MEDIUM'
      });
    } else if (allWatches.length > 50 && discoveryViews < allWatches.length * 0.05) {
      recommendations.push({
        type: 'IMPROVE_DISCOVERY',
        title: 'Boost Your Discoverability',
        description: 'Most views come from your followers. Add relevant tags and hashtags to reach new audiences.',
        priority: 'MEDIUM',
        action: 'Tag people and locations in your content'
      });
    }

    // Content type recommendation
    if (recentVideos.length > 0 && recentPhotos.length > 0) {
      const videoEngagement = recentVideos.reduce((sum, v) => sum + v.likes.length + v.saves.length, 0) / recentVideos.length;
      const photoEngagement = recentPhotos.reduce((sum, p) => sum + p.reactions.length + p.saves.length, 0) / recentPhotos.length;
      
      if (videoEngagement > photoEngagement * 1.5) {
        recommendations.push({
          type: 'CONTENT_TYPE',
          title: 'Videos Are Your Strength',
          description: 'Your videos get significantly more engagement than photos. Focus on video content.',
          priority: 'MEDIUM'
        });
      } else if (photoEngagement > videoEngagement * 1.5) {
        recommendations.push({
          type: 'CONTENT_TYPE',
          title: 'Photos Are Your Strength',
          description: 'Your photos get significantly more engagement than videos. Keep up the great photography!',
          priority: 'MEDIUM'
        });
      }
    }

    res.json({
      recommendations: recommendations.sort((a, b) => {
        const priority = { HIGH: 0, MEDIUM: 1, LOW: 2 };
        return priority[a.priority] - priority[b.priority];
      }),
      lastUpdated: new Date()
    });
  } catch (error) {
    console.error("Error fetching recommendations:", error);
    res.status(500).json({ error: "Failed to fetch recommendations" });
  }
});

// ============================================
// PROFILE VISIT TRACKING
// ============================================

// Track profile visit
router.post("/profile-visit/:profileUserId", authenticateToken, async (req: any, res) => {
  try {
    const { profileUserId } = req.params;
    const visitorId = req.user?.id;
    const { source = "DIRECT", sourceContentId } = req.body;

    if (visitorId === profileUserId) {
      return res.json({ recorded: false, reason: "own_profile" });
    }

    await prisma.profileVisit.create({
      data: {
        profileUserId,
        visitorId,
        source,
        sourceContentId
      }
    });

    res.json({ recorded: true });
  } catch (error) {
    console.error("Error tracking profile visit:", error);
    res.status(500).json({ error: "Failed to track visit" });
  }
});

// Get profile visit funnel
router.get("/profile-funnel", authenticateToken, async (req: any, res) => {
  try {
    const userId = req.user.id;
    const { period = "30d" } = req.query;

    const periodDays = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    const visits = await prisma.profileVisit.findMany({
      where: {
        profileUserId: userId,
        createdAt: { gte: startDate }
      },
      select: {
        source: true,
        sourceContentId: true,
        resultedInFollow: true
      }
    });

    const follows = await prisma.follow.count({
      where: {
        followingId: userId,
        createdAt: { gte: startDate }
      }
    });

    // Source breakdown
    const sources = visits.reduce((acc: any, v) => {
      acc[v.source] = (acc[v.source] || 0) + 1;
      return acc;
    }, {});

    // Conversion rate
    const conversionRate = visits.length > 0 
      ? (follows / visits.length * 100).toFixed(1)
      : 0;

    res.json({
      period: periodDays,
      totalVisits: visits.length,
      newFollowers: follows,
      conversionRate,
      sources,
      insight: parseFloat(conversionRate as string) > 10 
        ? "Great conversion rate! Your profile makes a strong impression."
        : parseFloat(conversionRate as string) < 5 && visits.length > 20
          ? "Consider updating your profile to convert more visitors to followers."
          : null
    });
  } catch (error) {
    console.error("Error fetching profile funnel:", error);
    res.status(500).json({ error: "Failed to fetch funnel data" });
  }
});

export default router;
