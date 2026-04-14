import { Router } from 'express';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware';
import { prisma } from '../index';
import crypto from 'crypto';

const db = prisma as any;
const router = Router();

// Helper to generate unique IDs
const generateId = () => crypto.randomBytes(12).toString('hex');

// Helper to hash IP for privacy
const hashIP = (ip: string) => crypto.createHash('sha256').update(ip + 'rvunicorn-salt').digest('hex').substring(0, 16);

// ===========================================
// SPONSORED ADS - Serving & Tracking
// ===========================================

// GET /api/gear-ads/sponsored - Get sponsored ads for gear section
router.get('/sponsored', optionalAuth, async (req, res) => {
  try {
    const { category, limit = '3', campingStyles } = req.query;
    const userId = (req as any).user?.id;

    // Build query for active ads within budget
    const where: any = {
      isActive: true,
      startDate: { lte: new Date() },
      OR: [
        { endDate: null },
        { endDate: { gte: new Date() } }
      ]
    };

    // Filter by category if specified
    if (category) {
      where.category = category;
    }

    // Get ads, prioritize by bid amount
    const ads = await db.gearAd.findMany({
      where,
      orderBy: [
        { bidAmount: 'desc' },
        { createdAt: 'desc' }
      ],
      take: parseInt(limit as string),
      include: {
        Advertiser: {
          select: {
            name: true,
            logoUrl: true
          }
        }
      }
    });

    // Track impressions
    const sessionId = req.headers['x-session-id'] as string || generateId();
    const ipHash = hashIP(req.ip || 'unknown');

    for (const ad of ads) {
      // Record impression
      await db.gearAdEvent.create({
        data: {
          id: generateId(),
          adId: ad.id,
          userId: userId || null,
          eventType: 'IMPRESSION',
          sessionId,
          ipHash,
          userAgent: req.headers['user-agent'] || null
        }
      });

      // Update impression count
      await db.gearAd.update({
        where: { id: ad.id },
        data: { impressions: { increment: 1 } }
      });
    }

    // Format response
    const sponsoredItems = ads.map((ad: any) => ({
      id: ad.id,
      type: 'sponsored',
      name: ad.name,
      brand: ad.brand,
      description: ad.description,
      imageUrl: ad.imageUrl,
      linkUrl: ad.linkUrl,
      category: ad.category,
      advertiser: ad.Advertiser?.name,
      advertiserLogo: ad.Advertiser?.logoUrl
    }));

    res.json(sponsoredItems);
  } catch (error: any) {
    console.error('Get sponsored ads error:', error);
    res.status(500).json({ error: 'Failed to get sponsored ads' });
  }
});

