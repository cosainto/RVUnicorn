import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
const prisma = new PrismaClient() as any;

const DEFAULT_QUICK_LINKS = [
  { id: 'profile', label: 'Profile', icon: 'User', path: '/profile/{username}', color: 'green' },
  { id: 'home', label: 'Home', icon: 'Home', path: '/travel', color: 'blue' },
  { id: 'rvlog', label: 'RV Log', icon: 'Wrench', path: '/maintenance', color: 'orange' },
  { id: 'campgrounds', label: 'Campgrounds', icon: 'MapPin', path: '/campgrounds', color: 'purple' },
  { id: 'photos', label: 'Photos', icon: 'Camera', path: '/albums', color: 'pink' },
];

// GET /api/preferences - Get user preferences
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    let prefs = await prisma.userPreferences.findUnique({
      where: { userId },
    });

    if (!prefs) {
      // Create default preferences
      prefs = await prisma.userPreferences.create({
        data: {
          userId,
          quickLinks: JSON.stringify(DEFAULT_QUICK_LINKS),
        },
      });
    }

    res.json({
      quickLinks: prefs.quickLinks ? JSON.parse(prefs.quickLinks) : DEFAULT_QUICK_LINKS,
      basecampLayout: prefs.basecampLayout ? JSON.parse(prefs.basecampLayout) : null,
    });
  } catch (error: any) {
    console.error('Get preferences error:', error);
    res.status(500).json({ error: 'Failed to get preferences' });
  }
});

// PUT /api/preferences/quick-links - Update quick links order/config
router.put('/quick-links', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;
    const { quickLinks } = req.body;

    if (!Array.isArray(quickLinks)) {
      return res.status(400).json({ error: 'quickLinks must be an array' });
    }

    await prisma.userPreferences.upsert({
      where: { userId },
      update: { quickLinks: JSON.stringify(quickLinks) },
      create: {
        userId,
        quickLinks: JSON.stringify(quickLinks),
      },
    });

    res.json({ success: true, quickLinks });
  } catch (error: any) {
    console.error('Update quick links error:', error);
    res.status(500).json({ error: 'Failed to update quick links' });
  }
});

// POST /api/preferences/reset-quick-links - Reset to defaults
router.post('/reset-quick-links', authenticateToken, async (req, res) => {
  try {
    const userId = (req as any).userId;

    await prisma.userPreferences.upsert({
      where: { userId },
      update: { quickLinks: JSON.stringify(DEFAULT_QUICK_LINKS) },
      create: {
        userId,
        quickLinks: JSON.stringify(DEFAULT_QUICK_LINKS),
      },
    });

    res.json({ success: true, quickLinks: DEFAULT_QUICK_LINKS });
  } catch (error: any) {
    console.error('Reset quick links error:', error);
    res.status(500).json({ error: 'Failed to reset quick links' });
  }
});

// GET /api/preferences/available-links - Get all available link options
router.get('/available-links', authenticateToken, async (req, res) => {
  const availableLinks = [
    { id: 'profile', label: 'Profile', icon: 'User', path: '/profile/{username}', color: 'green' },
    { id: 'home', label: 'Home', icon: 'Home', path: '/travel', color: 'blue' },
    { id: 'rvlog', label: 'RV Log', icon: 'Wrench', path: '/maintenance', color: 'orange' },
    { id: 'campgrounds', label: 'Campgrounds', icon: 'MapPin', path: '/campgrounds', color: 'purple' },
    { id: 'photos', label: 'Photos', icon: 'Camera', path: '/albums', color: 'pink' },
    { id: 'events', label: 'Events', icon: 'Calendar', path: '/events', color: 'yellow' },
    { id: 'friends', label: 'Friends', icon: 'Users', path: '/friends', color: 'cyan' },
    { id: 'messages', label: 'Messages', icon: 'MessageSquare', path: '/messages', color: 'indigo' },
    { id: 'recipes', label: 'Recipes', icon: 'ChefHat', path: '/recipes', color: 'red' },
    { id: 'gear', label: 'Gear', icon: 'Backpack', path: '/gear', color: 'teal' },
    { id: 'feed', label: 'Feed', icon: 'Rss', path: '/feed', color: 'gray' },
    { id: 'groups', label: 'Groups', icon: 'UsersRound', path: '/groups', color: 'violet' },
    { id: 'jobs', label: 'Jobs', icon: 'Briefcase', path: '/jobs', color: 'amber' },
  ];
  res.json(availableLinks);
});

export default router;