// POST /api/gear-ads/:id/click - Track ad click
router.post('/:id/click', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user?.id;
    const sessionId = req.headers['x-session-id'] as string || generateId();
    const ipHash = hashIP(req.ip || 'unknown');

    const ad = await db.gearAd.findUnique({
      where: { id }
    });

    if (!ad) {
      return res.status(404).json({ error: 'Ad not found' });
    }

    // Record click
    await db.gearAdEvent.create({
      data: {
        id: generateId(),
        adId: id,
        userId: userId || null,
        eventType: 'CLICK',
        sessionId,
        ipHash,
        userAgent: req.headers['user-agent'] || null
      }
    });

    // Update click count and spend
    await db.gearAd.update({
      where: { id },
      data: {
        clicks: { increment: 1 },
        spent: { increment: ad.bidAmount }
      }
    });

    res.json({ 
      success: true, 
      redirectUrl: ad.affiliateUrl || ad.linkUrl 
    });
  } catch (error: any) {
    console.error('Track ad click error:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

// ===========================================
// AFFILIATE LINKS
// ===========================================

// Affiliate retailer configurations
const AFFILIATE_RETAILERS = {
  amazon: {
    name: 'Amazon',
    tag: 'rvunicorn-20', // Replace with your Amazon Associates tag
    logo: '🛒'
  },
  rei: {
    name: 'REI',
    affiliateId: 'rvunicorn', // Replace with your REI affiliate ID
    logo: '⛰️'
  },
  cabelas: {
    name: "Cabela's",
    affiliateId: 'rvunicorn',
    logo: '🎣'
  },
  walmart: {
    name: 'Walmart',
    affiliateId: 'rvunicorn',
    logo: '🏪'
  },
  backcountry: {
    name: 'Backcountry',
    affiliateId: 'rvunicorn',
    logo: '🏔️'
  }
};

// GET /api/gear-ads/affiliate/retailers - Get available retailers
router.get('/affiliate/retailers', (req, res) => {
  const retailers = Object.entries(AFFILIATE_RETAILERS).map(([key, config]) => ({
    id: key,
    name: config.name,
    logo: config.logo
  }));
  res.json(retailers);
});

// POST /api/gear-ads/affiliate/click - Track affiliate link click
router.post('/affiliate/click', optionalAuth, async (req, res) => {
  try {
    const { retailer, productUrl, gearItemId, gearAdId, productName } = req.body;
    const userId = (req as any).user?.id;
    const sessionId = req.headers['x-session-id'] as string || generateId();

    if (!retailer || !productUrl) {
      return res.status(400).json({ error: 'Missing retailer or productUrl' });
    }

    const retailerConfig = AFFILIATE_RETAILERS[retailer as keyof typeof AFFILIATE_RETAILERS];
    if (!retailerConfig) {
      return res.status(400).json({ error: 'Unknown retailer' });
    }

    // Generate affiliate URL based on retailer
    let affiliateUrl = productUrl;
    if (retailer === 'amazon') {
      const url = new URL(productUrl);
      url.searchParams.set('tag', (retailerConfig as any).tag);
      affiliateUrl = url.toString();
    }

    // Track the click
    await db.affiliateClick.create({
      data: {
        id: generateId(),
        userId: userId || null,
        gearItemId: gearItemId || null,
        gearAdId: gearAdId || null,
        retailer,
        productUrl,
        affiliateUrl,
        sessionId
      }
    });

    res.json({ affiliateUrl });
  } catch (error: any) {
    console.error('Affiliate click error:', error);
    res.status(500).json({ error: 'Failed to process affiliate click' });
  }
});

// GET /api/gear-ads/affiliate/search/:query - Get buy links for a product
router.get('/affiliate/search/:query', async (req, res) => {
  try {
    const { query } = req.params;
    const encoded = encodeURIComponent(query);

    // Return search links for each retailer
    const searchLinks = [
      {
        retailer: 'amazon',
        name: 'Amazon',
        logo: '🛒',
        searchUrl: `https://www.amazon.com/s?k=${encoded}&tag=${AFFILIATE_RETAILERS.amazon.tag}`
      },
      {
        retailer: 'rei',
        name: 'REI',
        logo: '⛰️',
        searchUrl: `https://www.rei.com/search?q=${encoded}`
      },
      {
        retailer: 'cabelas',
        name: "Cabela's",
        logo: '🎣',
        searchUrl: `https://www.cabelas.com/shop/en?q=${encoded}`
      },
      {
        retailer: 'walmart',
        name: 'Walmart',
        logo: '🏪',
        searchUrl: `https://www.walmart.com/search?q=${encoded}`
      },
      {
        retailer: 'backcountry',
        name: 'Backcountry',
        logo: '🏔️',
        searchUrl: `https://www.backcountry.com/Store/catalog/search.jsp?q=${encoded}`
      }
    ];

    res.json(searchLinks);
  } catch (error: any) {
    console.error('Affiliate search error:', error);
    res.status(500).json({ error: 'Failed to search products' });
  }
});

// ===========================================
// CAMPGROUND MARKETPLACE - Nearby Gear For Sale
// ===========================================

// GET /api/gear-ads/marketplace/nearby - Get gear for sale at current campground
router.get('/marketplace/nearby', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { campgroundId } = req.query;

    // If no campgroundId provided, try to find user's current check-in
    let targetCampgroundId = campgroundId as string;

    if (!targetCampgroundId) {
      const now = new Date();
      const currentCheckIn = await db.campgroundCheckIn.findFirst({
        where: {
          userId,
          checkInDate: { lte: now },
          checkOutDate: { gte: now }
        },
        select: { campgroundId: true }
      });

      if (currentCheckIn) {
        targetCampgroundId = currentCheckIn.campgroundId;
      }
    }

    if (!targetCampgroundId) {
      return res.json({ 
        items: [], 
        campground: null,
        message: 'Check into a campground to see gear from nearby campers' 
      });
    }

    // Get campground info
    const campground = await db.campground.findUnique({
      where: { id: targetCampgroundId },
      select: { id: true, name: true, state: true }
    });

    // Find users currently at this campground
    const now = new Date();
    const checkIns = await db.campgroundCheckIn.findMany({
      where: {
        campgroundId: targetCampgroundId,
        checkInDate: { lte: now },
        checkOutDate: { gte: now },
        userId: { not: userId }
      },
      select: {
        userId: true,
        siteNumber: true
      }
    });

    const userIds = checkIns.map((c: any) => c.userId);

    // Get gear for sale from these users
    const gearForSale = await db.gearItem.findMany({
      where: {
        userId: { in: userIds },
        forSale: true
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true
          }
        }
      },
      orderBy: { updatedAt: 'desc' }
    });

    // Add site number to each item
    const itemsWithSite = gearForSale.map((item: any) => {
      const checkIn = checkIns.find((c: any) => c.userId === item.userId);
      return {
        ...item,
        siteNumber: checkIn?.siteNumber,
        type: 'campground-sale'
      };
    });

    res.json({
      items: itemsWithSite,
      campground,
      totalSellers: new Set(userIds).size
    });
  } catch (error: any) {
    console.error('Get nearby marketplace error:', error);
    res.status(500).json({ error: 'Failed to get nearby gear' });
  }
});

// GET /api/gear-ads/marketplace/all - Get all gear for sale (global marketplace)
router.get('/marketplace/all', optionalAuth, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { category, minPrice, maxPrice, state, sort = 'recent', limit = '50', offset = '0' } = req.query;

    const where: any = {
      forSale: true
    };

    // Exclude user's own items if logged in
    if (userId) {
      where.userId = { not: userId };
    }

    if (category) {
      where.category = category;
    }

    if (minPrice) {
      where.price = { ...where.price, gte: parseFloat(minPrice as string) };
    }

    if (maxPrice) {
      where.price = { ...where.price, lte: parseFloat(maxPrice as string) };
    }

    // Sort options
    let orderBy: any = { updatedAt: 'desc' };
    if (sort === 'price_low') orderBy = { price: 'asc' };
    if (sort === 'price_high') orderBy = { price: 'desc' };

    const gearForSale = await db.gearItem.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            username: true,
            profilePicture: true,
            homeCity: true,
            homeState: true
          }
        }
      },
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string)
    });

    // Filter by seller's state if specified
    let filteredItems = gearForSale;
    if (state) {
      filteredItems = gearForSale.filter((item: any) => item.user.homeState === state);
    }

    const total = await db.gearItem.count({ where });

    res.json({
      items: filteredItems.map((item: any) => ({ ...item, type: 'user-sale' })),
      total,
      hasMore: parseInt(offset as string) + filteredItems.length < total
    });
  } catch (error: any) {
    console.error('Get marketplace error:', error);
    res.status(500).json({ error: 'Failed to get marketplace' });
  }
});

// POST /api/gear-ads/marketplace/contact - Contact seller about an item
router.post('/marketplace/contact', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).user!.id;
    const { gearItemId, message } = req.body;

    const gearItem = await db.gearItem.findUnique({
      where: { id: gearItemId },
      include: {
        user: {
          select: { id: true, firstName: true }
        }
      }
    });

    if (!gearItem) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (!gearItem.forSale) {
      return res.status(400).json({ error: 'Item is not for sale' });
    }

    if (gearItem.userId === userId) {
      return res.status(400).json({ error: 'Cannot contact yourself' });
    }

    // Find or create message thread
    let thread = await db.messageThread.findFirst({
      where: {
        OR: [
          { user1Id: userId, user2Id: gearItem.userId },
          { user1Id: gearItem.userId, user2Id: userId }
        ]
      }
    });

    if (!thread) {
      thread = await db.messageThread.create({
        data: {
          id: generateId(),
          user1Id: userId,
          user2Id: gearItem.userId
        }
      });
    }

    // Send message
    await db.message.create({
      data: {
        id: generateId(),
        threadId: thread.id,
        senderId: userId,
        content: `💰 Interested in: ${gearItem.name} ($${gearItem.price})\n\n${message || 'Is this still available?'}`
      }
    });

    // Update thread timestamp
    await db.messageThread.update({
      where: { id: thread.id },
      data: { updatedAt: new Date() }
    });

    res.json({ 
      success: true, 
      threadId: thread.id,
      message: 'Message sent to seller!' 
    });
  } catch (error: any) {
    console.error('Contact seller error:', error);
    res.status(500).json({ error: 'Failed to contact seller' });
  }
});

// ===========================================
// ADMIN / ADVERTISER ENDPOINTS
// ===========================================

// POST /api/gear-ads/admin/create-ad - Create a new ad (admin/advertiser)
router.post('/admin/create-ad', authenticateToken, async (req, res) => {
  try {
    const {
      advertiserId,
      name,
      brand,
      description,
      imageUrl,
      linkUrl,
      affiliateUrl,
      category,
      targetCampingStyles,
      bidAmount,
      dailyBudget,
      totalBudget,
      startDate,
      endDate
    } = req.body;

    // Verify advertiser exists
    const advertiser = await db.advertiser.findUnique({
      where: { id: advertiserId }
    });

    if (!advertiser) {
      return res.status(404).json({ error: 'Advertiser not found' });
    }

    const ad = await db.gearAd.create({
      data: {
        id: generateId(),
        advertiserId,
        name,
        brand,
        description,
        imageUrl,
        linkUrl,
        affiliateUrl,
        category,
        targetCampingStyles: targetCampingStyles || [],
        bidAmount,
        dailyBudget,
        totalBudget,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : null,
        isActive: true
      }
    });

    res.json(ad);
  } catch (error: any) {
    console.error('Create ad error:', error);
    res.status(500).json({ error: 'Failed to create ad' });
  }
});

// GET /api/gear-ads/admin/stats/:advertiserId - Get advertiser stats
router.get('/admin/stats/:advertiserId', authenticateToken, async (req, res) => {
  try {
    const { advertiserId } = req.params;

    const ads = await db.gearAd.findMany({
      where: { advertiserId },
      select: {
        id: true,
        name: true,
        impressions: true,
        clicks: true,
        spent: true,
        isActive: true,
        category: true
      }
    });

    const totals = ads.reduce((acc: any, ad: any) => ({
      impressions: acc.impressions + (ad.impressions || 0),
      clicks: acc.clicks + (ad.clicks || 0),
      spent: acc.spent + Number(ad.spent || 0)
    }), { impressions: 0, clicks: 0, spent: 0 });

    const ctr = totals.impressions > 0 
      ? ((totals.clicks / totals.impressions) * 100).toFixed(2) 
      : '0.00';

    res.json({
      ads,
      totals: {
        ...totals,
        ctr: `${ctr}%`,
        avgCpc: totals.clicks > 0 ? (totals.spent / totals.clicks).toFixed(2) : '0.00'
      }
    });
  } catch (error: any) {
    console.error('Get advertiser stats error:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

export default router;
